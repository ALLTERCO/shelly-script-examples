/**
 * @title WB-M1W2 v3 MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Wirenboard WB-M1W2 v3 1-Wire to RS-485 converter.
 *   Reads internal NTC thermistor temperature, two external DS18B20 1-Wire channels,
 *   discrete input states, sensor presence flags, supply voltage, and pulse counters.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_v3.shelly.js
 */

/**
 * Wirenboard WB-M1W2 v3 - MODBUS-RTU Reader for Shelly (The Pill)
 *
 * WB-M1W2 v3 features:
 *   - Two universal inputs, each supporting up to 20 DS18B20 1-Wire sensors in parallel
 *   - Built-in NTC thermistor for internal/ambient temperature
 *   - Discrete input detection with debounce and pulse counting
 *   - RS485 MODBUS-RTU slave (9–28 V supply)
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 1 (printed on device label).
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
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
 * Register blocks read per poll cycle:
 *   Block A - Temperatures:   FC 0x04, addr  6, qty  3  (NTC + ch1 + ch2)
 *   Block B - Discrete:       FC 0x02, addr  0, qty 18  (input states + presence)
 *   Block C - Supply voltage: FC 0x04, addr 121, qty  1
 *   Block D - Counters:       FC 0x04, addr 277, qty  2  (pulse counter ch1 + ch2)
 *
 * Temperature register layout (FC 0x04, addr 6, qty 3):
 *   regs[0]  addr 6  Built-in NTC thermistor  s16  raw/16 = °C; 0x7FFF = error
 *   regs[1]  addr 7  External 1-Wire ch1      s16  raw/16 = °C; 0x7FFF = absent/error
 *   regs[2]  addr 8  External 1-Wire ch2      s16  raw/16 = °C; 0x7FFF = absent/error
 *
 * Discrete Block B (FC 0x02, addr 0, qty 18):
 *   bit  0  addr  0  Input #1 state    0=open, 1=closed to GND
 *   bit  1  addr  1  Input #2 state    0=open, 1=closed to GND
 *   bit 16  addr 16  Sensor #1 status  0=absent/polling, 1=data valid (v4.6.0+)
 *   bit 17  addr 17  Sensor #2 status  0=absent/polling, 1=data valid (v4.6.0+)
 *
 * References:
 *   WB-M1W2 Product Page:  https://wirenboard.com/en/product/WB-M1W2/
 *   WB-M1W2 Wiki (EN):     https://wiki.wirenboard.com/wiki/WB-M1W2_1-Wire_to_Modbus_Temperature_Measurement_Module/en
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N2',            // WB-M1W2 v3 factory default: 8 data, no parity, 2 stop bits
  SLAVE_ID: 13,
  RESPONSE_TIMEOUT: 1000, // ms
  INTER_READ_DELAY: 100,  // ms between chained block reads
  POLL_INTERVAL: 5000,    // ms between full poll cycles
  DEBUG: true,
};

/* === REGISTER MAP (for reference) === */
var REG = {
  // Block A - External 1-Wire temperatures ch1 + ch2 (NTC addr 6 not present on this firmware)
  TEMP:     { addr: 7,   qty: 2,  fc: 0x04 },
  // Block B - Discrete input states (addr 0, qty 2: input#1 and input#2)
  DISCRETE: { addr: 0,   qty: 2,  fc: 0x02 },
  // Block B2 - Sensor presence flags (addr 16, qty 2: sensor#1 and sensor#2 status)
  PRESENCE: { addr: 16,  qty: 2,  fc: 0x02 },
  // Block C - Supply voltage
  SUPPLY:   { addr: 121, qty: 1,  fc: 0x04 },
  // Block D - Pulse counters for both inputs
  COUNTERS: { addr: 277, qty: 2,  fc: 0x04 },
};

