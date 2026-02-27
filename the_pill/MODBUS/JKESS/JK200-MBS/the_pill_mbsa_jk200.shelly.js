/**
 * @title JK200 BMS MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Jikong JK-PB series BMS over RS485.
 *   Reads cell voltages, pack voltage, current, SOC, temperatures and alarms.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/JK200-MBS/the_pill_mbsa_jk200.shelly.js
 */

/**
 * JK200 BMS - MODBUS-RTU Reader for Shelly (The Pill)
 *
 * Compatible with Jikong JK-PB series BMS:
 *   JK-PB2A8S20P, JK-PB2A16S20P, JK-PB2A20S20P (and other PB variants).
 *
 * To enable MODBUS on the BMS:
 *   Open the JK BMS app -> Settings -> Device Address -> set to 1-15.
 *   Any non-zero address activates RS485 Modbus slave mode.
 *   Default: 9600 baud, 8N1.
 *
 * Hardware Connection (via RS485 transceiver, e.g. MAX485):
 *   RS485 A (D+)  <->  BMS RS485 A (D+)
 *   RS485 B (D-)  <->  BMS RS485 B (D-)
 *   RS485 RO      ->   Shelly RX (GPIO)
 *   RS485 DI      ->   Shelly TX (GPIO)
 *   RS485 VCC     ->   3.3V or 5V
 *   RS485 GND     ->   GND
 *
 * Addressing scheme (actual JK BMS RS485 Modbus V1.0 at 115200 baud):
 *   - Supports only FC 0x03 (Read Holding Registers).
 *   - U_WORD  (16-bit): stride 1 -- 1 register, no padding.
 *   - U_DWORD (32-bit): stride 2 -- 2 registers (hi, lo), no trailing padding.
 *   - S_WORD / S_DWORD: same strides, interpreted as signed (two's complement).
 *
 * Two register blocks are read per poll cycle:
 *   Block A -- Cell voltages:  FC 0x03, start 0x1200, qty CELL_COUNT
 *   Block B -- Key parameters: FC 0x03, start 0x128A, qty 30
 *
 * Block B actual register layout (qty 30, start 0x128A, stride-1 WORDs):
 *   Offset  Reg addr  Field             Type      Unit
 *    0      0x128A    MOSFET temp       S_WORD    0.1  degC
 *    1-2    0x128B-C  (reserved)
 *    3-4    0x128D-E  Pack voltage      U_DWORD   mV   (hi, lo)
 *    5-6    0x128F-90 Pack power        S_DWORD   mW   (hi, lo)
 *    7-8    0x1291-92 Pack current      S_DWORD   mA   (hi, lo)
 *    9      0x1293    Temperature 1     S_WORD    0.1  degC
 *   10      0x1294    Temperature 2     S_WORD    0.1  degC
 *   11-12   0x1295-96 Alarm bitmask     U_DWORD   --   (hi, lo)
 *   13      0x1297    Balance current   S_WORD    mA
 *   14      0x1298    State of Charge   U_WORD    %
 *
 * References:
 *   JK BMS RS485 Modbus V1.0: https://github.com/ciciban/jkbms-PB2A16S20P
 *   ESPHome integration:       https://github.com/syssi/esphome-jk-bms
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 115200,
  MODE: '8N1',
  SLAVE_ID: 1,
  CELL_COUNT: 16,          // 8, 10, 12, 14, 16, 20, 24 -- match your pack
  RESPONSE_TIMEOUT: 2000,  // ms; larger for bulk reads at 9600 baud
  INTER_READ_DELAY: 100,   // ms between block A and block B reads
  POLL_INTERVAL: 10000,    // ms between full poll cycles
  DEBUG: true,
};

/* === REGISTER MAP === */
var REG = {
  CELLS_BASE: 0x1200,
  MAIN_BASE: 0x128A,
  MAIN_QTY: 30,
};

