/**
 * @title DFRobot SEN0492 Laser Ranging Sensor - MODBUS-RTU reader
 * @description Reads distance and status from a DFRobot SEN0492 RS485 laser
 *   ranging sensor over MODBUS-RTU and prints values to the console.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/DFRobot/SEN0492/sen0492.shelly.js
 */

/**
 * DFRobot SEN0492 Laser Ranging Sensor - MODBUS-RTU Reader
 *
 * Sensor parameters (factory defaults):
 *   Slave ID  : 0x50 (80)
 *   Baud rate : 115200
 *   Mode      : 8N1
 *
 * Register map (FC 0x03 - Read Holding Registers):
 *
 *   Addr  Name                 Type    Unit   Access  Notes
 *   ----  -------------------  ------  -----  ------  ------------------
 *   0x00  System Recovery      UINT16  -      W       Write 0x01 to reset
 *   0x02  Alarm Threshold      UINT16  mm     W       Range: 40–4000
 *   0x04  Baud Rate Index      UINT16  -      W       0=2400 … 9=921600
 *   0x07  Timing Preset        UINT16  ms     W       Range: 20–1000
 *   0x08  Measurement Interval UINT16  ms     W       Range: 1–1000
 *   0x1A  Slave Address        UINT16  -      W       Range: 0x00–0xFE
 *   0x34  Distance             UINT16  mm     R       Range: 0–4000
 *   0x35  Output State         UINT16  -      R       See STATUS_* constants
 *   0x36  Measurement Mode     UINT16  -      W       1=≤1.3m 2=≤3m 3=≤4m
 *   0x37  Calibration Mode     UINT16  -      R/W     Write 0x04 to enter
 *
 * Status codes (register 0x35):
 *   0x00  Valid measurement
 *   0x01  Sigma Fail
 *   0x02  Signal Fail
 *   0x03  Min Range Fail
 *   0x04  Phase Fail
 *   0x05  Hardware Fail
 *   0x07  No Update
 *
 * Example frames:
 *   Read distance  TX: 50 03 00 34 00 01 C8 45
 *                  RX: 50 03 02 07 0B 06 7F  -> 0x070B = 1803 mm
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  --- B           (Green)  --> Sensor RS485 B
 *   IO2 (RX)  --- A           (Yellow) --> Sensor RS485 A
 *   IO3       --- DE/RE                    direction control (automatic)
 *   GND       --- GND         (Black)  --> Sensor GND
 *   5–36V     --- VCC         (Red)    --> Sensor power (separate supply)
 *   n/c       --- ALARM       (White)      open-collector alarm, active LOW
 *
 * Reference: https://wiki.dfrobot.com/Laser_Ranging_Sensor_RS485_4m_SKU_SEN0492
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 115200,
    MODE: '8N1',
    SLAVE_ID: 0x50,
    RESPONSE_TIMEOUT: 500,
    POLL_INTERVAL: 5000,
    DEBUG: false
};

/* === STATUS CODES === */
var STATUS = {
    0x00: 'Valid',
    0x01: 'Sigma Fail',
    0x02: 'Signal Fail',
    0x03: 'Min Range Fail',
    0x04: 'Phase Fail',
    0x05: 'Hardware Fail',
    0x07: 'No Update'
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
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        if (i > 0) s += ' ';
        s += toHex(bytes[i]);
    }
    return s;
}

function debug(msg) {
    if (CONFIG.DEBUG) print('[SEN0492] ' + msg);
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

function statusName(code) {
    var name = STATUS[code];
    return name !== undefined ? name : 'Unknown (0x' + toHex(code) + ')';
}

/* === MODBUS CORE === */

function buildFrame(slaveAddr, fc, regAddr, qty) {
    var frame = [
        slaveAddr & 0xFF, fc & 0xFF,
        (regAddr >> 8) & 0xFF, regAddr & 0xFF,
        (qty >> 8) & 0xFF, qty & 0xFF
    ];
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

function sendRequest(fc, regAddr, qty, callback) {
    if (!state.isReady) { callback('Not ready', null); return; }
    if (state.pendingRequest) { callback('Busy', null); return; }

    var frame = buildFrame(CONFIG.SLAVE_ID, fc, regAddr, qty);
    debug('TX: ' + bytesToHex(frame));

    state.pendingRequest = { callback: callback };
    state.rxBuffer = [];

    state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
        if (!state.pendingRequest) return;
        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        debug('Timeout');
        cb('Timeout', null);
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

    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excCrc = calcCRC(state.rxBuffer.slice(0, 3));
            var recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
            if (excCrc === recvCrc) {
                clearResponseTimer();
                var exCode = state.rxBuffer[2];
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                state.rxBuffer = [];
                cb('Exception 0x' + toHex(exCode), null);
            }
        }
        return;
    }

    var byteCount = state.rxBuffer[2];
    var expectedLen = 3 + byteCount + 2;
    if (state.rxBuffer.length < expectedLen) return;

    var frame = state.rxBuffer.slice(0, expectedLen);
    var crc = calcCRC(frame.slice(0, expectedLen - 2));
    var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
    if (crc !== recvCrc) { debug('CRC error'); return; }

    debug('RX: ' + bytesToHex(frame));
    clearResponseTimer();

    var payload = frame.slice(3, 3 + byteCount);
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

/* === SEN0492 API === */

/**
 * Read distance in mm (register 0x34).
 * @param {function} callback - callback(error, distance_mm)
 */
function readDistance(callback) {
    sendRequest(0x03, 0x34, 1, function(err, data) {
        if (err) { callback(err, null); return; }
        callback(null, (data[0] << 8) | data[1]);
    });
}

/**
 * Read output state / status code (register 0x35).
 * @param {function} callback - callback(error, status_code)
 */
function readStatus(callback) {
    sendRequest(0x03, 0x35, 1, function(err, data) {
        if (err) { callback(err, null); return; }
        callback(null, (data[0] << 8) | data[1]);
    });
}

/* === POLL === */

function poll() {
    readDistance(function(err, dist) {
        if (err) { print('[SEN0492] Distance error: ' + err); return; }
        readStatus(function(err, st) {
            if (err) { print('[SEN0492] Status error: ' + err); return; }
            print('[SEN0492] Distance: ' + dist + ' mm  Status: ' + statusName(st));
        });
    });
}

/* === INIT === */

function init() {
    print('DFRobot SEN0492 Laser Ranging Sensor');
    print('=====================================');
    print('Slave: 0x' + toHex(CONFIG.SLAVE_ID) +
          '  Baud: ' + CONFIG.BAUD_RATE +
          '  Mode: ' + CONFIG.MODE);
    print('');

    state.uart = UART.get();
    if (!state.uart) { print('ERROR: UART not available'); return; }

    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print('ERROR: UART configure failed');
        return;
    }

    state.uart.recv(onReceive);
    state.isReady = true;

    print('Polling every ' + (CONFIG.POLL_INTERVAL / 1000) + 's');
    print('');

    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
}

init();
