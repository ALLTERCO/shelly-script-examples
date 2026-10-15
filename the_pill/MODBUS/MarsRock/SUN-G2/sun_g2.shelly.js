/**
 * @title MarsRock G2 SUN Series Grid-Tie Inverter - MODBUS-RTU reader
 * @description Reads AC output power, AC grid voltage, DC input voltage, and
 *   temperature from a MarsRock G2 (Generation 2) SUN Series grid-tie
 *   micro-inverter over MODBUS-RTU and prints values to the console.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/MarsRock/SUN-G2/sun_g2.shelly.js
 */

/**
 * MarsRock G2 (Generation 2) SUN Series Grid-Tie Micro-Inverter
 * MODBUS-RTU Reader
 *
 * Communication parameters (factory defaults):
 *   Slave ID  : 1  (configurable 1–16 via jumpers J1–J4 on the RS485 module)
 *   Baud rate : 9600
 *   Mode      : 8N1
 *
 * Register map (FC 0x03 – Read Holding Registers):
 *
 *   Addr (dec)  Name                  Type    Scale  Unit   Access  Notes
 *   ----------  --------------------  ------  -----  -----  ------  ----------------------
 *   1  (0x01)   AC Output Power       UINT16  ×10    W      R       Displayed AC output power; byte order LE
 *   4  (0x04)   DAC Value             UINT16  raw    -      R/W     Analog control output (0–33187)
 *   63 (0x3F)   Temperature           UINT16  1      °C     R       Inverter temperature; subtract 2 for °C
 *   70 (0x46)   AC Grid Voltage       UINT16  ×10    V      R       Grid (AC) voltage
 *   109 (0x6D)  DC Input Voltage      UINT16  ×10    V      R       Solar panel / DC bus voltage
 *
 * Example frame (read AC output power, register 0x01, slave 0x01):
 *   TX: 01 03 00 01 00 01 D5 CA
 *   RX: 01 03 02 03 E8 xx xx  -> 0x03E8 = 1000 → 100.0 W
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
 * Reference:
 *   https://marsrock.com.cn/u_file/2405/09/file/G2SeriesMicroinverterSolarUserManual.pdf
 *   https://github.com/trucki-eu/RS485-Interface-for-Sun-GTIL2-1000
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",
    RESPONSE_TIMEOUT: 1000,
    POLL_INTERVAL: 10000,
    DEBUG: false
};

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state2 = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print('[VC] ' + msg);
  }

  function componentKey(type, id) {
    return type + ':' + String(id);
  }

  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === 'meta') {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === 'object' && desired[k] !== null) {
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

    for (i = 0; i < state2.existing.length; i++) {
      c = state2.existing[i];
      if (c.type === type && c.name === name) return c;
    }

    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state2.ids[spec.key] = id;
    state2.keys[spec.key] = key;
    state2.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    var id;

    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
        state2.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state2.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log('Created ' + state2.keys[spec.key] + ' ' + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        cb(true);
      });
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

        log('Recreating mismatched ' + key + ' ' + spec.config.name);
        deleteComponent(key, function() {
          addComponent(spec, cb);
        });
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
      log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
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
    return { name: name, meta: { ui: { view: 'group' } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state2.keys[logicalKey]) members.push(state2.keys[logicalKey]);
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
    key = componentKey('group', group.id);
    current = getConfig('group', group.id);

    function setMembersAndContinue() {
      Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state2.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() {
          ensureGroup(index + 1, cb);
        });
      });
    }

    function addGroup() {
      Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state2.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() {
            ensureGroup(index + 1, cb);
          });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg));
        state2.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || '').split(':');
        state2.existing.push({
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
        done(state2.ok, {
          ids: state2.ids,
          keys: state2.keys,
          handles: state2.handles
        });
      });
    });
  });
}

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 1;
var slaveIdHandle = null;

function getSlaveId() {
  var value = DEFAULT_SLAVE_ID;

  if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
  if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
  value = Math.round(value);
  if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
  if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

  if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
    slaveIdHandle.setValue(value);
  }

  return value;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// This script prints all values to the console; only the Modbus Slave ID is
// backed by a Virtual Component (it is configuration, not sensor data).

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'slaveId',
      type: 'number',
      id: 299,
      config: {
        name: 'Modbus Slave ID',
        min: MIN_SLAVE_ID,
        max: MAX_SLAVE_ID,
        default_value: DEFAULT_SLAVE_ID,
        persisted: true,
        meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    { id: 299, name: 'MarsRock SUN-G2 Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


/* === REGISTER MAP === */
var ENTITIES = [
    { key: "AC_OUTPUT_POWER",   name: "AC Output Power",   units: "W",  reg: { addr: 0x01, rtype: 0x03, itype: "u16", bo: "LE", wo: "BE" }, scale: 0.1, rights: "R",  vcId: null, handle: null, vcHandle: null },
    { key: "AC_GRID_VOLTAGE",   name: "AC Grid Voltage",   units: "V",  reg: { addr: 70,   rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 0.1, rights: "R",  vcId: null, handle: null, vcHandle: null },
    { key: "DC_INPUT_VOLTAGE",  name: "DC Input Voltage",  units: "V",  reg: { addr: 109,  rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 0.1, rights: "R",  vcId: null, handle: null, vcHandle: null },
    { key: "DAC_VALUE",         name: "DAC Value",         units: "-",  reg: { addr: 0x04, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1,   rights: "RW", vcId: null, handle: null, vcHandle: null },
    { key: "TEMPERATURE",       name: "Temperature",       units: "C",  reg: { addr: 63,   rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1,   offset: 2, rights: "R",  vcId: null, handle: null, vcHandle: null },
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
    uart: null,
    rxBuffer: [],
    isReady: false,
    pendingRequest: null,
    responseTimer: null,
    pollTimer: null
};

/* === HELPERS === */

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        if (i > 0) s += " ";
        s += toHex(bytes[i]);
    }
    return s;
}

function debug(msg) {
    if (CONFIG.DEBUG) print("[SUN-G2] " + msg);
}

function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return crc;
}

function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
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

function sendRequest(regAddr, qty, callback) {
    if (!state.isReady) { callback("Not ready", null); return; }
    if (state.pendingRequest) { callback("Busy", null); return; }

    var frame = buildFrame(getSlaveId(), 0x03, regAddr, qty);
    debug("TX: " + bytesToHex(frame));

    state.pendingRequest = { callback: callback };
    state.rxBuffer = [];

    state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
        if (!state.pendingRequest) return;
        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        debug("Timeout");
        cb("Timeout", null);
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
                cb("Exception 0x" + toHex(exCode), null);
            }
        }
        return;
    }

    if (state.rxBuffer.length < 3) return;
    var byteCount = state.rxBuffer[2];
    var expectedLen = 3 + byteCount + 2;
    if (state.rxBuffer.length < expectedLen) return;

    var frame = state.rxBuffer.slice(0, expectedLen);
    var crc = calcCRC(frame.slice(0, expectedLen - 2));
    var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
    if (crc !== recvCrc) { debug("CRC error"); return; }

    debug("RX: " + bytesToHex(frame));
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

