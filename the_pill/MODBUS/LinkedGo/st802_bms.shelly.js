/**
 * @title LinkedGo ST802 Thermostat - BMS Modbus RTU Client
 * @description Modbus RTU master that simulates BMS (Building Management System)
 *   commands for the LinkedGo ST802 Youth Smart Thermostat over RS485.
 * @status under construction
 */

/**
 * LinkedGo ST802 Youth Smart Thermostat - BMS Client
 *
 * Communicates via RS485-2 (terminals A2/B2) which defaults to slave mode.
 *
 * Thermostat RS485-2 factory defaults:
 *   P05 = 0  (Slave)
 *   P06 = 3  (9600 baud)
 *   P07 = 1  (LinkedGo protocol 3.0)
 *   P08 = 1  (Slave ID 1)
 *
 * Register map (LinkedGo 3.0, all addresses in hex):
 *
 *   FC 03/06 - Read/Write holding registers:
 *     0x1001 (H00) Power          0=OFF 1=ON
 *     0x1003 (H02) System type    0=2pipe-AC 1=DC-fan 2=floor-only 3=AC+floor 17=4pipe-AC
 *     0x1004 (H03) Operating mode 0=Cooling 3=Dry 4=Heating 5=Floor 7=Ventilation
 *     0x1006 (H05) Heat/cool sel  0=Both 1=CoolOnly 2=HeatOnly
 *     0x1007 (H06) Fan speed      0=Auto 1=Low 2=Medium 3=High 4=Speed4 5=Speed5
 *     0x1008 (H07) Setpoint temp  raw * 0.1 = degC  (step 0.5degC, range H23-H24)
 *     0x1009 (H08) Humidity SP    raw * 0.1 = %   (range 40-75%)
 *     0x1018 (H23) Min setpoint   raw * 0.1 = degC  (default 50 = 5degC)
 *     0x1019 (H24) Max setpoint   raw * 0.1 = degC  (default 500 = 50degC -> clamp to 35degC)
 *
 *   FC 03 - Read only:
 *     0x2101 (O00) Room temp      raw * 0.1 = degC
 *     0x2102 (O01) Humidity       raw * 0.1 = %
 *     0x2103 (O02) Floor temp     raw * 0.1 = degC
 *     0x2110 (O14) Relay status   bitmask (see RELAYS below)
 *     0x211A       Alarm          bit0 = room sensor failure
 *
 * Hardware wiring:
 *   Shelly TX  -->  RS485 module DI
 *   Shelly RX  -->  RS485 module RO
 *   RS485 A (D+) -> Thermostat A2
 *   RS485 B (D-) -> Thermostat B2
 *   GND          -> Thermostat GND
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",

    SLAVE_ID: 1,
    RESPONSE_TIMEOUT: 1000,  // ms

    POLL_INTERVAL: 30000,    // Status read period  (ms)
    CMD_INTERVAL:  60000,    // BMS command cycle period (ms)

    DEBUG: true
};

/* === ENABLE FLAGS ===
 * Set any flag to false to disable that poll action or command scenario.
 * All other logic stays intact -- flip back to true to re-enable.
 */
var ENABLE = {
    // Poll actions (pollStatus)
    POLL_TEMPERATURES: true,
    POLL_RELAYS:       true,
    POLL_ALARM:        true,

    // BMS command scenarios (CMD_SCENARIOS keys)
    CMD_MORNING_HEAT:  false,
    CMD_COOLING:       false,
    CMD_ECONOMY_HEAT:  false,
    CMD_VENTILATION:   false,
    CMD_DRY:           false,
    CMD_FLOOR_HEAT:    false,
    CMD_NIGHT_SETBACK: false,
    CMD_STANDBY:       false
};

