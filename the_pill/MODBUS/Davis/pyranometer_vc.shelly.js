/**
 * @title Davis Pyranometer MODBUS-RTU Reader + Virtual Components
 * @description MODBUS-RTU reader for a Davis-compatible RS-485 pyranometer with
 *   Virtual Component updates. Reads solar irradiance and pushes the value to a
 *   user-defined virtual number component.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Davis/pyranometer_vc.shelly.js
 */

/**
 * Davis Pyranometer - MODBUS-RTU Reader + Virtual Components for Shelly (The Pill)
 *
 * Discovered parameters (use modbus_scan to re-confirm):
 *   Slave ID : 1
 *   Baud rate: 9600
 *   Mode     : 8N1
 *
 * Register map (FC 0x04 - Read Input Registers):
 *   Addr 0x0000 - Solar Irradiance  UINT16  W/m2   (0 - 2000)
 *
 * Script-owned Virtual Component mapping:
 *   number:200  Solar Irradiance    W/m2
 *
 * The Pill 5-Terminal Add-on wiring:
 *
 *                         |=============|              |==============|
 *                    /====|         VCC |              |              |
 *                    |    | GND     GND |              | SLAVE DEVICE |
 * /========\         |    | TX      +5V |              |              |
 * |The Pill|-----=||||    | RX        A |------\/------| A            |
 * \========/         |    | RE/DE     B |------/\------| B            |
 *                    |    | +5V       A |              |              |
 *                    \====|           B |              |              |
 *                         |=============|              |==============|
 *
 * Reference: https://www.meteo-shopping.com/en/sensors/90-pyranometer-for-measuring-solar-radiation.html
 */

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================
//
// Usage:
//
// var VIRTUAL_COMPONENTS = {
//   components: [
//     {
//       key: "soc",
//       type: "number",
//       id: 200, // optional; when omitted the helper creates the next free one
//       config: {
//         name: "Battery SOC",
//         min: 0,
//         max: 100,
//         unit: "%",
//         meta: { ui: { view: "progressbar" }, cloud: ["measurement"] }
//       }
//     },
//     {
//       key: "status",
//       type: "text",
//       config: {
//         name: "Status",
//         default_value: "",
//         persisted: false,
//         meta: { ui: { view: "label", maxLength: 255 }, cloud: ["log"] }
//       }
//     }
//   ],
//   groups: [
//     { id: 200, name: "Battery", components: ["soc", "status"] }
//   ]
// };
//
// ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, vc) {
//   if (!ok) {
//     print("Virtual Component setup failed");
//     return;
//   }
//
//   vc.handles.soc.setValue(73);
//   vc.handles.status.setValue("ready");
// });
//
// Notes:
// - `key` is only the logical name inside your script.
// - `type` is a Shelly dynamic component type: number, boolean, text, enum,
//   button, group.
// - For fixed IDs, the helper checks whether the existing component config
//   matches. If not, it deletes and recreates it.
// - Without fixed IDs, the helper searches by type + config.name. If a matching
//   component exists and fits the config, it reuses it. If not, it creates a new
//   component and stores the assigned id.
// - The callback receives `vc.ids[key]`, `vc.keys[key]`, and `vc.handles[key]`.
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print("[VC] " + msg);
  }

  function componentKey(type, id) {
    return type + ":" + String(id);
  }


  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === "meta") {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === "object" && desired[k] !== null) {
        if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
      } else if (desired[k] !== current[k]) {
        return false;
      }
    }

    return true;
  }

  function normalizeComponent(spec) {
    if (!spec.config) spec.config = {};
    if (!spec.config.name) spec.config.name = spec.key;
    return spec;
  }

  function findExistingByName(type, name) {
    var i;
    var c;
    for (i = 0; i < state.existing.length; i++) {
      c = state.existing[i];
      if (c.type === type && c.name === name) return c;
    }
    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state.ids[spec.key] = id;
    state.keys[spec.key] = key;
    state.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call("Virtual.Delete", { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log("Virtual.Delete skipped for " + key + ": " + String(errCode) + " " + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call("Virtual.Add", params, function(res, errCode, errMsg) {
      var id;

      if (errCode !== 0) {
        log("Virtual.Add failed for " + spec.key + ": " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log("Virtual.Add did not return id for " + spec.key);
        state.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log("Created " + state.keys[spec.key] + " " + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() { cb(true); });
    });
  }

  function ensureOne(spec, cb) {
    var current;
    var existing;
    var key;

    spec = normalizeComponent(spec);

    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);

      if (current) {
        if (shallowConfigMatches(spec.config, current)) {
          remember(spec, spec.id);
          cb(true);
          return;
        }

        log("Recreating mismatched " + key + " " + spec.config.name);
        deleteComponent(key, function() { addComponent(spec, cb); });
        return;
      }

      addComponent(spec, cb);
      return;
    }

    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) {
      remember(spec, existing.id);
      cb(true);
      return;
    }

    if (existing) {
      log("Existing " + existing.key + " does not fit " + spec.config.name + "; creating a new one");
    }
    addComponent(spec, cb);
  }

  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) {
      cb();
      return;
    }

    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        ensureList(index + 1, cb);
      });
    });
  }

  function createGroupConfig(name) {
    return { name: name, meta: { ui: { view: "group" } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state.keys[logicalKey]) members.push(state.keys[logicalKey]);
    }

    return members;
  }

  function ensureGroup(index, cb) {
    var groups = manifest.groups || [];
    var group;
    var cfg;
    var current;
    var key;

    if (index >= groups.length) {
      cb();
      return;
    }

    group = groups[index];
    cfg = createGroupConfig(group.name);
    key = componentKey("group", group.id);
    current = getConfig("group", group.id);

    function setMembersAndContinue() {
      Shelly.call("Group.Set", { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Group.Set failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    function addGroup() {
      Shelly.call("Virtual.Add", { type: "group", id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Virtual.Add group failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log("Shelly.GetComponents failed: " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || "").split(":");
        state.existing.push({
          key: c.key || componentKey(c.type || keyParts[0], cfg.id),
          type: c.type || keyParts[0],
          id: cfg.id,
          name: cfg.name,
          config: cfg
        });
      }

      if (offset + raw.length < total && raw.length > 0) {
        readExistingPage(offset + raw.length, cb);
      } else {
        cb();
      }
    });
  }

  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() {
        done(state.ok, {
          ids: state.ids,
          keys: state.keys,
          handles: state.handles
        });
      });
    });
  });
}


