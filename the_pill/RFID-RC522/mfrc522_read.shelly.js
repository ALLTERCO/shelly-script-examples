/**
 * @title MFRC522 UART RFID read example
 * @description Basic MFRC522 example that detects cards and prints their UIDs.
 */

/**
 * MFRC522 RFID Card Reader - Basic Read Example
 *
 * Reads card serial numbers from MFRC522 module via UART.
 * Compatible with Shelly Gen2/Gen3 devices (The Pill).
 *
 * Wiring:
 *   Shelly TX → MFRC522 RX
 *   Shelly RX → MFRC522 TX
 *   Shelly GND → MFRC522 GND
 *   External 5V → MFRC522 VCC
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
    // UART settings
    baud: 9600,

    // Debug output
    debug: true,

    // Debounce: ignore same card within this period (ms)
    debounceMs: 1000
};

// ============================================================================
// CONSTANTS
// ============================================================================

var MFRC522_HEADER = 0xAB;
var COMMAND_WAIT = 0x02;
var COMMAND_READBLOCK = 0x03;
var COMMAND_WRITEBLOCK = 0x04;

var MIFARE_KEYA = 0x00;
var MIFARE_KEYB = 0x01;

var CARD_SERIAL_LENGTH = 4;

// ============================================================================
// UTILITIES
// ============================================================================

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHexString(bytes, separator) {
    separator = separator || ' ';
    var parts = [];
    for (var i = 0; i < bytes.length; i++) {
        parts.push(toHex(bytes[i]));
    }
    return parts.join(separator);
}

function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
    }
    return bytes;
}

function bytesToStr(bytes) {
    var str = '';
    for (var i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return str;
}

function log(msg) {
    if (CONFIG.debug) {
        print('[MFRC522] ' + msg);
    }
}

// ============================================================================
// MFRC522 API
// ============================================================================

var uart = null;
var rxBuffer = '';
var lastCardTime = 0;
var lastCardSerial = null;
var cardCallbacks = [];

var MFRC522 = {
    /**
     * Initialize UART connection to MFRC522 module
     * @returns {boolean} true if successful
     */
    init: function() {
        uart = UART.get();

        if (!uart.configure({ baud: CONFIG.baud, mode: '8N1' })) {
            print('[MFRC522] UART initialization failed');
            return false;
        }

        uart.recv(this._onReceive.bind(this));

        log('UART initialized at ' + CONFIG.baud + ' baud');

        // Put reader in wait mode
        this.wait();

        return true;
    },

    /**
     * Put MFRC522 in wait/listen mode
     */
    wait: function() {
        if (!uart) return;
        uart.write(bytesToStr([COMMAND_WAIT]));
        log('Waiting for card...');
    },

    /**
     * Register callback for card detection
     * @param {function} callback - Called with card object: { serial: [bytes], hex: "XX XX XX XX" }
     * @returns {number} callback ID for removal
     */
    onCard: function(callback) {
        cardCallbacks.push(callback);
        return cardCallbacks.length - 1;
    },

    /**
     * Remove card callback
     * @param {number} id - Callback ID from onCard()
     */
    offCard: function(id) {
        if (id >= 0 && id < cardCallbacks.length) {
            cardCallbacks[id] = null;
        }
    },

    /**
     * Internal: Handle received UART data
     */
    _onReceive: function(data) {
        if (!data || !data.length) return;

        var bytes = strToBytes(data);
        log('RX raw: ' + bytesToHexString(bytes));

        rxBuffer += data;

        // Process complete card serials (4 bytes)
        while (rxBuffer.length >= CARD_SERIAL_LENGTH) {
            var chunk = rxBuffer.substring(0, CARD_SERIAL_LENGTH);
            rxBuffer = rxBuffer.substring(CARD_SERIAL_LENGTH);
            this._processCard(strToBytes(chunk));
        }
    },

    /**
     * Internal: Process detected card
     */
    _processCard: function(serialBytes) {
        var now = Date.now();
        var hexStr = bytesToHexString(serialBytes);

        // Debounce: ignore repeated reads of same card
        if (lastCardSerial !== null &&
            now - lastCardTime < CONFIG.debounceMs &&
            hexStr === bytesToHexString(lastCardSerial)) {
            log('Debounced repeat: ' + hexStr);
            return;
        }

        lastCardTime = now;
        lastCardSerial = serialBytes.slice();

        var card = {
            serial: serialBytes,
            hex: hexStr,
            uid: hexStr.replace(/ /g, '')
        };

        log('Card detected: ' + card.hex);

        // Notify all callbacks
        for (var i = 0; i < cardCallbacks.length; i++) {
            if (cardCallbacks[i]) {
                cardCallbacks[i](card);
            }
        }

        // Return to wait mode for next card
        this.wait();
    }
};

// ============================================================================
// EXAMPLE: BASIC CARD READING
// ============================================================================

function onCardDetected(card) {
    print('');
    print('========================================');
    print('         CARD DETECTED');
    print('========================================');
    print('  Serial (hex): ' + card.hex);
    print('  UID:          ' + card.uid);
    print('  Bytes:        [' + card.serial.join(', ') + ']');
    print('========================================');
    print('');
}

// ============================================================================
// INIT
// ============================================================================

function init() {
    print('');
    print('MFRC522 RFID Card Reader');
    print('========================');
    print('');

    if (!MFRC522.init()) {
        print('ERROR: Failed to initialize MFRC522');
        return;
    }

    // Register card detection callback
    MFRC522.onCard(onCardDetected);

    print('Ready! Present a card to the reader...');
    print('');
}

init();