/* === ST802 REGISTER ADDRESSES (hex) === */
var REG = {
    // Read / Write (FC 03 / 06)
    POWER:       0x1001,  // H00
    SYS_TYPE:    0x1003,  // H02
    MODE:        0x1004,  // H03
    HC_SELECT:   0x1006,  // H05
    FAN_SPEED:   0x1007,  // H06
    SETPOINT:    0x1008,  // H07  raw * 0.1 = degC
    HUMIDITY_SP: 0x1009,  // H08  raw * 0.1 = %
    MIN_SP:      0x1018,  // H23  raw * 0.1 = degC
    MAX_SP:      0x1019,  // H24  raw * 0.1 = degC

    // Read only (FC 03)
    ROOM_TEMP:   0x2101,  // O00  raw * 0.1 = degC
    HUMIDITY:    0x2102,  // O01  raw * 0.1 = %
    FLOOR_TEMP:  0x2103,  // O02  raw * 0.1 = degC
    RELAY_STATE: 0x2110,  // O14  bitmask
    ALARM:       0x211A   // bit0 = room sensor failure
};

/* === ENUMERATION VALUES === */
var POWER = { OFF: 0, ON: 1 };

var MODE = {
    COOLING:       0,
    DRY:           3,
    HEATING:       4,
    FLOOR_HEATING: 5,
    VENTILATION:   7
};

var FAN = {
    AUTO:   0,
    LOW:    1,
    MEDIUM: 2,
    HIGH:   3,
    SPD4:   4,
    SPD5:   5
};

var HC = { BOTH: 0, COOL_ONLY: 1, HEAT_ONLY: 2 };

/* Relay bitmask positions (O14 / 0x2110) */
var RELAYS = {
    HIGH_SPEED:      0,  // bit0
    MEDIUM_SPEED:    1,  // bit1
    LOW_SPEED:       2,  // bit2
    FAN_COIL_VALVE:  3,  // bit3
    FLOOR_VALVE:     4,  // bit4
    DRY_CONTACT:     5   // bit5
};

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_HOLDING_REGISTERS: 0x03,
    WRITE_SINGLE_REGISTER:  0x06
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
    pollTimer: null,
    cmdTimer: null,
    cmdStep: 0
};

/* === HELPERS === */

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

function toHex16(n) {
    return toHex((n >> 8) & 0xFF) + toHex(n & 0xFF);
}

function bytesToHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        s += toHex(bytes[i]);
        if (i < bytes.length - 1) s += " ";
    }
    return s;
}

function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[ST802] " + msg);
    }
}

function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        var idx = (crc ^ bytes[i]) & 0xFF;
        crc = (crc >> 8) ^ CRC_TABLE[idx];
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
    for (var i = 0; i < data.length; i++) {
        frame.push(data[i] & 0xFF);
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

    state.pendingRequest = { functionCode: functionCode, callback: callback };
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

    // Exception response: FC with high bit set
    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excFrame = state.rxBuffer.slice(0, 5);
            var excCrc = calcCRC(excFrame.slice(0, 3));
            var excRecv = excFrame[3] | (excFrame[4] << 8);
            if (excCrc === excRecv) {
                clearResponseTimer();
                var excCode = state.rxBuffer[2];
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                state.rxBuffer = [];
                cb("Modbus exception 0x" + toHex(excCode), null);
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
    clearResponseTimer();

    var responseData = frame.slice(2, expectedLen - 2);
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, responseData);
}

function getExpectedLength(fc) {
    switch (fc) {
        case FC.READ_HOLDING_REGISTERS:
            if (state.rxBuffer.length >= 3) {
                return 3 + state.rxBuffer[2] + 2;
            }
            return 0;
        case FC.WRITE_SINGLE_REGISTER:
            return 8;  // echo: slave(1)+FC(1)+addr(2)+value(2)+CRC(2)
        default:
            return 0;
    }
}

function clearResponseTimer() {
    if (state.responseTimer) {
        Timer.clear(state.responseTimer);
        state.responseTimer = null;
    }
}

/* === REGISTER DECODE HELPERS === */

/**
 * Decode raw register value to degrees Celsius (factor 0.1)
 * @param {number} raw
 * @returns {number}
 */
function rawToTemp(raw) {
    return raw * 0.1;
}

/**
 * Encode temperature in degC to raw register value (rounded to 0.5degC step)
 * @param {number} degC
 * @returns {number}
 */
function tempToRaw(degC) {
    // Round to nearest 0.5degC then multiply by 10
    return Math.round(degC * 2) * 5;
}

/**
 * Decode raw humidity register value to percent (factor 0.1)
 * @param {number} raw
 * @returns {number}
 */
function rawToHumidity(raw) {
    return raw * 0.1;
}

