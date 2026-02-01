/**
 * Nova Fitness SDS011 PM2.5/PM10 Air Quality Sensor for Shelly
 *
 * Reads particulate matter (PM2.5 and PM10) concentrations using the
 * SDS011 laser dust sensor via UART.
 *
 * Hardware connection:
 * - SDS011 TX (Pin 7) -> Shelly RX (GPIO)
 * - SDS011 RX (Pin 6) -> Shelly TX (GPIO)
 * - VCC (Pin 3) -> 5V (4.7-5.3V, ~70mA working)
 * - GND (Pin 5) -> GND
 *
 * Note: SDS011 uses 3.3V TTL logic levels for UART.
 *
 * Protocol:
 * - Baud rate: 9600
 * - Data frame: 10 bytes [Header 0xAA] [Cmd 0xC0] [Data x6] [Checksum] [Tail 0xAB]
 * - PM values in 0.1 ug/m3 units (divide by 10 for ug/m3)
 *
 * Specifications:
 * - Measuring range: 0.0-999.9 ug/m3 (PM2.5 and PM10)
 * - Resolution: 0.3 ug/m3
 * - Response time: 1 second
 * - Working temperature: -20 to +50 C
 * - Lifetime: 8000 hours continuous
 *
 * @see https://github.com/avaldebe/PyPMS
 * @see https://cdn.sparkfun.com/assets/parts/1/2/2/7/5/Laser_Dust_Sensor_Control_Protocol_V1.3.pdf
 */

/* === CONFIG === */
var CONFIG = {
    // UART settings
    BAUD_RATE: 9600,

    // Protocol constants
    HEADER: 0xAA,
    TAIL: 0xAB,
    CMD_DATA: 0xC0,
    CMD_REPLY: 0xC5,

    // Command header for control messages
    CMD_HEADER: 0xB4,

    // Frame sizes
    DATA_FRAME_SIZE: 10,
    CMD_FRAME_SIZE: 19,

    // Measurement interval (ms) - sensor outputs ~1/second in active mode
    READ_INTERVAL: 1000,

    // Working period (0 = continuous, 1-30 = minutes between measurements)
    WORK_PERIOD: 0,

    // Debug mode
    DEBUG: true
};

/* === STATE === */
var state = {
    uart: null,
    rxBuffer: [],
    isReady: false,
    isAwake: true,
    lastPm25: null,
    lastPm10: null,
    lastReadTime: 0,
    deviceId: null
};

/* === HELPERS === */

/**
 * Convert byte array to hex string
 */
function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
        var h = bytes[i].toString(16).toUpperCase();
        if (h.length === 1) h = "0" + h;
        hex += h;
        if (i < bytes.length - 1) hex += " ";
    }
    return hex;
}

/**
 * Log debug messages
 */
function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[SDS011] " + msg);
    }
}

/**
 * Calculate checksum for data frame (sum of bytes 2-7 mod 256)
 */
function calcDataChecksum(bytes) {
    var sum = 0;
    for (var i = 2; i < 8; i++) {
        sum += bytes[i];
    }
    return sum & 0xFF;
}

/**
 * Calculate checksum for command frame (sum of bytes 2-16 mod 256)
 */
function calcCmdChecksum(bytes) {
    var sum = 0;
    for (var i = 2; i < 17; i++) {
        sum += bytes[i];
    }
    return sum & 0xFF;
}

/**
 * Build a command frame (19 bytes)
 * Format: [0xAA] [0xB4] [cmd] [data x13] [id_lo] [id_hi] [checksum] [0xAB]
 */
function buildCommand(cmd, data, deviceId) {
    var frame = [];
    frame.push(CONFIG.HEADER);
    frame.push(CONFIG.CMD_HEADER);
    frame.push(cmd);

    // Data bytes (13 bytes, pad with zeros)
    for (var i = 0; i < 13; i++) {
        frame.push(data && data[i] !== undefined ? data[i] : 0x00);
    }

    // Device ID (0xFFFF = all devices)
    var idLo = deviceId ? (deviceId & 0xFF) : 0xFF;
    var idHi = deviceId ? ((deviceId >> 8) & 0xFF) : 0xFF;
    frame.push(idLo);
    frame.push(idHi);

    // Checksum
    frame.push(calcCmdChecksum(frame));

    // Tail
    frame.push(CONFIG.TAIL);

    return frame;
}