/* === CONFIG === */
var AUTO_VC_GROUP_ID = null;
var AUTO_VC_GROUP_NAME = 'Davis Pyranometer MODBUS-RTU Reader';

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 5000,
  DEBUG: false
};

/* === ENTITIES === */
var ENTITIES = [
  {
    name:     'Solar Irradiance',
    units:    'W/m2',
    reg:      { addr: 0x0000, rtype: 0x04, itype: 'u16', bo: 'BE', wo: 'BE' },
    scale:    1,      // raw value is already in W/m2
    rights:   'R',
    vcId:     'number:200',
    vcHandle: null
  }
];

/* === CRC-16 TABLE (MODBUS polynomial 0xA001) === */
var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
];

/* === STATE === */
var state = {
  uart:           null,
  rxBuffer:       [],
  isReady:        false,
  pendingRequest: null,
  responseTimer:  null,
  pollTimer:      null
};

/* === HELPERS === */

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    s += toHex(bytes[i]);
    if (i < bytes.length - 1) s += ' ';
  }
  return s;
}

function debug(msg) {
  if (CONFIG.DEBUG) print('[PYR] ' + msg);
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function bytesToStr(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

/* === VIRTUAL COMPONENT === */

function updateVc(entity, value) {
  if (!entity || !entity.vcHandle) return;
  entity.vcHandle.setValue(value);
  debug(entity.name + ' -> ' + value + ' [' + entity.units + ']');
}


// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function parseVcKey(key) {
  var parts = String(key).split(':');
  return { type: parts[0], id: Number(parts[1]) };
}

function entityVcKey(index) {
  return 'entity' + String(index);
}

function entityVcConfig(entity, type) {
  var unit = entity.units || entity.unit || '';
  var ui = {
    view: type === 'boolean' ? 'label' : 'label'
  };

  if (unit && unit !== '-') ui.unit = unit;

  if (type === 'boolean') {
    ui.titles = { 'false': 'off', 'true': 'on' };
    return {
      name: entity.name,
      default_value: false,
      meta: { ui: ui, cloud: ['log'] }
    };
  }

  return {
    name: entity.name,
    default_value: 0,
    min: entity.min !== undefined ? entity.min : -999999999999999,
    max: entity.max !== undefined ? entity.max : 999999999999999,
    meta: { ui: ui, cloud: ['measurement'] }
  };
}

function buildVirtualComponentsManifest() {
  var manifest = { components: [] };
  var groupMembers = [];
  var i;
  var entity;
  var parsed;
  var key;

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    if (!entity.vcId) continue;

    parsed = parseVcKey(entity.vcId);
    key = entityVcKey(i);
    entity.vcKey = key;
    manifest.components.push({
      key: key,
      type: parsed.type,
      id: parsed.id,
      config: entityVcConfig(entity, parsed.type)
    });
    groupMembers.push(key);
  }

  if (AUTO_VC_GROUP_ID !== null && groupMembers.length > 0) {
    manifest.groups = [
      { id: AUTO_VC_GROUP_ID, name: AUTO_VC_GROUP_NAME, components: groupMembers }
    ];
  }

  return manifest;
}

