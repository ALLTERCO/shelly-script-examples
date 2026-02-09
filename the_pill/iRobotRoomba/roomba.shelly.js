/**
 * @title iRobot Roomba Open Interface library
 * @description UART library implementing the iRobot Open Interface (OI) for Roomba
 *   500 series control.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/iRobotRoomba/roomba.shelly.js
 */

/**
 * iRobot Roomba 500 Series - Core API Library
 *
 * Full implementation of the iRobot Open Interface (OI) protocol for
 * Roomba 500 series (including Roomba 560) via UART.
 *
 * Protocol Reference:
 * - Baud Rate: 115200 (default for 500 series)
 * - Serial: 8N1
 * - OI Protocol v2
 *
 * @see https://github.com/orlin369/Roomba
 * @see iRobot Create Open Interface Specification
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
    // UART settings (Roomba 500 series default: 115200)
    baud: 115200,
    mode: '8N1',

    // Wake pulse duration (ms) - pulse BRC pin to wake Roomba
    wakePulseMs: 100,

    // Command delay between OI commands (ms)
    cmdDelayMs: 50,

    // Sensor polling interval (ms)
    sensorPollMs: 500,

    // Debug output
    debug: true,

    // Virtual components (optional - set to null to disable)
    vc: {
        statusDisplay: 'text:200',   // Shows Roomba status
        batteryDisplay: 'number:200' // Shows battery percentage
    }
};

// ============================================================================
// OI OPCODES
// ============================================================================

var OI = {
    // Mode commands
    RESET: 7,
    START: 128,
    BAUD: 129,
    SAFE: 131,
    FULL: 132,
    POWER: 133,

    // Cleaning commands
    SPOT: 134,
    COVER: 135,
    DEMO: 136,
    DOCK: 143,

    // Actuator commands
    DRIVE: 137,
    DRIVERS: 138,
    LEDS: 139,
    SONG: 140,
    PLAY: 141,
    PWM_DRIVERS: 144,
    DRIVE_DIRECT: 145,
    DIGITAL_OUT: 147,
    SEND_IR: 151,

    // Sensor commands
    SENSORS: 142,
    STREAM: 148,
    QUERY_LIST: 149,
    STREAM_PAUSE: 150,

    // Scripting commands (Create only)
    SCRIPT: 152,
    PLAY_SCRIPT: 153,
    GET_SCRIPT: 154,
    WAIT: 155,
    WAIT_DISTANCE: 156,
    WAIT_ANGLE: 157,
    WAIT_EVENT: 158,

    // Display commands (newer models)
    DIGIT_LEDS_RAW: 163,
    DIGIT_LEDS_ASCII: 164
};

// ============================================================================
// SENSOR PACKET IDS
// ============================================================================

var SENSOR = {
    // Packet groups
    GROUP_0: 0,    // Packets 7-26
    GROUP_1: 1,    // Packets 7-16
    GROUP_2: 2,    // Packets 17-20
    GROUP_3: 3,    // Packets 21-26
    GROUP_4: 4,    // Packets 27-34
    GROUP_5: 5,    // Packets 35-42
    GROUP_6: 6,    // Packets 7-42

    // Individual packets
    BUMPS_WHEELDROPS: 7,
    WALL: 8,
    CLIFF_LEFT: 9,
    CLIFF_FRONT_LEFT: 10,
    CLIFF_FRONT_RIGHT: 11,
    CLIFF_RIGHT: 12,
    VIRTUAL_WALL: 13,
    OVERCURRENTS: 14,
    DIRT_DETECT: 15,
    UNUSED_1: 16,
    IR_BYTE: 17,
    BUTTONS: 18,
    DISTANCE: 19,
    ANGLE: 20,
    CHARGING_STATE: 21,
    VOLTAGE: 22,
    CURRENT: 23,
    TEMPERATURE: 24,
    BATTERY_CHARGE: 25,
    BATTERY_CAPACITY: 26,
    WALL_SIGNAL: 27,
    CLIFF_LEFT_SIGNAL: 28,
    CLIFF_FRONT_LEFT_SIGNAL: 29,
    CLIFF_FRONT_RIGHT_SIGNAL: 30,
    CLIFF_RIGHT_SIGNAL: 31,
    DIGITAL_INPUTS: 32,
    ANALOG_INPUT: 33,
    CHARGING_SOURCES: 34,
    OI_MODE: 35,
    SONG_NUMBER: 36,
    SONG_PLAYING: 37,
    STREAM_PACKETS: 38,
    VELOCITY: 39,
    RADIUS: 40,
    RIGHT_VELOCITY: 41,
    LEFT_VELOCITY: 42
};

// ============================================================================
// CONSTANTS
// ============================================================================

var DRIVE = {
    STRAIGHT: 0x8000,
    CLOCKWISE: 0xFFFF,
    COUNTER_CLOCKWISE: 0x0001
};

var MODE = {
    OFF: 0,
    PASSIVE: 1,
    SAFE: 2,
    FULL: 3
};

var CHARGE_STATE = {
    NOT_CHARGING: 0,
    RECONDITIONING: 1,
    FULL_CHARGING: 2,
    TRICKLE_CHARGING: 3,
    WAITING: 4,
    FAULT: 5
};

var LED = {
    NONE: 0,
    PLAY: 0x02,
    ADVANCE: 0x08
};

var MOTOR = {
    SIDE_BRUSH: 0x01,
    VACUUM: 0x02,
    MAIN_BRUSH: 0x04
};

var BUTTON = {
    MAX: 0x01,
    CLEAN: 0x02,
    SPOT: 0x04,
    POWER: 0x08
};

var BUMP = {
    RIGHT: 0x01,
    LEFT: 0x02,
    WHEELDROP_RIGHT: 0x04,
    WHEELDROP_LEFT: 0x08,
    WHEELDROP_CASTER: 0x10
};

// ============================================================================
// STATE
// ============================================================================

var uart = null;
var currentMode = MODE.OFF;
var lastSensorData = null;
var sensorCallbacks = [];
var rxBuffer = '';

// Virtual component handles
var vcStatus = null;
var vcBattery = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert a byte to 2-char uppercase hex string
 */
