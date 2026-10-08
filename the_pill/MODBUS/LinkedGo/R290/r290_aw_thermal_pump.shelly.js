/**
 * @title LinkedGo R290 A/W Thermal Pump MODBUS example
 * @description MODBUS-RTU polling and basic control example for LinkedGo
 *   R290 air-to-water thermal pumps via RS485 on The Pill.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/LinkedGo/r290_aw_thermal_pump.shelly.js
 */

/**
 * LinkedGo R290 A/W Thermal Pump - MODBUS RTU Example
 *
 * Source protocol file:
 *   R290 A_W modbus protocol.xlsx
 *
 * Transport defaults from protocol:
 *   - Baud rate: 9600
 *   - Framing: 8N1
 *   - Slave ID: 0x10 (decimal 16)
 *
 * The protocol document labels function usage as "03/16" for many holding
 * registers (read/write). This script reads with FC03 and writes with FC06
 * (single register), which is typically accepted for single-word settings.
 *
 * Data type notes from protocol:
 *   - TEMP1 values are signed 16-bit with 0.1 degC scale
 *   - Value 32767 indicates sensor failure
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
 * Example API calls from this script console:
 *   setPower(true);        // register 1011
 *   setMode(1);            // register 1012 (1=heating)
 *   setHotWaterTarget(50); // register 1157
 *   setHeatingTarget(42);  // register 1158
 *   setCoolingTarget(10);  // register 1159
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  RESPONSE_TIMEOUT: 1200,
  POLL_INTERVAL_MS: 12000,
  DEBUG: true
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
var DEFAULT_SLAVE_ID = 16;
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
    { id: 299, name: 'LinkedGo R290 Thermal Pump Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


// ============================================================================
// REGISTER DEFINITIONS
// ============================================================================

var ENTITIES = [
  // Read/write control registers
  { key: 'SYSTEM_STATE', name: 'System State', units: '-', reg: { addr: 1011, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'RW' },
  { key: 'MODE', name: 'Mode', units: '-', reg: { addr: 1012, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'RW' },
  { key: 'HOT_WATER_TARGET', name: 'Hot Water Target', units: 'degC', reg: { addr: 1157, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'RW' },
  { key: 'HEATING_TARGET', name: 'Heating Target', units: 'degC', reg: { addr: 1158, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'RW' },
  { key: 'COOLING_TARGET', name: 'Cooling Target', units: 'degC', reg: { addr: 1159, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'RW' },

  // Read-only status registers
  { key: 'RUNNING_MODE', name: 'Running Mode', units: '-', reg: { addr: 2012, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'LOAD_OUTPUT', name: 'Load Output Bitmask', units: '-', reg: { addr: 2019, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'SWITCH_STATE', name: 'Switch State Bitmask', units: '-', reg: { addr: 2034, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },

  { key: 'HEAT_RETURN_TEMP', name: 'Heating Return Water Temp', units: 'degC', reg: { addr: 2035, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'HEAT_OUTLET_TEMP', name: 'Heating Outlet Water Temp', units: 'degC', reg: { addr: 2036, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'INLET_WATER_TEMP', name: 'Inlet Water Temp', units: 'degC', reg: { addr: 2045, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'OUTLET_WATER_TEMP', name: 'Outlet Water Temp', units: 'degC', reg: { addr: 2046, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'DHW_TANK_TEMP', name: 'DHW Tank Water Temp', units: 'degC', reg: { addr: 2047, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'AMBIENT_TEMP', name: 'Ambient Temp', units: 'degC', reg: { addr: 2048, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'COIL_TEMP', name: 'Coil Temp', units: 'degC', reg: { addr: 2049, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'SUCTION_TEMP', name: 'Suction Temp', units: 'degC', reg: { addr: 2051, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'DISCHARGE_TEMP', name: 'Discharge Temp', units: 'degC', reg: { addr: 2053, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'ANTI_FREEZE_TEMP', name: 'Anti-Freeze Temp', units: 'degC', reg: { addr: 2055, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },
  { key: 'ROOM_TEMP', name: 'Room Temp', units: 'degC', reg: { addr: 2058, rtype: 0x03, itype: 'i16' }, scale: 0.1, rights: 'R' },

  { key: 'COMPRESSOR_FREQ_SET', name: 'Compressor Frequency Set', units: 'Hz', reg: { addr: 2071, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'COMPRESSOR_FREQ_RUN', name: 'Compressor Frequency Running', units: 'Hz', reg: { addr: 2072, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'DC_FAN1_SPEED', name: 'DC Fan 1 Speed', units: 'rpm', reg: { addr: 2074, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'DC_FAN2_SPEED', name: 'DC Fan 2 Speed', units: 'rpm', reg: { addr: 2075, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'WATER_FLOW', name: 'Water Flow', units: 'raw', reg: { addr: 2077, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },

  { key: 'FAILURE_1', name: 'Failure 1 Bitmask', units: '-', reg: { addr: 2085, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_2', name: 'Failure 2 Bitmask', units: '-', reg: { addr: 2086, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_3', name: 'Failure 3 Bitmask', units: '-', reg: { addr: 2087, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_4', name: 'Failure 4 Bitmask', units: '-', reg: { addr: 2088, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_5', name: 'Failure 5 Bitmask', units: '-', reg: { addr: 2089, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_6', name: 'Failure 6 Bitmask', units: '-', reg: { addr: 2090, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_7', name: 'Failure 7 Bitmask', units: '-', reg: { addr: 2081, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_8', name: 'Failure 8 Bitmask', units: '-', reg: { addr: 2082, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' },
  { key: 'FAILURE_9', name: 'Failure 9 Bitmask', units: '-', reg: { addr: 2083, rtype: 0x03, itype: 'u16' }, scale: 1, rights: 'R' }
];

var REG = {};
var i;
for (i = 0; i < ENTITIES.length; i++) {
  REG[ENTITIES[i].key] = ENTITIES[i].reg.addr;
}

// ============================================================================
// MODBUS CORE
// ============================================================================

var FC = {
  READ_HOLDING_REGISTERS: 0x03,
  WRITE_SINGLE_REGISTER: 0x06
};

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  isReady: false
};

function debug(msg) {
  if (CONFIG.DEBUG) print('[R290] ' + msg);
}

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var s = '';
  for (var j = 0; j < bytes.length; j++) {
    s += toHex(bytes[j]);
    if (j < bytes.length - 1) s += ' ';
  }
  return s;
}

function bytesToStr(bytes) {
  var s = '';
  for (var j = 0; j < bytes.length; j++) {
    s += String.fromCharCode(bytes[j] & 0xFF);
  }
  return s;
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var j;
  for (j = 0; j < bytes.length; j++) {
    crc = crc ^ bytes[j];
    var k;
    for (k = 0; k < 8; k++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return crc;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var j;
  for (j = 0; j < data.length; j++) frame.push(data[j] & 0xFF);
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function initUart() {
  state.uart = UART.get();
  if (!state.uart) {
    print('[R290] ERROR: UART not available');
    return false;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('[R290] ERROR: UART configuration failed');
    return false;
  }

  state.uart.recv(onReceive);
  state.isReady = true;
  debug('UART ready @ ' + CONFIG.BAUD_RATE + ' ' + CONFIG.MODE + ', slave=' + getSlaveId());
  return true;
}

function sendRequest(functionCode, data, callback) {
  if (!state.isReady) {
    callback('Not initialized', null);
    return;
  }
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var frame = buildFrame(getSlaveId(), functionCode, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = {
    functionCode: functionCode,
    callback: callback
  };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (!state.pendingRequest) return;
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    cb('Timeout', null);
  }, null);

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!data || data.length === 0) return;

  var j;
  for (j = 0; j < data.length; j++) {
    state.rxBuffer.push(data.charCodeAt(j) & 0xFF);
  }
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;

  var response = state.rxBuffer;
  var functionCode = response[1];

  if (functionCode & 0x80) {
    if (Timer.clear) Timer.clear(state.responseTimer);
    var exc = response.length > 2 ? response[2] : 0;
    var cbe = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cbe('Modbus exception 0x' + toHex(exc), null);
    return;
  }

  var expectedLength;
  if (state.pendingRequest.functionCode === FC.READ_HOLDING_REGISTERS) {
    expectedLength = 5 + response[2];
  } else {
    expectedLength = 8;
  }

  if (response.length < expectedLength) return;

  var crcCalculated = calcCRC(response.slice(0, expectedLength - 2));
  var crcReceived = response[expectedLength - 2] | (response[expectedLength - 1] << 8);
  if (crcCalculated !== crcReceived) {
    if (Timer.clear) Timer.clear(state.responseTimer);
    var cbc = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cbc('CRC mismatch', null);
    return;
  }

  if (Timer.clear) Timer.clear(state.responseTimer);

  var request = state.pendingRequest;
  state.pendingRequest = null;
  state.rxBuffer = [];

  debug('RX: ' + bytesToHex(response.slice(0, expectedLength)));
  request.callback(null, response.slice(0, expectedLength));
}

function readHolding(addr, quantity, callback) {
  var payload = [
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (quantity >> 8) & 0xFF,
    quantity & 0xFF
  ];

  sendRequest(FC.READ_HOLDING_REGISTERS, payload, function(err, frame) {
    if (err) {
      callback(err, null);
      return;
    }

    var values = [];
    var byteCount = frame[2];
    var j;
    for (j = 0; j < byteCount; j += 2) {
      values.push((frame[3 + j] << 8) | frame[3 + j + 1]);
    }
    callback(null, values);
  });
}

function writeSingleRegister(addr, value, callback) {
  var payload = [
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF
  ];

  sendRequest(FC.WRITE_SINGLE_REGISTER, payload, function(err) {
    callback(err);
  });
}

// ============================================================================
// DATA PARSING
// ============================================================================

function decodeI16(raw) {
  if (raw > 0x7FFF) return raw - 0x10000;
  return raw;
}

function decodeByEntity(entity, raw) {
  if (entity.reg.itype === 'i16') {
    if (raw === 32767) return null;
    return decodeI16(raw) * entity.scale;
  }
  return raw * entity.scale;
}

function findEntityByKey(key) {
  for (var j = 0; j < ENTITIES.length; j++) {
    if (ENTITIES[j].key === key) return ENTITIES[j];
  }
  return null;
}

function readEntity(entity, callback) {
  readHolding(entity.reg.addr, 1, function(err, values) {
    if (err) {
      callback(err, null);
      return;
    }
    callback(null, decodeByEntity(entity, values[0]));
  });
}

// ============================================================================
// PUBLIC CONTROL HELPERS
// ============================================================================

function setPower(isOn) {
  writeSingleRegister(REG.SYSTEM_STATE, isOn ? 1 : 0, function(err) {
    if (err) print('[R290] setPower failed: ' + err);
    else print('[R290] setPower OK -> ' + (isOn ? 'ON' : 'OFF'));
  });
}

function setMode(modeValue) {
  writeSingleRegister(REG.MODE, modeValue, function(err) {
    if (err) print('[R290] setMode failed: ' + err);
    else print('[R290] setMode OK -> ' + modeValue);
  });
}

function setHotWaterTarget(tempDegC) {
  writeSingleRegister(REG.HOT_WATER_TARGET, tempDegC, function(err) {
    if (err) print('[R290] setHotWaterTarget failed: ' + err);
    else print('[R290] setHotWaterTarget OK -> ' + tempDegC + ' degC');
  });
}

function setHeatingTarget(tempDegC) {
  writeSingleRegister(REG.HEATING_TARGET, tempDegC, function(err) {
    if (err) print('[R290] setHeatingTarget failed: ' + err);
    else print('[R290] setHeatingTarget OK -> ' + tempDegC + ' degC');
  });
}

function setCoolingTarget(tempDegC) {
  writeSingleRegister(REG.COOLING_TARGET, tempDegC, function(err) {
    if (err) print('[R290] setCoolingTarget failed: ' + err);
    else print('[R290] setCoolingTarget OK -> ' + tempDegC + ' degC');
  });
}

// ============================================================================
// POLLING
// ============================================================================

var POLL_KEYS = [
  'SYSTEM_STATE',
  'RUNNING_MODE',
  'HEAT_RETURN_TEMP',
  'HEAT_OUTLET_TEMP',
  'INLET_WATER_TEMP',
  'OUTLET_WATER_TEMP',
  'DHW_TANK_TEMP',
  'AMBIENT_TEMP',
  'COIL_TEMP',
  'SUCTION_TEMP',
  'DISCHARGE_TEMP',
  'ANTI_FREEZE_TEMP',
  'ROOM_TEMP',
  'COMPRESSOR_FREQ_RUN',
  'DC_FAN1_SPEED',
  'DC_FAN2_SPEED',
  'WATER_FLOW',
  'FAILURE_1',
  'FAILURE_2',
  'FAILURE_3',
  'FAILURE_4',
  'FAILURE_5',
  'FAILURE_6',
  'FAILURE_7',
  'FAILURE_8',
  'FAILURE_9'
];

function pollOnce() {
  var idx = 0;

  function next() {
    if (idx >= POLL_KEYS.length) return;

    var entity = findEntityByKey(POLL_KEYS[idx]);
    idx += 1;

    if (!entity) {
      next();
      return;
    }

    readEntity(entity, function(err, value) {
      if (err) {
        print('[R290] ' + entity.name + ': ERROR ' + err);
      } else if (value === null) {
        print('[R290] ' + entity.name + ': SENSOR_ERROR');
      } else {
        print('[R290] ' + entity.name + ': ' + value + ' ' + entity.units);
      }

      Timer.set(80, false, next, null);
    });
  }

  next();
}

function startPolling() {
  pollOnce();

  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL_MS, true, function() {
    pollOnce();
  }, null);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  print('[R290] Starting LinkedGo R290 thermal pump MODBUS example');
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      print('[R290] ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;
    slaveIdHandle.on('change', function() {
      debug('Slave ID changed -> ' + getSlaveId());
    });

    if (!initUart()) return;
    startPolling();
  });
}

main();