/* === ENTITIES (full register map for documentation and optional VC binding) === */
var ENTITIES = [
  //
  // --- Discrete Inputs (FC 0x02) ---
  //
  { name: 'Input #1 State',     units: '-',    reg: { addr: 0,   rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Input #2 State',     units: '-',    reg: { addr: 1,   rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Sensor #1 Status',   units: '-',    reg: { addr: 16,  rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Sensor #2 Status',   units: '-',    reg: { addr: 17,  rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  //
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  //
  { name: 'NTC Temperature',    units: 'degC', reg: { addr: 6,   rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Ch1 Temperature',    units: 'degC', reg: { addr: 7,   rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Ch2 Temperature',    units: 'degC', reg: { addr: 8,   rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Supply Voltage',     units: 'mV',   reg: { addr: 121, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Counter Ch1',        units: '-',    reg: { addr: 277, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Counter Ch2',        units: '-',    reg: { addr: 278, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  //
  // --- Holding Registers (FC 0x03) - configuration (read FC3, write FC6/FC16) ---
  //
  { name: 'Filter Threshold',   units: 'degC', reg: { addr: 99,  rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Baud Rate',          units: 'bps',  reg: { addr: 110, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 100,    rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Parity',             units: '-',    reg: { addr: 111, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Stop Bits',          units: '-',    reg: { addr: 112, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Reset',              units: '-',    reg: { addr: 120, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Slave Address',      units: '-',    reg: { addr: 128, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Input #1 Mode',      units: '-',    reg: { addr: 275, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Input #2 Mode',      units: '-',    reg: { addr: 276, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
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
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

/* === STATE === */
var state = {
  uart: null,
  rxBuffer: [],
  isReady: false,
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
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
  if (CONFIG.DEBUG) {
    print('[WB-M1W2] ' + msg);
  }
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
  for (var i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xFF);
  }
  return s;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  for (var i = 0; i < data.length; i++) {
    frame.push(data[i] & 0xFF);
  }
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

/* === SIGNED CONVERSION === */

function toSigned16(v) {
  return v >= 0x8000 ? v - 0x10000 : v;
}

/* === DISPLAY FORMATTERS (integer arithmetic only) === */

// raw s16 (×1/16 degC) -> "XX.XXXX C" (4 decimal places)
function fmtC16(raw) {
  var sign = raw < 0 ? '-' : '';
  var abs = raw < 0 ? -raw : raw;
  var whole = Math.floor(abs / 16);
  var frac = (abs % 16) * 625;  // 0-9375 in units of 0.0001 degC
  var f4 = ('0000' + frac).slice(-4);
  return sign + whole + '.' + f4 + ' C';
}

/* === MODBUS CORE === */

function sendRequest(functionCode, startAddr, qty, callback) {
  if (!state.isReady) {
    callback('Not initialised', null);
    return;
  }
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var data = [
    (startAddr >> 8) & 0xFF,
    startAddr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];

  var frame = buildFrame(CONFIG.SLAVE_ID, functionCode, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { functionCode: functionCode, callback: callback };
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

  // Exception response (high bit set on FC byte)
  if (fc & 0x80) {
    var excCrc = calcCRC(state.rxBuffer.slice(0, 3));
    var recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (excCrc === recvCrc) {
      clearResponseTimeout();
      var exCode = state.rxBuffer[2];
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      state.rxBuffer = [];
      cb('Exception 0x' + toHex(exCode), null);
    }
    return;
  }

  // FC 0x06 write-register echo: slave(1)+FC(1)+addr(2)+value(2)+CRC(2) = 8 bytes
  if (fc === 0x06) {
    if (state.rxBuffer.length < 8) return;
    var frame6 = state.rxBuffer.slice(0, 8);
    var crc6 = calcCRC(frame6.slice(0, 6));
    var recv6 = frame6[6] | (frame6[7] << 8);
    if (crc6 !== recv6) { debug('CRC error (FC06)'); return; }
    debug('RX: ' + bytesToHex(frame6));
    clearResponseTimeout();
    var cb6 = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb6(null, true);
    return;
  }

  // FC 0x02 / 0x03 / 0x04: slave(1)+FC(1)+byteCount(1)+data(N)+CRC(2)
  if (state.rxBuffer.length < 3) return;
  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

  if (crc !== recvCrc) { debug('CRC error'); return; }

  debug('RX: ' + bytesToHex(frame));
  clearResponseTimeout();

  var responseData = frame.slice(2, expectedLen - 2);
  var cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  cb(null, responseData);
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

// Read qty input registers (FC 0x04) starting at addr.
// Callback receives (err, regs[]) where regs[] is an array of uint16.
function readInputRegisters(addr, qty, callback) {
  sendRequest(0x04, addr, qty, function(err, response) {
    if (err) { callback(err, null); return; }
    var regs = [];
    for (var i = 1; i < response.length; i += 2) {
      regs.push((response[i] << 8) | response[i + 1]);
    }
    callback(null, regs);
  });
}

// Read qty discrete inputs (FC 0x02) starting at addr.
// Callback receives (err, bits[]) where bits[] is an array of 0/1.
function readDiscreteInputs(addr, qty, callback) {
  sendRequest(0x02, addr, qty, function(err, response) {
    if (err) { callback(err, null); return; }
    var bits = [];
    for (var i = 0; i < qty; i++) {
      var byteIdx = Math.floor(i / 8) + 1;
      var bitIdx = i % 8;
      if (byteIdx < response.length) {
        bits.push((response[byteIdx] >> bitIdx) & 0x01);
      }
    }
    callback(null, bits);
  });
}

// Write a single holding register (FC 0x06).
// Callback receives (err, success).
function writeSingleRegister(addr, value, callback) {
  if (!state.isReady) { callback('Not initialised', false); return; }
  if (state.pendingRequest) { callback('Request pending', false); return; }

  var data = [
    (addr >> 8) & 0xFF, addr & 0xFF,
    (value >> 8) & 0xFF, value & 0xFF,
  ];
  var frame = buildFrame(CONFIG.SLAVE_ID, 0x06, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { functionCode: 0x06, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      debug('Timeout');
      cb('Timeout', false);
    }
  });

  state.uart.write(bytesToStr(frame));
}

/* === PARSE HELPERS === */

// Parses Block A response (FC 0x04, addr 7, qty 2) -> temperature object
function parseTempBlock(regs) {
  return {
    ch1Raw: toSigned16(regs[0]),  // external 1-Wire channel 1
    ch2Raw: toSigned16(regs[1]),  // external 1-Wire channel 2
  };
}

// Parses Block B response (FC 0x02, addr 0, qty 2) -> input states
function parseDiscreteBlock(bits) {
  return {
    input1: bits[0] === 1,  // true = closed to GND
    input2: bits[1] === 1,
  };
}

// Parses Block B2 response (FC 0x02, addr 16, qty 2) -> sensor presence
function parsePresenceBlock(bits) {
  return {
    sensor1: bits[0] === 1,  // true = data valid / sensor present
    sensor2: bits[1] === 1,
  };
}

/* === TEMPERATURE FORMATTING === */

// Formats a raw s16 temperature (×1/16 degC) with error/absent check.
// Returns a display string.
function fmtTemp(raw, label, sensorPresent) {
  if (raw === 0x7FFF) {
    return label + ': absent/error';
  }
  var s = label + ': ' + fmtC16(raw);
  if (sensorPresent === false) {
    s += '  [not ready]';
  }
  return s;
}

/* === PRINT === */

function printData(d) {
  print('--- WB-M1W2 v3 ---');

  // Temperatures
  if (d.temps) {
    var s1 = d.presence ? d.presence.sensor1 : null;
    var s2 = d.presence ? d.presence.sensor2 : null;
    print('  ' + fmtTemp(d.temps.ch1Raw, 'Ch1 (1-Wire)', s1));
    print('  ' + fmtTemp(d.temps.ch2Raw, 'Ch2 (1-Wire)', s2));
  }

  // Discrete inputs + presence
  if (d.discrete) {
    var p1 = d.presence ? (d.presence.sensor1 ? 'ready' : 'absent') : '?';
    var p2 = d.presence ? (d.presence.sensor2 ? 'ready' : 'absent') : '?';
    print('  Input #1: ' + (d.discrete.input1 ? 'closed' : 'open') +
          '   Sensor #1: ' + p1);
    print('  Input #2: ' + (d.discrete.input2 ? 'closed' : 'open') +
          '   Sensor #2: ' + p2);
  }

  // Supply voltage
  if (d.supplyMv !== null) {
    print('  Supply: ' + d.supplyMv + ' mV');
  }

  // Pulse counters
  print('  Counters: ch1=' + d.counter1 + '  ch2=' + d.counter2);

  print('');
}

/* === POLL === */

function pollDevice() {
  var result = {
    temps:    null,
    discrete: null,
    presence: null,
    supplyMv: null,
    counter1: null,
    counter2: null,
  };

  // Block A: 1-Wire temperatures ch1 + ch2
  readInputRegisters(REG.TEMP.addr, REG.TEMP.qty, function(err, regs) {
    if (err) {
      print('[WB-M1W2] Temp read error: ' + err);
    } else {
      result.temps = parseTempBlock(regs);
    }

    Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
      // Block B: input states (#1 and #2)
      readDiscreteInputs(REG.DISCRETE.addr, REG.DISCRETE.qty, function(err, bits) {
        if (err) {
          print('[WB-M1W2] Discrete read error: ' + err);
        } else {
          result.discrete = parseDiscreteBlock(bits);
        }

        Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
          // Block B2: sensor presence flags (#1 and #2)
          readDiscreteInputs(REG.PRESENCE.addr, REG.PRESENCE.qty, function(err, bits) {
            if (err) {
              print('[WB-M1W2] Presence read error: ' + err);
            } else {
              result.presence = parsePresenceBlock(bits);
            }

            Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
              // Block C: supply voltage
              readInputRegisters(REG.SUPPLY.addr, REG.SUPPLY.qty, function(err, regs) {
                if (err) {
                  print('[WB-M1W2] Supply read error: ' + err);
                } else {
                  result.supplyMv = regs[0];
                }

                Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
                  // Block D: pulse counters
                  readInputRegisters(REG.COUNTERS.addr, REG.COUNTERS.qty, function(err, regs) {
                    if (err) {
                      print('[WB-M1W2] Counters read error: ' + err);
                    } else {
                      result.counter1 = regs[0];
                      result.counter2 = regs[1];
                    }
                    printData(result);
                  });
                });
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
  print('WB-M1W2 v3 - MODBUS-RTU Reader');
  print('================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;

  debug('UART: ' + CONFIG.BAUD_RATE + ' baud, ' + CONFIG.MODE);
  debug('Slave ID: ' + CONFIG.SLAVE_ID);
  print('Poll interval: ' + (CONFIG.POLL_INTERVAL / 1000) + ' s');
  print('');

  // First poll after 500 ms, then periodic
  Timer.set(500, false, pollDevice);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollDevice);
}

init();
