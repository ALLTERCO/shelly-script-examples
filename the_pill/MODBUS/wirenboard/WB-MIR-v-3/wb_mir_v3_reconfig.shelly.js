/**
 * @title WB-MIR v3 MODBUS Reconfiguration Utility
 * @description One-shot utility to change the WB-MIR v3 baud rate and slave ID
 *   over MODBUS-RTU. Connects at the current settings (115200 baud, slave 133),
 *   writes the new slave ID (62) to register 128, then writes the new baud rate
 *   code (96 = 9600 bps) to register 110. Power-cycle the device afterwards.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3_reconfig.shelly.js
 */

/**
 * WB-MIR v3 - MODBUS Reconfiguration Utility for Shelly (The Pill)
 *
 * Writes two holding registers to change communication parameters:
 *   Reg 128 (0x0080): Slave ID          current 133 → target 62
 *   Reg 110 (0x006E): Baud rate code    current 1152 (115200) → target 96 (9600)
 *
 * Baud rate encoding (value × 100 = bps):
 *   96   = 9,600 bps
 *   1152 = 115,200 bps
 *
 * Register source:
 *   https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *
 * IMPORTANT:
 *   - Changes take effect after a power cycle of the WB-MIR v3.
 *   - Slave ID is written first; baud rate is written last so the bus
 *     stays usable if the slave ID write fails.
 *   - Delete or disable this script after a successful reconfiguration.
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  ─── B (D-)  ──> WB-MIR v3 RS485 B (D-)
 *   IO2 (RX)  ─── A (D+)  ──> WB-MIR v3 RS485 A (D+)
 *   IO3       ─── DE/RE   ──  direction control (automatic)
 *   GND       ─── GND     ──> WB-MIR v3 GND
 */

/* === CONFIG === */
var CONFIG = {
  // Current communication settings (what the device is responding on now)
  BAUD_CURRENT:   115200,
  MODE:           '8N2',   // WB-MIR v3 default: 8 data, no parity, 2 stop bits
  SLAVE_CURRENT:  133,

  // Target settings to write
  SLAVE_TARGET:   62,
  BAUD_TARGET:    9600,    // written as 96 (baud / 100) per WB register encoding

  RESPONSE_TIMEOUT: 1500,  // ms
  STEP_DELAY:       200,   // ms between writes
};

/* === REGISTER ADDRESSES === */
var REG_SLAVE_ID  = 128;   // Holding, RW — Modbus slave address (1-247)
var REG_BAUD_RATE = 110;   // Holding, RW — RS-485 speed code (value × 100 = bps)

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
  uart:            null,
  rxBuffer:        [],
  pendingRequest:  null,
  responseTimer:   null,
};

/* === HELPERS === */

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
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
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildWriteSingle(slaveId, addr, value) {
  var frame = [
    slaveId & 0xFF, 0x06,
    (addr >> 8) & 0xFF,  addr & 0xFF,
    (value >> 8) & 0xFF, value & 0xFF,
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

/* === MODBUS FC06 WRITE === */

function writeSingleRegister(slaveId, addr, value, callback) {
  if (state.pendingRequest) {
    callback('Request already pending');
    return;
  }

  var frame = buildWriteSingle(slaveId, addr, value);
  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      cb('Timeout');
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

  var len = state.rxBuffer.length;

  // Exception: slave(1)+FC(1)+exCode(1)+CRC(2) = 5 bytes
  if (len >= 5 && (state.rxBuffer[1] & 0x80)) {
    var excCrc  = calcCRC(state.rxBuffer.slice(0, 3));
    var recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (excCrc === recvCrc) {
      clearTimer();
      var exCode = state.rxBuffer[2];
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      state.rxBuffer = [];
      cb('Exception 0x' + toHex(exCode));
    }
    return;
  }

  // FC06 echo: slave(1)+FC(1)+addr(2)+value(2)+CRC(2) = 8 bytes
  if (len < 8) return;
  var crc  = calcCRC(state.rxBuffer.slice(0, 6));
  var recv = state.rxBuffer[6] | (state.rxBuffer[7] << 8);
  if (crc !== recv) return;   // partial or corrupt — wait

  clearTimer();
  var cb6 = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  cb6(null);
}

function clearTimer() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

/* === RECONFIGURATION SEQUENCE === */

function step1_writeSlaveId() {
  print('Step 1/2 — Writing new slave ID: ' + CONFIG.SLAVE_TARGET +
        '  (reg ' + REG_SLAVE_ID + ')');

  writeSingleRegister(CONFIG.SLAVE_CURRENT, REG_SLAVE_ID, CONFIG.SLAVE_TARGET,
    function(err) {
      if (err) {
        print('  FAILED: ' + err);
        print('  Check wiring, power, and current settings.');
        return;
      }
      print('  OK');
      Timer.set(CONFIG.STEP_DELAY, false, step2_writeBaudRate);
    }
  );
}

function step2_writeBaudRate() {
  // Write using the NEW slave ID (just confirmed written successfully)
  var baudCode = CONFIG.BAUD_TARGET / 100;   // 9600 / 100 = 96
  print('Step 2/2 — Writing new baud rate code: ' + baudCode +
        '  (' + CONFIG.BAUD_TARGET + ' bps, reg ' + REG_BAUD_RATE + ')');

  writeSingleRegister(CONFIG.SLAVE_TARGET, REG_BAUD_RATE, baudCode,
    function(err) {
      if (err) {
        print('  FAILED: ' + err);
        print('  Slave ID was already updated. Retry baud rate write at slave ' +
              CONFIG.SLAVE_TARGET + ' on ' + CONFIG.BAUD_CURRENT + ' baud.');
        return;
      }
      print('  OK');
      printDone();
    }
  );
}

function printDone() {
  print('');
  print('=========================================');
  print('Reconfiguration complete.');
  print('Power-cycle the WB-MIR v3 to apply.');
  print('');
  print('New settings:');
  print('  Slave ID:  ' + CONFIG.SLAVE_TARGET);
  print('  Baud rate: ' + CONFIG.BAUD_TARGET);
  print('  Mode:      ' + CONFIG.MODE);
  print('=========================================');
}

/* === INIT === */

function init() {
  print('WB-MIR v3 - MODBUS Reconfiguration Utility');
  print('===========================================');
  print('Current: slave=' + CONFIG.SLAVE_CURRENT +
        '  baud=' + CONFIG.BAUD_CURRENT + '  mode=' + CONFIG.MODE);
  print('Target:  slave=' + CONFIG.SLAVE_TARGET +
        '  baud=' + CONFIG.BAUD_TARGET  + '  mode=' + CONFIG.MODE);
  print('');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_CURRENT, mode: CONFIG.MODE })) {
    print('ERROR: UART configure failed');
    return;
  }

  state.uart.recv(onReceive);

  Timer.set(300, false, step1_writeSlaveId);
}

init();