/* === ALARM BIT LABELS === */
var ALARM_LABELS = [
  'Cell undervoltage',       // bit 0
  'Cell overvoltage',        // bit 1
  'Discharge overcurrent',   // bit 2
  'Charge overcurrent',      // bit 3
  'Low temperature (chg)',   // bit 4
  'High temperature (dis)',  // bit 5
  'MOS overtemperature',     // bit 6
  'Short circuit',           // bit 7
  'Cell delta too large',    // bit 8
  'Pack undervoltage',       // bit 9
  'Pack overvoltage',        // bit 10
  'Low SOC',                 // bit 11
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
    print('[JK200] ' + msg);
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

/* === SIGNED CONVERSIONS === */

function toSigned16(v) {
  return v >= 0x8000 ? v - 0x10000 : v;
}

function toSigned32(hi, lo) {
  var v = hi * 65536 + lo;
  return v >= 2147483648 ? v - 4294967296 : v;
}

/* === DISPLAY FORMATTERS (integer arithmetic only) === */

function pad3(n) {
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return '' + n;
}

// millivolts -> "X.XXX V"
function fmtV(mv) {
  var sign = mv < 0 ? '-' : '';
  var abs = mv < 0 ? -mv : mv;
  return sign + Math.floor(abs / 1000) + '.' + pad3(abs % 1000) + ' V';
}

// milliamps -> "X.XXX A"
function fmtA(ma) {
  var sign = ma < 0 ? '-' : '';
  var abs = ma < 0 ? -ma : ma;
  return sign + Math.floor(abs / 1000) + '.' + pad3(abs % 1000) + ' A';
}

// milliwatts -> "X.XXX W"
function fmtW(mw) {
  var sign = mw < 0 ? '-' : '';
  var abs = mw < 0 ? -mw : mw;
  return sign + Math.floor(abs / 1000) + '.' + pad3(abs % 1000) + ' W';
}

// 0.1  degC units -> "X.X C"
function fmtC(tenths) {
  var sign = tenths < 0 ? '-' : '';
  var abs = tenths < 0 ? -tenths : tenths;
  return sign + Math.floor(abs / 10) + '.' + (abs % 10) + ' C';
}

/* === MODBUS CORE (FC 0x03 only) === */

var FC_READ_HOLDING = 0x03;

function sendRequest(data, callback) {
  if (!state.isReady) {
    callback('Not initialised', null);
    return;
  }
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var frame = buildFrame(CONFIG.SLAVE_ID, FC_READ_HOLDING, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function () {
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
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }
  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];

  // Exception response
  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
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
    }
    return;
  }

  // Normal FC 0x03 response: slave(1) + FC(1) + byteCount(1) + data(N) + CRC(2)
  if (fc !== FC_READ_HOLDING || state.rxBuffer.length < 3) return;

  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

  if (crc !== recvCrc) {
    debug('CRC error');
    return;
  }

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

// Read qty holding registers starting at addr.
// Callback receives (err, registers[]) where registers[] is an array of
// uint16 values, one per MODBUS register.
function readRegisters(addr, qty, callback) {
  var data = [
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];

  sendRequest(data, function (err, response) {
    if (err) {
      callback(err, null);
      return;
    }
    // response[0] = byteCount, response[1..byteCount] = register data (big-endian)
    var byteCount = response[0];
    var regs = [];
    for (var i = 1; i <= byteCount; i += 2) {
      regs.push((response[i] << 8) | response[i + 1]);
    }
    callback(null, regs);
  });
}

/* === PARSE CELL BLOCK (start 0x1200, qty CELL_COUNT) === */

// Returns { cells[], minV, maxV, deltaV, minCell, maxCell } (all in mV).
function parseCellBlock(regs) {
  var cells = [];
  var minV = 65535;
  var maxV = 0;
  var minCell = 0;
  var maxCell = 0;

  for (var i = 0; i < CONFIG.CELL_COUNT; i++) {
    // stride-1: each register is one cell voltage (no padding)
    var mv = regs[i];
    cells.push(mv);
    if (mv < minV) { minV = mv; minCell = i + 1; }
    if (mv > maxV) { maxV = mv; maxCell = i + 1; }
  }

  return {
    cells: cells,
    minV: minV,
    maxV: maxV,
    deltaV: maxV - minV,
    minCell: minCell,
    maxCell: maxCell,
  };
}

/* === PARSE MAIN BLOCK (start 0x128A, qty 30) === */

