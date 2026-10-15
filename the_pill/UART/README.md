# UART Test

Simple UART loopback test for verifying wiring and communication with The Pill.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- Any UART-compatible device or USB-to-UART adapter

### Wiring

| Device | Shelly |
|--------|--------|
| TX | RX (GPIO) |
| RX | TX (GPIO) |
| GND | GND |

**UART Settings:** 9600 baud, 8N1

## Files

### uart_test.shelly.js

**UART Loopback Test** - Sends periodic messages and prints received data.

**Features:**
- Sends "Hello UART" every 2 seconds
- Prints all received UART data
- Configurable baud rate, message, and interval
- Optional ACK (0xF1) filtering

**Configuration:**
```javascript
var CONFIG = {
  baud: 9600,        // Baud rate
  mode: '8N1',       // UART mode
  txInterval: 2000,  // Send interval (ms)
  txMessage: 'Hello UART',
  debug: true
};
```

## Quick Start

1. Connect your UART device to Shelly (TX/RX/GND)
2. Upload `uart_test.shelly.js` to your Shelly device
3. Open the device console to see TX/RX messages
4. Verify data appears on both ends
