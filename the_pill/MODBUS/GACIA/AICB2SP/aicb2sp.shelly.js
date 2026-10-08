/**
 * @title GACIA AICB2SP Smart IoT MCB - MODBUS-RTU reader/controller
 * @description Reads metering data (voltage, current, power, energy, frequency,
 *   power factor, temperature) and controls the breaker switch via
 *   MODBUS-RTU over RS485 from a GACIA AICB2SP smart circuit breaker.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/GACIA/AICB2SP/aicb2sp.shelly.js
 */

/**
 * GACIA AICB2SP Smart IoT MCB - MODBUS-RTU Client
 *
 * NOTE: No official register map was published by GACIA at the time this
 * script was written. The register addresses below are derived from the
 * KWS-303L / Tuya RS485 smart-breaker reference implementation and are
 * confirmed to work with devices that share the same metering firmware
 * (Tuya HS01-485-WR3 bridge). Verify against the actual device manual if
 * registers do not respond as expected - they may follow the DDS238-style
 * map instead (alternative addresses listed in comments).
 *
 * RS485 parameters (factory defaults):
 *   Baud rate  : 9600
 *   Frame      : 8N1  (try 8E1 if 8N1 does not respond)
 *   Slave ID   : 1
 *
 * Register map (FC 0x03 - Read Holding Registers):
 *
 *   Addr  Dec  Parameter        Type   Unit   Scale    Alt (DDS238-style)
 *   ----  ---  ---------------  -----  -----  -------  ------------------
 *   0x0000  0  Rated Voltage    INT16  V      /100
 *   0x0001  1  Rated Current    INT16  A      /100
 *   0x000D 13  Voltage (live)   INT16  V      /100     0x000C /10
 *   0x0011 17  Current (live)   INT16  A      /1000    0x000D /100
 *   0x0019 25  Active Power     INT16  W      /100     0x000E /1
 *   0x002F 47  Power Factor     INT16  -      /1000    0x0010 /1000
 *   0x0032 50  Frequency        INT16  Hz     /100     0x0011 /100
 *   0x0036 54  Energy Total     INT16  kWh    /1000
 *   0x003B 59  Temperature      INT16  degC   /1
 *
 * Switch control register (FC 0x06 - Write Single Register):
 *   0x003E 62  Switch ON/OFF    INT16  -      1=ON  0=OFF
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
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",          // try "8E1" if no response

    RESPONSE_TIMEOUT: 1000,   // ms
    POLL_INTERVAL: 10000,     // ms

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
    { id: 299, name: 'GACIA AICB2SP Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


/* === REGISTER MAP === */
var REG = {
    VOLTAGE:      0x000D,  // V / 100
    CURRENT:      0x0011,  // A / 1000
    ACTIVE_POWER: 0x0019,  // W / 100
    POWER_FACTOR: 0x002F,  // / 1000
    FREQUENCY:    0x0032,  // Hz / 100
    ENERGY:       0x0036,  // kWh / 1000
    TEMPERATURE:  0x003B,  // degC
    SWITCH:       0x003E   // write: 1=ON, 0=OFF
};

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
    if (CONFIG.DEBUG) print("[AICB2SP] " + msg);
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

/** Sign-extend a 16-bit unsigned value to a signed integer */
function toInt16(val) {
    return (val & 0x8000) ? (val - 0x10000) : val;
}

/** Format a number to N decimal places as a string */
function fmt(val, decimals) {
    var factor = 1;
    for (var i = 0; i < decimals; i++) factor *= 10;
    var sign = val < 0 ? "-" : "";
    val = Math.abs(val);
    var whole = Math.floor(val);
    var frac = Math.round((val - whole) * factor);
    if (frac >= factor) { whole++; frac = 0; }
    var fracStr = frac.toString();
    while (fracStr.length < decimals) fracStr = "0" + fracStr;
    return sign + whole + (decimals > 0 ? "." + fracStr : "");
}

/* === MODBUS CORE === */

