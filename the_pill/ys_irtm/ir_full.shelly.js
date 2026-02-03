/**
 * @title YS-IRTM advanced IR automation example
 * @description Bidirectional IR automation with scenes, HTTP calls, and switch
 *   integration.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/ys_irtm/ir_full.shelly.js
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

    send: function(userHi, userLo, cmd) {
        var frame = [CONFIG.address, 0xF1, userHi & 0xFF, userLo & 0xFF, cmd & 0xFF];
        dbg('TX: ' + toHex(userHi) + ' ' + toHex(userLo) + ' ' + toHex(cmd));
        uart.write(bytesToStr(frame));
    },

    sendCode: function(code) {
        if (code && code.length >= 3) this.send(code[0], code[1], code[2]);
    },

    onReceive: function(callback) {
        rxCallbacks.push(callback);
        return rxCallbacks.length - 1;
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

        dbg('RX: ' + code.hex);
        for (var i = 0; i < rxCallbacks.length; i++) {
            if (rxCallbacks[i]) rxCallbacks[i](code);
        }
    }
};

// ============================================================================
// IR CODES
// ============================================================================

var CODES = {
    POWER:    [0x00, 0xBF, 0x0D],
    VOL_UP:   [0x00, 0xBF, 0x1A],
    VOL_DOWN: [0x00, 0xBF, 0x1E],
    MUTE:     [0x00, 0xBF, 0x10],
    NUM_1:    [0x00, 0xBF, 0x01],
    NUM_2:    [0x00, 0xBF, 0x02],
    NUM_3:    [0x00, 0xBF, 0x03],
    NUM_7:    [0x00, 0xBF, 0x17],
    NUM_8:    [0x00, 0xBF, 0x0C],
    CH_UP:    [0x00, 0xBF, 0x1B],
    CH_DOWN:  [0x00, 0xBF, 0x1F]
};

function matchCode(rx, target) {
    return rx.raw[0] === target[0] && rx.raw[1] === target[1] && rx.raw[2] === target[2];
}

function getCodeName(rx) {
    for (var name in CODES) {
        if (matchCode(rx, CODES[name])) return name;
    }
    return null;
}

// ============================================================================
// ACTIONS
// ============================================================================

var Actions = {
    toggleLight: function() {
        Shelly.call('Switch.Toggle', { id: 0 });
    },

    allOff: function() {
        Shelly.call('Switch.Set', { id: 0, on: false });
        Shelly.call('Switch.Set', { id: 1, on: false });
        print('All OFF');
    },

    sceneMovie: function() {
        Shelly.call('Light.Set', { id: 0, brightness: 10 });
        Shelly.call('Switch.Set', { id: 1, on: false });
        print('Movie mode');
    },

    sceneBright: function() {
        Shelly.call('Light.Set', { id: 0, brightness: 100 });
        Shelly.call('Switch.Set', { id: 1, on: true });
        print('Bright mode');
    },

    httpCall: function(url) {
        Shelly.call('HTTP.GET', { url: url }, function(res, err, msg) {
            if (err) print('HTTP error: ' + msg);
        });
    },

    forwardToTasmota: function(code, tasmotaIp) {
        var necCode = '0x' + toHex(code.userHi) + toHex(code.userLo) + toHex(code.cmd);
        var url = 'http://' + tasmotaIp + '/cm?cmnd=IRSend%20{"Protocol":"NEC","Bits":32,"Data":"' + necCode + '"}';
        this.httpCall(url);
    }
};

// ============================================================================
// MAIN IR HANDLER
// ============================================================================

function onIRReceived(code) {
    var name = getCodeName(code);
    if (name) {
        print('[IR] ' + name);
    } else {
        print('[IR] Unknown: ' + code.hex);
        return;
    }

    switch (name) {
        case 'POWER':
            Actions.allOff();
            break;
        case 'MUTE':
            Actions.toggleLight();
            break;
        case 'NUM_1':
            Shelly.call('Switch.Toggle', { id: 0 });
            break;
        case 'NUM_2':
            Shelly.call('Switch.Toggle', { id: 1 });
            break;
        case 'NUM_7':
            Actions.sceneMovie();
            break;
        case 'NUM_8':
            Actions.sceneBright();
            break;
        case 'CH_UP':
            Actions.httpCall('http://192.168.1.200/on');
            break;
        case 'CH_DOWN':
            Actions.httpCall('http://192.168.1.200/off');
            break;
    }
}

// ============================================================================
// BIDIRECTIONAL: Switch change -> send IR
// ============================================================================

function setupSwitchToIR() {
    Shelly.addStatusHandler(function(ev) {
        if (ev.component === 'switch:0' && ev.delta && ev.delta.output !== undefined) {
            if (ev.delta.output) {
                YSIRTM.sendCode(CODES.POWER);
                print('Switch ON -> IR POWER');
            }
        }
    });
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    if (!YSIRTM.init()) return;

    YSIRTM.onReceive(onIRReceived);
    // setupSwitchToIR();  // Uncomment for bidirectional

    print('[Example] Custom Handler ready');
}

init();