// Actual register offsets at 115200 baud (stride-1 WORDs, stride-2 DWORDs):
//   [0]      0x128A  MOSFET temp   S_WORD  0.1  degC
//   [1..2]   0x128B-C (reserved)
//   [3..4]   0x128D-E Pack voltage  U_DWORD mV   hi=regs[3], lo=regs[4]
//   [5..6]   0x128F-90 Pack power   S_DWORD mW   hi=regs[5], lo=regs[6]
//   [7..8]   0x1291-92 Pack current S_DWORD mA   hi=regs[7], lo=regs[8]
//   [9]      0x1293  Temp 1        S_WORD  0.1  degC
//   [10]     0x1294  Temp 2        S_WORD  0.1  degC
//   [11..12] 0x1295-96 Alarm bits  U_DWORD bitmask  hi=regs[11], lo=regs[12]
//   [13]     0x1297  Balance curr  S_WORD  mA
//   [14]     0x1298  SOC           U_WORD  %
function parseMainBlock(regs) {
  return {
    mosFetTemp: toSigned16(regs[0]),             // 0.1  degC
    voltage: regs[3] * 65536 + regs[4],          // mV (U_DWORD)
    power: toSigned32(regs[5], regs[6]),          // mW (S_DWORD, + charge / - discharge)
    current: toSigned32(regs[7], regs[8]),        // mA (S_DWORD, + charge / - discharge)
    temp1: toSigned16(regs[9]),                   // 0.1  degC
    temp2: toSigned16(regs[10]),                  // 0.1  degC
    alarms: regs[11] * 65536 + regs[12],          // bitmask
    balanceCurrent: toSigned16(regs[13]),         // mA
    soc: regs[14],                                // %
  };
}

/* === PRINT === */

function printAlarms(bitmask) {
  if (bitmask === 0) {
    print('  Alarms:  none');
    return;
  }
  var active = 'Alarms: ';
  for (var b = 0; b < ALARM_LABELS.length; b++) {
    if (bitmask & (1 << b)) {
      active += '[' + ALARM_LABELS[b] + '] ';
    }
  }
  if (bitmask & 0x8000) active += '[Manual shutdown] ';
  print('  ' + active);
}

function printData(cellData, main) {
  print('--- JK200 BMS ---');

  if (cellData) {
    print('  Cells (' + CONFIG.CELL_COUNT + '):');
    for (var i = 0; i < cellData.cells.length; i++) {
      var tag = '';
      if (i + 1 === cellData.minCell) tag = ' (min)';
      if (i + 1 === cellData.maxCell) tag = ' (max)';
      print('    ' + (i + 1 < 10 ? ' ' : '') + (i + 1) + ': ' + fmtV(cellData.cells[i]) + tag);
    }
    print('  Delta: ' + fmtV(cellData.deltaV) +
          ' | Min: ' + fmtV(cellData.minV) + ' (cell ' + cellData.minCell + ')' +
          ' | Max: ' + fmtV(cellData.maxV) + ' (cell ' + cellData.maxCell + ')');
  } else {
    print('  Cells: read error');
  }

  if (main) {
    print('  Pack:    ' + fmtV(main.voltage) +
          ' | ' + fmtA(main.current) +
          ' | ' + fmtW(main.power));
    print('  SOC:     ' + main.soc + ' %');
    print('  Temp:    MOS ' + fmtC(main.mosFetTemp) +
          ' | T1 ' + fmtC(main.temp1) +
          ' | T2 ' + fmtC(main.temp2));
    print('  Balance: ' + fmtA(main.balanceCurrent));
    printAlarms(main.alarms);
  } else {
    print('  Main params: read error');
  }

  print('');
}

/* === POLL === */

function pollBMS() {
  var cellQty = CONFIG.CELL_COUNT;

  readRegisters(REG.CELLS_BASE, cellQty, function (err, regs) {
    var cellData = null;
    if (err) {
      print('[JK200] Cell block error: ' + err);
    } else {
      if (regs.length < cellQty) {
        print('[JK200] Cell block short (' + regs.length + ')');
      } else {
        cellData = parseCellBlock(regs);
      }
    }

    Timer.set(CONFIG.INTER_READ_DELAY, false, function () {
      readRegisters(REG.MAIN_BASE, REG.MAIN_QTY, function (err, regs) {
        var main = null;
        if (err) {
          print('[JK200] Main block error: ' + err);
        } else if (regs.length < REG.MAIN_QTY) {
          print('[JK200] Main block short (' + regs.length + ')');
        } else {
          main = parseMainBlock(regs);
        }

        printData(cellData, main);
      });
    });
  });
}

/* === INIT === */

function init() {
  print('JK200 BMS - MODBUS-RTU Reader');
  print('==============================');

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
  print('Cells: ' + CONFIG.CELL_COUNT + ' | Poll: ' + (CONFIG.POLL_INTERVAL / 1000) + ' s');
  print('');

  Timer.set(500, false, pollBMS);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollBMS);
}

init();