function buildReadFrame(slave, fc, regAddr, qty) {
    var frame = [
        slave & 0xFF, fc & 0xFF,
        (regAddr >> 8) & 0xFF, regAddr & 0xFF,
        (qty >> 8) & 0xFF, qty & 0xFF
    ];
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

function buildWriteFrame(slave, regAddr, value) {
    var frame = [
        slave & 0xFF, 0x06,
        (regAddr >> 8) & 0xFF, regAddr & 0xFF,
        (value >> 8) & 0xFF, value & 0xFF
    ];
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

function sendRequest(frame, callback) {
    if (!state.isReady) { callback("Not ready", null); return; }
    if (state.pendingRequest) { callback("Busy", null); return; }

    debug("TX: " + bytesToHex(frame));

    state.pendingRequest = { fc: frame[1], callback: callback };
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

    // Exception response
    if (fc & 0x80) {
        if (state.rxBuffer.length < 5) return;
        var excCrc = calcCRC(state.rxBuffer.slice(0, 3));
        if (excCrc === (state.rxBuffer[3] | (state.rxBuffer[4] << 8))) {
            clearResponseTimer();
            var exCode = state.rxBuffer[2];
            var cb = state.pendingRequest.callback;
            state.pendingRequest = null;
            state.rxBuffer = [];
            cb("Exception 0x" + toHex(exCode), null);
        }
        return;
    }

    // FC 0x06 write response: 8 bytes echo
    if ((fc & 0x7F) === 0x06) {
        if (state.rxBuffer.length < 8) return;
        var wFrame = state.rxBuffer.slice(0, 8);
        var wCrc = calcCRC(wFrame.slice(0, 6));
        var wRecv = wFrame[6] | (wFrame[7] << 8);
        if (wCrc !== wRecv) { debug("CRC error (write)"); return; }
        debug("RX: " + bytesToHex(wFrame));
        clearResponseTimer();
        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        cb(null, null);
        return;
    }

    // FC 0x03/0x04 read response
    if (state.rxBuffer.length < 3) return;
    var byteCount = state.rxBuffer[2];
    var expectedLen = 3 + byteCount + 2;
    if (state.rxBuffer.length < expectedLen) return;

    var rFrame = state.rxBuffer.slice(0, expectedLen);
    var rCrc = calcCRC(rFrame.slice(0, expectedLen - 2));
    var rRecv = rFrame[expectedLen - 2] | (rFrame[expectedLen - 1] << 8);
    if (rCrc !== rRecv) { debug("CRC error"); return; }

    debug("RX: " + bytesToHex(rFrame));
    clearResponseTimer();

    var payload = rFrame.slice(3, 3 + byteCount);
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

/* === AICB2SP API === */

/**
 * Read a single holding register (FC 0x03).
 * @param {number} regAddr - Register address
 * @param {function} callback - callback(error, raw_uint16)
 */
function readRegister(regAddr, callback) {
    var frame = buildReadFrame(getSlaveId(), 0x03, regAddr, 1);
    sendRequest(frame, function(err, data) {
        if (err) { callback(err, null); return; }
        callback(null, (data[0] << 8) | data[1]);
    });
}

/**
 * Write a single holding register (FC 0x06).
 * @param {number} regAddr - Register address
 * @param {number} value   - 16-bit value
 * @param {function} callback - callback(error)
 */
function writeRegister(regAddr, value, callback) {
    var frame = buildWriteFrame(getSlaveId(), regAddr, value);
    sendRequest(frame, function(err) {
        callback(err);
    });
}

/**
 * Read voltage in Volts (scale: raw / 100).
 * @param {function} callback - callback(error, voltage_V)
 */
function readVoltage(callback) {
    readRegister(REG.VOLTAGE, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 100.0);
    });
}

/**
 * Read current in Amperes (scale: raw / 1000).
 * @param {function} callback - callback(error, current_A)
 */
function readCurrent(callback) {
    readRegister(REG.CURRENT, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 1000.0);
    });
}

