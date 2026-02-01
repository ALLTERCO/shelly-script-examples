# YS-IRTM Infrared Module

Scripts for sending and receiving NEC-format infrared codes using the YS-IRTM module.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- YS-IRTM IR transmitter/receiver module
- 5V power supply

### Wiring

| YS-IRTM | Shelly |
|---------|--------|
| TX | RX (GPIO) |
| RX | TX (GPIO) |
| VCC | 5V |
| GND | GND |

**UART Settings:** 9600 baud, 8N1 (configurable: 4800, 9600, 19200, 57600)

## Files

### ysirtm.shelly.js

**Core API Library** - Full YS-IRTM UART protocol implementation.

**Features:**
- Send NEC IR codes (3-byte format)
- Receive and decode IR codes
- Configurable module address
- Baud rate configuration
- Virtual component integration
- Debounced RX handling

**Protocol:**
- TX Command (0xF1): `[Address] [0xF1] [UserHi] [UserLo] [Cmd]`
- RX Format: 3 bytes `[UserHi] [UserLo] [Cmd]`
- Failsafe address: 0xFA (always works)

**API Methods:**
```javascript
YSIRTM.init()                    // Initialize UART
YSIRTM.send(userHi, userLo, cmd) // Send IR code
YSIRTM.sendCode([hi, lo, cmd])   // Send from array
YSIRTM.sendHex("00 BF 0D")       // Send from hex string
YSIRTM.onReceive(callback)       // Register RX callback
YSIRTM.offReceive(id)            // Remove callback
YSIRTM.setAddress(addr)          // Change module address
YSIRTM.setBaudRate(baud)         // Change baud rate
YSIRTM.getLastCode()             // Get last received code
```

**Helper Functions:**
```javascript
addCode('POWER', 0x00, 0xBF, 0x0D)    // Add named code
sendNamed('POWER')                     // Send by name
onButtonSend(component, event, code)   // Button trigger
onReceiveSwitch(code, switchId, action) // IR to switch
learnMode(seconds)                     // Capture codes
```

---

### btn2ir.shelly.js

**Button Trigger Example** - Send IR codes when buttons are pressed.

**Features:**
- Map virtual buttons to IR codes
- Map physical inputs to IR codes
- Support for BLU button triggers
- Named code library

**Default Mappings:**
| Button | Action |
|--------|--------|
| button:200 | POWER |
| button:201 | VOL_UP |
| button:202 | VOL_DOWN |
| button:203 | MUTE |

---

### ir2sw.shelly.js

**Switch Control Example** - Control Shelly switches via IR remote.

**Features:**
- Map IR codes to switch actions
- Support toggle, on, off actions
- Multiple switches from single remote

**Example Mappings:**
```javascript
onReceiveSwitch([0x00, 0xBF, 0x01], 0, 'toggle');  // Button 1 -> Switch 0
onReceiveSwitch([0x00, 0xBF, 0x0D], 0, 'off');     // Power -> All off
```

---

### ir_full.shelly.js

**Advanced Example** - Bidirectional control with custom handlers.

**Features:**
- Named code matching
- Scene activation (Movie mode, Bright mode)
- HTTP calls to external devices
- Switch state to IR forwarding
- Tasmota IR bridge integration

**Example Actions:**
- POWER → All switches off
- MUTE → Toggle light
- NUM_7 → Movie scene (dim lights)
- NUM_8 → Bright scene (full lights)
- CH_UP/DOWN → HTTP calls

---

### ir_learn.shelly.js

**Learn Mode** - Capture IR codes from any NEC-compatible remote.

**Features:**
- Auto-detect unique codes
- Count repeated presses
- Generate copy-paste code snippets
- Configurable duration (default 120s)

**Output Example:**
```
--- NEW CODE #1 ---
  Hex:   00 BF 0D
  Array: [0x00, 0xBF, 0x0D]
  Copy:  addCode('BTN_1', 0x00, 0xBF, 0x0D);
```

---

### tv_ir.shelly.js

**TV Remote Library** - Pre-configured codes for common TV brands.

**Supported Brands:**
- Samsung
- LG
- Generic (default)

**Available Commands:**
POWER, VOL_UP, VOL_DOWN, MUTE, CH_UP, CH_DOWN, INPUT/SOURCE, MENU, UP, DOWN, LEFT, RIGHT, OK/ENTER, NUM_0-NUM_9

**Usage:**
```javascript
var TV = SAMSUNG;  // or LG, GENERIC
loadTV(TV);

// Then use:
tv('POWER');
tvVolUp();
tvMute();
```

## Quick Start

### Send IR codes from buttons:
1. Upload `btn2ir.shelly.js`
2. Create virtual buttons in Shelly web UI
3. Press buttons to send IR codes

### Control switches with remote:
1. Upload `ir_learn.shelly.js` to capture your remote codes
2. Note the codes printed
3. Upload `ir2sw.shelly.js` and configure mappings

### TV control:
1. Upload `tv_ir.shelly.js`
2. Set `var TV = SAMSUNG;` (or your brand)
3. Create virtual buttons mapped to TV commands

## References

- [YS-IRTM MicroPython Library](https://github.com/mcauser/micropython-ys-irtm)
- [NEC IR Protocol](https://www.sbprojects.net/knowledge/ir/nec.php)
