/**
 * @title MODBUS-RTU HTTP Bridge
 * @description HTTP endpoint that bridges MODBUS RTU over UART. Accepts a
 *   register descriptor as JSON, performs MODBUS RTU read/write via The Pill
 *   UART, and returns the result as JSON.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/HTTP-Bridge/modbus_http_bridge.shelly.js
 */

/**
 * MODBUS-RTU HTTP Bridge
 *
 * Exposes an HTTP endpoint that accepts a MODBUS register descriptor and
 * performs the corresponding RTU read or write via UART (RS485).
 *
 * Endpoint:
 *   GET  http://<SHELLY-IP>/script/<ID>/modbus?register=<URL-encoded-JSON>[&slave=<id>]
 *   POST http://<SHELLY-IP>/script/<ID>/modbus
 *        Body (JSON): {"register": <descriptor>, "slave": <id>}
 *        Body (JSON): <descriptor>   (register descriptor directly)
 *
 * Register descriptor format:
 *   {
 *     "name": "Active Power",
 *     "units": "W",
 *     "scale": 1,
 *     "rights": "RW",        // "R" = read-only, "RW" = read-write
 *     "reg": {
 *       "addr": 0,           // register address (0-65535)
 *       "rtype": "holding",  // "holding" | "input" | "coil" | "discrete"
 *       "itype": "u16",      // "u16" | "i16" | "u32" | "i32" | "f32"
 *       "bo": "BE",          // byte order within register: "BE" or "LE"
 *       "wo": "BE"           // word order for 32-bit types:  "BE" or "LE"
 *     },
 *     "value": null,         // null => read; number => write (raw register value)
 *     "human_readable": null // filled on response (value * scale)
 *   }
 *
 * Response on success:
 *   Same descriptor with "value" and "human_readable" populated.
 * Response on error:
 *   {"error": "<message>"}
 *
 * Write rules:
 *   - If "value" is not null and "rights" == "RW" => write operation.
 *   - Otherwise => read operation.
 *   - For coils: value 0 = OFF, any non-zero = ON.
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
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 115200,
    MODE: '8N1',            // "8N1", "8E1", "8O1"
    DEFAULT_SLAVE: 1,       // default MODBUS slave address
    RESPONSE_TIMEOUT: 1000, // ms - max wait for slave response
    DEBUG: true
};

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_COILS:               0x01,
    READ_DISCRETE_INPUTS:     0x02,
    READ_HOLDING_REGISTERS:   0x03,
    READ_INPUT_REGISTERS:     0x04,
    WRITE_SINGLE_COIL:        0x05,
    WRITE_SINGLE_REGISTER:    0x06,
    WRITE_MULTIPLE_REGISTERS: 0x10
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
    responseTimer: null
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
        print("[BRIDGE] " + msg);
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
    frame.push(crc & 0xFF);        // CRC low byte
    frame.push((crc >> 8) & 0xFF); // CRC high byte
    return frame;
}

/* === VALUE DECODING === */

/**
 * Reconstruct IEEE 754 single-precision float from 32-bit integer bits.
 */
function float32FromBits(bits) {
    if ((bits & 0x7FFFFFFF) === 0) return 0.0;
    var sign = (bits >>> 31) ? -1 : 1;
    var exp  = (bits >>> 23) & 0xFF;
    var mant = bits & 0x7FFFFF;
    if (exp === 0xFF) {
        return sign * Infinity;
    }
    if (exp === 0) {
        // Subnormal
        return sign * mant * Math.pow(2, -149);
    }
    return sign * (1 + mant / 8388608) * Math.pow(2, exp - 127);
}

/**
 * Decode register bytes to a numeric value.
 *
 * @param {number[]} bytes - Raw bytes from the MODBUS response (register data only,
 *                            no byteCount prefix, no CRC).
 * @param {string}   itype - "u16" | "i16" | "u32" | "i32" | "f32"
 * @param {string}   bo    - byte order within each 16-bit register: "BE" | "LE"
 * @param {string}   wo    - word order for 32-bit types: "BE" (high word first) | "LE"
 * @returns {number|null}
 */
