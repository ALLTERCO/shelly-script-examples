# iRobot Roomba Control

> **Under Development** - This example is currently under development and may not be fully functional.

Scripts for controlling iRobot Roomba 500 series vacuum cleaners via the Open Interface (OI) protocol over UART.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- iRobot Roomba 500 series (tested with Roomba 560)
- Mini-DIN cable connection

### Wiring

| Roomba Mini-DIN | Shelly |
|-----------------|--------|
| Pin 3 (RXD) | TX (GPIO) |
| Pin 4 (TXD) | RX (GPIO) |
| Pin 5 (BRC) | Optional wake pin |
| Pin 6,7 (GND) | GND |

**UART Settings:** 115200 baud, 8N1

## Files

### roomba_vc.shelly.js

**Core API Library** - Full implementation of the iRobot Open Interface protocol with self-created status and battery Virtual Components.

**Features:**
- Complete OI protocol implementation
- Mode control (Passive, Safe, Full)
- Cleaning commands (Clean, Spot, Dock)
- Drive control with velocity and radius
- Motor control (vacuum, brushes)
- LED and song control
- Sensor reading (battery, bumps, cliffs)
- Virtual component integration for status display

**API Methods:**
```javascript
ROOMBA.init()           // Initialize UART
ROOMBA.wakeUp(callback) // Wake and initialize Roomba
ROOMBA.start()          // Enter Passive mode
ROOMBA.safe()           // Enter Safe mode
ROOMBA.full()           // Enter Full mode
ROOMBA.clean()          // Start cleaning
ROOMBA.spot()           // Spot cleaning
ROOMBA.dock()           // Return to dock
ROOMBA.stop()           // Stop movement
ROOMBA.drive(vel, rad)  // Drive with velocity/radius
ROOMBA.driveDirect(l,r) // Direct wheel control
ROOMBA.motors(mask)     // Control cleaning motors
ROOMBA.leds(...)        // Control LEDs
ROOMBA.getBattery(cb)   // Read battery status
ROOMBA.beep()           // Play beep sound
```

---

### roomba_ctrl_vc.shelly.js

**Button Controller** - Control Roomba via self-created virtual buttons and physical inputs.

**Button Mappings:**
| Button | Single Push | Double Push | Long Push |
|--------|-------------|-------------|-----------|
| Main (button:200) | Start/Stop cleaning | Emergency stop | Return to dock |
| Spot (button:201) | Spot clean | - | - |

**Features:**
- Auto wake-up on first button press
- Battery monitoring (configurable interval)
- Status display via virtual components

## Quick Start

1. Wire your Roomba to the Shelly device
2. Upload and run `roomba_ctrl_vc.shelly.js`
3. The script creates/verifies the required Virtual Components at startup
4. Press the virtual button to wake and control your Roomba

## References

- [Roomba Arduino Library](https://github.com/orlin369/Roomba)
- [iRobot Create Open Interface Specification](https://www.irobot.com/about-irobot/stem/create-2)
