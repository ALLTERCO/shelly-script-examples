# MODBUS Utility Scripts

Shared utility scripts for MODBUS-RTU diagnostics and device discovery on The Pill.

## Problem (The Story)
You have an unknown device on the RS485 bus, or you've lost track of its slave ID and serial settings. These utilities help you find and identify any MODBUS-RTU device without needing vendor software.

## Persona
- Integrator commissioning a new device with unknown or factory-reset settings
- DIY user discovering what is on a shared RS485 bus
- Developer testing a new MODBUS device before writing a dedicated reader script

## Files
- [`modbus_scan.shelly.js`](modbus_scan.shelly.js): Universal scanner — sweeps all combinations of baud rate, parity, stop bits, and slave IDs; reads PROBE_REGS to identify found devices

## Usage

### modbus_scan.shelly.js

Edit the top-level `CONFIG` to narrow the search:

```javascript
var CONFIG = {
  BAUDS:   [9600, 19200],  // remove rates you don't need
  MODES:   ['8N1', '8N2'], // common defaults
  ID_START: 1,
  ID_END:   10,            // lower for faster scan
  PING_TIMEOUT_MS: 200,
};
```

Add device-specific entries to `PROBE_REGS` to improve identification output:

```javascript
{ name: 'My Device Reg', fc: 0x03, addr: 100, qty: 2 },
```

Sample output:
```
--- 9600 baud  8N2 ---
  *** FOUND: slave=1  baud=9600  mode=8N2  -> OK ***

Identifying slave=1  baud=9600  mode=8N2
  [WB Supply Voltage] fc=0x04  addr=0x0079  -> 0x2EE0
  [WB Model String]   fc=0x04  addr=0x00C8  -> "WB-M1W2"

========================================
MODBUS Scan Summary
========================================
  slave=1  baud=9600  mode=8N2
========================================
```