/**
 * Decode relay status bitmask into a readable object
 * @param {number} mask
 * @returns {object}
 */
function decodeRelayStatus(mask) {
    return {
        highSpeed:     !!(mask & (1 << RELAYS.HIGH_SPEED)),
        mediumSpeed:   !!(mask & (1 << RELAYS.MEDIUM_SPEED)),
        lowSpeed:      !!(mask & (1 << RELAYS.LOW_SPEED)),
        fanCoilValve:  !!(mask & (1 << RELAYS.FAN_COIL_VALVE)),
        floorValve:    !!(mask & (1 << RELAYS.FLOOR_VALVE)),
        dryContact:    !!(mask & (1 << RELAYS.DRY_CONTACT))
    };
}

/**
 * Decode operating mode value to label string
 * @param {number} v
 * @returns {string}
 */
function modeLabel(v) {
    switch (v) {
        case MODE.COOLING:       return "Cooling";
        case MODE.DRY:           return "Dry";
        case MODE.HEATING:       return "Heating";
        case MODE.FLOOR_HEATING: return "FloorHeating";
        case MODE.VENTILATION:   return "Ventilation";
        default:                 return "Unknown(" + v + ")";
    }
}

/**
 * Decode fan speed value to label string
 * @param {number} v
 * @returns {string}
 */
function fanLabel(v) {
    switch (v) {
        case FAN.AUTO:   return "Auto";
        case FAN.LOW:    return "Low";
        case FAN.MEDIUM: return "Medium";
        case FAN.HIGH:   return "High";
        case FAN.SPD4:   return "Speed4";
        case FAN.SPD5:   return "Speed5";
        default:         return "Unknown(" + v + ")";
    }
}

/* === ST802 CONTROL API === */

/**
 * Set thermostat power on or off.
 * @param {number} onOff  POWER.ON or POWER.OFF
 * @param {function} callback  callback(error, success)
 */
function setPower(onOff, callback) {
    var data = [
        (REG.POWER >> 8) & 0xFF, REG.POWER & 0xFF,
        (onOff >> 8) & 0xFF,     onOff & 0xFF
    ];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, resp) {
        if (err) {
            debug("setPower error: " + err);
            if (callback) callback(err, false);
            return;
        }
        debug("Power set to " + (onOff ? "ON" : "OFF"));
        if (callback) callback(null, true);
    });
}

/**
 * Set operating mode.
 * @param {number} mode  MODE.HEATING / COOLING / DRY / FLOOR_HEATING / VENTILATION
 * @param {function} callback  callback(error, success)
 */
function setMode(mode, callback) {
    var data = [
        (REG.MODE >> 8) & 0xFF, REG.MODE & 0xFF,
        (mode >> 8) & 0xFF,     mode & 0xFF
    ];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, resp) {
        if (err) {
            debug("setMode error: " + err);
            if (callback) callback(err, false);
            return;
        }
        debug("Mode set to " + modeLabel(mode));
        if (callback) callback(null, true);
    });
}

/**
 * Set fan speed.
 * @param {number} speed  FAN.AUTO / LOW / MEDIUM / HIGH / SPD4 / SPD5
 * @param {function} callback  callback(error, success)
 */
function setFanSpeed(speed, callback) {
    var data = [
        (REG.FAN_SPEED >> 8) & 0xFF, REG.FAN_SPEED & 0xFF,
        (speed >> 8) & 0xFF,          speed & 0xFF
    ];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, resp) {
        if (err) {
            debug("setFanSpeed error: " + err);
            if (callback) callback(err, false);
            return;
        }
        debug("Fan speed set to " + fanLabel(speed));
        if (callback) callback(null, true);
    });
}

/**
 * Set temperature setpoint.
 * Resolution: 0.5degC steps. Range: 5-35degC (device default).
 * @param {number} degC  Target temperature in degC (e.g. 22.0 or 22.5)
 * @param {function} callback  callback(error, success)
 */
function setSetpoint(degC, callback) {
    var raw = tempToRaw(degC);
    var data = [
        (REG.SETPOINT >> 8) & 0xFF, REG.SETPOINT & 0xFF,
        (raw >> 8) & 0xFF,           raw & 0xFF
    ];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, resp) {
        if (err) {
            debug("setSetpoint error: " + err);
            if (callback) callback(err, false);
            return;
        }
        debug("Setpoint set to " + degC + "degC (raw " + raw + ")");
        if (callback) callback(null, true);
    });
}

