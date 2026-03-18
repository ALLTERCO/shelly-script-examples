/**
 * @title Universal MODBUS-RTU Scanner
 * @description Discovers MODBUS-RTU slave devices by scanning all combinations
 *   of baud rate, parity, stop bits, and slave IDs. After finding a device,
 *   reads PROBE_REGS to help identify the device type. Works with any vendor.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/utils/modbus_scan.shelly.js
 */

/**
 * Universal MODBUS-RTU Scanner for Shelly (The Pill)
 *
 * Two-phase operation:
 *
 *   Phase 1 - SCAN:
 *     Sends a generic ping (FC 0x03, addr 0, qty 1) to every combination of
 *     baud rate, UART mode, and slave ID.  Any valid MODBUS response —
 *     including an exception reply — confirms a device at that address.
 *
 *   Phase 2 - IDENTIFY:
 *     For each found device, reads PROBE_REGS in order and prints every
 *     successful register read to help identify the device type.
 *
 * Customization tips:
 *   - Reduce CONFIG.BAUDS / CONFIG.MODES to speed up the scan.
 *   - Lower CONFIG.ID_END if slave IDs are known to be small.
 *   - Add vendor-specific entries to PROBE_REGS for better identification.
 *
 * Scan time estimate (CONFIG defaults, 200 ms timeout):
 *   4 bauds × 4 modes × 30 IDs × ~220 ms  ≈  105 s  (~1.75 min)
 *   Full 8-baud sweep                       ≈  210 s  (~3.5  min)
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  ─── B (D-)  ──> RS485 B (D-)
 *   IO2 (RX)  ─── A (D+)  ──> RS485 A (D+)
 *   IO3       ─── DE/RE   ──  direction control (automatic)
 *   GND       ─── GND     ──> Device GND
 */

/* === CONFIG === */
var CONFIG = {
  // Baud rates to scan. Remove entries to speed up the sweep.
  BAUDS: [4800, 9600, 19200, 38400, 115200],

  // UART modes: data bits + parity + stop bits.
  // Supported by Shelly UART: '8N1', '8N2', '8E1', '8O1'.
  MODES: ['8N1', '8N2', '8E1', '8O1'],

  // Slave ID range (MODBUS valid range: 1-247).
  ID_START: 1,
  ID_END:   30,

  // Timeout waiting for ping response (ms). Raise on noisy or slow lines.
  PING_TIMEOUT_MS: 200,

  // Timeout for each PROBE_REGS read during identify phase (ms).
  PROBE_TIMEOUT_MS: 500,

  // Inter-frame gap between consecutive transmissions (ms).
  INTER_FRAME_MS: 20,
};

/* === PROBE REGISTERS ===
 *
 * Read from each confirmed device during the IDENTIFY phase.
 * Entries are tried in order; every successful read is printed.
 * A timeout or exception is silently skipped.
 *
 * Customize this list to match devices you expect on the bus.
 * Each entry: { name, fc, addr, qty }
 *   fc   - MODBUS function code (0x03 = holding, 0x04 = input)
 *   addr - register start address (decimal)
 *   qty  - number of 16-bit registers to read (1-125)
 */
