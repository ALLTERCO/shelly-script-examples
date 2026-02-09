/**
 * @title MODBUS-RTU master library
 * @description UART MODBUS-RTU master implementation for reading and writing slave
 *   registers.
 * @status under-development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/modbus_rtu.shelly.js
 */

/**
 * MODBUS-RTU Master Library for Shelly
 *
 * Implements MODBUS-RTU protocol over UART for communicating with
 * MODBUS slave devices (sensors, PLCs, energy meters, etc.)
 *
 * Supported Function Codes:
 * - 0x01: Read Coils
 * - 0x02: Read Discrete Inputs
 * - 0x03: Read Holding Registers
 * - 0x04: Read Input Registers
 * - 0x05: Write Single Coil
 * - 0x06: Write Single Register
 *
 * Hardware connection:
 * - RS485 Module TX -> Shelly RX (GPIO)
 * - RS485 Module RX -> Shelly TX (GPIO)
 * - RS485 Module DE/RE -> Directly managed by module
 * - VCC -> 3.3V or 5V (depending on module)
 * - GND -> GND
 *
 * Protocol:
 * - Default baud rate: 9600 (configurable)
 * - Frame format: 8N1 or 8E1 (configurable)
 * - CRC-16 (polynomial 0xA001)
 */

/* === CONFIG === */
var CONFIG = {
    // UART settings
    BAUD_RATE: 9600,
    MODE: "8N1",            // "8N1", "8E1", "8O1"

    // MODBUS timing (ms)
    RESPONSE_TIMEOUT: 1000, // Max wait for slave response
    INTER_FRAME_DELAY: 50,  // Delay between frames (3.5 char times at 9600 = ~4ms)

    // Default slave address
    DEFAULT_SLAVE: 1,

    // Debug mode
    DEBUG: true
};

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_COILS: 0x01,
    READ_DISCRETE_INPUTS: 0x02,
    READ_HOLDING_REGISTERS: 0x03,
    READ_INPUT_REGISTERS: 0x04,
    WRITE_SINGLE_COIL: 0x05,
    WRITE_SINGLE_REGISTER: 0x06,
    WRITE_MULTIPLE_COILS: 0x0F,
    WRITE_MULTIPLE_REGISTERS: 0x10
};

/* === MODBUS EXCEPTION CODES === */
var EX = {
    ILLEGAL_FUNCTION: 0x01,
    ILLEGAL_DATA_ADDRESS: 0x02,
    ILLEGAL_DATA_VALUE: 0x03,
    SLAVE_DEVICE_FAILURE: 0x04,
    ACKNOWLEDGE: 0x05,
    SLAVE_DEVICE_BUSY: 0x06,
    MEMORY_PARITY_ERROR: 0x08,
    GATEWAY_PATH_UNAVAILABLE: 0x0A,
    GATEWAY_TARGET_FAILED: 0x0B
};

/* === STATE === */
var state = {
    uart: null,
    rxBuffer: [],
    isReady: false,
    pendingRequest: null,
    responseTimer: null
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

/* === HELPERS === */

/**
 * Convert byte to 2-char uppercase hex string
 */
function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

/**
 * Convert byte array to hex string
 */
function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
        hex += toHex(bytes[i]);
        if (i < bytes.length - 1) hex += " ";
    }
    return hex;
}

/**
 * Log debug messages
 */
function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[MODBUS] " + msg);
    }
}

/**
 * Calculate CRC-16 for MODBUS frame
 */
function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        var index = (crc ^ bytes[i]) & 0xFF;
        crc = (crc >> 8) ^ CRC_TABLE[index];
    }
    return crc;
}

/**
 * Convert byte array to binary string for UART write
 */
function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

/**
 * Build MODBUS request frame with CRC
 */
function buildFrame(slaveAddr, functionCode, data) {
    var frame = [slaveAddr & 0xFF, functionCode & 0xFF];

    if (data) {
        for (var i = 0; i < data.length; i++) {
            frame.push(data[i] & 0xFF);
        }
    }

    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);         // CRC low byte
    frame.push((crc >> 8) & 0xFF);  // CRC high byte

    return frame;
}