/**
 * Set humidity setpoint.
 * Range: 40-75%.
 * @param {number} pct  Target humidity in % (integer)
 * @param {function} callback  callback(error, success)
 */
function setHumiditySetpoint(pct, callback) {
    var raw = pct * 10;
    if (raw < 400) raw = 400;
    if (raw > 750) raw = 750;
    var data = [
        (REG.HUMIDITY_SP >> 8) & 0xFF, REG.HUMIDITY_SP & 0xFF,
        (raw >> 8) & 0xFF,              raw & 0xFF
    ];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err, resp) {
        if (err) {
            debug("setHumiditySetpoint error: " + err);
            if (callback) callback(err, false);
            return;
        }
        debug("Humidity setpoint set to " + pct + "% (raw " + raw + ")");
        if (callback) callback(null, true);
    });
}

/* === ST802 STATUS API === */

/**
 * Read current room temperature, humidity, and floor temperature.
 * Reads three consecutive registers starting at O00 (0x2101).
 * @param {function} callback  callback(error, {roomTemp, humidity, floorTemp})
 */
function readTemperatures(callback) {
    var startAddr = REG.ROOM_TEMP;
    var qty = 3;  // O00, O01, O02
    var data = [
        (startAddr >> 8) & 0xFF, startAddr & 0xFF,
        (qty >> 8) & 0xFF,       qty & 0xFF
    ];
    sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, resp) {
        if (err) {
            callback(err, null);
            return;
        }
        // resp[0] = byteCount (6), then pairs of bytes per register
        var roomTemp  = rawToTemp((resp[1] << 8) | resp[2]);
        var humidity  = rawToHumidity((resp[3] << 8) | resp[4]);
        var floorTemp = rawToTemp((resp[5] << 8) | resp[6]);
        callback(null, {
            roomTemp:  roomTemp,
            humidity:  humidity,
            floorTemp: floorTemp
        });
    });
}

/**
 * Read relay output status bitmask (O14 / 0x2110).
 * @param {function} callback  callback(error, relayStatus)
 */
function readRelayStatus(callback) {
    var data = [
        (REG.RELAY_STATE >> 8) & 0xFF, REG.RELAY_STATE & 0xFF,
        0x00, 0x01
    ];
    sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, resp) {
        if (err) {
            callback(err, null);
            return;
        }
        var mask = (resp[1] << 8) | resp[2];
        callback(null, decodeRelayStatus(mask));
    });
}

/**
 * Read alarm register (0x211A).
 * @param {function} callback  callback(error, {roomSensorFail})
 */
function readAlarm(callback) {
    var data = [
        (REG.ALARM >> 8) & 0xFF, REG.ALARM & 0xFF,
        0x00, 0x01
    ];
    sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, resp) {
        if (err) {
            callback(err, null);
            return;
        }
        var mask = (resp[1] << 8) | resp[2];
        callback(null, { roomSensorFail: !!(mask & 0x01) });
    });
}

/**
 * Read current power state and operating mode (H00 and H03).
 * @param {function} callback  callback(error, {power, mode, fanSpeed, setpoint})
 */
function readControlRegisters(callback) {
    // Read H00, skip H01, H02, H03 in one block: addr 0x1001, qty 4
    var startAddr = REG.POWER;  // 0x1001
    var qty = 4;  // H00(1001), gap(1002), H02(1003), H03(1004)
    var data = [
        (startAddr >> 8) & 0xFF, startAddr & 0xFF,
        (qty >> 8) & 0xFF,       qty & 0xFF
    ];
    sendRequest(FC.READ_HOLDING_REGISTERS, data, function(err, resp) {
        if (err) {
            callback(err, null);
            return;
        }
        // resp[0]=byteCount(8), then 4 registers as big-endian words
        var power    = (resp[1] << 8) | resp[2];   // H00 at 0x1001
        // resp[3..4] = register 0x1002 (unused gap)
        var sysType  = (resp[5] << 8) | resp[6];   // H02 at 0x1003
        var mode     = (resp[7] << 8) | resp[8];   // H03 at 0x1004
        callback(null, {
            power:   power,
            sysType: sysType,
            mode:    mode
        });
    });
}

