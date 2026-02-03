/**
 * @title YS-IRTM IR-to-switch example
 * @description Maps received IR codes to Shelly switch actions.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/ys_irtm/ir2sw.shelly.js
 */

// ============================================================================
// MINIMAL YS-IRTM API
// ============================================================================

var CONFIG = {
    baud: 9600,
    address: 0xFA,
    debug: true,
    rxDebounceMs: 200
};

var uart = null;
var rxBuffer = '';
var rxCallbacks = [];
var lastRxTime = 0;
var lastRxCode = null;

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
}

function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xFF);
    return bytes;
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
        uart.recv(this._onReceive.bind(this));
        dbg('Ready @ ' + CONFIG.baud + ' baud');
        return true;
    },

    onReceive: function(callback) {
        rxCallbacks.push(callback);
        return rxCallbacks.length - 1;
    },

    _onReceive: function(data) {
        if (!data || !data.length) return;
        var bytes = strToBytes(data);

        // Skip ACK bytes
        if (bytes.length === 1 && (bytes[0] === 0xF1 || bytes[0] === 0xF2 || bytes[0] === 0xF3)) {
            return;
        }

        rxBuffer += data;
        while (rxBuffer.length >= 3) {
            var chunk = rxBuffer.substring(0, 3);
            rxBuffer = rxBuffer.substring(3);
            this._processRx(strToBytes(chunk));
        }
    },

    _processRx: function(bytes) {
        var now = Date.now();
        if (now - lastRxTime < CONFIG.rxDebounceMs && lastRxCode &&
            lastRxCode[0] === bytes[0] && lastRxCode[1] === bytes[1] && lastRxCode[2] === bytes[2]) {
            return;
        }
        lastRxTime = now;
        lastRxCode = bytes;

        var code = {
            userHi: bytes[0],
            userLo: bytes[1],
            cmd: bytes[2],
            raw: bytes,
            hex: toHex(bytes[0]) + ' ' + toHex(bytes[1]) + ' ' + toHex(bytes[2])
        };

        dbg('RX: ' + code.hex);
        for (var i = 0; i < rxCallbacks.length; i++) {
            if (rxCallbacks[i]) rxCallbacks[i](code);
        }
    }
};

function onReceiveSwitch(code, switchId, action) {
    action = action || 'toggle';
    YSIRTM.onReceive(function(rx) {
        if (rx.raw[0] === code[0] && rx.raw[1] === code[1] && rx.raw[2] === code[2]) {
            dbg('Match -> Switch ' + switchId + ' ' + action);
            if (action === 'toggle') Shelly.call('Switch.Toggle', { id: switchId });
            else if (action === 'on') Shelly.call('Switch.Set', { id: switchId, on: true });
            else if (action === 'off') Shelly.call('Switch.Set', { id: switchId, on: false });
        }
    });
}

// ============================================================================
// CONFIGURATION - Map IR codes to switches
// ============================================================================

function setup() {
    // Format: onReceiveSwitch([userHi, userLo, cmd], switchId, action)
    // Actions: 'toggle', 'on', 'off'

    // Number buttons toggle switches
    onReceiveSwitch([0x00, 0xBF, 0x01], 0, 'toggle');  // Button 1 -> Switch 0
    onReceiveSwitch([0x00, 0xBF, 0x02], 1, 'toggle');  // Button 2 -> Switch 1
    onReceiveSwitch([0x00, 0xBF, 0x03], 2, 'toggle');  // Button 3 -> Switch 2

    // Power button turns all off
    onReceiveSwitch([0x00, 0xBF, 0x0D], 0, 'off');
    onReceiveSwitch([0x00, 0xBF, 0x0D], 1, 'off');
    onReceiveSwitch([0x00, 0xBF, 0x0D], 2, 'off');
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    if (!YSIRTM.init()) return;
    setup();
    print('[Example] Switch Control ready');
}

init();