function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

/**
 * Convert byte array to hex string with spaces
 */
function bytesToHexStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += (i ? ' ' : '') + toHex(bytes[i]);
    }
    return s;
}

/**
 * Convert byte array to binary string for UART write
 */
function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

/**
 * Convert binary string to byte array
 */
function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
    }
    return bytes;
}

/**
 * Convert signed 16-bit to two bytes (big-endian)
 */
function int16ToBytes(val) {
    val = val & 0xFFFF;
    return [(val >> 8) & 0xFF, val & 0xFF];
}

/**
 * Convert two bytes (big-endian) to signed 16-bit
 */
function bytesToInt16(hi, lo) {
    var val = ((hi & 0xFF) << 8) | (lo & 0xFF);
    if (val >= 0x8000) val -= 0x10000;
    return val;
}

/**
 * Debug print helper
 */
function dbg(msg) {
    if (CONFIG.debug) {
        print('[ROOMBA] ' + msg);
    }
}

// ============================================================================
// ROOMBA CORE API
// ============================================================================

var ROOMBA = {
    /**
     * Initialize UART communication
     * @returns {boolean} true if successful
     */
    init: function() {
        uart = UART.get();

        if (!uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
            print('[ROOMBA] ERROR: Failed to configure UART');
            return false;
        }

        // Setup RX handler
        uart.recv(this._onReceive.bind(this));

        // Setup virtual components if configured
        this._initVirtualComponents();

        dbg('Initialized @ ' + CONFIG.baud + ' baud');
        return true;
    },

    /**
     * Send raw bytes to Roomba
     * @param {number[]} bytes - Array of bytes to send
     */
    sendRaw: function(bytes) {
        dbg('TX: ' + bytesToHexStr(bytes));
        uart.write(bytesToStr(bytes));
    },

    /**
     * Send single opcode
     * @param {number} opcode - OI opcode
     */
    sendCmd: function(opcode) {
        this.sendRaw([opcode & 0xFF]);
    },

    // ------------------------------------------------------------------------
    // Mode Commands
    // ------------------------------------------------------------------------

    /**
     * Start the OI (enters Passive mode)
     * Must be called before any other OI commands
     */
    start: function() {
        this.sendCmd(OI.START);
        currentMode = MODE.PASSIVE;
        dbg('Started OI -> Passive mode');
        this._updateStatus('Passive');
    },

    /**
     * Reset the Roomba (simulates removing battery)
     */
    reset: function() {
        this.sendCmd(OI.RESET);
        currentMode = MODE.OFF;
        dbg('Reset');
        this._updateStatus('Reset');
    },

    /**
     * Enter Safe mode (cliff/bump protection active)
     */
    safe: function() {
        this.sendCmd(OI.SAFE);
        currentMode = MODE.SAFE;
        dbg('Safe mode');
        this._updateStatus('Safe');
    },

    /**
     * Enter Full mode (all safety disabled - use with caution!)
     */
    full: function() {
        this.sendCmd(OI.FULL);
        currentMode = MODE.FULL;
        dbg('Full mode');
        this._updateStatus('Full');
    },

    /**
     * Power down the Roomba
     */
    power: function() {
        this.sendCmd(OI.POWER);
        currentMode = MODE.PASSIVE;
        dbg('Power off');
        this._updateStatus('Power Off');
    },

    // ------------------------------------------------------------------------
    // Cleaning Commands
    // ------------------------------------------------------------------------

    /**
     * Start spot cleaning
     */
    spot: function() {
        this.sendCmd(OI.SPOT);
        dbg('Spot cleaning');
        this._updateStatus('Spot');
    },

    /**
     * Start max/cover cleaning
     */
    clean: function() {
        this.sendCmd(OI.COVER);
        dbg('Cover/Clean');
        this._updateStatus('Cleaning');
    },

    /**
     * Seek the dock
     */
    dock: function() {
        this.sendCmd(OI.DOCK);
        dbg('Seeking dock');
        this._updateStatus('Docking');
    },

    // ------------------------------------------------------------------------
    // Drive Commands
    // ------------------------------------------------------------------------

    /**
     * Drive with velocity and radius
     * @param {number} velocity - mm/s (-500 to 500)
     * @param {number} radius - mm (-2000 to 2000), special values for straight/spin
     */
    drive: function(velocity, radius) {
        velocity = Math.max(-500, Math.min(500, velocity));
        var velBytes = int16ToBytes(velocity);
        var radBytes = int16ToBytes(radius);
        this.sendRaw([OI.DRIVE, velBytes[0], velBytes[1], radBytes[0], radBytes[1]]);
        dbg('Drive: vel=' + velocity + ' rad=' + radius);
    },

    /**
     * Drive straight at given velocity
     * @param {number} velocity - mm/s (-500 to 500)
     */
    driveStraight: function(velocity) {
        this.drive(velocity, DRIVE.STRAIGHT);
    },

    /**
     * Spin in place
     * @param {number} velocity - mm/s (positive = counter-clockwise)
     */
    spin: function(velocity) {
        if (velocity >= 0) {
            this.drive(velocity, DRIVE.COUNTER_CLOCKWISE);
        } else {
            this.drive(-velocity, DRIVE.CLOCKWISE);
        }
    },

    /**
     * Stop all movement
     */
    stop: function() {
        this.drive(0, 0);
        dbg('Stop');
    },

    /**
     * Drive with direct wheel velocities
     * @param {number} leftVel - Left wheel mm/s (-500 to 500)
     * @param {number} rightVel - Right wheel mm/s (-500 to 500)
     */
    driveDirect: function(leftVel, rightVel) {
        leftVel = Math.max(-500, Math.min(500, leftVel));
        rightVel = Math.max(-500, Math.min(500, rightVel));
        var leftBytes = int16ToBytes(leftVel);
        var rightBytes = int16ToBytes(rightVel);
        this.sendRaw([OI.DRIVE_DIRECT, rightBytes[0], rightBytes[1], leftBytes[0], leftBytes[1]]);
        dbg('DriveDirect: L=' + leftVel + ' R=' + rightVel);
    },

    // ------------------------------------------------------------------------
    // Motor Commands
    // ------------------------------------------------------------------------

    /**
     * Control cleaning motors
     * @param {number} motors - Bitmask of MOTOR.SIDE_BRUSH, VACUUM, MAIN_BRUSH
     */
    motors: function(motors) {
        this.sendRaw([OI.DRIVERS, motors & 0x07]);
        dbg('Motors: ' + toHex(motors));
    },

    /**
     * Control motors with PWM
     * @param {number} mainBrush - -127 to 127
     * @param {number} sideBrush - -127 to 127
     * @param {number} vacuum - 0 to 127
     */
    motorsPWM: function(mainBrush, sideBrush, vacuum) {
        mainBrush = Math.max(-127, Math.min(127, mainBrush)) & 0xFF;
        sideBrush = Math.max(-127, Math.min(127, sideBrush)) & 0xFF;
        vacuum = Math.max(0, Math.min(127, vacuum)) & 0xFF;
        this.sendRaw([OI.PWM_DRIVERS, mainBrush, sideBrush, vacuum]);
        dbg('MotorsPWM: main=' + mainBrush + ' side=' + sideBrush + ' vac=' + vacuum);
    },

    // ------------------------------------------------------------------------
    // LED Commands
    // ------------------------------------------------------------------------

    /**
     * Control LEDs
     * @param {number} leds - Bitmask of LED.PLAY, LED.ADVANCE
     * @param {number} powerColor - 0 (green) to 255 (red)
     * @param {number} powerIntensity - 0 to 255
     */
    leds: function(leds, powerColor, powerIntensity) {
        this.sendRaw([
            OI.LEDS,
            leds & 0x0A,
            powerColor & 0xFF,
            powerIntensity & 0xFF
        ]);
        dbg('LEDs: leds=' + toHex(leds) + ' color=' + powerColor + ' intensity=' + powerIntensity);
    },

    // ------------------------------------------------------------------------
    // Song Commands
    // ------------------------------------------------------------------------

    /**
     * Define a song
     * @param {number} songNum - Song slot (0-4)
     * @param {number[]} notes - Array of [note, duration, note, duration, ...]
     */
    song: function(songNum, notes) {
        var numNotes = Math.min(16, Math.floor(notes.length / 2));
        var cmd = [OI.SONG, songNum & 0x0F, numNotes];
        for (var i = 0; i < numNotes * 2; i++) {
            cmd.push(notes[i] & 0xFF);
        }
        this.sendRaw(cmd);
        dbg('Song ' + songNum + ' defined (' + numNotes + ' notes)');
    },

    /**
     * Play a song
     * @param {number} songNum - Song slot (0-4)
     */
    playSong: function(songNum) {
        this.sendRaw([OI.PLAY, songNum & 0x0F]);
        dbg('Play song ' + songNum);
    },

    /**
     * Play a simple beep
     */
    beep: function() {
        this.song(0, [72, 10, 72, 10, 79, 20]);
        var self = this;
        Timer.set(100, false, function() {
            self.playSong(0);
        });
    },

    // ------------------------------------------------------------------------
    // Sensor Commands
    // ------------------------------------------------------------------------

    /**
     * Request sensor data
     * @param {number} packetId - Sensor packet ID
     * @param {function} callback - callback(data)
     */
    getSensors: function(packetId, callback) {
        if (callback) {
            sensorCallbacks.push({
                packetId: packetId,
                callback: callback,
                timestamp: Date.now()
            });
        }
        this.sendRaw([OI.SENSORS, packetId & 0xFF]);
    },

    /**
     * Get battery status
     * @param {function} callback - callback({voltage, current, charge, capacity, percent, temp, state})
     */
    getBattery: function(callback) {
        var self = this;
        this.getSensors(SENSOR.GROUP_3, function(data) {
            if (data && data.length >= 10) {
                var voltage = bytesToInt16(data[0], data[1]);
                var current = bytesToInt16(data[2], data[3]);
                var temp = data[4];
                if (temp > 127) temp -= 256;
                var charge = bytesToInt16(data[5], data[6]);
                var capacity = bytesToInt16(data[7], data[8]);
                var percent = capacity > 0 ? Math.round(charge * 100 / capacity) : 0;

                var batteryData = {
                    voltage: voltage,
                    current: current,
                    charge: charge,
                    capacity: capacity,
                    percent: percent,
                    temp: temp,
                    state: data[9] !== undefined ? data[9] : -1
                };

                self._updateBattery(percent);

                if (callback) callback(batteryData);
            }
        });
    },

    /**
     * Get bump and wheel drop sensors
     * @param {function} callback - callback({bumpLeft, bumpRight, dropLeft, dropRight, dropCaster})
     */
    getBumps: function(callback) {
        this.getSensors(SENSOR.BUMPS_WHEELDROPS, function(data) {
            if (data && data.length >= 1) {
                var b = data[0];
                if (callback) {
                    callback({
                        bumpRight: !!(b & BUMP.RIGHT),
                        bumpLeft: !!(b & BUMP.LEFT),
                        dropRight: !!(b & BUMP.WHEELDROP_RIGHT),
                        dropLeft: !!(b & BUMP.WHEELDROP_LEFT),
                        dropCaster: !!(b & BUMP.WHEELDROP_CASTER)
                    });
                }
            }
        });
    },

    /**
     * Register callback for sensor updates
     * @param {function} callback - callback(sensorData)
     */
    onSensorUpdate: function(callback) {
        sensorCallbacks.push({
            packetId: -1,
            callback: callback,
            timestamp: 0
        });
    },

    // ------------------------------------------------------------------------
    // Convenience Methods
    // ------------------------------------------------------------------------

    /**
     * Wake up and initialize Roomba
     * Call this first before any other commands
     * @param {function} callback - Called when ready
     */
    wakeUp: function(callback) {
        var self = this;
        dbg('Waking up Roomba...');

        // Send start command
        Timer.set(CONFIG.wakePulseMs, false, function() {
            self.start();

            // Switch to safe mode
            Timer.set(CONFIG.cmdDelayMs, false, function() {
                self.safe();

                // Beep to confirm ready
                Timer.set(CONFIG.cmdDelayMs, false, function() {
                    self.beep();
                    dbg('Roomba ready');
                    if (callback) callback();
                });
            });
        });
    },

    /**
     * Perform a quick clean cycle
     */
    quickClean: function() {
        var self = this;
        this.wakeUp(function() {
            Timer.set(500, false, function() {
                self.clean();
            });
        });
    },

    /**
     * Emergency stop - stop all motors and movement
     */
    emergencyStop: function() {
        this.stop();
        this.motors(0);
        dbg('EMERGENCY STOP');
        this._updateStatus('STOPPED');
    },

    // ------------------------------------------------------------------------
    // Internal Handlers
    // ------------------------------------------------------------------------

    _onReceive: function(data) {
        if (!data || data.length === 0) return;

        rxBuffer += data;
        var bytes = strToBytes(rxBuffer);

        // Process sensor callbacks
        if (sensorCallbacks.length > 0) {
            var cb = sensorCallbacks.shift();
            if (cb && cb.callback) {
                cb.callback(bytes);
            }
            rxBuffer = '';
        }

        dbg('RX: ' + bytesToHexStr(bytes));
    },

    _initVirtualComponents: function() {
        if (CONFIG.vc.statusDisplay) {
            try {
                vcStatus = Virtual.getHandle(CONFIG.vc.statusDisplay);
            } catch (e) {
                dbg('Status display VC not available');
            }
        }

        if (CONFIG.vc.batteryDisplay) {
            try {
                vcBattery = Virtual.getHandle(CONFIG.vc.batteryDisplay);
            } catch (e) {
                dbg('Battery display VC not available');
            }
        }
    },

    _updateStatus: function(status) {
        if (vcStatus) {
            try {
                vcStatus.setValue(status);
            } catch (e) { }
        }
    },

    _updateBattery: function(percent) {
        if (vcBattery) {
            try {
                vcBattery.setValue(percent);
            } catch (e) { }
        }
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Setup button trigger for Roomba commands
 * @param {string} component - e.g., "button:200" or "input:0"
 * @param {string} event - e.g., "single_push", "double_push", "long_push"
 * @param {function} action - Function to execute
 */
function onButtonAction(component, event, action) {
    Shelly.addEventHandler(function(ev) {
        if (ev.component === component && ev.info && ev.info.event === event) {
            action();
        }
    });
    dbg('Button trigger: ' + component + ':' + event);
}

/**
 * Setup periodic battery monitoring
 * @param {number} intervalMs - Poll interval in milliseconds
 * @param {function} callback - callback({percent, voltage, ...})
 */
function monitorBattery(intervalMs, callback) {
    Timer.set(intervalMs, true, function() {
        ROOMBA.getBattery(callback);
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

print('[ROOMBA] API loaded. Call ROOMBA.init() then ROOMBA.wakeUp() to start.');