/* === BMS POLL CYCLE === */

/**
 * Full status poll: reads temperatures, relay status, and alarm.
 * Each step is guarded by its ENABLE flag and chained sequentially
 * to avoid bus collisions.
 */
function pollStatus() {
    debug("--- Polling ST802 status ---");

    function doRelays() {
        if (!ENABLE.POLL_RELAYS) { doAlarm(); return; }
        Timer.set(200, false, function() {
            readRelayStatus(function(err, relays) {
                if (err) {
                    debug("Relay read error: " + err);
                } else {
                    print("[ST802] Relays: " +
                          "Hi=" + (relays.highSpeed ? "1" : "0") +
                          " Med=" + (relays.mediumSpeed ? "1" : "0") +
                          " Lo=" + (relays.lowSpeed ? "1" : "0") +
                          " FanValve=" + (relays.fanCoilValve ? "1" : "0") +
                          " FloorValve=" + (relays.floorValve ? "1" : "0") +
                          " DryContact=" + (relays.dryContact ? "1" : "0"));
                }
                doAlarm();
            });
        });
    }

    function doAlarm() {
        if (!ENABLE.POLL_ALARM) { return; }
        Timer.set(200, false, function() {
            readAlarm(function(err, alarm) {
                if (err) {
                    debug("Alarm read error: " + err);
                } else if (alarm.roomSensorFail) {
                    print("[ST802] ALARM: Room sensor failure!");
                } else {
                    debug("Alarm: OK");
                }
            });
        });
    }

    if (ENABLE.POLL_TEMPERATURES) {
        readTemperatures(function(err, temps) {
            if (err) {
                debug("Temperature read error: " + err);
            } else {
                print("[ST802] Room: " + temps.roomTemp.toFixed(1) + "degC  " +
                      "Humidity: " + temps.humidity.toFixed(0) + "%  " +
                      "Floor: " + temps.floorTemp.toFixed(1) + "degC");
            }
            doRelays();
        });
    } else {
        doRelays();
    }
}

/* === BMS COMMAND SIMULATION === */

/**
 * BMS command scenarios, cycled on CMD_INTERVAL.
 * Each scenario has a `key` matching an ENABLE flag so it can be
 * individually disabled without removing code.
 */
var CMD_SCENARIOS = [
    {
        key:   "CMD_MORNING_HEAT",
        label: "Morning start - Heating 22degC, Auto fan",
        fn: function() {
            setPower(POWER.ON, function() {
                Timer.set(300, false, function() {
                    setMode(MODE.HEATING, function() {
                        Timer.set(300, false, function() {
                            setSetpoint(22.0, function() {
                                Timer.set(300, false, function() {
                                    setFanSpeed(FAN.AUTO, null);
                                });
                            });
                        });
                    });
                });
            });
        }
    },
    {
        key:   "CMD_COOLING",
        label: "Occupied - Cooling 24degC, Medium fan",
        fn: function() {
            setMode(MODE.COOLING, function() {
                Timer.set(300, false, function() {
                    setSetpoint(24.0, function() {
                        Timer.set(300, false, function() {
                            setFanSpeed(FAN.MEDIUM, null);
                        });
                    });
                });
            });
        }
    },
    {
        key:   "CMD_ECONOMY_HEAT",
        label: "Economy - Heating 20degC, Low fan",
        fn: function() {
            setMode(MODE.HEATING, function() {
                Timer.set(300, false, function() {
                    setSetpoint(20.0, function() {
                        Timer.set(300, false, function() {
                            setFanSpeed(FAN.LOW, null);
                        });
                    });
                });
            });
        }
    },
    {
        key:   "CMD_VENTILATION",
        label: "Ventilation only, Auto fan",
        fn: function() {
            setMode(MODE.VENTILATION, function() {
                Timer.set(300, false, function() {
                    setFanSpeed(FAN.AUTO, null);
                });
            });
        }
    },
    {
        key:   "CMD_DRY",
        label: "Dehumidify (Dry mode) 24degC",
        fn: function() {
            setMode(MODE.DRY, function() {
                Timer.set(300, false, function() {
                    setSetpoint(24.0, null);
                });
            });
        }
    },
    {
        key:   "CMD_FLOOR_HEAT",
        label: "Floor heating 21degC",
        fn: function() {
            setMode(MODE.FLOOR_HEATING, function() {
                Timer.set(300, false, function() {
                    setSetpoint(21.0, null);
                });
            });
        }
    },
    {
        key:   "CMD_NIGHT_SETBACK",
        label: "Night setback - Heating 18degC, Low fan",
        fn: function() {
            setMode(MODE.HEATING, function() {
                Timer.set(300, false, function() {
                    setSetpoint(18.0, function() {
                        Timer.set(300, false, function() {
                            setFanSpeed(FAN.LOW, null);
                        });
                    });
                });
            });
        }
    },
    {
        key:   "CMD_STANDBY",
        label: "Standby - Power OFF",
        fn: function() {
            setPower(POWER.OFF, null);
        }
    }
];

