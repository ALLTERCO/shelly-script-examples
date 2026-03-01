/**
 * @title CWT-MB308V MODBUS example + Virtual Components
 * @description Example integration for the ComWinTop MB308V IO module over
 *   MODBUS-RTU with Virtual Component integration. Exposes 2 relay buttons,
 *   2 digital input displays, 2 analog output sliders, and 2 analog input
 *   progress bars grouped in the Shelly web UI.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/ComWinTop/mb308v_vc.shelly.js
 */

/**
 * CWT-MB308V MODBUS IO Module + Virtual Components (demo layout)
 *
 * Demonstrates the Virtual Component UI for the ComWinTop CWT-MB308V
 * GPIO expander via MODBUS-RTU:
 *
 *   button:200  Relay 0 toggle    -- press to flip DO 0
 *   button:201  Relay 1 toggle    -- press to flip DO 1
 *   number:200  Digital Input 0   -- live 0/1 display  (read-only)
 *   number:201  Digital Input 1   -- live 0/1 display  (read-only)
 *   number:202  Analog Output 0   -- slider 0-24000     (writable)
 *   number:203  Analog Output 1   -- slider 0-24000     (writable)
 *   number:204  Analog Input 0    -- progress bar 0-10216 (read-only)
 *   number:205  Analog Input 1    -- progress bar 0-10216 (read-only)
 *   group:200   MB308V Demo       -- groups all above
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  ─── B (D-)  ──> MB308V B (D-)
 *   IO2 (RX)  ─── A (D+)  ──> MB308V A (D+)
 *   IO3       ─── DE/RE   ──  direction control (automatic)
 *   GND       ─── GND     ──> MB308V GND
 *   Power: 7-35VDC to MB308V (separate supply)
 *
 * Default settings: 9600 baud, 8N1, Slave ID: 1
 *
 * Pre-create VCs with skills/modbus-vc-deploy.md before uploading.
 *
 * Reference: https://github.com/bgerp/ztm/blob/master/Zontromat/devices/vendors/cwt/mb308v/mb308v.py
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",
    SLAVE_ID: 1,
    RESPONSE_TIMEOUT: 1000,
    POLL_INTERVAL: 5000,
    DEBUG: true
};

/* === CWT-MB308V REGISTER MAP === */

var AI_MAX_VALUE = 10216;  // Raw full-scale for AI (4-20mA or 0-5V/0-10V)
var AO_MAX_VALUE = 24000;  // Raw full-scale for AO (0-10V or 4-20mA)

/*
 * ENTITIES documents all channels.
 *
 * vcId assignment for OUTPUT VCs (script writes value via updateVc):
 *   DI 0 -> number:200   DI 1 -> number:201
 *   AI 0 -> number:204   AI 1 -> number:205
 *
 * INPUT VCs (user sets value, script reads / reacts):
 *   DO 0 -> button:200   DO 1 -> button:201   (managed via event handler)
 *   AO 0 -> number:202   AO 1 -> number:203   (polled each cycle)
 * These are kept null in ENTITIES; handles are stored in state.vc.*
 */