function decodeValue(bytes, itype, bo, wo) {
    var raw, b0, b1, b2, b3, bits32;

    if (itype === "u16" || itype === "i16") {
        if (bytes.length < 2) return null;
        if (bo === "LE") {
            raw = (bytes[1] << 8) | bytes[0];
        } else {
            raw = (bytes[0] << 8) | bytes[1];
        }
        raw = raw & 0xFFFF;
        if (itype === "i16" && raw >= 0x8000) raw -= 0x10000;
        return raw;
    }

    if (itype === "u32" || itype === "i32" || itype === "f32") {
        if (bytes.length < 4) return null;

        // Apply word order: wo="BE" => bytes[0..1]=high word, bytes[2..3]=low word
        //                   wo="LE" => bytes[0..1]=low word,  bytes[2..3]=high word
        if (wo === "LE") {
            // Swap word positions
            var tmp0 = bytes[0]; var tmp1 = bytes[1];
            bytes[0] = bytes[2]; bytes[1] = bytes[3];
            bytes[2] = tmp0;     bytes[3] = tmp1;
        }

        // Apply byte order within each 16-bit word
        if (bo === "LE") {
            b0 = bytes[1]; b1 = bytes[0];
            b2 = bytes[3]; b3 = bytes[2];
        } else {
            b0 = bytes[0]; b1 = bytes[1];
            b2 = bytes[2]; b3 = bytes[3];
        }

        bits32 = (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0);

        if (itype === "u32") return bits32;
        if (itype === "i32") return bits32 >= 0x80000000 ? bits32 - 4294967296 : bits32;
        if (itype === "f32") return float32FromBits(bits32);
    }

    return null;
}

/* === VALUE ENCODING (for writes) === */

/**
 * Convert IEEE 754 float to 32-bit integer bits.
 */
function float32ToBits(f) {
    if (f === 0) return 0;
    var sign = (f < 0) ? 1 : 0;
    if (sign) f = -f;
    var exp = Math.floor(Math.log(f) / 0.6931471805599453); // log(2)
    var mant = f / Math.pow(2, exp) - 1;
    exp += 127;
    if (exp <= 0) return 0;
    if (exp >= 255) return (sign << 31) | (0xFF << 23);
    var mantBits = Math.round(mant * 8388608) & 0x7FFFFF;
    return ((sign << 31) | (exp << 23) | mantBits) >>> 0;
}

/**
 * Encode a numeric value to register bytes for writing.
 *
 * @param {number} value - Raw value to encode (integer for u/i types, float for f32)
 * @param {string} itype - "u16" | "i16" | "u32" | "i32" | "f32"
 * @param {string} bo    - byte order within each 16-bit register: "BE" | "LE"
 * @param {string} wo    - word order for 32-bit types: "BE" | "LE"
 * @returns {number[]} Array of bytes (2 bytes for 16-bit, 4 bytes for 32-bit)
 */
function encodeValue(value, itype, bo, wo) {
    var raw16, bits32, b0, b1, b2, b3, hb, lb, result;

    if (itype === "u16" || itype === "i16") {
        raw16 = value & 0xFFFF;
        if (bo === "LE") {
            return [raw16 & 0xFF, (raw16 >> 8) & 0xFF];
        } else {
            return [(raw16 >> 8) & 0xFF, raw16 & 0xFF];
        }
    }

    if (itype === "u32" || itype === "i32" || itype === "f32") {
        if (itype === "f32") {
            bits32 = float32ToBits(value);
        } else {
            bits32 = (value >>> 0);
        }

        // Extract big-endian bytes from bits32
        b0 = (bits32 >> 24) & 0xFF;
        b1 = (bits32 >> 16) & 0xFF;
        b2 = (bits32 >>  8) & 0xFF;
        b3 =  bits32        & 0xFF;

        // Apply byte order within each word
        if (bo === "LE") {
            // Swap within each 16-bit word
            hb = [b1, b0]; // high word bytes swapped
            lb = [b3, b2]; // low word bytes swapped
        } else {
            hb = [b0, b1];
            lb = [b2, b3];
        }

        // Apply word order: wo="BE" => high word first
        if (wo === "BE") {
            result = [hb[0], hb[1], lb[0], lb[1]];
        } else {
            result = [lb[0], lb[1], hb[0], hb[1]];
        }
        return result;
    }

    return [];
}

/* === MODBUS CORE === */

