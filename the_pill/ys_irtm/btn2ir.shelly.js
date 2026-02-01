/**
 * YS-IRTM Example: Button Trigger
 * Send IR codes when Shelly buttons/inputs are pressed.
 */

// ============================================================================
// MINIMAL YS-IRTM API
// ============================================================================

var CONFIG = {
    baud: 9600,
    address: 0xFA,
    debug: true
};

var uart = null;
var CODES = {};

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
}

function dbg(msg) {
    if (CONFIG.debug) print('[YS-IRTM] ' + msg);
}

var YSIRTM = {
    init: function() {
        uart = UART.get();
        if (!uart.configure({ baud: CONFIG.baud, mode: '8N1' })) {
            print('[YS-IRTM] UART init failed');
            return false;
        }
        dbg('Ready @ ' + CONFIG.baud + ' baud');
        return true;
    },

    send: function(userHi, userLo, cmd) {
        var frame = [CONFIG.address, 0xF1, userHi & 0xFF, userLo & 0xFF, cmd & 0xFF];
        dbg('TX: ' + toHex(userHi) + ' ' + toHex(userLo) + ' ' + toHex(cmd));
        uart.write(bytesToStr(frame));
    },

    sendCode: function(code) {
        if (code && code.length >= 3) this.send(code[0], code[1], code[2]);
    }
};

function addCode(name, userHi, userLo, cmd) {
    CODES[name.toUpperCase()] = [userHi & 0xFF, userLo & 0xFF, cmd & 0xFF];
}

function sendNamed(name) {
    var code = CODES[name.toUpperCase()];
    if (code) {
        YSIRTM.sendCode(code);
        return true;
    }
    print('[YS-IRTM] Unknown: ' + name);
    return false;
}

function onButtonSend(component, event, code) {
    Shelly.addEventHandler(function(ev) {
        if (ev.component === component && ev.event === event) {
            if (typeof code === 'string') sendNamed(code);
            else YSIRTM.sendCode(code);
        }
    });
    dbg('Mapped: ' + component + ':' + event);
}

// ============================================================================
// CONFIGURATION - Define your IR codes
// ============================================================================

addCode('POWER',    0x00, 0xBF, 0x0D);
addCode('VOL_UP',   0x00, 0xBF, 0x1A);
addCode('VOL_DOWN', 0x00, 0xBF, 0x1E);
addCode('MUTE',     0x00, 0xBF, 0x10);
addCode('CH_UP',    0x00, 0xBF, 0x1B);
addCode('CH_DOWN',  0x00, 0xBF, 0x1F);
addCode('INPUT',    0x00, 0xBF, 0x0B);

// ============================================================================
// BUTTON MAPPINGS
// ============================================================================

function setup() {
    // Virtual buttons (create in Shelly web UI)
    onButtonSend('button:200', 'single_push', 'POWER');
    onButtonSend('button:201', 'single_push', 'VOL_UP');
    onButtonSend('button:202', 'single_push', 'VOL_DOWN');
    onButtonSend('button:203', 'single_push', 'MUTE');

    // Physical inputs
    // onButtonSend('input:0', 'single_push', 'POWER');
    // onButtonSend('input:0', 'double_push', 'INPUT');
    // onButtonSend('input:0', 'long_push', 'MUTE');

    // BLU button
    // onButtonSend('bthomedevice:200', 'single_push', 'POWER');

    // Direct code array
    // onButtonSend('button:204', 'single_push', [0x00, 0xBF, 0x0D]);
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    if (!YSIRTM.init()) return;
    setup();
    print('[Example] Button Trigger ready');
}

init();