var ENTITIES = [
    //
    // --- Digital Inputs (DI 0-7, FC 0x02) ---
    //
    { name: "DI 0", units: "-", reg: { addr: 0, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:200", handle: null, vcHandle: null },
    { name: "DI 1", units: "-", reg: { addr: 1, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:201", handle: null, vcHandle: null },
    { name: "DI 2", units: "-", reg: { addr: 2, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 3", units: "-", reg: { addr: 3, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 4", units: "-", reg: { addr: 4, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 5", units: "-", reg: { addr: 5, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 6", units: "-", reg: { addr: 6, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 7", units: "-", reg: { addr: 7, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    //
    // --- Digital Outputs / Relays (DO 0-11, FC 0x01) ---
    // Controlled via button:200 / button:201 (see state.vc.btn)
    //
    { name: "DO 0",  units: "-", reg: { addr: 0,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 1",  units: "-", reg: { addr: 1,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 2",  units: "-", reg: { addr: 2,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 3",  units: "-", reg: { addr: 3,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 4",  units: "-", reg: { addr: 4,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 5",  units: "-", reg: { addr: 5,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 6",  units: "-", reg: { addr: 6,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 7",  units: "-", reg: { addr: 7,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 8",  units: "-", reg: { addr: 8,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 9",  units: "-", reg: { addr: 9,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 10", units: "-", reg: { addr: 10, rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 11", units: "-", reg: { addr: 11, rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    //
    // --- Analog Inputs (AI 0-7, FC 0x04) ---
    //
    { name: "AI 0", units: "raw", reg: { addr: 0, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:204", handle: null, vcHandle: null },
    { name: "AI 1", units: "raw", reg: { addr: 1, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:205", handle: null, vcHandle: null },
    { name: "AI 2", units: "raw", reg: { addr: 2, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 3", units: "raw", reg: { addr: 3, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 4", units: "raw", reg: { addr: 4, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 5", units: "raw", reg: { addr: 5, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 6", units: "raw", reg: { addr: 6, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 7", units: "raw", reg: { addr: 7, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    //
    // --- Analog Outputs (AO 0-3, FC 0x03) ---
    // User-driven via number:202 / number:203 sliders (see state.vc.ao)
    //
    { name: "AO 0", units: "raw", reg: { addr: 0, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 1", units: "raw", reg: { addr: 1, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 2", units: "raw", reg: { addr: 2, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 3", units: "raw", reg: { addr: 3, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
];

function entitiesByRtype(rtype) {
    var result = [];
    for (var i = 0; i < ENTITIES.length; i++) {
        if (ENTITIES[i].reg.rtype === rtype) result.push(ENTITIES[i]);
    }
    return result;
}

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_COILS:              0x01,
    READ_DISCRETE_INPUTS:    0x02,
    READ_HOLDING_REGISTERS:  0x03,
    READ_INPUT_REGISTERS:    0x04,
    WRITE_SINGLE_COIL:       0x05,
    WRITE_SINGLE_REGISTER:   0x06
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
    // Relay toggle states (DO 0 and DO 1)
    doState: [false, false],
    // Last AO values written to hardware (-1 = not yet sent)
    lastAo: [-1, -1],
    // Virtual component handles for interactive VCs
    vc: {
        btn: [null, null],  // button:200, button:201  (relay toggles)
        ao:  [null, null],  // number:202, number:203  (AO sliders)
    }
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
    if (CONFIG.DEBUG) print("[MB308V] " + msg);
}

function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return crc;
}

function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
}

function buildFrame(slaveAddr, functionCode, data) {
    var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
    if (data) {
        for (var i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
    }
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

/* === VIRTUAL COMPONENT (output: script -> VC) === */

function updateVc(entity, value) {
    if (!entity || !entity.vcHandle) return;
    entity.vcHandle.setValue(value);
    debug(entity.name + " -> " + value);
}

/* === MODBUS CORE === */

function sendRequest(functionCode, data, callback) {
    if (!state.isReady) { callback("Not initialized", null); return; }
    if (state.pendingRequest) { callback("Request pending", null); return; }

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
    for (var i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
    processResponse();
}

function processResponse() {
    if (!state.pendingRequest) { state.rxBuffer = []; return; }
    if (state.rxBuffer.length < 5) return;

    var fc = state.rxBuffer[1];

    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excFrame = state.rxBuffer.slice(0, 5);
            var crc = calcCRC(excFrame.slice(0, 3));
            var recv = excFrame[3] | (excFrame[4] << 8);
            if (crc === recv) {
                clearTimer();
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

    if (crc !== recvCrc) { debug("CRC error"); return; }

    debug("RX: " + bytesToHex(frame));
    clearTimer();

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
            return (state.rxBuffer.length >= 3) ? 3 + state.rxBuffer[2] + 2 : 0;
        case FC.WRITE_SINGLE_COIL:
        case FC.WRITE_SINGLE_REGISTER:
            return 8;
        default:
            return 0;
    }
}

function clearTimer() {
    if (state.responseTimer) { Timer.clear(state.responseTimer); state.responseTimer = null; }
}

/* === MB308V API === */

function readDigitalInputs(callback) {
    var diEnt = entitiesByRtype(0x02);
    sendRequest(FC.READ_DISCRETE_INPUTS, [0x00, diEnt[0].reg.addr, 0x00, diEnt.length], function(err, resp) {
        if (err) { callback(err, null); return; }
        var inputs = [];
        for (var i = 0; i < diEnt.length; i++) {
            var byteIdx = Math.floor(i / 8) + 1;
            var bitIdx = i % 8;
            inputs.push((byteIdx < resp.length) ? (resp[byteIdx] >> bitIdx) & 0x01 : 0);
        }
        callback(null, inputs);
    });
}

function readAnalogInputs(callback) {
    var aiEnt = entitiesByRtype(0x04);
    sendRequest(FC.READ_INPUT_REGISTERS, [0x00, aiEnt[0].reg.addr, 0x00, aiEnt.length], function(err, resp) {
        if (err) { callback(err, null); return; }
        var values = [];
        for (var i = 1; i < resp.length - 1; i += 2) values.push((resp[i] << 8) | resp[i + 1]);
        callback(null, values);
    });
}

function writeDigitalOutput(channel, value, callback) {
    var doEnt = entitiesByRtype(0x01);
    if (channel < 0 || channel >= doEnt.length) {
        if (callback) callback("Invalid channel: " + channel, false);
        return;
    }
    var data = [0x00, doEnt[channel].reg.addr & 0xFF, value ? 0xFF : 0x00, 0x00];
    sendRequest(FC.WRITE_SINGLE_COIL, data, function(err) {
        if (callback) callback(err, !err);
    });
}

function writeAnalogOutput(channel, value, callback) {
    var aoEnt = entitiesByRtype(0x03);
    if (channel < 0 || channel >= aoEnt.length) {
        if (callback) callback("Invalid channel: " + channel, false);
        return;
    }
    if (value < 0) value = 0;
    if (value > AO_MAX_VALUE) value = AO_MAX_VALUE;
    var data = [0x00, aoEnt[channel].reg.addr & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err) {
        if (callback) callback(err, !err);
    });
}

function aiToMilliamps(raw) { return 4.0 + (raw / AI_MAX_VALUE) * 16.0; }
function aiToVoltage(raw)   { return (raw / AI_MAX_VALUE) * 10.0; }
function milliampsToAo(mA)  { if (mA < 4) mA = 4; if (mA > 20) mA = 20; return Math.round(((mA - 4) / 16.0) * AO_MAX_VALUE); }
function voltageToAo(volts) { if (volts < 0) volts = 0; if (volts > 10) volts = 10; return Math.round((volts / 10.0) * AO_MAX_VALUE); }

/* === RELAY TOGGLE (called from button event handler) === */

function toggleRelay(channel) {
    state.doState[channel] = !state.doState[channel];
    var newState = state.doState[channel];
    debug("Relay " + channel + " -> " + (newState ? "ON" : "OFF"));
    writeDigitalOutput(channel, newState, function(err) {
        if (err) {
            debug("Relay " + channel + " write error: " + err);
            state.doState[channel] = !state.doState[channel];  // revert
        }
    });
}

/* === POLL === */

function pollAllInputs() {
    // --- Read DI 0 and DI 1 (bulk read all 8, publish first 2) ---
    readDigitalInputs(function(err, inputs) {
        if (err) {
            debug("DI Error: " + err);
        } else {
            var diEnt = entitiesByRtype(0x02);
            updateVc(diEnt[0], inputs[0]);   // DI 0 -> number:200
            updateVc(diEnt[1], inputs[1]);   // DI 1 -> number:201
            print("[DI] DI0:" + inputs[0] + " DI1:" + inputs[1]);
        }

        // --- Check AO sliders for user changes, write hardware if changed ---
        Timer.set(100, false, function() {
            for (var i = 0; i < 2; i++) {
                if (!state.vc.ao[i]) continue;
                var sliderVal = state.vc.ao[i].getValue();
                if (sliderVal !== state.lastAo[i]) {
                    state.lastAo[i] = sliderVal;
                    debug("AO " + i + " slider -> " + sliderVal);
                    writeAnalogOutput(i, sliderVal, null);
                }
            }

            // --- Read AI 0 and AI 1 (bulk read all 8, publish first 2) ---
            Timer.set(100, false, function() {
                readAnalogInputs(function(err, values) {
                    if (err) {
                        debug("AI Error: " + err);
                        return;
                    }
                    var aiEnt = entitiesByRtype(0x04);
                    updateVc(aiEnt[0], values[0]);   // AI 0 -> number:204
                    updateVc(aiEnt[1], values[1]);   // AI 1 -> number:205
                    var mA0 = aiToMilliamps(values[0]).toFixed(2);
                    var mA1 = aiToMilliamps(values[1]).toFixed(2);
                    print("[AI] AI0:" + mA0 + "mA  AI1:" + mA1 + "mA");
                });
            });
        });
    });
}

/* === INITIALIZATION === */

function init() {
    print("CWT-MB308V MODBUS IO Module + Virtual Components");
    print("=================================================");
    print("  button:200/201  -> relay toggle (DO 0/1)");
    print("  number:200/201  -> DI 0/1 display");
    print("  number:202/203  -> AO 0/1 sliders");
    print("  number:204/205  -> AI 0/1 progress bars");
    print("  group:200       -> MB308V Demo");
    print("");

    // --- OUTPUT VCs (script writes values) ---
    // Init handles for entities that have vcId set (DI 0/1 and AI 0/1)
    for (var i = 0; i < ENTITIES.length; i++) {
        var ent = ENTITIES[i];
        if (ent.vcId) {
            ent.vcHandle = Virtual.getHandle(ent.vcId);
            debug("VC out: " + ent.name + " -> " + ent.vcId);
        }
    }

    // --- INPUT VCs (user drives these, script reads / reacts) ---
    // Button handles (relay toggles)
    state.vc.btn[0] = Virtual.getHandle("button:200");
    state.vc.btn[1] = Virtual.getHandle("button:201");
    debug("VC in: Relay 0 toggle -> button:200");
    debug("VC in: Relay 1 toggle -> button:201");

    // AO slider handles – read getValue() on each poll cycle
    state.vc.ao[0] = Virtual.getHandle("number:202");
    state.vc.ao[1] = Virtual.getHandle("number:203");
    debug("VC in: AO 0 slider -> number:202");
    debug("VC in: AO 1 slider -> number:203");

    // Seed lastAo from current slider values so we don't write 0 on first boot
    if (state.vc.ao[0]) state.lastAo[0] = state.vc.ao[0].getValue();
    if (state.vc.ao[1]) state.lastAo[1] = state.vc.ao[1].getValue();

    // --- Button event handler ---
    // Catches push events from button:200 and button:201 to toggle relays.
    Shelly.addEventHandler(function(event, ud) {
        if (event.name !== "push" && event.name !== "single_push") return;
        debug("Button event: " + event.component + " / " + event.name);
        if (event.component === "button:200") toggleRelay(0);
        else if (event.component === "button:201") toggleRelay(1);
    }, null);

    // --- UART ---
    state.uart = UART.get();
    if (!state.uart) { print("ERROR: UART not available"); return; }
    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print("ERROR: UART configuration failed");
        return;
    }
    state.uart.recv(onReceive);
    state.isReady = true;

    debug("UART: " + CONFIG.BAUD_RATE + " baud, " + CONFIG.MODE);
    debug("Slave ID: " + CONFIG.SLAVE_ID);
    print("Polling every " + (CONFIG.POLL_INTERVAL / 1000) + "s...");
    print("");

    Timer.set(500, false, pollAllInputs);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollAllInputs);
}

init();
