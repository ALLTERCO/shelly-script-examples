/**
 * @title SDS011 virtual component UI
 * @description UI-oriented SDS011 script that updates virtual components with PM and
 *   AQI data.
 */

/**
 * SDS011 Air Quality Sensor with Virtual Components UI
 *
 * Reads PM2.5/PM10 from SDS011 sensor and displays values on
 * Shelly virtual components for graphical UI.
 *
 * Prerequisites:
 * - Run sds011_setup.shelly.js once to create virtual components
 *
 * Hardware connection:
 * - SDS011 TX (Pin 7) -> Shelly RX (GPIO)
 * - SDS011 RX (Pin 6) -> Shelly TX (GPIO)
 * - VCC (Pin 3) -> 5V
 * - GND (Pin 5) -> GND
 *
 * Virtual Components Used:
 * - number:200 - PM2.5 display
 * - number:201 - PM10 display
 * - text:200   - AQI category
 * - button:200 - Wake/Sleep toggle
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
    CMD_HEADER: 0xB4,

    // Frame sizes
    DATA_FRAME_SIZE: 10,

    // Virtual component IDs
    VC_PM25: 200,
    VC_PM10: 201,
    VC_AQI: 200,
    VC_BUTTON: 200,

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
    deviceId: null
};

/* === HELPERS === */

function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[SDS011-VC] " + msg);
    }
}

function calcDataChecksum(bytes) {
    var sum = 0;
    for (var i = 2; i < 8; i++) {
        sum += bytes[i];
    }
    return sum & 0xFF;
}

function calcCmdChecksum(bytes) {
    var sum = 0;
    for (var i = 2; i < 17; i++) {
        sum += bytes[i];
    }
    return sum & 0xFF;
}

function buildCommand(cmd, data, deviceId) {
    var frame = [];
    frame.push(CONFIG.HEADER);
    frame.push(CONFIG.CMD_HEADER);
    frame.push(cmd);

    for (var i = 0; i < 13; i++) {
        frame.push(data && data[i] !== undefined ? data[i] : 0x00);
    }

    var idLo = deviceId ? (deviceId & 0xFF) : 0xFF;
    var idHi = deviceId ? ((deviceId >> 8) & 0xFF) : 0xFF;
    frame.push(idLo);
    frame.push(idHi);
    frame.push(calcCmdChecksum(frame));
    frame.push(CONFIG.TAIL);

    return frame;
}

function sendCommand(frame) {
    var bytes = "";
    for (var i = 0; i < frame.length; i++) {
        bytes += String.fromCharCode(frame[i]);
    }
    state.uart.write(bytes);
}

/* === AQI CALCULATION === */

function getAqiCategory(pm25) {
    if (pm25 <= 12.0) return "Good";
    if (pm25 <= 35.4) return "Moderate";
    if (pm25 <= 55.4) return "Unhealthy (Sensitive)";
    if (pm25 <= 150.4) return "Unhealthy";
    if (pm25 <= 250.4) return "Very Unhealthy";
    return "Hazardous";
}

/* === SENSOR CONTROL === */

function setSleep(awake) {
    var data = [0x01, awake ? 0x01 : 0x00];
    var frame = buildCommand(0x06, data, state.deviceId);
    sendCommand(frame);
    state.isAwake = awake;
    debug(awake ? "Sensor waking up..." : "Sensor going to sleep...");
}

function setMode(active) {
    var data = [0x01, active ? 0x00 : 0x01];
    var frame = buildCommand(0x02, data, state.deviceId);
    sendCommand(frame);
}

/* === VIRTUAL COMPONENTS UPDATE === */

function updateVirtualComponents() {
    // Update PM2.5
    if (state.lastPm25 !== null) {
        Shelly.call("Number.Set", {
            id: CONFIG.VC_PM25,
            value: state.lastPm25
        });
    }

    // Update PM10
    if (state.lastPm10 !== null) {
        Shelly.call("Number.Set", {
            id: CONFIG.VC_PM10,
            value: state.lastPm10
        });
    }

    // Update AQI text
    if (state.lastPm25 !== null) {
        var aqi = getAqiCategory(state.lastPm25);
        Shelly.call("Text.Set", {
            id: CONFIG.VC_AQI,
            value: aqi
        });
    }
}

/* === UART HANDLER === */

function onUartReceive(data) {
    for (var i = 0; i < data.length; i++) {
        state.rxBuffer.push(data.charCodeAt(i));
    }
    processRxBuffer();
}

function processRxBuffer() {
    while (state.rxBuffer.length >= CONFIG.DATA_FRAME_SIZE) {
        if (state.rxBuffer[0] !== CONFIG.HEADER) {
            state.rxBuffer.shift();
            continue;
        }

        if (state.rxBuffer.length < CONFIG.DATA_FRAME_SIZE) {
            break;
        }

        if (state.rxBuffer[9] !== CONFIG.TAIL) {
            state.rxBuffer.shift();
            continue;
        }

        var frame = state.rxBuffer.splice(0, CONFIG.DATA_FRAME_SIZE);

        var checksum = calcDataChecksum(frame);
        if (checksum !== frame[8]) {
            debug("Checksum error");
            continue;
        }

        parseFrame(frame);
    }
}

function parseFrame(frame) {
    var cmd = frame[1];

    if (cmd === CONFIG.CMD_DATA) {
        var pm25Raw = frame[2] | (frame[3] << 8);
        var pm10Raw = frame[4] | (frame[5] << 8);

        state.lastPm25 = pm25Raw / 10.0;
        state.lastPm10 = pm10Raw / 10.0;
        state.deviceId = frame[6] | (frame[7] << 8);

        debug("PM2.5: " + state.lastPm25.toFixed(1) + " | PM10: " + state.lastPm10.toFixed(1));

        // Update virtual components
        updateVirtualComponents();

        // Emit event
        Shelly.emitEvent("air_quality", {
            pm25: state.lastPm25,
            pm10: state.lastPm10,
            aqi: getAqiCategory(state.lastPm25)
        });
    }
}

/* === BUTTON HANDLER === */

function onButtonEvent(ev) {
    if (ev.component !== "button:" + CONFIG.VC_BUTTON) return;
    if (!ev.info || ev.info.event !== "single_push") return;

    // Toggle wake/sleep
    if (state.isAwake) {
        setSleep(false);
        Shelly.call("Text.Set", {
            id: CONFIG.VC_AQI,
            value: "Sleeping..."
        });
    } else {
        setSleep(true);
        Shelly.call("Text.Set", {
            id: CONFIG.VC_AQI,
            value: "Waking up..."
        });
    }
}

/* === INITIALIZATION === */

function init() {
    print("SDS011 Air Quality Sensor with Virtual Components");
    print("=================================================");

    // Check virtual components exist
    var pm25Status = Shelly.getComponentStatus("number", CONFIG.VC_PM25);
    if (pm25Status === null) {
        print("ERROR: Virtual components not found!");
        print("Run sds011_setup.shelly.js first to create components.");
        return;
    }

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

    state.uart.recv(onUartReceive);
    print("UART configured at " + CONFIG.BAUD_RATE + " baud");

    // Register button handler
    Shelly.addEventHandler(onButtonEvent);

    // Initialize UI
    Shelly.call("Text.Set", {
        id: CONFIG.VC_AQI,
        value: "Initializing..."
    });

    // Wait for sensor to initialize
    Timer.set(2000, false, function() {
        state.isReady = true;
        setMode(true);
        print("Ready! Receiving air quality data...");
        Shelly.call("Text.Set", {
            id: CONFIG.VC_AQI,
            value: "Waiting for data..."
        });
    });
}

init();