/**
 * Send command to SDS011
 */
function sendCommand(frame) {
    var bytes = "";
    for (var i = 0; i < frame.length; i++) {
        bytes += String.fromCharCode(frame[i]);
    }

    debug("TX: " + bytesToHex(frame));
    state.uart.write(bytes);
}

/* === SDS011 API === */

var SDS011 = {
    /**
     * Set reporting mode
     * @param {boolean} active - true for active mode (continuous), false for query mode
     */
    setMode: function(active) {
        // Command 0x02: Set data reporting mode
        // Data[0] = 1 (set), Data[1] = 0 (active) or 1 (query)
        var data = [0x01, active ? 0x00 : 0x01];
        var frame = buildCommand(0x02, data, state.deviceId);
        sendCommand(frame);
        debug("Set mode: " + (active ? "active" : "query"));
    },

    /**
     * Query data in query mode (passive mode)
     */
    query: function() {
        // Command 0x04: Query data
        var frame = buildCommand(0x04, null, state.deviceId);
        sendCommand(frame);
        debug("Query data");
    },

    /**
     * Set device ID
     * @param {number} newId - New device ID (0-65535)
     */
    setDeviceId: function(newId) {
        // Command 0x05: Set device ID
        var data = [];
        for (var i = 0; i < 11; i++) data.push(0x00);
        data.push(newId & 0xFF);
        data.push((newId >> 8) & 0xFF);
        var frame = buildCommand(0x05, data, state.deviceId);
        sendCommand(frame);
        debug("Set device ID: " + newId);
    },

    /**
     * Set sleep/wake state
     * @param {boolean} awake - true to wake, false to sleep
     */
    setSleep: function(awake) {
        // Command 0x06: Set sleep and work
        // Data[0] = 1 (set), Data[1] = 0 (sleep) or 1 (work)
        var data = [0x01, awake ? 0x01 : 0x00];
        var frame = buildCommand(0x06, data, state.deviceId);
        sendCommand(frame);
        state.isAwake = awake;
        debug(awake ? "Wake up" : "Sleep");
    },

    /**
     * Wake up the sensor
     */
    wake: function() {
        this.setSleep(true);
    },

    /**
     * Put sensor to sleep (fan stops, laser off)
     */
    sleep: function() {
        this.setSleep(false);
    },

    /**
     * Set working period
     * @param {number} minutes - 0 for continuous, 1-30 for interval in minutes
     */
    setWorkPeriod: function(minutes) {
        // Command 0x08: Set working period
        // Data[0] = 1 (set), Data[1] = period (0=continuous, 1-30=minutes)
        minutes = Math.max(0, Math.min(30, minutes));
        var data = [0x01, minutes];
        var frame = buildCommand(0x08, data, state.deviceId);
        sendCommand(frame);
        debug("Set work period: " + (minutes === 0 ? "continuous" : minutes + " min"));
    },

    /**
     * Get firmware version
     */
    getFirmware: function() {
        // Command 0x07: Check firmware version
        var frame = buildCommand(0x07, null, state.deviceId);
        sendCommand(frame);
        debug("Get firmware version");
    },

    /**
     * Get last PM2.5 reading (ug/m3)
     */
    getPM25: function() {
        return state.lastPm25;
    },

    /**
     * Get last PM10 reading (ug/m3)
     */
    getPM10: function() {
        return state.lastPm10;
    },

    /**
     * Get last readings as object
     */
    getReadings: function() {
        return {
            pm25: state.lastPm25,
            pm10: state.lastPm10,
            timestamp: state.lastReadTime,
            deviceId: state.deviceId
        };
    },

    /**
     * Check if sensor is awake
     */
    isAwake: function() {
        return state.isAwake;
    }
};

/* === UART HANDLER === */

/**
 * Process received UART data
 */
function onUartReceive(data) {
    // Add received bytes to buffer
    for (var i = 0; i < data.length; i++) {
        state.rxBuffer.push(data.charCodeAt(i));
    }

    // Process buffer for complete frames
    processRxBuffer();
}

/**
 * Process the receive buffer for complete frames
 */