/**
 * Read active power in Watts (scale: raw / 100).
 * @param {function} callback - callback(error, power_W)
 */
function readActivePower(callback) {
    readRegister(REG.ACTIVE_POWER, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 100.0);
    });
}

/**
 * Read power factor (scale: raw / 1000).
 * @param {function} callback - callback(error, pf)
 */
function readPowerFactor(callback) {
    readRegister(REG.POWER_FACTOR, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 1000.0);
    });
}

/**
 * Read frequency in Hz (scale: raw / 100).
 * @param {function} callback - callback(error, frequency_Hz)
 */
function readFrequency(callback) {
    readRegister(REG.FREQUENCY, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 100.0);
    });
}

/**
 * Read total energy in kWh (scale: raw / 1000).
 * @param {function} callback - callback(error, energy_kWh)
 */
function readEnergy(callback) {
    readRegister(REG.ENERGY, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw) / 1000.0);
    });
}

/**
 * Read breaker temperature in degC.
 * @param {function} callback - callback(error, temperature_C)
 */
function readTemperature(callback) {
    readRegister(REG.TEMPERATURE, function(err, raw) {
        if (err) { callback(err, null); return; }
        callback(null, toInt16(raw));
    });
}

/**
 * Turn the breaker ON (write 1 to switch register).
 * @param {function} callback - callback(error)
 */
function switchOn(callback) {
    writeRegister(REG.SWITCH, 1, function(err) {
        if (!err) print("[AICB2SP] Breaker switched ON");
        callback(err);
    });
}

/**
 * Turn the breaker OFF (write 0 to switch register).
 * @param {function} callback - callback(error)
 */
function switchOff(callback) {
    writeRegister(REG.SWITCH, 0, function(err) {
        if (!err) print("[AICB2SP] Breaker switched OFF");
        callback(err);
    });
}

/* === POLL === */

/**
 * Sequential poll: voltage -> current -> power -> pf -> freq -> energy -> temp.
 * Each step runs only if the previous succeeded.
 */
function poll() {
    readVoltage(function(err, v) {
        if (err) { print("[AICB2SP] Voltage error: " + err); return; }
        readCurrent(function(err, a) {
            if (err) { print("[AICB2SP] Current error: " + err); return; }
            readActivePower(function(err, w) {
                if (err) { print("[AICB2SP] Power error: " + err); return; }
                readPowerFactor(function(err, pf) {
                    if (err) { print("[AICB2SP] PF error: " + err); return; }
                    readFrequency(function(err, hz) {
                        if (err) { print("[AICB2SP] Freq error: " + err); return; }
                        readEnergy(function(err, kwh) {
                            if (err) { print("[AICB2SP] Energy error: " + err); return; }
                            readTemperature(function(err, c) {
                                if (err) { print("[AICB2SP] Temp error: " + err); return; }
                                print(
                                    "[AICB2SP]" +
                                    " V=" + fmt(v, 1) + "V" +
                                    " I=" + fmt(a, 3) + "A" +
                                    " P=" + fmt(w, 1) + "W" +
                                    " PF=" + fmt(pf, 3) +
                                    " F=" + fmt(hz, 2) + "Hz" +
                                    " E=" + fmt(kwh, 3) + "kWh" +
                                    " T=" + c + "C"
                                );
                            });
                        });
                    });
                });
            });
        });
    });
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

    print("GACIA AICB2SP Smart MCB");
    print("=======================");
    print("Slave: " + getSlaveId() + "  Baud: " + CONFIG.BAUD_RATE + "  Mode: " + CONFIG.MODE);
    print("");

    state.uart = UART.get();
    if (!state.uart) { print("ERROR: UART not available"); return; }

    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print("ERROR: UART configure failed");
        return;
    }

    state.uart.recv(onReceive);
    state.isReady = true;

    print("Polling every " + (CONFIG.POLL_INTERVAL / 1000) + "s");
    print("Call switchOn() / switchOff() to control the breaker.");
    print("");

    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);

    });
}

init();
