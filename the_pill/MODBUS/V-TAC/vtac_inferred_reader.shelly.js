/**
 * @title V-TAC VT-66036103 inferred MODBUS reader
 * @description Reads a small set of inferred holding registers from the
 *   V-TAC VT-66036103 / INVT-family inverter and prints them to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/V-TAC/vtac_inferred_reader.shelly.js
 */

/**
 * V-TAC VT-66036103 Inferred MODBUS Reader
 *
 * This script is based on local reverse-engineering work in:
 * - registers.md
 * - register-proposals.md
 *
 * Important:
 * - The register names and scales here are inferred, not vendor-confirmed.
 * - The goal is to poll the most plausible holding registers every 15 seconds
 *   and keep the results visible in the console during validation.
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
 *                    \====|           B |              |==============|
 *                         |=============|
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
  DEBUG: false,
};

var ENTITIES = [
  { name: 'Battery Voltage Threshold A', addr: 8704, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Battery Voltage Threshold B', addr: 8705, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Battery Voltage Threshold C', addr: 8706, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Battery Voltage Threshold D', addr: 8707, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Battery Charge Current Limit', addr: 8708, fc: 0x03, scale: 0.1, unit: 'A' },
  { name: 'Battery Discharge Current Limit', addr: 8711, fc: 0x03, scale: 0.1, unit: 'A' },
  { name: 'Battery Capacity', addr: 8712, fc: 0x03, scale: 1, unit: 'Ah?' },
  { name: 'PV1 Max Input Current', addr: 8713, fc: 0x03, scale: 0.1, unit: 'A' },
  { name: 'PV2 Max Input Current', addr: 8714, fc: 0x03, scale: 0.1, unit: 'A' },
  { name: 'PV Max Voltage Limit', addr: 8718, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'MPPT Upper Limit', addr: 8720, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'MPPT Upper Recovery', addr: 8721, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Rated AC Power', addr: 8725, fc: 0x03, scale: 1, unit: 'W' },
  { name: 'AC Output Current Limit', addr: 8729, fc: 0x03, scale: 0.1, unit: 'A' },
  { name: 'Model Power Class', addr: 8737, fc: 0x03, scale: 0.1, unit: 'kW' },
  { name: 'Nominal Grid Frequency A', addr: 8738, fc: 0x03, scale: 1, unit: 'Hz' },
  { name: 'Nominal Grid Frequency B', addr: 8739, fc: 0x03, scale: 1, unit: 'Hz' },
  { name: 'Unused Marker', addr: 8836, fc: 0x03, scale: 1, unit: 'raw' },
  { name: 'Percentage Limit', addr: 8856, fc: 0x03, scale: 1, unit: '%' },
  { name: 'Grid High Frequency Trip', addr: 8992, fc: 0x03, scale: 0.01, unit: 'Hz' },
  { name: 'Grid Low Frequency Trip', addr: 8993, fc: 0x03, scale: 0.01, unit: 'Hz' },
  { name: 'Grid Voltage Threshold A', addr: 8994, fc: 0x03, scale: 0.1, unit: 'V' },
  { name: 'Grid Voltage Threshold B', addr: 8995, fc: 0x03, scale: 0.1, unit: 'V' },
];

var FC = {
  READ_HOLDING_REGISTERS: 0x03,
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
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  isReady: false,
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
};

// ============================================================================
// HELPERS
// ============================================================================

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var hex = '';
  var i;
  for (i = 0; i < bytes.length; i++) {
    hex += toHex(bytes[i]);
    if (i < bytes.length - 1) hex += ' ';
  }
  return hex;
}

function debug(msg) {
  if (CONFIG.DEBUG) {
    print('[V-TAC] ' + msg);
  }
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    var index = (crc ^ bytes[i]) & 0xFF;
    crc = (crc >> 8) ^ CRC_TABLE[index];
  }
  return crc;
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xFF);
  }
  return s;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var i;
  if (data) {
    for (i = 0; i < data.length; i++) {
      frame.push(data[i] & 0xFF);
    }
  }
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function formatScaled(raw, scale) {
  var value = raw * scale;
  if (scale === 1) return '' + value;
  if (scale === 0.1) return value.toFixed(1);
  if (scale === 0.01) return value.toFixed(2);
  return '' + value;
}

// ============================================================================
// MODBUS CORE
// ============================================================================

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
    callback: callback,
  };
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

  var i;
  for (i = 0; i < data.length; i++) {
    state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  }

  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];

  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
      var excFrame = state.rxBuffer.slice(0, 5);
      var crc = calcCRC(excFrame.slice(0, 3));
      var recvCrc = excFrame[3] | (excFrame[4] << 8);
      if (crc === recvCrc) {
        clearResponseTimeout();
        var exCode = state.rxBuffer[2];
        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        cb('Exception: 0x' + toHex(exCode), null);
      }
    }
    return;
  }

  var expectedLen = 0;
  if (fc === FC.READ_HOLDING_REGISTERS && state.rxBuffer.length >= 3) {
    expectedLen = 3 + state.rxBuffer[2] + 2;
  }

  if (expectedLen === 0 || state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var frameCrc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvFrameCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

  if (frameCrc !== recvFrameCrc) {
    debug('CRC error');
    return;
  }

  debug('RX: ' + bytesToHex(frame));
  clearResponseTimeout();

  var responseData = frame.slice(2, expectedLen - 2);
  var done = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  done(null, responseData);
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function readHoldingRegister(addr, callback) {
  var data = [(addr >> 8) & 0xFF, addr & 0xFF, 0x00, 0x01];

  sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, response) {
    if (err) {
      callback(err, null);
      return;
    }
    if (response.length < 3) {
      callback('Short response', null);
      return;
    }
    var raw = (response[1] << 8) | response[2];
    callback(null, raw);
  });
}

// ============================================================================
// POLLING
// ============================================================================

function pollEntities() {
  var results = [];

  function readNext(index) {
    if (index >= ENTITIES.length) {
      print('--- V-TAC VT-66036103 inferred map ---');
      var i;
      for (i = 0; i < results.length; i++) {
        print(results[i]);
      }
      print('');
      return;
    }

    var entity = ENTITIES[index];
    readHoldingRegister(entity.addr, function(err, raw) {
      if (err) {
        results.push(entity.name + ': ERROR (' + err + ')');
      } else {
        var scaled = formatScaled(raw, entity.scale);
        results.push(
          entity.name +
            ': ' +
            scaled +
            ' [' +
            entity.unit +
            '] raw=' +
            raw +
            ' addr=' +
            entity.addr
        );
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
  print('V-TAC VT-66036103 inferred MODBUS reader');
  print('=========================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (
    !state.uart.configure({
      baud: CONFIG.BAUD_RATE,
      mode: CONFIG.MODE,
    })
  ) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;

  debug('UART: ' + CONFIG.BAUD_RATE + ' baud, ' + CONFIG.MODE);
  debug('Slave ID: ' + CONFIG.SLAVE_ID);

  print('Polling ' + ENTITIES.length + ' inferred holding registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, pollEntities);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollEntities);
}

init();
