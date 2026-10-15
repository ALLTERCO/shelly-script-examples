# MODBUS Utility Scripts

Shared utility scripts for MODBUS-RTU diagnostics and device discovery on The
Pill.

## Problem (The Story)
You may have either:
- an unknown device on the RS485 bus
- a known device with unknown slave ID or UART settings
- a known device with known bus settings but an unknown register map

These utilities help you move from bus-level discovery to register-level
discovery without vendor software.

## Persona
- Integrator commissioning a new device with unknown or factory-reset settings
- DIY user discovering what is on a shared RS485 bus
- Developer testing a new MODBUS device before writing a dedicated reader script

## Files
- [`modbus_scan.shelly.js`](modbus_scan.shelly.js): universal bus scanner that sweeps baud rate, UART mode, and slave IDs, then reads `PROBE_REGS` to help identify devices
- [`modbus_register_scan.shelly.js`](modbus_register_scan.shelly.js): register-space walker for known slave/baud/mode settings; reads `FC03` and `FC04` one register at a time

## Usage

### modbus_scan.shelly.js

Use this when the device exists on the RS485 bus, but you do not yet know its
address or serial settings.

Edit the top-level `CONFIG` to narrow the search:

```javascript
var CONFIG = {
  BAUDS: [9600, 19200],
  MODES: ['8N1', '8N2'],
  ID_START: 1,
  ID_END: 10,
  PING_TIMEOUT_MS: 200,
};
```

Add device-specific entries to `PROBE_REGS` to improve identification output:

```javascript
{ name: 'My Device Reg', fc: 0x03, addr: 100, qty: 2 },
```

Sample output:

```text
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

### modbus_register_scan.shelly.js

Use this when the target device address and UART settings are already known,
but the register map is not.

Edit the top-level `CONFIG`:

```javascript
var CONFIG = {
  SLAVE_ID: 1,
  BAUD_RATES: [9600],
  MODE: '8N1',
  FC_LIST: [0x03, 0x04],
  ADDR_START: 0,
  ADDR_END: 5000,
  QTY: 1,
};
```

Sample output:

```text
[9600][HOLDING] addr=8713 (0x2209) -> OK value=160 hex=0x00A0
[9600][HOLDING] addr=8992 (0x2320) -> OK value=5050 hex=0x13BA

========================================
MODBUS Register Discovery Summary
========================================
Baud 9600:
Holding Registers (9600, 0x03):
  OK: 104
  Exception: 4896
  Timeout: 1
```