function processRxBuffer() {
    while (state.rxBuffer.length >= CONFIG.DATA_FRAME_SIZE) {
        // Look for header byte
        if (state.rxBuffer[0] !== CONFIG.HEADER) {
            // Skip invalid byte
            state.rxBuffer.shift();
            continue;
        }

        // Check if we have a complete frame
        if (state.rxBuffer.length < CONFIG.DATA_FRAME_SIZE) {
            break;
        }

        // Validate tail byte
        if (state.rxBuffer[9] !== CONFIG.TAIL) {
            // Invalid frame, skip header and try again
            state.rxBuffer.shift();
            continue;
        }

        // Extract frame
        var frame = state.rxBuffer.splice(0, CONFIG.DATA_FRAME_SIZE);

        // Validate checksum
        var checksum = calcDataChecksum(frame);
        if (checksum !== frame[8]) {
            debug("Checksum error: got " + frame[8] + ", expected " + checksum);
            continue;
        }

        // Parse frame based on command byte
        parseFrame(frame);
    }
}

/**
 * Parse a complete data frame
 */
function parseFrame(frame) {
    var cmd = frame[1];

    debug("RX: " + bytesToHex(frame));

    if (cmd === CONFIG.CMD_DATA) {
        // Data frame: PM2.5 and PM10 readings
        var pm25Raw = frame[2] | (frame[3] << 8);
        var pm10Raw = frame[4] | (frame[5] << 8);

        // Convert to ug/m3 (raw values are in 0.1 ug/m3)
        state.lastPm25 = pm25Raw / 10.0;
        state.lastPm10 = pm10Raw / 10.0;
        state.lastReadTime = Date.now();

        // Extract device ID
        state.deviceId = frame[6] | (frame[7] << 8);

        handleNewReading();
    } else if (cmd === CONFIG.CMD_REPLY) {
        // Command reply
        var replyCmd = frame[2];
        debug("Command reply for 0x" + replyCmd.toString(16).toUpperCase());

        // Handle specific replies
        if (replyCmd === 0x07) {
            // Firmware version reply
            var year = frame[3];
            var month = frame[4];
            var day = frame[5];
            debug("Firmware: 20" + year + "-" + month + "-" + day);
        }
    }
}

/**
 * Handle new sensor reading
 */
function handleNewReading() {
    print("=================================");
    print("Air Quality Reading");
    print("PM2.5: " + state.lastPm25.toFixed(1) + " ug/m3");
    print("PM10:  " + state.lastPm10.toFixed(1) + " ug/m3");
    print("AQI:   " + getAqiCategory(state.lastPm25));
    print("=================================");

    // Emit event for other scripts/handlers
    Shelly.emitEvent("air_quality", {
        pm25: state.lastPm25,
        pm10: state.lastPm10,
        deviceId: state.deviceId,
        aqi: getAqiCategory(state.lastPm25)
    });
}

/**
 * Get AQI category based on PM2.5 value (US EPA breakpoints)
 */
function getAqiCategory(pm25) {
    if (pm25 <= 12.0) return "Good";
    if (pm25 <= 35.4) return "Moderate";
    if (pm25 <= 55.4) return "Unhealthy (Sensitive)";
    if (pm25 <= 150.4) return "Unhealthy";
    if (pm25 <= 250.4) return "Very Unhealthy";
    return "Hazardous";
}

/* === INITIALIZATION === */

function init() {
    print("Nova Fitness SDS011 Air Quality Sensor");
    print("Initializing...");

    // Initialize UART
    state.uart = UART.get();
    if (!state.uart) {
        print("ERROR: UART not available on this device");
        return;
    }

    state.uart.configure({
        baud: CONFIG.BAUD_RATE,
        mode: "8N1"
    });

    // Set up receive handler
    state.uart.recv(onUartReceive);

    print("UART configured at " + CONFIG.BAUD_RATE + " baud");

    // Wait for sensor to initialize (fan spin-up)
    Timer.set(2000, false, function() {
        state.isReady = true;
        print("Ready! Receiving air quality data...");

        // Set to active mode for continuous readings
        SDS011.setMode(true);

        // Optionally set working period
        if (CONFIG.WORK_PERIOD > 0) {
            Timer.set(100, false, function() {
                SDS011.setWorkPeriod(CONFIG.WORK_PERIOD);
            });
        }
    });
}

init();
