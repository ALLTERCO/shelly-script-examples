/**
 * MFRC522 UART RFID Card Reader for Shelly
 *
 * Reads RFID card UIDs using the MFRC522-UART module.
 * Based on: https://github.com/zodier/MFRC522-UART-Arduino
 *
 * Hardware connection:
 * - MFRC522 TX -> Shelly RX (GPIO)
 * - MFRC522 RX -> Shelly TX (GPIO)
 * - VCC -> 3.3V
 * - GND -> GND
 *
 * Protocol:
 * - Baud rate: 9600
 * - Frame format: [Header 0xAB] [Length] [Command] [Data...]
 */

/* === CONFIG === */
var CONFIG = {
    // UART settings
    BAUD_RATE: 9600,

    // Protocol constants
    HEADER: 0xAB,

    // Commands
    CMD_WAIT: 0x02,         // Put module in standby/wait mode
    CMD_READ_BLOCK: 0x03,   // Read block from card
    CMD_WRITE_BLOCK: 0x04,  // Write block to card

    // Status codes
    STATUS_OK: 1,
    STATUS_ERROR: 0,

    // Key types for authentication
    KEY_A: 0x00,
    KEY_B: 0x01,

    // Default key (factory default)
    DEFAULT_KEY: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],

    // Debug mode
    DEBUG: true
};

/* === STATE === */
var state = {
    uart: null,
    rxBuffer: [],
    lastCardUid: null,
    isReady: false
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
        if (i < bytes.length - 1) hex += ":";
    }
    return hex;
}

/**
 * Log debug messages
 */
function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[MFRC522] " + msg);
    }
}

/**
 * Build a command frame
 * Frame format: [Header 0xAB] [Length] [Command] [Data...]
 */
function buildFrame(command, data) {
    var frame = [];
    frame.push(CONFIG.HEADER);

    // Length includes: length byte + command byte + data length
    var len = 2 + (data ? data.length : 0);
    frame.push(len);
    frame.push(command);

    if (data) {
        for (var i = 0; i < data.length; i++) {
            frame.push(data[i]);
        }
    }

    return frame;
}

/**
 * Send command to MFRC522
 */
function sendCommand(command, data) {
    var frame = buildFrame(command, data);
    var bytes = "";
    for (var i = 0; i < frame.length; i++) {
        bytes += String.fromCharCode(frame[i]);
    }

    debug("TX: " + bytesToHex(frame));
    state.uart.write(bytes);
}

/* === MFRC522 API === */

var MFRC522 = {
    /**
     * Put module in wait/standby mode (ready to detect cards)
     */
    wait: function() {
        sendCommand(CONFIG.CMD_WAIT, null);
        debug("Entering wait mode...");
    },

    /**
     * Read a block from the card
     * @param {number} block - Block number (0-63 for 1K cards)
     * @param {number} keyType - KEY_A (0x00) or KEY_B (0x01)
     * @param {array} key - 6-byte authentication key
     * @param {function} callback - Called with (data, error)
     */
    readBlock: function(block, keyType, key, callback) {
        var data = [block, keyType];
        for (var i = 0; i < 6; i++) {
            data.push(key[i]);
        }
        sendCommand(CONFIG.CMD_READ_BLOCK, data);
        debug("Reading block " + block);
    },

    /**
     * Write a block to the card
     * @param {number} block - Block number (0-63 for 1K cards)
     * @param {number} keyType - KEY_A (0x00) or KEY_B (0x01)
     * @param {array} key - 6-byte authentication key
     * @param {array} blockData - 16-byte data to write
     */
    writeBlock: function(block, keyType, key, blockData) {
        var data = [block, keyType];
        for (var i = 0; i < 6; i++) {
            data.push(key[i]);
        }
        for (var j = 0; j < 16; j++) {
            data.push(blockData[j] || 0x00);
        }
        sendCommand(CONFIG.CMD_WRITE_BLOCK, data);
        debug("Writing block " + block);
    },

    /**
     * Get last read card UID
     */
    getLastUid: function() {
        return state.lastCardUid;
    }
};

/* === UART HANDLER === */

/**
 * Process received UART data
 * The module sends card UID when a card is detected
 */
function onUartReceive(data) {
    // Add received bytes to buffer
    for (var i = 0; i < data.length; i++) {
        state.rxBuffer.push(data.charCodeAt(i));
    }

    debug("RX buffer: " + bytesToHex(state.rxBuffer));

    // Process buffer - look for complete frames
    processRxBuffer();
}

/**
 * Process the receive buffer for complete frames
 */
function processRxBuffer() {
    // Need at least header + length to determine frame size
    while (state.rxBuffer.length >= 2) {
        // Look for header byte
        if (state.rxBuffer[0] !== CONFIG.HEADER) {
            // Not a header, could be raw UID data from some modules
            // Try to detect 4-byte or 7-byte UID
            if (state.rxBuffer.length >= 4) {
                // Assume it's a 4-byte UID (most common MIFARE Classic)
                var uid = state.rxBuffer.splice(0, 4);
                handleCardDetected(uid);
                continue;
            }
            // Skip invalid byte
            state.rxBuffer.shift();
            continue;
        }

        // Get frame length
        var frameLen = state.rxBuffer[1];

        // Check if we have the complete frame
        // Total frame = header (1) + length (1) + data (frameLen)
        var totalLen = 2 + frameLen;
        if (state.rxBuffer.length < totalLen) {
            // Wait for more data
            break;
        }

        // Extract complete frame
        var frame = state.rxBuffer.splice(0, totalLen);

        // Parse frame
        parseFrame(frame);
    }
}

/**
 * Parse a complete frame
 */
function parseFrame(frame) {
    debug("Parsing frame: " + bytesToHex(frame));

    if (frame.length < 3) {
        debug("Frame too short");
        return;
    }

    var command = frame[2];
    var data = frame.slice(3);

    switch (command) {
        case CONFIG.CMD_WAIT:
            // Response to wait command - might contain card UID
            if (data.length >= 4) {
                handleCardDetected(data);
            }
            break;

        case CONFIG.CMD_READ_BLOCK:
            // Block read response (16 bytes)
            if (data.length >= 16) {
                debug("Block data: " + bytesToHex(data.slice(0, 16)));
            }
            break;

        default:
            // Unknown command or card data
            if (data.length >= 4) {
                handleCardDetected(data);
            }
            break;
    }
}

/**
 * Handle card detection
 */
function handleCardDetected(uid) {
    var uidHex = bytesToHex(uid);
    state.lastCardUid = uid;

    print("=================================");
    print("Card detected!");
    print("UID: " + uidHex);
    print("UID length: " + uid.length + " bytes");
    print("=================================");

    // Emit event for other scripts/handlers
    Shelly.emitEvent("rfid_card", {
        uid: uidHex,
        uidBytes: uid
    });

    // Re-enter wait mode to detect next card
    Timer.set(500, false, function() {
        MFRC522.wait();
    });
}

/* === INITIALIZATION === */

function init() {
    print("MFRC522 UART RFID Reader");
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

    // Wait a moment for module to initialize
    Timer.set(1000, false, function() {
        state.isReady = true;
        print("Ready! Present a card to read...");

        // Put module in wait mode to start detecting cards
        MFRC522.wait();
    });
}

init();
