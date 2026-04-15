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
  SLAVE_ID: 16,
  RESPONSE_TIMEOUT: 1200,
  POLL_INTERVAL_MS: 12000,
  DEBUG: true
};

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
  debug('UART ready @ ' + CONFIG.BAUD_RATE + ' ' + CONFIG.MODE + ', slave=' + CONFIG.SLAVE_ID);
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

  var frame = buildFrame(CONFIG.SLAVE_ID, functionCode, data);
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
  if (!initUart()) return;
  startPolling();
}

main();
