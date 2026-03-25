/**
 * @title WB-MIR v3 MODBUS-RTU Reader + Virtual Components
 * @description MODBUS-RTU reader for Wirenboard WB-MIR v3 IR transceiver and
 *   environment sensor over RS485 with Virtual Component updates. Reads DS18B20
 *   temperature, module presence flags, and supply voltages, then pushes values
 *   to user-defined virtual components.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3_vc.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - MODBUS-RTU Reader + Virtual Components
 *
 * WB-MIR v3 features:
 *   - IR transceiver (send/receive IR commands, up to 80 stored commands)
 *   - 1-Wire input for DS18B20 temperature sensor
 *   - Discrete input (button) with short / long / double press detection
 *   - RS485 MODBUS-RTU slave
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 1.
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  ─── B (D-)  ──> WB-MIR v3 RS485 B (D-)
 *   IO2 (RX)  ─── A (D+)  ──> WB-MIR v3 RS485 A (D+)
 *   IO3       ─── DE/RE   ──  direction control (automatic)
 *   GND       ─── GND     ──> WB-MIR v3 GND
 *   12V ext   ──────────> WB-MIR v3 PWR (requires 12 V supply)
 *
 * Virtual Component mapping (pre-create via Shelly UI or scripts):
 *   number:200   1-Wire Temperature    degC
 *   number:201   Supply Voltage        V
 *   number:202   MCU Temperature       degC
 *   boolean:200  Input 1W State        0=open/1-wire, 1=closed
 *   boolean:201  1-Wire Probe Status   0=disconnected, 1=connected
 *   boolean:202  IR Transceiver        0=absent, 1=present
 *   boolean:203  1-Wire Sensor         0=absent, 1=present
 *   group:200    WB-MIR v3             (group containing all above)
 *
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N2',             // WB-MIR v3 factory default: 8 data, no parity, 2 stop bits
  SLAVE_ID: 62,
  RESPONSE_TIMEOUT: 1000,  // ms
  INTER_READ_DELAY: 100,   // ms between chained block reads
  POLL_INTERVAL: 5000,     // ms between full poll cycles
  DEBUG: true,
};

/* === REGISTER MAP (for reference) === */
var REG = {
  TEMP:         { addr: 7,   qty: 1,  fc: 0x04 },
  DISCRETE:     { addr: 0,   qty: 17, fc: 0x02 },
  POWER:        { addr: 121, qty: 4,  fc: 0x04 },
  PRESENCE:     { addr: 375, qty: 2,  fc: 0x04 },
};

