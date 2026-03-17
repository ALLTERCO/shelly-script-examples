/**
 * @title WB-M1W2 MODBUS Slave Scanner
 * @description Scans MODBUS slave IDs 1-30 at 9600 baud with both 8N1 and 8N2
 *   stop-bit modes. Reports any device that responds. Use this to discover the
 *   actual slave ID and serial settings printed on the device label.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_scan.shelly.js
 */

/* === CONFIG === */
var BAUD = 9600;
var ID_START = 1;
var ID_END = 30;
var MODES = ['8N1', '8N2'];
var TIMEOUT_MS = 400;   // ms per attempt; raise if line has many sensors

/* === CRC-16 TABLE === */
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
var sc = {
  uart:      null,
  rxBuf:     [],
  pending:   false,
  timer:     null,
  modeIdx:   0,
  slaveId:   ID_START,
  found:     [],
};

/* === HELPERS === */

function calcCRC(bytes) {
  var crc = 0xFFFF;
  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function buildFrame(slaveAddr, fc, data) {
  var frame = [slaveAddr & 0xFF, fc & 0xFF];
  for (var i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function bytesToStr(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

/* === SCAN LOGIC === */

function onData(data) {
  if (!sc.pending || !data || data.length === 0) return;
  for (var i = 0; i < data.length; i++) sc.rxBuf.push(data.charCodeAt(i) & 0xFF);
  checkResponse();
}

function checkResponse() {
  // Any reply at least 4 bytes long (exception or normal) is a valid MODBUS response.
  if (sc.rxBuf.length < 4) return;

  // Minimal CRC check: last 2 bytes must match CRC of preceding bytes.
  var len = sc.rxBuf.length;
  var crc = calcCRC(sc.rxBuf.slice(0, len - 2));
  var recv = sc.rxBuf[len - 2] | (sc.rxBuf[len - 1] << 8);
  if (crc !== recv) return;   // not yet complete or garbage; wait for more bytes

  if (sc.timer) { Timer.clear(sc.timer); sc.timer = null; }
  sc.pending = false;

  var mode = MODES[sc.modeIdx];
  var id   = sc.slaveId;
  var fc   = sc.rxBuf[1];
  var tag  = (fc & 0x80) ? 'EXCEPTION fc=0x' + toHex(fc & 0x7F) : 'OK';
  print('*** FOUND: slave ' + id + '  mode ' + mode + '  -> ' + tag + ' ***');
  sc.found.push({ id: id, mode: mode });

  advance();
}

function onTimeout() {
  sc.pending = false;
  sc.rxBuf = [];
  advance();
}

function advance() {
  sc.slaveId++;
  if (sc.slaveId > ID_END) {
    sc.modeIdx++;
    sc.slaveId = ID_START;
    if (sc.modeIdx >= MODES.length) {
      // Scan complete
      print('');
      print('=== Scan complete ===');
      if (sc.found.length === 0) {
        print('No device responded. Check wiring, power, and baud rate.');
      } else {
        for (var i = 0; i < sc.found.length; i++) {
          print('  Slave ' + sc.found[i].id + '  mode ' + sc.found[i].mode);
        }
      }
      return;
    }
    print('');
    print('--- Switching to ' + MODES[sc.modeIdx] + ' ---');
    sc.uart.configure({ baud: BAUD, mode: MODES[sc.modeIdx] });
  }
  Timer.set(30, false, scanNext);
}

function scanNext() {
  sc.rxBuf = [];
  sc.pending = true;

  // FC4 read input reg addr 6 qty 1 (NTC temp); any valid reg works for probing
  var frame = buildFrame(sc.slaveId, 0x04, [0x00, 0x06, 0x00, 0x01]);
  sc.timer = Timer.set(TIMEOUT_MS, false, onTimeout);
  sc.uart.write(bytesToStr(frame));
}

/* === INIT === */

function init() {
  print('');
  print('WB-M1W2 MODBUS Scanner');
  print('======================');
  print('Baud: ' + BAUD + '  IDs: ' + ID_START + '-' + ID_END);
  print('Modes: ' + MODES.join(', '));
  print('Timeout per attempt: ' + TIMEOUT_MS + ' ms');
  print('');

  sc.uart = UART.get();
  if (!sc.uart) { print('ERROR: UART not available'); return; }
  if (!sc.uart.configure({ baud: BAUD, mode: MODES[sc.modeIdx] })) {
    print('ERROR: UART configure failed');
    return;
  }
  sc.uart.recv(onData);

  print('--- Starting ' + MODES[sc.modeIdx] + ' ---');
  Timer.set(300, false, scanNext);
}

init();
