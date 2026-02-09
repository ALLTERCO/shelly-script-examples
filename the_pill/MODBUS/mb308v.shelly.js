/**
 * @title CWT-MB308V MODBUS example
 * @description Example integration for the ComWinTop MB308V IO module over
 *   MODBUS-RTU.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/mb308v.shelly.js
 */

/**
 * CWT-MB308V MODBUS IO Module Example
 *
 * Example script demonstrating communication with ComWinTop CWT-MB308V
 * GPIO expander module via MODBUS-RTU protocol.
 *
 * CWT-MB308V Specifications:
 * - 8 Analog Inputs (AI): 4-20mA / 0-5V / 0-10V (configurable)
 * - 4 Analog Outputs (AO): 0-10V / 4-20mA
 * - 8 Digital Inputs (DI): Dry contact / NPN
 * - 12 Digital Outputs (DO): Relay outputs
 *
 * Hardware connection:
 * - RS485 Module A (D+) -> MB308V A (D+)
 * - RS485 Module B (D-) -> MB308V B (D-)
 * - RS485 Module RO -> Shelly RX (GPIO)
 * - RS485 Module DI -> Shelly TX (GPIO)
 * - Power: 7-35VDC to MB308V
 *
 * Default settings: 9600 baud, 8N1, Slave ID: 1
 *
 * Reference: https://github.com/bgerp/ztm/blob/master/Zontromat/devices/vendors/cwt/mb308v/mb308v.py
 */

/* === CONFIG === */
var CONFIG = {
    // UART settings
    BAUD_RATE: 9600,
    MODE: "8N1",

    // MODBUS settings
    SLAVE_ID: 1,
    RESPONSE_TIMEOUT: 1000,

    // Polling interval (ms)
    POLL_INTERVAL: 5000,

    // Debug mode
    DEBUG: true
};

/* === CWT-MB308V REGISTER MAP === */
var MB308V = {
    // Digital Outputs (Relays) - 12 coils
    DO_COUNT: 12,
    DO_START_ADDR: 0,

    // Digital Inputs - 8 inputs
    DI_COUNT: 8,
    DI_START_ADDR: 0,

    // Analog Outputs - 4 registers (0-24000 = 0-10V or 4-20mA)
    AO_COUNT: 4,
    AO_START_ADDR: 0,
    AO_MAX_VALUE: 24000,

    // Analog Inputs - 8 registers (0-10216 typical for 4-20mA)
    AI_COUNT: 8,
    AI_START_ADDR: 0,
    AI_MAX_VALUE: 10216
};

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_COILS: 0x01,
    READ_DISCRETE_INPUTS: 0x02,
    READ_HOLDING_REGISTERS: 0x03,
    READ_INPUT_REGISTERS: 0x04,
    WRITE_SINGLE_COIL: 0x05,
    WRITE_SINGLE_REGISTER: 0x06
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
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
        hex += toHex(bytes[i]);
        if (i < bytes.length - 1) hex += " ";
    }
    return hex;
}

function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[MB308V] " + msg);
    }
}

function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        var index = (crc ^ bytes[i]) & 0xFF;
        crc = (crc >> 8) ^ CRC_TABLE[index];
    }
    return crc;
}

function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

function buildFrame(slaveAddr, functionCode, data) {
    var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
    if (data) {
        for (var i = 0; i < data.length; i++) {
            frame.push(data[i] & 0xFF);
        }
    }
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

/* === MODBUS CORE === */

function sendRequest(functionCode, data, callback) {
    if (!state.isReady) {
        callback("Not initialized", null);
        return;
    }
    if (state.pendingRequest) {
        callback("Request pending", null);
        return;
    }

    var frame = buildFrame(CONFIG.SLAVE_ID, functionCode, data);
    debug("TX: " + bytesToHex(frame));

    state.pendingRequest = {
        functionCode: functionCode,
        callback: callback
    };
    state.rxBuffer = [];

    state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
        if (state.pendingRequest) {
            var cb = state.pendingRequest.callback;
            state.pendingRequest = null;
            debug("Timeout");
            cb("Timeout", null);
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

    // Check exception
    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excFrame = state.rxBuffer.slice(0, 5);
            var crc = calcCRC(excFrame.slice(0, 3));
            var recvCrc = excFrame[3] | (excFrame[4] << 8);
            if (crc === recvCrc) {
                clearTimeout();
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                state.rxBuffer = [];
                cb("Exception: 0x" + toHex(state.rxBuffer[2]), null);
            }
        }
        return;
    }

    var expectedLen = getExpectedLength(fc);
    if (expectedLen === 0 || state.rxBuffer.length < expectedLen) return;

    var frame = state.rxBuffer.slice(0, expectedLen);
    var crc = calcCRC(frame.slice(0, expectedLen - 2));
    var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

    if (crc !== recvCrc) {
        debug("CRC error");
        return;
    }

    debug("RX: " + bytesToHex(frame));
    clearTimeout();

    var responseData = frame.slice(2, expectedLen - 2);
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, responseData);
}