function bindEntityVirtualComponents(readyVc) {
  var i;
  var entity;

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    if (!entity.vcKey) continue;
    entity.vcHandle = readyVc.handles[entity.vcKey];
    debug('VC handle for ' + entity.name + ' -> ' + entity.vcId);
  }
}

/* === MODBUS CORE === */

function buildFrame(slaveAddr, fc, regAddr, qty) {
  var frame = [
    slaveAddr & 0xFF, fc & 0xFF,
    (regAddr >> 8) & 0xFF, regAddr & 0xFF,
    (qty >> 8) & 0xFF, qty & 0xFF
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function sendRequest(fc, regAddr, qty, callback) {
  if (!state.isReady) { callback('Not initialised', null); return; }
  if (state.pendingRequest) { callback('Request pending', null); return; }

  var frame = buildFrame(CONFIG.SLAVE_ID, fc, regAddr, qty);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      debug('Timeout');
      cb('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!data || data.length === 0) return;
  for (var i = 0; i < data.length; i++) {
    state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  }
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) { state.rxBuffer = []; return; }
  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];

  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
      var excCrc = calcCRC(state.rxBuffer.slice(0, 3));
      var recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
      if (excCrc === recvCrc) {
        clearResponseTimer();
        var exCode = state.rxBuffer[2];
        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        cb('Exception 0x' + toHex(exCode), null);
      }
    }
    return;
  }

  var byteCount = state.rxBuffer[2];
  var expectedLen = 3 + byteCount + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) { debug('CRC error'); return; }

  debug('RX: ' + bytesToHex(frame));
  clearResponseTimer();

  var payload = frame.slice(3, 3 + byteCount);
  var cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  cb(null, payload);
}

function clearResponseTimer() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

/* === PYRANOMETER API === */

/**
 * Read solar irradiance.
 * @param {function} callback - callback(error, irradiance_Wm2)
 */
function readIrradiance(callback) {
  var ent = ENTITIES[0];
  sendRequest(ent.reg.rtype, ent.reg.addr, 1, function(err, data) {
    if (err) { callback(err, null); return; }
    var raw = (data[0] << 8) | data[1];
    callback(null, raw * ent.scale);
  });
}

/* === POLL === */

function poll() {
  readIrradiance(function(err, irr) {
    if (err) {
      print('[PYR] Error: ' + err);
      return;
    }
    print('[PYR] Irradiance: ' + irr + ' W/m2');
    updateVc(ENTITIES[0], irr);
  });
}

/* === INIT === */

function startApp() {
  print('Davis Pyranometer - MODBUS-RTU Reader + Virtual Components');
  print('===========================================================');

  state.uart = UART.get();
  if (!state.uart) { print('ERROR: UART not available'); return; }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configure failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;

  debug('UART: ' + CONFIG.BAUD_RATE + ' baud, ' + CONFIG.MODE);
  debug('Slave ID: ' + CONFIG.SLAVE_ID);
  print('Poll: ' + (CONFIG.POLL_INTERVAL / 1000) + ' s');
  print('');

  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
}

ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
  if (!ok) {
    print('ERROR: Virtual component setup failed');
    return;
  }

  bindEntityVirtualComponents(readyVc);
  startApp();
});