/**
 * Get exception message from code
 */
function getExceptionMessage(code) {
    switch (code) {
        case EX.ILLEGAL_FUNCTION: return "Illegal Function";
        case EX.ILLEGAL_DATA_ADDRESS: return "Illegal Data Address";
        case EX.ILLEGAL_DATA_VALUE: return "Illegal Data Value";
        case EX.SLAVE_DEVICE_FAILURE: return "Slave Device Failure";
        case EX.ACKNOWLEDGE: return "Acknowledge";
        case EX.SLAVE_DEVICE_BUSY: return "Slave Device Busy";
        case EX.MEMORY_PARITY_ERROR: return "Memory Parity Error";
        case EX.GATEWAY_PATH_UNAVAILABLE: return "Gateway Path Unavailable";
        case EX.GATEWAY_TARGET_FAILED: return "Gateway Target Failed";
        default: return "Unknown Exception (0x" + toHex(code) + ")";
    }
}

/* === MODBUS API === */

var MODBUS = {
    /**
     * Initialize MODBUS master
     * @returns {boolean} true if successful
     */
    init: function() {
        state.uart = UART.get();
        if (!state.uart) {
            print("[MODBUS] ERROR: UART not available");
            return false;
        }

        if (!state.uart.configure({
            baud: CONFIG.BAUD_RATE,
            mode: CONFIG.MODE
        })) {
            print("[MODBUS] ERROR: UART configuration failed");
            return false;
        }

        state.uart.recv(this._onReceive.bind(this));
        state.isReady = true;

        debug("Initialized @ " + CONFIG.BAUD_RATE + " baud, " + CONFIG.MODE);
        return true;
    },

    /**
     * Read Coils (FC 0x01)
     * @param {number} slave - Slave address (1-247)
     * @param {number} startAddr - Starting coil address (0-65535)
     * @param {number} quantity - Number of coils to read (1-2000)
     * @param {function} callback - callback(error, coils[])
     */
    readCoils: function(slave, startAddr, quantity, callback) {
        var data = [
            (startAddr >> 8) & 0xFF,
            startAddr & 0xFF,
            (quantity >> 8) & 0xFF,
            quantity & 0xFF
        ];

        this._sendRequest(slave, FC.READ_COILS, data, function(err, response) {
            if (err) {
                callback(err, null);
                return;
            }

            // Parse coil status from response bytes
            var coils = [];
            var byteCount = response[0];
            for (var i = 0; i < quantity; i++) {
                var byteIndex = Math.floor(i / 8) + 1;
                var bitIndex = i % 8;
                if (byteIndex < response.length) {
                    coils.push((response[byteIndex] >> bitIndex) & 0x01);
                }
            }
            callback(null, coils);
        });
    },

    /**
     * Read Discrete Inputs (FC 0x02)
     * @param {number} slave - Slave address (1-247)
     * @param {number} startAddr - Starting input address (0-65535)
     * @param {number} quantity - Number of inputs to read (1-2000)
     * @param {function} callback - callback(error, inputs[])
     */
    readDiscreteInputs: function(slave, startAddr, quantity, callback) {
        var data = [
            (startAddr >> 8) & 0xFF,
            startAddr & 0xFF,
            (quantity >> 8) & 0xFF,
            quantity & 0xFF
        ];

        this._sendRequest(slave, FC.READ_DISCRETE_INPUTS, data, function(err, response) {
            if (err) {
                callback(err, null);
                return;
            }

            var inputs = [];
            var byteCount = response[0];
            for (var i = 0; i < quantity; i++) {
                var byteIndex = Math.floor(i / 8) + 1;
                var bitIndex = i % 8;
                if (byteIndex < response.length) {
                    inputs.push((response[byteIndex] >> bitIndex) & 0x01);
                }
            }
            callback(null, inputs);
        });
    },

    /**
     * Read Holding Registers (FC 0x03)
     * @param {number} slave - Slave address (1-247)
     * @param {number} startAddr - Starting register address (0-65535)
     * @param {number} quantity - Number of registers to read (1-125)
     * @param {function} callback - callback(error, registers[])
     */
    readHoldingRegisters: function(slave, startAddr, quantity, callback) {
        var data = [
            (startAddr >> 8) & 0xFF,
            startAddr & 0xFF,
            (quantity >> 8) & 0xFF,
            quantity & 0xFF
        ];

        this._sendRequest(slave, FC.READ_HOLDING_REGISTERS, data, function(err, response) {
            if (err) {
                callback(err, null);
                return;
            }

            var registers = [];
            var byteCount = response[0];
            for (var i = 1; i < response.length - 1; i += 2) {
                var value = (response[i] << 8) | response[i + 1];
                registers.push(value);
            }
            callback(null, registers);
        });
    },

    /**
     * Read Input Registers (FC 0x04)
     * @param {number} slave - Slave address (1-247)
     * @param {number} startAddr - Starting register address (0-65535)
     * @param {number} quantity - Number of registers to read (1-125)
     * @param {function} callback - callback(error, registers[])
     */
    readInputRegisters: function(slave, startAddr, quantity, callback) {
        var data = [
            (startAddr >> 8) & 0xFF,
            startAddr & 0xFF,
            (quantity >> 8) & 0xFF,
            quantity & 0xFF
        ];

        this._sendRequest(slave, FC.READ_INPUT_REGISTERS, data, function(err, response) {
            if (err) {
                callback(err, null);
                return;
            }

            var registers = [];
            var byteCount = response[0];
            for (var i = 1; i < response.length - 1; i += 2) {
                var value = (response[i] << 8) | response[i + 1];
                registers.push(value);
            }
            callback(null, registers);
        });
    },

    /**
     * Write Single Coil (FC 0x05)
     * @param {number} slave - Slave address (1-247)
     * @param {number} coilAddr - Coil address (0-65535)
     * @param {boolean} value - true = ON, false = OFF
     * @param {function} callback - callback(error, success)
     */
    writeSingleCoil: function(slave, coilAddr, value, callback) {
        var data = [
            (coilAddr >> 8) & 0xFF,
            coilAddr & 0xFF,
            value ? 0xFF : 0x00,  // 0xFF00 = ON, 0x0000 = OFF
            0x00
        ];

        this._sendRequest(slave, FC.WRITE_SINGLE_COIL, data, function(err, response) {
            if (err) {
                callback(err, false);
                return;
            }
            callback(null, true);
        });
    },

    /**
     * Write Single Register (FC 0x06)
     * @param {number} slave - Slave address (1-247)
     * @param {number} regAddr - Register address (0-65535)
     * @param {number} value - Value to write (0-65535)
     * @param {function} callback - callback(error, success)
     */
    writeSingleRegister: function(slave, regAddr, value, callback) {
        var data = [
            (regAddr >> 8) & 0xFF,
            regAddr & 0xFF,
            (value >> 8) & 0xFF,
            value & 0xFF
        ];

        this._sendRequest(slave, FC.WRITE_SINGLE_REGISTER, data, function(err, response) {
            if (err) {
                callback(err, false);
                return;
            }
            callback(null, true);
        });
    },

    /**
     * Read a single holding register (convenience method)
     * @param {number} slave - Slave address
     * @param {number} regAddr - Register address
     * @param {function} callback - callback(error, value)
     */
    readRegister: function(slave, regAddr, callback) {
        this.readHoldingRegisters(slave, regAddr, 1, function(err, registers) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, registers[0]);
            }
        });
    },

    /**
     * Read a single coil (convenience method)
     * @param {number} slave - Slave address
     * @param {number} coilAddr - Coil address
     * @param {function} callback - callback(error, value)
     */
    readCoil: function(slave, coilAddr, callback) {
        this.readCoils(slave, coilAddr, 1, function(err, coils) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, coils[0] === 1);
            }
        });
    },

    /* === Internal Methods === */

    _sendRequest: function(slave, functionCode, data, callback) {
        if (!state.isReady) {
            callback("MODBUS not initialized", null);
            return;
        }

        if (state.pendingRequest) {
            callback("Request pending", null);
            return;
        }

        var frame = buildFrame(slave, functionCode, data);
        debug("TX: " + bytesToHex(frame));

        state.pendingRequest = {
            slave: slave,
            functionCode: functionCode,
            callback: callback,
            timestamp: Date.now()
        };

        state.rxBuffer = [];

        // Set response timeout
        state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
            if (state.pendingRequest) {
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                debug("Response timeout");
                cb("Timeout", null);
            }
        });

        state.uart.write(bytesToStr(frame));
    },

    _onReceive: function(data) {
        if (!data || data.length === 0) return;

        // Add bytes to buffer
        for (var i = 0; i < data.length; i++) {
            state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
        }

        // Try to process response
        this._processResponse();
    },

    _processResponse: function() {
        if (!state.pendingRequest) {
            state.rxBuffer = [];
            return;
        }

        // Minimum response: slave(1) + FC(1) + data(1) + CRC(2) = 5 bytes
        if (state.rxBuffer.length < 5) {
            return;
        }

        var slave = state.rxBuffer[0];
        var fc = state.rxBuffer[1];

        // Check for exception response (FC with high bit set)
        if (fc & 0x80) {
            if (state.rxBuffer.length >= 5) {
                // Validate CRC
                var excFrame = state.rxBuffer.slice(0, 5);
                var crc = calcCRC(excFrame.slice(0, 3));
                var receivedCrc = excFrame[3] | (excFrame[4] << 8);

                if (crc === receivedCrc) {
                    this._clearTimeout();
                    var exCode = state.rxBuffer[2];
                    var cb = state.pendingRequest.callback;
                    state.pendingRequest = null;
                    state.rxBuffer = [];
                    debug("Exception: " + getExceptionMessage(exCode));
                    cb("Exception: " + getExceptionMessage(exCode), null);
                }
            }
            return;
        }

        // Determine expected response length based on function code
        var expectedLen = this._getExpectedResponseLength(fc);
        if (expectedLen === 0 || state.rxBuffer.length < expectedLen) {
            return;
        }

        // Validate CRC
        var frame = state.rxBuffer.slice(0, expectedLen);
        var crc = calcCRC(frame.slice(0, expectedLen - 2));
        var receivedCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

        if (crc !== receivedCrc) {
            debug("CRC error: expected " + toHex(crc & 0xFF) + " " + toHex((crc >> 8) & 0xFF) +
                  ", got " + toHex(receivedCrc & 0xFF) + " " + toHex((receivedCrc >> 8) & 0xFF));
            return;
        }

        debug("RX: " + bytesToHex(frame));

        this._clearTimeout();

        // Extract data (without slave, FC, and CRC)
        var responseData = frame.slice(2, expectedLen - 2);

        var cb = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];

        cb(null, responseData);
    },

    _getExpectedResponseLength: function(fc) {
        switch (fc) {
            case FC.READ_COILS:
            case FC.READ_DISCRETE_INPUTS:
            case FC.READ_HOLDING_REGISTERS:
            case FC.READ_INPUT_REGISTERS:
                // slave(1) + FC(1) + byteCount(1) + data(N) + CRC(2)
                if (state.rxBuffer.length >= 3) {
                    return 3 + state.rxBuffer[2] + 2;
                }
                return 0;

            case FC.WRITE_SINGLE_COIL:
            case FC.WRITE_SINGLE_REGISTER:
                // Echo response: slave(1) + FC(1) + addr(2) + value(2) + CRC(2) = 8
                return 8;

            default:
                return 0;
        }
    },

    _clearTimeout: function() {
        if (state.responseTimer) {
            Timer.clear(state.responseTimer);
            state.responseTimer = null;
        }
    }
};

/* === INITIALIZATION === */

function init() {
    print("MODBUS-RTU Master Library");
    print("=========================");

    if (!MODBUS.init()) {
        print("ERROR: Failed to initialize MODBUS");
        return;
    }

    print("Ready! Use MODBUS.readHoldingRegisters(), etc.");
    print("");
    print("Example: Read 2 registers from slave 1, address 0:");
    print("  MODBUS.readHoldingRegisters(1, 0, 2, function(err, regs) {");
    print("    print('Registers:', JSON.stringify(regs));");
    print("  });");
}

init();