function getExpectedLength(fc) {
    switch (fc) {
        case FC.READ_COILS:
        case FC.READ_DISCRETE_INPUTS:
        case FC.READ_HOLDING_REGISTERS:
        case FC.READ_INPUT_REGISTERS:
            if (state.rxBuffer.length >= 3) {
                return 3 + state.rxBuffer[2] + 2;
            }
            return 0;
        case FC.WRITE_SINGLE_COIL:
        case FC.WRITE_SINGLE_REGISTER:
            return 8;
        default:
            return 0;
    }
}

function clearTimeout() {
    if (state.responseTimer) {
        Timer.clear(state.responseTimer);
        state.responseTimer = null;
    }
}

/* === MB308V API === */

/**
 * Read all Digital Inputs (8 inputs)
 * @param {function} callback - callback(error, inputs[8])
 */
function readDigitalInputs(callback) {
    var data = [0x00, 0x00, 0x00, MB308V.DI_COUNT];
    sendRequest(FC.READ_DISCRETE_INPUTS, data, function(err, response) {
        if (err) {
            callback(err, null);
            return;
        }
        var inputs = [];
        for (var i = 0; i < MB308V.DI_COUNT; i++) {
            var byteIdx = Math.floor(i / 8) + 1;
            var bitIdx = i % 8;
            if (byteIdx < response.length) {
                inputs.push((response[byteIdx] >> bitIdx) & 0x01);
            }
        }
        callback(null, inputs);
    });
}

/**
 * Read all Digital Outputs / Relays (12 coils)
 * @param {function} callback - callback(error, relays[12])
 */
function readDigitalOutputs(callback) {
    var data = [0x00, 0x00, 0x00, MB308V.DO_COUNT];
    sendRequest(FC.READ_COILS, data, function(err, response) {
        if (err) {
            callback(err, null);
            return;
        }
        var relays = [];
        for (var i = 0; i < MB308V.DO_COUNT; i++) {
            var byteIdx = Math.floor(i / 8) + 1;
            var bitIdx = i % 8;
            if (byteIdx < response.length) {
                relays.push((response[byteIdx] >> bitIdx) & 0x01);
            }
        }
        callback(null, relays);
    });
}

/**
 * Write single Digital Output / Relay
 * @param {number} channel - Relay channel (0-11)
 * @param {boolean} value - true = ON, false = OFF
 * @param {function} callback - callback(error, success)
 */
function writeDigitalOutput(channel, value, callback) {
    if (channel < 0 || channel >= MB308V.DO_COUNT) {
        callback("Invalid channel: " + channel, false);
        return;
    }
    var data = [0x00, channel & 0xFF, value ? 0xFF : 0x00, 0x00];
    sendRequest(FC.WRITE_SINGLE_COIL, data, function(err, response) {
        callback(err, !err);
    });
}

/**
 * Read all Analog Inputs (8 channels)
 * @param {function} callback - callback(error, values[8])
 */
function readAnalogInputs(callback) {
    var data = [0x00, 0x00, 0x00, MB308V.AI_COUNT];
    sendRequest(FC.READ_INPUT_REGISTERS, data, function(err, response) {
        if (err) {
            callback(err, null);
            return;
        }
        var values = [];
        for (var i = 1; i < response.length - 1; i += 2) {
            var value = (response[i] << 8) | response[i + 1];
            values.push(value);
        }
        callback(null, values);
    });
}

/**
 * Read all Analog Outputs (4 channels)
 * @param {function} callback - callback(error, values[4])
 */
function readAnalogOutputs(callback) {
    var data = [0x00, 0x00, 0x00, MB308V.AO_COUNT];
    sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, response) {
        if (err) {
            callback(err, null);
            return;
        }
        var values = [];
        for (var i = 1; i < response.length - 1; i += 2) {
            var value = (response[i] << 8) | response[i + 1];
            values.push(value);
        }
        callback(null, values);
    });
}

