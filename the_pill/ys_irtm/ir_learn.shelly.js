/**
 * @title YS-IRTM IR learn mode
 * @description Captures and prints NEC IR codes for reuse in other scripts.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/ys_irtm/ir_learn.shelly.js
 */

// ============================================================================
// MINIMAL YS-IRTM API
// ============================================================================

var CONFIG = {
    baud: 9600,
    address: 0xFA,
    debug: false,
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

function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xFF);
    return bytes;
}

var YSIRTM = {
    init: function() {
        uart = UART.get();
        if (!uart.configure({ baud: CONFIG.baud, mode: '8N1' })) {
            print('[YS-IRTM] UART init failed');
            return false;
        }
        uart.recv(this._onReceive.bind(this));
        return true;
    },

    onReceive: function(callback) {
        rxCallbacks.push(callback);
        return rxCallbacks.length - 1;
    },

    offReceive: function(id) {
        if (id >= 0 && id < rxCallbacks.length) rxCallbacks[id] = null;
    },

    _onReceive: function(data) {
        if (!data || !data.length) return;
        var bytes = strToBytes(data);
        if (bytes.length === 1 && (bytes[0] === 0xF1 || bytes[0] === 0xF2 || bytes[0] === 0xF3)) return;

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

        for (var i = 0; i < rxCallbacks.length; i++) {
            if (rxCallbacks[i]) rxCallbacks[i](code);
        }
    }
};

// ============================================================================
// LEARN MODE
// ============================================================================

var LEARN_DURATION = 120;  // seconds
var discovered = {};
var counter = 0;

function learnMode(duration) {
    duration = duration || LEARN_DURATION;
    discovered = {};
    counter = 0;

    print('');
    print('========================================');
    print('       IR CODE LEARNING MODE');
    print('========================================');
    print('Point remote at receiver, press buttons.');
    print('Listening for ' + duration + ' seconds...');
    print('');

    var cbId = YSIRTM.onReceive(function(code) {
        var key = code.hex;

        if (!discovered[key]) {
            counter++;
            discovered[key] = { num: counter, count: 1, code: code };

            print('--- NEW CODE #' + counter + ' ---');
            print('  Hex:   ' + code.hex);
            print('  Array: [0x' + toHex(code.userHi) + ', 0x' + toHex(code.userLo) + ', 0x' + toHex(code.cmd) + ']');
            print('  Copy:  addCode(\'BTN_' + counter + '\', 0x' + toHex(code.userHi) + ', 0x' + toHex(code.userLo) + ', 0x' + toHex(code.cmd) + ');');
        } else {
            discovered[key].count++;
            print('#' + discovered[key].num + ' repeated (' + discovered[key].count + 'x)');
        }
    });

    Timer.set(duration * 1000, false, function() {
        YSIRTM.offReceive(cbId);
        printSummary();
    });
}

function printSummary() {
    print('');
    print('========================================');
    print('       LEARNING COMPLETE');
    print('========================================');
    print('Found ' + counter + ' unique codes:');
    print('');
    print('// Copy to your script:');
    for (var key in discovered) {
        var d = discovered[key];
        print('addCode(\'BTN_' + d.num + '\', 0x' + toHex(d.code.userHi) + ', 0x' + toHex(d.code.userLo) + ', 0x' + toHex(d.code.cmd) + ');  // ' + d.count + 'x');
    }
    print('');
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    if (!YSIRTM.init()) return;
    learnMode(LEARN_DURATION);
}

init();