var PROBE_REGS = [
  // --- Generic probes (work on most devices) ---
  { name: 'Holding[0]',           fc: 0x03, addr: 0,      qty: 2 },
  { name: 'Input[0]',             fc: 0x04, addr: 0,      qty: 2 },

  // --- Wirenboard devices (WB-MIR, WB-M1W2, WB-M*, etc.) ---
  { name: 'WB Supply Voltage',    fc: 0x04, addr: 121,    qty: 1 },   // mV
  { name: 'WB MCU Temperature',   fc: 0x04, addr: 124,    qty: 1 },   // x0.1 degC
  { name: 'WB Model String',      fc: 0x04, addr: 200,    qty: 8 },   // 16-char ASCII

  // --- Deye / Solis / SolarmanV5 inverters ---
  { name: 'Deye Device Type',     fc: 0x03, addr: 3,      qty: 1 },

  // --- ComWinTop CWT-MB308V ---
  { name: 'CWT Input[0]',         fc: 0x04, addr: 0,      qty: 4 },

  // --- JK BMS (JK-PB series) ---
  { name: 'JK SOC',               fc: 0x03, addr: 0x1298, qty: 1 },

  // --- LinkedGo ST802 thermostat ---
  { name: 'LinkedGo Temp',        fc: 0x03, addr: 0,      qty: 2 },
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
var sc = {
  uart:     null,
  rxBuf:    [],
  pending:  false,
  timer:    null,
  phase:    'scan',   // 'scan' | 'identify' | 'done'

  // scan phase
  baudIdx:  0,
  modeIdx:  0,
  slaveId:  0,        // set to CONFIG.ID_START in init
  found:    [],       // [{ id, baud, mode }]

  // identify phase
  foundIdx: 0,
  probeIdx: 0,
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

function toHex16(n) {
  return toHex((n >> 8) & 0xFF) + toHex(n & 0xFF);
}

function buildFrame(slaveAddr, fc, addr, qty) {
  var frame = [
    slaveAddr & 0xFF, fc & 0xFF,
    (addr >> 8) & 0xFF, addr & 0xFF,
    (qty >> 8) & 0xFF,  qty & 0xFF,
  ];
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

// Decode register values as 2-byte-per-register ASCII (Wirenboard model strings etc.)
function regsToAscii(response) {
  var s = '';
  for (var i = 1; i < response.length - 1; i++) {
    var b = response[i] & 0xFF;
    if (b >= 0x20 && b < 0x7F) s += String.fromCharCode(b);
  }
  return s.length > 0 ? '"' + s + '"' : '';
}

// Format raw register bytes as hex words for printing
function regsToHex(response) {
  var s = '';
  for (var i = 1; i < response.length - 1; i += 2) {
    if (i > 1) s += ' ';
    var hi = response[i] & 0xFF;
    var lo = (i + 1 < response.length - 1) ? response[i + 1] & 0xFF : 0;
    s += '0x' + toHex(hi) + toHex(lo);
  }
  return s;
}

function clearTimer() {
  if (sc.timer) { Timer.clear(sc.timer); sc.timer = null; }
}

/* === UART RX HANDLER === */

function onData(data) {
  if (!sc.pending || !data || data.length === 0) return;
  for (var i = 0; i < data.length; i++) sc.rxBuf.push(data.charCodeAt(i) & 0xFF);
  checkResponse();
}

// Validate any MODBUS frame ending: last 2 bytes must be CRC of preceding bytes.
// Returns true if a complete, CRC-valid frame is in the buffer.
function checkResponse() {
  var len = sc.rxBuf.length;
  if (len < 4) return;

  var crc   = calcCRC(sc.rxBuf.slice(0, len - 2));
  var recvd = sc.rxBuf[len - 2] | (sc.rxBuf[len - 1] << 8);
  if (crc !== recvd) return;   // partial or garbage — wait for more bytes

  clearTimer();
  sc.pending = false;

  if (sc.phase === 'scan') onPingResponse();
  else                     onProbeResponse();
}

/* ================================================================
 * PHASE 1 — SCAN
 * ================================================================ */

function sendPing() {
  sc.rxBuf   = [];
  sc.pending = true;
  var frame  = buildFrame(sc.slaveId, 0x03, 0, 1);
  sc.timer   = Timer.set(CONFIG.PING_TIMEOUT_MS, false, onPingTimeout);
  sc.uart.write(bytesToStr(frame));
}

function onPingResponse() {
  var fc  = sc.rxBuf[1];
  var tag = (fc & 0x80) ? 'exception fc=0x' + toHex(fc & 0x7F) : 'OK';
  var baud = CONFIG.BAUDS[sc.baudIdx];
  var mode = CONFIG.MODES[sc.modeIdx];

  print('  *** FOUND: slave=' + sc.slaveId +
        '  baud=' + baud + '  mode=' + mode +
        '  -> ' + tag + ' ***');

  sc.found.push({ id: sc.slaveId, baud: baud, mode: mode });
  sc.rxBuf = [];
  Timer.set(CONFIG.INTER_FRAME_MS, false, advanceScan);
}

function onPingTimeout() {
  sc.pending = false;
  sc.rxBuf   = [];
  advanceScan();
}

function advanceScan() {
  sc.slaveId++;

  if (sc.slaveId > CONFIG.ID_END) {
    sc.slaveId = CONFIG.ID_START;
    sc.modeIdx++;

    if (sc.modeIdx >= CONFIG.MODES.length) {
      sc.modeIdx = 0;
      sc.baudIdx++;

      if (sc.baudIdx >= CONFIG.BAUDS.length) {
        // Scan complete — move to identify phase
        print('');
        print('Scan complete. Found: ' + sc.found.length + ' device(s).');
        if (sc.found.length === 0) {
          printSummary();
          return;
        }
        sc.phase    = 'identify';
        sc.foundIdx = 0;
        sc.probeIdx = 0;
        Timer.set(CONFIG.INTER_FRAME_MS, false, startIdentify);
        return;
      }
    }

    var baud = CONFIG.BAUDS[sc.baudIdx];
    var mode = CONFIG.MODES[sc.modeIdx];
    print('');
    print('--- ' + baud + ' baud  ' + mode + ' ---');
    sc.uart.configure({ baud: baud, mode: mode });
  }

  Timer.set(CONFIG.INTER_FRAME_MS, false, sendPing);
}

/* ================================================================
 * PHASE 2 — IDENTIFY
 * ================================================================ */

function startIdentify() {
  if (sc.foundIdx >= sc.found.length) {
    printSummary();
    return;
  }

  var dev = sc.found[sc.foundIdx];
  print('');
  print('Identifying slave=' + dev.id + '  baud=' + dev.baud + '  mode=' + dev.mode);
  sc.uart.configure({ baud: dev.baud, mode: dev.mode });
  sc.probeIdx = 0;
  Timer.set(CONFIG.INTER_FRAME_MS * 5, false, sendProbe);
}

function sendProbe() {
  if (sc.probeIdx >= PROBE_REGS.length) {
    sc.foundIdx++;
    Timer.set(CONFIG.INTER_FRAME_MS, false, startIdentify);
    return;
  }

  var dev   = sc.found[sc.foundIdx];
  var probe = PROBE_REGS[sc.probeIdx];

  sc.rxBuf   = [];
  sc.pending = true;
  var frame  = buildFrame(dev.id, probe.fc, probe.addr, probe.qty);
  sc.timer   = Timer.set(CONFIG.PROBE_TIMEOUT_MS, false, onProbeTimeout);
  sc.uart.write(bytesToStr(frame));
}

function onProbeResponse() {
  var probe = PROBE_REGS[sc.probeIdx];
  var fc    = sc.rxBuf[1];

  if (fc & 0x80) {
    // Exception — register not implemented; skip silently
  } else {
    // Normal response — decode and print
    var hex   = regsToHex(sc.rxBuf);
    var ascii = regsToAscii(sc.rxBuf);
    var line  = '  [' + probe.name + '] fc=0x0' + probe.fc.toString(16).toUpperCase() +
                '  addr=0x' + toHex16(probe.addr) +
                '  -> ' + hex;
    if (ascii) line += '  ' + ascii;
    print(line);
  }

  sc.rxBuf = [];
  sc.probeIdx++;
  Timer.set(CONFIG.INTER_FRAME_MS, false, sendProbe);
}

function onProbeTimeout() {
  sc.pending = false;
  sc.rxBuf   = [];
  sc.probeIdx++;
  Timer.set(CONFIG.INTER_FRAME_MS, false, sendProbe);
}

/* ================================================================
 * SUMMARY
 * ================================================================ */

function printSummary() {
  print('');
  print('========================================');
  print('MODBUS Scan Summary');
  print('========================================');

  if (sc.found.length === 0) {
    print('No devices found.');
    print('Check: wiring, power supply, baud rate range, slave ID range.');
  } else {
    print('Devices found: ' + sc.found.length);
    for (var i = 0; i < sc.found.length; i++) {
      var d = sc.found[i];
      print('  slave=' + d.id + '  baud=' + d.baud + '  mode=' + d.mode);
    }
  }

  print('');
  print('To use a found device, set in your reader script:');
  print('  CONFIG.SLAVE_ID  = <slave>');
  print('  CONFIG.BAUD_RATE = <baud>');
  print('  CONFIG.MODE      = "<mode>"');
  print('========================================');
}

/* ================================================================
 * INIT
 * ================================================================ */

function init() {
  print('');
  print('Universal MODBUS-RTU Scanner');
  print('============================');
  print('Bauds:   ' + CONFIG.BAUDS.join(', '));
  print('Modes:   ' + CONFIG.MODES.join(', '));
  print('IDs:     ' + CONFIG.ID_START + ' - ' + CONFIG.ID_END);
  print('Timeout: ' + CONFIG.PING_TIMEOUT_MS + ' ms  |  ' +
        'Combos: ' + (CONFIG.BAUDS.length * CONFIG.MODES.length * (CONFIG.ID_END - CONFIG.ID_START + 1)));
  print('');

  sc.uart = UART.get();
  if (!sc.uart) { print('ERROR: UART not available'); return; }

  sc.slaveId = CONFIG.ID_START;

  if (!sc.uart.configure({ baud: CONFIG.BAUDS[0], mode: CONFIG.MODES[0] })) {
    print('ERROR: UART configure failed');
    return;
  }
  sc.uart.recv(onData);

  print('--- ' + CONFIG.BAUDS[0] + ' baud  ' + CONFIG.MODES[0] + ' ---');
  Timer.set(300, false, sendPing);
}

init();