/**
 * Write single Analog Output
 * @param {number} channel - AO channel (0-3)
 * @param {number} value - Value (0-24000)
 * @param {function} callback - callback(error, success)
 */
function writeAnalogOutput(channel, value, callback) {
    if (channel < 0 || channel >= MB308V.AO_COUNT) {
        callback("Invalid channel: " + channel, false);
        return;
    }
    if (value < 0) value = 0;
    if (value > MB308V.AO_MAX_VALUE) value = MB308V.AO_MAX_VALUE;

    var data = [0x00, channel & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, response) {
        callback(err, !err);
    });
}

/**
 * Convert raw AI value to milliamps (4-20mA mode)
 * @param {number} raw - Raw value (0-10216)
 * @returns {number} Current in mA
 */
function aiToMilliamps(raw) {
    // 0 = 4mA, 10216 = 20mA (typical)
    return 4.0 + (raw / MB308V.AI_MAX_VALUE) * 16.0;
}

/**
 * Convert raw AI value to voltage (0-10V mode)
 * @param {number} raw - Raw value
 * @returns {number} Voltage in V
 */
function aiToVoltage(raw) {
    return (raw / MB308V.AI_MAX_VALUE) * 10.0;
}

/**
 * Convert milliamps to raw AO value (4-20mA mode)
 * @param {number} mA - Current in mA (4-20)
 * @returns {number} Raw value
 */
function milliampsToAo(mA) {
    if (mA < 4) mA = 4;
    if (mA > 20) mA = 20;
    return Math.round(((mA - 4) / 16.0) * MB308V.AO_MAX_VALUE);
}

/**
 * Convert voltage to raw AO value (0-10V mode)
 * @param {number} volts - Voltage (0-10)
 * @returns {number} Raw value
 */
function voltageToAo(volts) {
    if (volts < 0) volts = 0;
    if (volts > 10) volts = 10;
    return Math.round((volts / 10.0) * MB308V.AO_MAX_VALUE);
}

/* === DEMO POLLING === */

function pollAllInputs() {
    debug("--- Polling MB308V ---");

    // Read Digital Inputs
    readDigitalInputs(function(err, inputs) {
        if (err) {
            debug("DI Error: " + err);
            return;
        }
        var diStr = "";
        for (var i = 0; i < inputs.length; i++) {
            diStr += "DI" + i + ":" + inputs[i] + " ";
        }
        print("[DI] " + diStr);

        // Chain: Read Analog Inputs
        Timer.set(100, false, function() {
            readAnalogInputs(function(err, values) {
                if (err) {
                    debug("AI Error: " + err);
                    return;
                }
                var aiStr = "";
                for (var i = 0; i < values.length; i++) {
                    var mA = aiToMilliamps(values[i]).toFixed(2);
                    aiStr += "AI" + i + ":" + mA + "mA ";
                }
                print("[AI] " + aiStr);
            });
        });
    });
}

/* === INITIALIZATION === */

function init() {
    print("CWT-MB308V MODBUS IO Module");
    print("===========================");
    print("8AI + 4AO + 8DI + 12DO");
    print("");

    state.uart = UART.get();
    if (!state.uart) {
        print("ERROR: UART not available");
        return;
    }

    if (!state.uart.configure({
        baud: CONFIG.BAUD_RATE,
        mode: CONFIG.MODE
    })) {
        print("ERROR: UART configuration failed");
        return;
    }

    state.uart.recv(onReceive);
    state.isReady = true;

    debug("UART: " + CONFIG.BAUD_RATE + " baud, " + CONFIG.MODE);
    debug("Slave ID: " + CONFIG.SLAVE_ID);
    print("");

    // Start polling
    print("Starting input polling every " + (CONFIG.POLL_INTERVAL / 1000) + "s...");
    print("");

    // Initial poll
    Timer.set(500, false, pollAllInputs);

    // Periodic polling
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollAllInputs);

    // Example usage
    print("API Functions:");
    print("  readDigitalInputs(cb)        - Read 8 DI");
    print("  readDigitalOutputs(cb)       - Read 12 DO");
    print("  writeDigitalOutput(ch, val, cb) - Set relay");
    print("  readAnalogInputs(cb)         - Read 8 AI");
    print("  readAnalogOutputs(cb)        - Read 4 AO");
    print("  writeAnalogOutput(ch, val, cb)  - Set AO");
    print("");
    print("Example: Turn on relay 0");
    print("  writeDigitalOutput(0, true, function(e,s){print(s);});");
}

init();