/* === SUN-G2 API === */

/**
 * Read a single holding register (FC 0x03).
 * @param {number} addr - Register address
 * @param {function} callback - callback(error, rawValue)
 */
function readRegister(addr, callback) {
    sendRequest(addr, 1, function(err, data) {
        if (err) { callback(err, null); return; }
        callback(null, (data[0] << 8) | data[1]);
    });
}

/* === POLL === */

function poll() {
    var results = [];

    function readNext(index) {
        if (index >= ENTITIES.length) {
            print("--- MarsRock SUN-G2 ---");
            for (var i = 0; i < results.length; i++) print(results[i]);
            print("");
            return;
        }

        var e = ENTITIES[index];
        readRegister(e.reg.addr, function(err, raw) {
            if (err) {
                results.push(e.name + ": ERROR (" + err + ")");
            } else {
                var val = raw * e.scale;
                results.push(e.name + ": " + val + " " + e.units);
            }
            Timer.set(50, false, function() { readNext(index + 1); });
        });
    }

    readNext(0);
}

/* === INIT === */

function init() {
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
      if (!ok) {
        print('ERROR: Virtual component setup failed');
        return;
      }
      vcHandles = readyVc.handles;
      slaveIdHandle = readyVc.handles.slaveId;
      slaveIdHandle.on('change', function() {
        debug('Slave ID changed -> ' + getSlaveId());
      });

    print("MarsRock G2 SUN Series Grid-Tie Inverter");
    print("=========================================");
    print("Slave: " + getSlaveId() +
          "  Baud: " + CONFIG.BAUD_RATE +
          "  Mode: " + CONFIG.MODE);
    print("");

    state.uart = UART.get();
    if (!state.uart) { print("ERROR: UART not available"); return; }

    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print("ERROR: UART configure failed");
        return;
    }

    state.uart.recv(onReceive);
    state.isReady = true;

    print("Polling " + ENTITIES.length + " parameters every " + (CONFIG.POLL_INTERVAL / 1000) + "s");
    print("");

    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);

    });
}

init();