function sendRequest(slaveId, functionCode, data, callback) {
    if (!state.isReady) {
        callback("MODBUS not initialized", null);
        return;
    }
    if (state.pendingRequest) {
        callback("Request pending, try again", null);
        return;
    }

    var frame = buildFrame(slaveId, functionCode, data);
    debug("TX [slave=" + slaveId + "]: " + bytesToHex(frame));

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

    // Exception response: high bit set on FC
    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excSlice = state.rxBuffer.slice(0, 5);
            var excCrc = calcCRC(excSlice.slice(0, 3));
            var excRecv = excSlice[3] | (excSlice[4] << 8);
            if (excCrc === excRecv) {
                clearResponseTimeout();
                var exCode = state.rxBuffer[2];
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                state.rxBuffer = [];
                cb("MODBUS exception 0x" + toHex(exCode), null);
            }
        }
        return;
    }

    // Determine expected frame length
    var expectedLen = 0;
    if ((fc === FC.READ_COILS ||
         fc === FC.READ_DISCRETE_INPUTS ||
         fc === FC.READ_HOLDING_REGISTERS ||
         fc === FC.READ_INPUT_REGISTERS) && state.rxBuffer.length >= 3) {
        // slave(1) + FC(1) + byteCount(1) + data(N) + CRC(2)
        expectedLen = 3 + state.rxBuffer[2] + 2;
    } else if (fc === FC.WRITE_SINGLE_COIL ||
               fc === FC.WRITE_SINGLE_REGISTER) {
        // Echo: slave(1) + FC(1) + addr(2) + value(2) + CRC(2) = 8
        expectedLen = 8;
    } else if (fc === FC.WRITE_MULTIPLE_REGISTERS) {
        // slave(1) + FC(1) + addr(2) + quantity(2) + CRC(2) = 8
        expectedLen = 8;
    }

    if (expectedLen === 0 || state.rxBuffer.length < expectedLen) return;

    var frame = state.rxBuffer.slice(0, expectedLen);
    var crc = calcCRC(frame.slice(0, expectedLen - 2));
    var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

    if (crc !== recvCrc) {
        debug("CRC error: expected " + toHex(crc & 0xFF) + toHex((crc >> 8) & 0xFF) +
              " got " + toHex(recvCrc & 0xFF) + toHex((recvCrc >> 8) & 0xFF));
        // Discard one byte and retry
        state.rxBuffer.shift();
        processResponse();
        return;
    }

    debug("RX: " + bytesToHex(frame));
    clearResponseTimeout();

    // Extract payload (after slave+FC, before CRC)
    var payload = frame.slice(2, expectedLen - 2);
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, payload);
}

function clearResponseTimeout() {
    if (state.responseTimer) {
        Timer.clear(state.responseTimer);
        state.responseTimer = null;
    }
}

/* === MODBUS API === */

/**
 * Read a register/coil and return decoded value via callback.
 * @param {number} slave       - MODBUS slave address
 * @param {object} reg         - reg descriptor: {addr, rtype, itype, bo, wo}
 * @param {function} callback  - callback(error, value)
 */
function modbusRead(slave, reg, callback) {
    var fc, regCount;

    if (reg.rtype === "holding") {
        fc = FC.READ_HOLDING_REGISTERS;
    } else if (reg.rtype === "input") {
        fc = FC.READ_INPUT_REGISTERS;
    } else if (reg.rtype === "coil") {
        fc = FC.READ_COILS;
    } else if (reg.rtype === "discrete") {
        fc = FC.READ_DISCRETE_INPUTS;
    } else {
        callback("Unknown rtype: " + reg.rtype, null);
        return;
    }

    // 32-bit types need 2 registers
    regCount = (reg.itype === "u32" || reg.itype === "i32" || reg.itype === "f32") ? 2 : 1;

    // Coils/discrete use bit count, not register count
    var quantity = regCount;

    var reqData = [
        (reg.addr >> 8) & 0xFF,
        reg.addr & 0xFF,
        (quantity >> 8) & 0xFF,
        quantity & 0xFF
    ];

    sendRequest(slave, fc, reqData, function(err, payload) {
        if (err) {
            callback(err, null);
            return;
        }

        var value;
        if (reg.rtype === "coil" || reg.rtype === "discrete") {
            // payload: [byteCount, byte0, ...]  bit 0 of byte0 = coil 0
            if (!payload || payload.length < 2) {
                callback("Short coil response", null);
                return;
            }
            value = (payload[1] & 0x01) ? 1 : 0;
        } else {
            // payload: [byteCount, regHi, regLo, ...]
            if (!payload || payload.length < 3) {
                callback("Short register response", null);
                return;
            }
            // Skip byteCount byte at payload[0]
            var regBytes = payload.slice(1);
            value = decodeValue(regBytes, reg.itype, reg.bo, reg.wo);
            if (value === null) {
                callback("Decode failed (insufficient bytes)", null);
                return;
            }
        }
        callback(null, value);
    });
}