/* === ENTITIES === */
var ENTITIES = [
  //
  // --- Discrete Inputs (FC 0x02) ---
  //
  { name: 'Input 1W State',      units: '-',    reg: { addr: 0,    rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: 'boolean:200', handle: null, vcHandle: null },
  { name: '1-Wire Probe Status', units: '-',    reg: { addr: 16,   rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: 'boolean:201', handle: null, vcHandle: null },
  //
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  //
  { name: '1-Wire Temperature',  units: 'degC', reg: { addr: 7,    rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'R',  vcId: 'number:200',  handle: null, vcHandle: null },
  { name: 'Supply Voltage',      units: 'V',    reg: { addr: 121,  rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 0.001,  rights: 'R',  vcId: 'number:201',  handle: null, vcHandle: null },
  { name: 'MCU Temperature',     units: 'degC', reg: { addr: 124,  rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.1,    rights: 'R',  vcId: 'number:202',  handle: null, vcHandle: null },
  { name: 'IR Transceiver',      units: '-',    reg: { addr: 375,  rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: 'boolean:202', handle: null, vcHandle: null },
  { name: '1-Wire Sensor',       units: '-',    reg: { addr: 376,  rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: 'boolean:203', handle: null, vcHandle: null },
  //
  // --- Holding Registers (FC 0x03) - configuration, no VC ---
  //
  { name: 'Conn Loss Timeout',   units: 's',    reg: { addr: 8,    rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
  { name: 'Sensor Poll Period',  units: 's',    reg: { addr: 101,  rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
  { name: 'Input 1W Mode',       units: '-',    reg: { addr: 275,  rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
  { name: 'Debounce Time',       units: 'ms',   reg: { addr: 340,  rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
  { name: 'Long Press Duration', units: 'ms',   reg: { addr: 1100, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
  { name: 'Double Press Wait',   units: 'ms',   reg: { addr: 1140, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null,          handle: null, vcHandle: null },
];

// Entity index constants for convenient access
var E = {
  INPUT_STATE:    0,
  PROBE_STATUS:   1,
  TEMPERATURE:    2,
  SUPPLY_V:       3,
  MCU_TEMP:       4,
  IR_PRESENT:     5,
  OW_PRESENT:     6,
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

/* === STATE === */
var state = {
  uart: null,
  rxBuffer: [],
  isReady: false,
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  metadataQueue: [],
  metadataIndex: 0,
  metadataBusy: false,
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
    print('[WB-MIR] ' + msg);
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

/* === VIRTUAL COMPONENT === */

function updateVc(entity, value) {
  if (!entity || !entity.vcHandle) return;
  if (typeof value === 'number') {
    value = Math.round(value * 10) / 10;
  }
  entity.vcHandle.setValue(value);
  debug(entity.name + ' -> ' + value + ' [' + entity.units + ']');
}

function capitalize(s) {
  if (!s || s.length === 0) return s;
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function parseVcId(vcId) {
  var parts;
  if (!vcId) return null;
  parts = vcId.split(':');
  if (parts.length !== 2) return null;
  return {
    type: parts[0],
    id: +parts[1],
  };
}

function configureVcMetadata(entity) {
  var parsed, config, method;
  if (!entity || !entity.vcId) return;

  parsed = parseVcId(entity.vcId);
  if (!parsed || (parsed.type !== 'number' && parsed.type !== 'boolean')) return;

  config = Shelly.getComponentConfig(parsed.type, parsed.id);
  if (!config) {
    debug('VC config missing for ' + entity.vcId);
    return;
  }

  if (!config.meta) config.meta = {};
  if (!config.meta.ui) config.meta.ui = {};

  config.name = entity.name;
  if (parsed.type === 'number') {
    config.meta.ui.unit = entity.units;
  }
  if (parsed.type === 'boolean') {
    config.meta.ui.titles = ['OFF', 'ON'];
  }

  method = capitalize(parsed.type) + '.SetConfig';
  state.metadataQueue.push({
    method: method,
    params: { id: parsed.id, config: config },
    vcId: entity.vcId,
    units: entity.units,
  });
}

function processMetadataQueue() {
  var job;
  if (state.metadataBusy || state.metadataIndex >= state.metadataQueue.length) return;

  job = state.metadataQueue[state.metadataIndex];
  state.metadataIndex++;
  state.metadataBusy = true;

  Shelly.call(job.method, job.params, function(result, error_code, error_message) {
    if (error_code !== 0) {
      print('[WB-MIR] VC config error for ' + job.vcId + ': ' + error_message);
    } else {
      debug('VC config updated for ' + job.vcId + ' unit=' + job.units);
    }
    state.metadataBusy = false;
    Timer.set(50, false, processMetadataQueue);
  });
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

/* === DISPLAY FORMATTERS (integer arithmetic only) === */

// 0.1 degC units -> "X.X C"
function fmtC(tenths) {
  var sign = tenths < 0 ? '-' : '';
  var abs = tenths < 0 ? -tenths : tenths;
  return sign + Math.floor(abs / 10) + '.' + (abs % 10) + ' C';
}

// 0.0625 degC units -> "XX.XXXX C"
function fmtC16(raw) {
  var sign = raw < 0 ? '-' : '';
  var abs = raw < 0 ? -raw : raw;
  var whole = Math.floor(abs / 16);
  var frac = (abs % 16) * 625;
  var f4 = ('0000' + frac).slice(-4);
  return sign + whole + '.' + f4 + ' C';
}

/* === PRINT === */

function printData(d) {
  print('--- WB-MIR v3 ---');

  if (d.tempRaw === 0x7FFF) {
    print('  Temperature:  sensor error');
  } else {
    print('  Temperature:  ' + fmtC16(toSigned16(d.tempRaw)) +
          (d.discrete ? (d.discrete.probeConnected ? '' : '  [probe disconnected]') : ''));
  }

  if (d.discrete) {
    print('  Input state:  ' + (d.discrete.input1wState ? 'closed' : 'open/1-wire'));
    print('  Probe:        ' + (d.discrete.probeConnected ? 'connected' : 'disconnected'));
  }

  if (d.power) {
    print('  Supply:       ' + d.power.supplyV + ' mV' +
          '  (min ' + d.power.minV + ' mV  MCU ' + d.power.mcuV + ' mV)');
    print('  MCU Temp:     ' + fmtC(d.power.mcuTemp));
  }

  if (d.presence) {
    print('  IR module:    ' + (d.presence.irPresent ? 'present' : 'absent'));
    print('  1-Wire:       ' + (d.presence.owPresent ? 'present' : 'absent'));
  }

  print('');
}

/* === POLL === */

function pollDevice() {
  var result = {
    tempRaw:     null,
    discrete:    null,
    power:       null,
    presence:    null,
  };

  // Block A: temperature (FC 0x04, addr 7, qty 1)
  readInputRegisters(REG.TEMP.addr, REG.TEMP.qty, function(err, regs) {
    if (err) {
      print('[WB-MIR] Temp read error: ' + err);
    } else {
      result.tempRaw = regs[0];
      if (result.tempRaw !== 0x7FFF) {
        updateVc(ENTITIES[E.TEMPERATURE], toSigned16(result.tempRaw) * ENTITIES[E.TEMPERATURE].scale);
      }
    }

    Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
      // Block B: discrete inputs (FC 0x02, addr 0, qty 17)
      readDiscreteInputs(REG.DISCRETE.addr, REG.DISCRETE.qty, function(err, bits) {
        if (err) {
          print('[WB-MIR] Discrete read error: ' + err);
        } else {
          result.discrete = { input1wState: bits[0], probeConnected: bits[16] === 1 };
          updateVc(ENTITIES[E.INPUT_STATE],   bits[0] !== 0);
          updateVc(ENTITIES[E.PROBE_STATUS],  bits[16] !== 0);
        }

        Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
          // Block C: supply voltage + MCU temp (FC 0x04, addr 121, qty 4)
          readInputRegisters(REG.POWER.addr, REG.POWER.qty, function(err, regs) {
            if (err) {
              print('[WB-MIR] Power read error: ' + err);
            } else {
              result.power = {
                supplyV: regs[0],
                minV:    regs[1],
                mcuV:    regs[2],
                mcuTemp: toSigned16(regs[3]),
              };
              updateVc(ENTITIES[E.SUPPLY_V],  result.power.supplyV * ENTITIES[E.SUPPLY_V].scale);
              updateVc(ENTITIES[E.MCU_TEMP],  result.power.mcuTemp * ENTITIES[E.MCU_TEMP].scale);
            }

            Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
              // Block D: presence flags (FC 0x04, addr 375, qty 2)
              readInputRegisters(REG.PRESENCE.addr, REG.PRESENCE.qty, function(err, regs) {
                if (err) {
                  print('[WB-MIR] Presence read error: ' + err);
                } else {
                  result.presence = { irPresent: regs[0] !== 0, owPresent: regs[1] !== 0 };
                  updateVc(ENTITIES[E.IR_PRESENT], result.presence.irPresent);
                  updateVc(ENTITIES[E.OW_PRESENT], result.presence.owPresent);
                }
                printData(result);
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
  print('WB-MIR v3 - MODBUS-RTU Reader + Virtual Components');
  print('===================================================');

  // Bind virtual component handles
  for (var i = 0; i < ENTITIES.length; i++) {
    var ent = ENTITIES[i];
    if (ent.vcId) {
      ent.vcHandle = Virtual.getHandle(ent.vcId);
      configureVcMetadata(ent);
      debug('VC handle for ' + ent.name + ' -> ' + ent.vcId);
    }
  }
  processMetadataQueue();

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

  Timer.set(500, false, pollDevice);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollDevice);
}

init();