/**
 * Execute the next enabled BMS command scenario in the rotation.
 * Scenarios whose ENABLE key is false are silently skipped.
 * If all scenarios are disabled the cycle is a no-op.
 */
function runNextBmsCommand() {
    var total = CMD_SCENARIOS.length;
    var checked = 0;
    while (checked < total) {
        var scenario = CMD_SCENARIOS[state.cmdStep % total];
        state.cmdStep++;
        checked++;
        if (ENABLE[scenario.key] === false) {
            debug("Skipping disabled scenario: " + scenario.key);
            continue;
        }
        print("[BMS] Sending command: " + scenario.label);
        scenario.fn();
        return;
    }
    debug("All command scenarios disabled -- nothing to send.");
}

/* === INITIALIZATION === */

function init() {
    print("LinkedGo ST802 - BMS Modbus RTU Client");
    print("=======================================");
    print("Slave ID: " + CONFIG.SLAVE_ID + "  Baud: " + CONFIG.BAUD_RATE + " " + CONFIG.MODE);
    print("");

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

    print("UART ready. Starting BMS simulation.");
    print("");
    print("Control registers (write with FC 06):");
    print("  0x" + toHex16(REG.POWER)       + " (H00) - Power");
    print("  0x" + toHex16(REG.MODE)        + " (H03) - Operating mode");
    print("  0x" + toHex16(REG.FAN_SPEED)   + " (H06) - Fan speed");
    print("  0x" + toHex16(REG.SETPOINT)    + " (H07) - Setpoint temp");
    print("  0x" + toHex16(REG.HUMIDITY_SP) + " (H08) - Humidity setpoint");
    print("");
    print("Sensor registers (read with FC 03):");
    print("  0x" + toHex16(REG.ROOM_TEMP)   + " (O00) - Room temp");
    print("  0x" + toHex16(REG.HUMIDITY)    + " (O01) - Humidity");
    print("  0x" + toHex16(REG.FLOOR_TEMP)  + " (O02) - Floor temp");
    print("  0x" + toHex16(REG.RELAY_STATE) + " (O14) - Relay status");
    print("  0x" + toHex16(REG.ALARM)       + "       - Alarm");
    print("");

    // Initial BMS command after 1s
    Timer.set(1000, false, function() {
        runNextBmsCommand();
    });

    // Periodic status poll
    Timer.set(3000, false, pollStatus);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollStatus);

    // Periodic BMS command rotation
    state.cmdTimer = Timer.set(CONFIG.CMD_INTERVAL, true, runNextBmsCommand);

    print("BMS simulation running.");
    print("  Status poll every " + (CONFIG.POLL_INTERVAL / 1000) + "s");
    print("  Command cycle every " + (CONFIG.CMD_INTERVAL / 1000) + "s");
    print("");
    print("API quick reference:");
    print("  setPower(POWER.ON/OFF, cb)");
    print("  setMode(MODE.HEATING/COOLING/DRY/FLOOR_HEATING/VENTILATION, cb)");
    print("  setFanSpeed(FAN.AUTO/LOW/MEDIUM/HIGH, cb)");
    print("  setSetpoint(22.0, cb)          // degC, 0.5 step");
    print("  setHumiditySetpoint(55, cb)    // %, range 40-75");
    print("  readTemperatures(cb)");
    print("  readRelayStatus(cb)");
    print("  readAlarm(cb)");
}

init();