/**
 * Write a value to a register/coil.
 * @param {number} slave       - MODBUS slave address
 * @param {object} reg         - reg descriptor: {addr, rtype, itype, bo, wo}
 * @param {number} value       - Raw value to write
 * @param {function} callback  - callback(error)
 */
function modbusWrite(slave, reg, value, callback) {
    var fc, reqData, encoded;

    if (reg.rtype === "coil") {
        fc = FC.WRITE_SINGLE_COIL;
        reqData = [
            (reg.addr >> 8) & 0xFF,
            reg.addr & 0xFF,
            value ? 0xFF : 0x00,
            0x00
        ];
        sendRequest(slave, fc, reqData, function(err) {
            callback(err || null);
        });
        return;
    }

    if (reg.rtype !== "holding") {
        callback("Write only supported for 'holding' and 'coil' register types");
        return;
    }

    if (reg.itype === "u16" || reg.itype === "i16") {
        fc = FC.WRITE_SINGLE_REGISTER;
        encoded = encodeValue(value, reg.itype, reg.bo, reg.wo);
        reqData = [
            (reg.addr >> 8) & 0xFF,
            reg.addr & 0xFF,
            encoded[0],
            encoded[1]
        ];
        sendRequest(slave, fc, reqData, function(err) {
            callback(err || null);
        });
        return;
    }

    if (reg.itype === "u32" || reg.itype === "i32" || reg.itype === "f32") {
        fc = FC.WRITE_MULTIPLE_REGISTERS;
        encoded = encodeValue(value, reg.itype, reg.bo, reg.wo);
        // FC 0x10: addr(2) + quantity(2) + byteCount(1) + data(4)
        reqData = [
            (reg.addr >> 8) & 0xFF,
            reg.addr & 0xFF,
            0x00, 0x02,          // quantity: 2 registers
            0x04,                // byte count: 4 bytes
            encoded[0], encoded[1], encoded[2], encoded[3]
        ];
        sendRequest(slave, fc, reqData, function(err) {
            callback(err || null);
        });
        return;
    }

    callback("Unsupported itype for write: " + reg.itype);
}

/* === HTTP UTILITIES === */

/**
 * URL-decode a percent-encoded string (handles %XX and + => space).
 */
function urlDecode(s) {
    var result = "";
    var i = 0;
    while (i < s.length) {
        var c = s[i];
        if (c === "+") {
            result += " ";
            i++;
        } else if (c === "%" && i + 2 < s.length) {
            var hex = s[i + 1] + s[i + 2];
            result += String.fromCharCode(parseInt(hex, 16));
            i += 3;
        } else {
            result += c;
            i++;
        }
    }
    return result;
}

/**
 * Parse query string into a key/value object.
 * Handles values with embedded '=' characters.
 */
function parseQS(qs) {
    var params = {};
    if (!qs || qs.length === 0) return params;
    var parts = qs.split("&");
    for (var i = 0; i < parts.length; i++) {
        var eqIdx = parts[i].indexOf("=");
        if (eqIdx < 0) {
            params[parts[i]] = null;
        } else {
            var key = parts[i].substring(0, eqIdx);
            var val = parts[i].substring(eqIdx + 1);
            params[key] = val;
        }
    }
    return params;
}

/**
 * Send a JSON error response.
 */
function sendError(response, code, msg) {
    response.code = code;
    response.body = JSON.stringify({ error: msg });
    response.send();
}

/* === HTTP HANDLER === */

