# JK200 BMS - MODBUS-RTU Reader

Script for reading live data from a **Jikong JK-PB series BMS** (commonly called JK200 for the 200A variants) over MODBUS-RTU via RS485/UART using The Pill.

Compatible models: JK-PB2A8S20P, JK-PB2A16S20P, JK-PB2A20S20P (and other PB-series variants).

## Files

### [the_pill_mbsa_jk200.shelly.js](the_pill_mbsa_jk200.shelly.js)

Reads two register blocks per poll cycle and prints a full status report to the Shelly script console:

- All individual cell voltages with min/max/delta
- Pack voltage, current, power
- State of Charge (SOC)
- MOSFET temperature, battery temperature sensors 1 & 2
- Balance current
- Active alarm flags

---

## Enable MODBUS on the BMS

By default the JK BMS communicates over its own proprietary protocol. To activate RS485 MODBUS slave mode:

1. Open the **JiKong BMS** app and connect via Bluetooth.
2. Go to **Settings -> Device Address**.
3. Set the address to any value from **1 to 15** (0 = disabled).
4. The chosen address becomes the MODBUS slave ID.

Communication: **115200 baud, 8N1** (protocol "001 - JK BMS RS485 Modbus V1.0").

---

## Hardware Requirements

- Shelly device with UART (e.g., **The Pill**)
- RS485 transceiver module (e.g., MAX485, SP485)
- Jikong JK-PB series BMS with RS485 connector

### Wiring

**RS485 module to Shelly (The Pill):**

| RS485 Module | Shelly / The Pill |
|---|---|
| RO (Receiver Output) | RX (GPIO) |
| DI (Driver Input) | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**RS485 module to JK BMS:**

| RS485 Module | JK BMS RS485 Port |
|---|---|
| A (D+) | A (D+) |
| B (D-) | B (D-) |

> The JK BMS RS485 port is a 4-pin JST-style connector. Typical pinout: GND, A, B, +5V. Consult your BMS manual for the exact connector layout -- not all units are identical.

---

## Register Map

The JK BMS uses **stride-1 addressing** for 16-bit fields and **stride-2** for 32-bit fields — no padding registers are inserted between values:

| Value width | MODBUS registers used | Layout |
|---|---|---|
| U_WORD / S_WORD (16-bit) | 1 | `[data]` |
| U_DWORD / S_DWORD (32-bit) | 2 | `[hi, lo]` |

> Note: The V1.0 protocol specification describes stride-2 WORDs and stride-4 DWORDs with padding. The actual device behaviour at 115200 baud omits all padding registers.

### Block A — Cell Voltages (`FC 0x03`, start `0x1200`, qty `CELL_COUNT`)

| Address | Parameter | Type | Unit |
|---|---|---|---|
| 0x1200 | Cell 1 voltage | U_WORD | mV |
| 0x1201 | Cell 2 voltage | U_WORD | mV |
| ... | ... | ... | ... |
| 0x1200 + (N-1) | Cell N voltage | U_WORD | mV |

Read quantity = `CELL_COUNT` registers. Cell N voltage = `registers[N-1]`.

### Block B — Key Parameters (`FC 0x03`, start `0x128A`, qty 30)

| Offset | Address | Parameter | Type | Unit | Notes |
|---|---|---|---|---|---|
| regs[0] | 0x128A | MOSFET temperature | S_WORD | 0.1 degC | |
| regs[1..2] | 0x128B-C | (reserved) | -- | -- | |
| regs[3..4] | 0x128D-E | Pack voltage | U_DWORD | mV | `regs[3]*65536 + regs[4]` |
| regs[5..6] | 0x128F-90 | Pack power | S_DWORD | mW | + = charging |
| regs[7..8] | 0x1291-92 | Pack current | S_DWORD | mA | + = charging |
| regs[9] | 0x1293 | Temperature 1 | S_WORD | 0.1 degC | |
| regs[10] | 0x1294 | Temperature 2 | S_WORD | 0.1 degC | |
| regs[11..12] | 0x1295-96 | Alarm bitmask | U_DWORD | -- | see below |
| regs[13] | 0x1297 | Balance current | S_WORD | mA | |
| regs[14] | 0x1298 | State of Charge | U_WORD | % | |

### Alarm Bitmask

| Bit | Meaning |
|---|---|
| 0 | Cell undervoltage |
| 1 | Cell overvoltage |
| 2 | Discharge overcurrent |
| 3 | Charge overcurrent |
| 4 | Low temperature (charge) |
| 5 | High temperature (discharge) |
| 6 | MOS overtemperature |
| 7 | Short circuit |
| 8 | Cell delta too large |
| 9 | Pack undervoltage |
| 10 | Pack overvoltage |
| 11 | Low SOC |
| 15 | Manual shutdown |

---

## Configuration

```javascript
var CONFIG = {
  BAUD_RATE: 115200,        // JK BMS RS485 Modbus V1.0 operates at 115200 baud
  MODE: '8N1',
  SLAVE_ID: 1,              // must match BMS Device Address setting
  CELL_COUNT: 16,           // 8 / 10 / 12 / 14 / 16 / 20 / 24
  RESPONSE_TIMEOUT: 2000,   // ms
  INTER_READ_DELAY: 100,    // ms between block A and block B reads
  POLL_INTERVAL: 10000,     // ms between full poll cycles
  DEBUG: false,             // true = print raw TX/RX frames
};
```

> Set `CELL_COUNT` to match your battery pack. Common values: 8 (24 V), 16 (48 V), 20 (60 V), 24 (72 V).

---

## Console Output Example

```
JK200 BMS - MODBUS-RTU Reader
==============================
Cells: 16 | Poll: 10 s

--- JK200 BMS ---
  Cells (16):
      1: 3.420 V
      2: 3.419 V
      3: 3.421 V
      4: 3.418 V (min)
     ...
      6: 3.428 V (max)
     ...
     16: 3.415 V
  Delta: 0.013 V | Min: 3.415 V (cell 16) | Max: 3.428 V (cell 6)
  Pack:    54.667 V | 0.585 A | 31.979 W
  SOC:     63 %
  Temp:    MOS 22.5 C | T1 20.3 C | T2 21.1 C
  Balance: 0.000 A
  Alarms:  none
```

---

## Implementation Notes

- Only FC 0x03 (Read Holding Registers) is used -- the script is **read-only**.
- Two bulk reads per poll: block A (cell voltages) then block B (parameters), with a 100 ms inter-read delay for bus stability.
- CRC-16 is computed via lookup table (MODBUS polynomial 0xA001).
- MODBUS exception responses are detected (FC | 0x80) and surfaced as error strings.
- A configurable response timeout (default 2 s) guards each request.
- Signed 32-bit values (power, current) are assembled from two 16-bit registers using integer arithmetic, avoiding bitshift overflow in mJS.
- All source characters are ASCII -- mJS (Shelly scripting runtime) does not support Unicode in script source.

---

## References

- [JK BMS RS485 Modbus V1.0 Protocol](https://github.com/ciciban/jkbms-PB2A16S20P)
- [ESPHome JK-BMS integration (syssi)](https://github.com/syssi/esphome-jk-bms)
- [ESPHome JK-BMS MODBUS YAML example](https://github.com/syssi/esphome-jk-bms/blob/main/esp32-jk-pb-modbus-example.yaml)
- [JK BMS RS485 Modbus V1.1 PDF](https://github.com/syssi/esphome-jk-bms/blob/main/docs/pb2a16s20p/BMS%20RS485%20Modbus%20V1.1.pdf)
- [MODBUS Protocol Specification](https://modbus.org/specs.php)
