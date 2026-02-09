/**
 * @title YS-IRTM TV remote codes
 * @description Preconfigured NEC IR codes for common TV brands using YS-IRTM.
 * @status under-development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/ys_irtm/tv_ir.shelly.js
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
}

// ============================================================================
// TV CODE LIBRARIES
// ============================================================================

var SAMSUNG = {
    POWER:    [0x07, 0x07, 0x02],
    VOL_UP:   [0x07, 0x07, 0x07],
    VOL_DOWN: [0x07, 0x07, 0x0B],
    MUTE:     [0x07, 0x07, 0x0F],
    CH_UP:    [0x07, 0x07, 0x12],
    CH_DOWN:  [0x07, 0x07, 0x10],
    SOURCE:   [0x07, 0x07, 0x01],
    MENU:     [0x07, 0x07, 0x1A],
    UP:       [0x07, 0x07, 0x60],
    DOWN:     [0x07, 0x07, 0x61],
    LEFT:     [0x07, 0x07, 0x65],
    RIGHT:    [0x07, 0x07, 0x62],
    ENTER:    [0x07, 0x07, 0x68]
};

var LG = {
    POWER:    [0x04, 0xFB, 0x08],
    VOL_UP:   [0x04, 0xFB, 0x02],
    VOL_DOWN: [0x04, 0xFB, 0x03],
    MUTE:     [0x04, 0xFB, 0x09],
    CH_UP:    [0x04, 0xFB, 0x00],
    CH_DOWN:  [0x04, 0xFB, 0x01],
    INPUT:    [0x04, 0xFB, 0x0B],
    MENU:     [0x04, 0xFB, 0x43],
    UP:       [0x04, 0xFB, 0x40],
    DOWN:     [0x04, 0xFB, 0x41],
    LEFT:     [0x04, 0xFB, 0x07],
    RIGHT:    [0x04, 0xFB, 0x06],
    OK:       [0x04, 0xFB, 0x44]
};

var GENERIC = {
    POWER:    [0x00, 0xBF, 0x0D],
    VOL_UP:   [0x00, 0xBF, 0x1A],
    VOL_DOWN: [0x00, 0xBF, 0x1E],
    MUTE:     [0x00, 0xBF, 0x10],
    CH_UP:    [0x00, 0xBF, 0x1B],
    CH_DOWN:  [0x00, 0xBF, 0x1F],
    INPUT:    [0x00, 0xBF, 0x0B],
    MENU:     [0x00, 0xBF, 0x04],
    OK:       [0x00, 0xBF, 0x06],
    UP:       [0x00, 0xBF, 0x40],
    DOWN:     [0x00, 0xBF, 0x41],
    LEFT:     [0x00, 0xBF, 0x07],
    RIGHT:    [0x00, 0xBF, 0x09],
    NUM_0:    [0x00, 0xBF, 0x00],
    NUM_1:    [0x00, 0xBF, 0x01],
    NUM_2:    [0x00, 0xBF, 0x02],
    NUM_3:    [0x00, 0xBF, 0x03],
    NUM_4:    [0x00, 0xBF, 0x14],
    NUM_5:    [0x00, 0xBF, 0x15],
    NUM_6:    [0x00, 0xBF, 0x16],
    NUM_7:    [0x00, 0xBF, 0x17],
    NUM_8:    [0x00, 0xBF, 0x0C],
    NUM_9:    [0x00, 0xBF, 0x4D]
};

// ============================================================================
// SELECT TV BRAND & LOAD CODES
// ============================================================================

var TV = GENERIC;  // Change to: SAMSUNG, LG, or GENERIC

function loadTV(brand) {
    for (var key in brand) {
        var c = brand[key];
        addCode(key, c[0], c[1], c[2]);
    }
    print('Loaded ' + Object.keys(brand).length + ' TV codes');
}

// Convenience functions
function tv(cmd) { sendNamed(cmd); }
function tvPower() { tv('POWER'); }
function tvVolUp() { tv('VOL_UP'); }
function tvVolDown() { tv('VOL_DOWN'); }
function tvMute() { tv('MUTE'); }

// ============================================================================
// BUTTON MAPPINGS
// ============================================================================

function setup() {
    onButtonSend('button:200', 'single_push', 'POWER');
    onButtonSend('button:201', 'single_push', 'VOL_UP');
    onButtonSend('button:202', 'single_push', 'VOL_DOWN');
    onButtonSend('button:203', 'single_push', 'MUTE');
    onButtonSend('button:204', 'single_push', 'CH_UP');
    onButtonSend('button:205', 'single_push', 'CH_DOWN');
    onButtonSend('button:206', 'single_push', 'INPUT');
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    if (!YSIRTM.init()) return;
    loadTV(TV);
    setup();
    print('[Example] TV Remote ready');
    print('Use: tv("POWER"), tvVolUp(), etc.');
}

init();