function httpHandler(request, response) {
    var descriptor = null;
    var slave = CONFIG.DEFAULT_SLAVE;

    // --- Parse input ---
    if (request.method === "POST" && request.body && request.body.length > 0) {
        var body;
        try {
            body = JSON.parse(request.body);
        } catch (e) {
            sendError(response, 400, "Invalid JSON body: " + e);
            return;
        }
        // Accept {"register": {...}, "slave": N} or the descriptor directly
        if (body.register !== undefined) {
            descriptor = body.register;
            if (body.slave !== undefined) slave = body.slave;
        } else if (body.reg !== undefined) {
            descriptor = body;
        } else {
            sendError(response, 400, "Body must contain 'register' key or be a register descriptor");
            return;
        }
    } else {
        // GET: parse from query string
        var params = parseQS(request.query);
        if (!params.register) {
            sendError(response, 400, "Missing 'register' query parameter");
            return;
        }
        var regJson = urlDecode(params.register);
        try {
            descriptor = JSON.parse(regJson);
        } catch (e) {
            sendError(response, 400, "Invalid JSON in 'register': " + e);
            return;
        }
        if (params.slave) slave = parseInt(params.slave, 10);
    }

    // --- Validate descriptor ---
    if (!descriptor || !descriptor.reg) {
        sendError(response, 400, "Descriptor missing 'reg' field");
        return;
    }
    var reg = descriptor.reg;
    if (reg.addr === undefined || reg.addr === null) {
        sendError(response, 400, "reg.addr is required");
        return;
    }
    if (!reg.rtype) {
        sendError(response, 400, "reg.rtype is required");
        return;
    }
    if (!reg.itype) reg.itype = "u16";
    if (!reg.bo)    reg.bo    = "BE";
    if (!reg.wo)    reg.wo    = "BE";
    if (!descriptor.scale || descriptor.scale === 0) descriptor.scale = 1;

    // --- Check MODBUS state ---
    if (!state.isReady) {
        sendError(response, 503, "MODBUS not initialized");
        return;
    }
    if (state.pendingRequest) {
        sendError(response, 503, "Bus busy, try again");
        return;
    }

    // --- Determine read or write ---
    var isWrite = (descriptor.value !== null &&
                   descriptor.value !== undefined &&
                   descriptor.rights === "RW");

    if (isWrite) {
        debug("WRITE slave=" + slave + " addr=" + reg.addr +
              " itype=" + reg.itype + " value=" + descriptor.value);

        modbusWrite(slave, reg, descriptor.value, function(err) {
            if (err) {
                sendError(response, 500, err);
                return;
            }
            descriptor.human_readable = descriptor.value * descriptor.scale;
            response.code = 200;
            response.body = JSON.stringify(descriptor);
            response.send();
        });
    } else {
        debug("READ slave=" + slave + " addr=" + reg.addr + " itype=" + reg.itype);

        modbusRead(slave, reg, function(err, value) {
            if (err) {
                sendError(response, 500, err);
                return;
            }
            descriptor.value = value;
            descriptor.human_readable = value * descriptor.scale;
            response.code = 200;
            response.body = JSON.stringify(descriptor);
            response.send();
        });
    }
}

/* === INITIALIZATION === */

function init() {
    print("MODBUS-RTU HTTP Bridge");
    print("======================");

    state.uart = UART.get();
    if (!state.uart) {
        print("ERROR: UART not available");
        return;
    }

    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print("ERROR: UART configuration failed");
        return;
    }

    state.uart.recv(onReceive);
    state.isReady = true;

    HTTPServer.registerEndpoint("modbus", httpHandler);

    print("UART: " + CONFIG.BAUD_RATE + " baud, " + CONFIG.MODE);
    print("Default slave: " + CONFIG.DEFAULT_SLAVE);
    print("Endpoint: GET/POST /script/<ID>/modbus");
    print("");
    print("Example (GET):");
    print("  curl 'http://<IP>/script/<ID>/modbus?register=%7B%22name%22%3A%22W%22%2C%22units%22%3A%22W%22%2C%22scale%22%3A1%2C%22rights%22%3A%22R%22%2C%22reg%22%3A%7B%22addr%22%3A0%2C%22rtype%22%3A%22holding%22%2C%22itype%22%3A%22u16%22%2C%22bo%22%3A%22BE%22%2C%22wo%22%3A%22BE%22%7D%2C%22value%22%3Anull%2C%22human_readable%22%3Anull%7D'");
    print("");
    print("Example (POST):");
    print("  curl -X POST 'http://<IP>/script/<ID>/modbus' \\");
    print("       -H 'Content-Type: application/json' \\");
    print("       -d '{\"register\":{\"name\":\"W\",\"units\":\"W\",\"scale\":1,\"rights\":\"R\",\"reg\":{\"addr\":0,\"rtype\":\"holding\",\"itype\":\"u16\",\"bo\":\"BE\",\"wo\":\"BE\"},\"value\":null,\"human_readable\":null}}'");
}

init();
