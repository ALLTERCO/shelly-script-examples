/**
 * @title iRobot Roomba button controller
 * @description Controls Roomba via virtual buttons and physical inputs over UART.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/iRobotRoomba/roomba_ctrl.shelly.js
 */

/**
 * iRobot Roomba 560 - Button Control Script
 *
 * Controls Roomba 560 via virtual buttons and physical inputs.
 * Uses The Pill UART to communicate with Roomba via mini-DIN connector.
 *
 * Button Mappings:
 * - Button 1 (single): Clean / Start cleaning
 * - Button 1 (double): Stop / Emergency stop
 * - Button 1 (long):   Dock / Return to base
 * - Button 2 (single): Spot clean
 *
 * Hardware Connection:
 * - Roomba mini-DIN pin 3 (RXD) -> Shelly TX
 * - Roomba mini-DIN pin 4 (TXD) -> Shelly RX
 * - Roomba mini-DIN pin 5 (BRC) -> Optional wake pin
 * - Roomba mini-DIN pin 6,7 (GND) -> Shelly GND
 *
 * @see https://github.com/orlin369/Roomba
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
    // UART settings (Roomba 500 series default: 115200)
    baud: 115200,
    mode: '8N1',

    // Command delay between OI commands (ms)
    cmdDelayMs: 50,

    // Debug output
    debug: true,

    // Button components for control
    buttons: {
        main: 'button:200',     // Main control button
        spot: 'button:201'      // Spot clean button
    },

    // Virtual components for status display
    vc: {
        statusDisplay: 'text:200',
        batteryDisplay: 'number:200'
    },

    // Battery monitor interval (ms) - 0 to disable
    batteryPollMs: 60000
};

// ============================================================================
// OI OPCODES
// ============================================================================

var OI = {
    START: 128,
    SAFE: 131,
    FULL: 132,
    POWER: 133,
    SPOT: 134,
    COVER: 135,
    DOCK: 143,
    DRIVE: 137,
    DRIVERS: 138,
    SENSORS: 142
};

// ============================================================================
// SENSOR PACKET IDS
// ============================================================================

var SENSOR = {
    GROUP_3: 3,
    BUMPS_WHEELDROPS: 7
};

// ============================================================================
// CONSTANTS
// ============================================================================

var MODE = {
    OFF: 0,
    PASSIVE: 1,
    SAFE: 2,
    FULL: 3
};

// ============================================================================
// STATE
// ============================================================================

var uart = null;
var currentMode = MODE.OFF;
var isReady = false;
var isCleaning = false;

// Virtual component handles
var vcStatus = null;
var vcBattery = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

function bytesToHexStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += (i ? ' ' : '') + toHex(bytes[i]);
    }
    return s;
}

function int16ToBytes(val) {
    val = val & 0xFFFF;
    return [(val >> 8) & 0xFF, val & 0xFF];
}

function dbg(msg) {
    if (CONFIG.debug) {
        print('[ROOMBA] ' + msg);
    }
}

// ============================================================================
// ROOMBA CONTROL
// ============================================================================

function sendRaw(bytes) {
    if (!uart) return;
    dbg('TX: ' + bytesToHexStr(bytes));
    uart.write(bytesToStr(bytes));
}

function sendCmd(opcode) {
    sendRaw([opcode & 0xFF]);
}

function start() {
    sendCmd(OI.START);
    currentMode = MODE.PASSIVE;
    dbg('Started OI -> Passive mode');
    updateStatus('Passive');
}

function safe() {
    sendCmd(OI.SAFE);
    currentMode = MODE.SAFE;
    dbg('Safe mode');
    updateStatus('Safe');
}

function power() {
    sendCmd(OI.POWER);
    currentMode = MODE.PASSIVE;
    isCleaning = false;
    dbg('Power off');
    updateStatus('Power Off');
}

function spot() {
    sendCmd(OI.SPOT);
    isCleaning = true;
    dbg('Spot cleaning');
    updateStatus('Spot');
}

function clean() {
    sendCmd(OI.COVER);
    isCleaning = true;
    dbg('Cleaning');
    updateStatus('Cleaning');
}

function dock() {
    sendCmd(OI.DOCK);
    isCleaning = false;
    dbg('Seeking dock');
    updateStatus('Docking');
}

function stop() {
    var velBytes = int16ToBytes(0);
    var radBytes = int16ToBytes(0);
    sendRaw([OI.DRIVE, velBytes[0], velBytes[1], radBytes[0], radBytes[1]]);
    sendRaw([OI.DRIVERS, 0]);
    isCleaning = false;
    dbg('STOP');
    updateStatus('Stopped');
}

function wakeUp(callback) {
    dbg('Waking up Roomba...');

    Timer.set(100, false, function() {
        start();

        Timer.set(CONFIG.cmdDelayMs, false, function() {
            safe();

            Timer.set(CONFIG.cmdDelayMs, false, function() {
                isReady = true;
                dbg('Roomba ready');
                updateStatus('Ready');
                if (callback) callback();
            });
        });
    });
}

// ============================================================================
// VIRTUAL COMPONENTS
// ============================================================================

function updateStatus(status) {
    if (vcStatus) {
        try {
            vcStatus.setValue(status);
        } catch (e) { }
    }
}

function updateBattery(percent) {
    if (vcBattery) {
        try {
            vcBattery.setValue(percent);
        } catch (e) { }
    }
}

function initVirtualComponents() {
    if (CONFIG.vc.statusDisplay) {
        try {
            vcStatus = Virtual.getHandle(CONFIG.vc.statusDisplay);
            dbg('Status display VC connected');
        } catch (e) {
            dbg('Status display VC not available');
        }
    }

    if (CONFIG.vc.batteryDisplay) {
        try {
            vcBattery = Virtual.getHandle(CONFIG.vc.batteryDisplay);
            dbg('Battery display VC connected');
        } catch (e) {
            dbg('Battery display VC not available');
        }
    }
}

// ============================================================================
// BUTTON HANDLERS
// ============================================================================

function onMainButton(event) {
    dbg('Main button: ' + event);

    if (!isReady) {
        wakeUp(function() {
            onMainButton(event);
        });
        return;
    }

    if (event === 'single_push') {
        if (isCleaning) {
            stop();
        } else {
            clean();
        }
    } else if (event === 'double_push') {
        stop();
    } else if (event === 'long_push') {
        dock();
    }
}

function onSpotButton(event) {
    dbg('Spot button: ' + event);

    if (!isReady) {
        wakeUp(function() {
            onSpotButton(event);
        });
        return;
    }

    if (event === 'single_push') {
        spot();
    }
}

function onEvent(ev) {
    if (!ev.info || !ev.info.event) return;

    var event = ev.info.event;

    if (ev.component === CONFIG.buttons.main) {
        onMainButton(event);
    } else if (ev.component === CONFIG.buttons.spot) {
        onSpotButton(event);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    print('[ROOMBA] Initializing Roomba 560 controller...');

    // Initialize UART
    uart = UART.get();
    if (!uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
        print('[ROOMBA] ERROR: Failed to configure UART');
        return;
    }

    // Initialize virtual components
    initVirtualComponents();

    // Register event handler
    Shelly.addEventHandler(onEvent);

    // Setup battery monitoring
    if (CONFIG.batteryPollMs > 0) {
        Timer.set(CONFIG.batteryPollMs, true, function() {
            if (isReady) {
                sendRaw([OI.SENSORS, SENSOR.GROUP_3]);
            }
        });
    }

    updateStatus('Initialized');
    dbg('Initialized @ ' + CONFIG.baud + ' baud');
    dbg('Main button: ' + CONFIG.buttons.main);
    dbg('Spot button: ' + CONFIG.buttons.spot);
    print('[ROOMBA] Ready. Press main button to wake and control Roomba.');
}

init();
