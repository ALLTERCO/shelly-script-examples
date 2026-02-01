# MFRC522 RFID Card Reader

Scripts for reading RFID cards using the MFRC522-UART module.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- MFRC522-UART RFID module (not SPI version)
- 3.3V or 5V power supply

### Wiring

| MFRC522 | Shelly |
|---------|--------|
| TX | RX (GPIO) |
| RX | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**UART Settings:** 9600 baud, 8N1

## Files

### mfrc522.shelly.js

**Core API Library** - Full MFRC522 UART protocol implementation with block read/write support.

**Features:**
- Card UID detection
- Block read with authentication
- Block write with authentication
- Configurable key types (KEY_A, KEY_B)
- Event emission on card detection
- Debug logging

**Protocol:**
- Frame format: `[Header 0xAB] [Length] [Command] [Data...]`
- Commands: Wait (0x02), Read Block (0x03), Write Block (0x04)

**API Methods:**
```javascript
MFRC522.wait()                           // Enter wait mode (detect cards)
MFRC522.readBlock(block, keyType, key)   // Read 16-byte block
MFRC522.writeBlock(block, keyType, key, data)  // Write 16-byte block
MFRC522.getLastUid()                     // Get last detected card UID
```

**Events Emitted:**
```javascript
Shelly.emitEvent("rfid_card", {
    uid: "XX:XX:XX:XX",    // Hex string with colons
    uidBytes: [...]        // Raw byte array
});
```

---

### mfrc522_read.shelly.js

**Basic Read Example** - Simple card detection and UID reading.

**Features:**
- Initialize MFRC522 module
- Detect MIFARE cards (4-byte UID)
- Print card serial number
- Debounce repeated reads (configurable)
- Callback-based card detection

**API Methods:**
```javascript
MFRC522.init()              // Initialize UART connection
MFRC522.wait()              // Start listening for cards
MFRC522.onCard(callback)    // Register detection callback
MFRC522.offCard(id)         // Remove callback
```

**Example Output:**
```
========================================
         CARD DETECTED
========================================
  Serial (hex): A1 B2 C3 D4
  UID:          A1B2C3D4
  Bytes:        [161, 178, 195, 212]
========================================
```

## Quick Start

1. Wire the MFRC522-UART module to your Shelly device
2. Upload `mfrc522_read.shelly.js` for basic reading
3. Present a card to see its UID printed

## Supported Cards

- MIFARE Classic 1K (4-byte UID)
- MIFARE Classic 4K (4-byte UID)
- MIFARE Ultralight (7-byte UID)
- Most ISO 14443A compatible cards

## References

- [MFRC522-UART-Arduino](https://github.com/zodier/MFRC522-UART-Arduino)
