/**
 * @title Marstek VenusE MODBUS-RTU reader + Virtual Components
 * @description Reads key Marstek VenusE live MODBUS registers and
 *   updates Shelly Virtual Components for battery, AC, energy, and status data.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e_vc.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU Reader + Virtual Components
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting, UART, and Virtual
 * Components support.
 * Device compatibility: The Pill with 5-terminal RS485 add-on.
 * External hardware: Marstek Venus-E 3.0 connected through its RS485 RJ45
 * port. Use normal RJ45 pin numbering while looking into the device socket.
 *
 * Hardware Connection:
 * - Venus RJ45 pin 1 (RS485 A) -> The Pill A
 * - Venus RJ45 pin 2 (RS485 B) -> The Pill B
 * - Venus RJ45 pin 7 or 8 (GND) -> The Pill GND (recommended)
 * - Venus RJ45 pins 3 and 6 -> Leave disconnected
 * - Venus RJ45 pins 4 and 5 (+5 V) -> Leave disconnected
 *
 * Do not connect either Venus +5 V pin to The Pill. If the MODBUS bus is
 * silent, verify the RJ45 viewing orientation and wiring against this pinout;
 * do not experiment with the +5 V pins.
 *
 * Virtual Components created:
 * - group:220   Marstek VenusE
 * - number:220  Battery Voltage, 0..100 V
 * - number:221  Battery Current, -100..100 A
 * - number:222  Battery Power, -2500..2500 W
 * - number:223  Battery SOC, 0..100 %
 * - number:224  AC Voltage, 187..253 V
 * - number:225  AC Power, -2500..2500 W
 * - number:226  AC Frequency, 45..55 Hz
 * - number:227  Internal Temperature, -10..55 C
 * - number:228  Inverter State, 0..6
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This VC variant is read-only. It does not write control registers.
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


// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 115200,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
  DEBUG: false
};

var COMPONENT_IDS = {
  group: 220,
  firstNumber: 220
};

var ENTITIES = [
  { name: 'Battery Voltage', addr: 32100, qty: 1, type: 'u16', scale: 0.01, unit: 'V', min: 0, max: 100, vcId: 'number:220', vcHandle: null },
  { name: 'Battery Current', addr: 32101, qty: 1, type: 's16', scale: 0.01, unit: 'A', min: -100, max: 100, vcId: 'number:221', vcHandle: null },
  { name: 'Battery Power', addr: 32102, qty: 2, type: 's32', scale: 1, unit: 'W', min: -2500, max: 2500, vcId: 'number:222', vcHandle: null },
  { name: 'Battery SOC', addr: 32104, qty: 1, type: 'u16', scale: 1, unit: '%', min: 0, max: 100, vcId: 'number:223', vcHandle: null },
  { name: 'AC Voltage', addr: 32200, qty: 1, type: 'u16', scale: 0.1, unit: 'V', min: 187, max: 253, defaultValue: 230, vcId: 'number:224', vcHandle: null },
  { name: 'AC Power', addr: 32202, qty: 2, type: 's32', scale: 1, unit: 'W', min: -2500, max: 2500, vcId: 'number:225', vcHandle: null },
  { name: 'AC Frequency', addr: 32204, qty: 1, type: 'u16', scale: 0.1, unit: 'Hz', min: 45, max: 55, defaultValue: 50, vcId: 'number:226', vcHandle: null },
  { name: 'Internal Temperature', addr: 35000, qty: 1, type: 's16', scale: 0.1, unit: 'C', min: -10, max: 55, vcId: 'number:227', vcHandle: null },
  { name: 'Inverter State', addr: 35100, qty: 1, type: 'u16', scale: 1, unit: '', min: 0, max: 6, vcId: 'number:228', vcHandle: null }
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  isReady: false
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[venus-e-vc] ' + msg);
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  var j;

  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    for (j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc = crc >> 1;
    }
  }

  return crc & 0xFFFF;
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildReadFrame(addr, qty) {
  var frame = [
    CONFIG.SLAVE_ID & 0xFF,
    0x03,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function clearResponseTimer() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function decodePayload(payload, type) {
  var raw16;
  var hi;
  var lo;
  var value;

  if (type === 'u16' || type === 's16') {
    raw16 = (payload[0] << 8) | payload[1];
    if (type === 's16' && raw16 >= 0x8000) raw16 = raw16 - 0x10000;
    return raw16;
  }

  hi = (payload[0] << 8) | payload[1];
  lo = (payload[2] << 8) | payload[3];
  value = hi * 65536 + lo;

  if (type === 's32' && value >= 2147483648) value = value - 4294967296;
  return value;
}

function scaledValue(raw, scale) {
  var value = raw * scale;
  if (scale === 0.1) return Math.round(value * 10) / 10;
  if (scale === 0.01) return Math.round(value * 100) / 100;
  if (scale === 0.001) return Math.round(value * 1000) / 1000;
  return value;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function numberConfig(component) {
  var defaultValue = 0;
  if (component.defaultValue !== undefined) defaultValue = component.defaultValue;

  return {
    name: component.name,
    default_value: defaultValue,
    min: component.min,
    max: component.max,
    meta: {
      ui: {
        view: 'progressbar',
        unit: component.unit,
        step: component.scale < 1 ? component.scale : 1
      },
      persist: false
    }
  };
}

function componentVcKey(index) {
  return 'component' + String(index);
}

function buildVirtualComponentsManifest() {
  var manifest = { components: [] };
  var members = [];
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    ENTITIES[i].vcKey = componentVcKey(i);
    manifest.components.push({
      key: ENTITIES[i].vcKey,
      type: 'number',
      id: COMPONENT_IDS.firstNumber + i,
      config: numberConfig(ENTITIES[i])
    });
    members.push(ENTITIES[i].vcKey);
  }

  manifest.groups = [
    { id: COMPONENT_IDS.group, name: 'Marstek VenusE', components: members }
  ];

  return manifest;
}

function bindVirtualComponents(readyVc) {
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    ENTITIES[i].vcHandle = readyVc.handles[ENTITIES[i].vcKey];
  }
}

function updateVc(component, value) {
  if (!component.vcHandle) return;
  component.vcHandle.setValue(value);
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRead(entity, callback) {
  if (!state.isReady) {
    callback('Not ready', null);
    return;
  }

  if (state.pendingRequest) {
    callback('Busy', null);
    return;
  }

  state.pendingRequest = { entity: entity, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (!state.pendingRequest) return;
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    cb('Timeout', null);
  });

  state.uart.write(bytesToStr(buildReadFrame(entity.addr, entity.qty)));
}

function onReceive(data) {
  var i;
  if (!data || data.length === 0) return;

  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  var fc;
  var byteCount;
  var expectedLen;
  var frame;
  var crc;
  var recvCrc;
  var payload;
  var entity;
  var cb;

  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;
  fc = state.rxBuffer[1];

  if (fc & 0x80) {
    if (state.rxBuffer.length < 5) return;
    crc = calcCRC(state.rxBuffer.slice(0, 3));
    recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (crc !== recvCrc) return;

    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('MODBUS exception', null);
    return;
  }

  byteCount = state.rxBuffer[2];
  expectedLen = 3 + byteCount + 2;
  if (state.rxBuffer.length < expectedLen) return;

  frame = state.rxBuffer.slice(0, expectedLen);
  crc = calcCRC(frame.slice(0, expectedLen - 2));
  recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimer();
  payload = frame.slice(3, 3 + byteCount);
  entity = state.pendingRequest.entity;
  cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  cb(null, decodePayload(payload, entity.type));
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  function readNext(index) {
    var entity;

    if (index >= ENTITIES.length) {
      log('Poll complete');
      return;
    }

    entity = ENTITIES[index];
    sendRead(entity, function(err, raw) {
      if (err) {
        log(entity.name + ': ERROR (' + err + ')');
      } else {
        updateVc(entity, raw);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  readNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Marstek VenusE MODBUS-RTU reader + VC');

  state.uart = UART.get();
  if (!state.uart) {
    log('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    log('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;

  ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
    if (!ok) {
      log('ERROR: Virtual component setup failed');
      return;
    }

    bindVirtualComponents(readyVc);
    log('Polling ' + ENTITIES.length + ' registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
