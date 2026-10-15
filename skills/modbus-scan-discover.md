# Skill: Discover Unknown MODBUS Devices with modbus_scan

Use `modbus_scan.shelly.js` to identify an unknown MODBUS-RTU device on the
RS-485 bus: find its slave ID, baud rate, serial mode, and which registers
respond — before writing any device-specific script.

---

## When to use this skill

- You have an RS-485 sensor/device with no known communication parameters.
- You want to confirm the parameters stated in a datasheet.
- You need to find which registers (FC03 / FC04) are readable and what values
  they return.

---

## Step 1 — Wire the device to The Pill

Connect the RS-485 bus using the 5-terminal add-on:

| The Pill pin | RS-485 signal |
|---|---|
| `IO1 (TX)` | `B (D-)` |
| `IO2 (RX)` | `A (D+)` |
| `IO3` | `DE/RE` (direction control, automatic) |
| `GND` | `GND` |

Power the sensor from a separate supply (9–24 VDC typical).
Connect only **one** device at a time during scanning to avoid bus contention.

---

## Step 2 — Upload and run modbus_scan

```bash
export DEVICE=<shelly-ip>           # e.g. 10.101.11.221

python3 tools/put_script.py ${DEVICE} 1 \
    the_pill/MODBUS/utils/modbus_scan.shelly.js
```

`put_script.py` stops any running script in slot 1, uploads the scanner, and
starts it automatically.

---

## Step 3 — Stream the log

```bash
curl -s -N "http://${DEVICE}/debug/log"
```

The scanner runs a two-phase sweep:

| Phase | What it does |
|---|---|
| **Phase 1 – ping** | Sends a minimal FC03/FC04 probe to every combination of baud rate × serial mode × slave ID. Reports each responding slave. |
| **Phase 2 – identify** | For each responding slave, reads a set of PROBE_REGS and prints the raw register values. |

Typical scan covers **5 bauds × 4 modes × 30 IDs = 600 combinations**.
Runtime is approximately **1–2 minutes** (depends on `RESPONSE_TIMEOUT`).

---

## Step 4 — Interpret the output

### Phase 1 hit
```
[SCAN] Found slave=1  baud=9600  mode=8N1  fc=0x04
```
This tells you the slave address, baud rate, and which function code responded.

### Phase 2 register dump
```
[ID]   slave=1  baud=9600  8N1
[FC04] addr=0x0000  val=0x0312  (786)
[FC04] addr=0x0001  val=0x0000  (0)
```
Each line is one register. Note the addresses that return non-zero or
physically meaningful values — those are your usable registers.

### Nothing found?
- Check wiring polarity (swap A/D+ and B/D−).
- Power-cycle the sensor.
- Verify the sensor is powered (separate supply, correct voltage).
- Some sensors require a minimum bus idle time before they respond — try
  increasing `RESPONSE_TIMEOUT` in `CONFIG` before re-scanning.

---

## Step 5 — Record the discovered parameters

From the scan output, note:

| Parameter | Example value |
|---|---|
| Slave ID | `1` |
| Baud rate | `9600` |
| Serial mode | `8N1` |
| Function code | `FC 0x04` |
| Register address(es) | `0x0000` (irradiance W/m²) |
| Data type | `UINT16` (single register) |

These values become the `CONFIG` block and `ENTITIES` table in the
device-specific script.

---

## Step 6 — Cross-check with the datasheet

If a datasheet is available, verify:
- The register address matches (datasheets often use 1-based Modicon addressing;
  subtract 1 to get the zero-based address used in Modbus frames).
- The data type and scale factor are correct (e.g. `raw × 0.1` for tenths).
- Registers that return 0 consistently may not be implemented — remove them
  from the entity list rather than assuming they are valid.

---

## Cleanup

After scanning, the scanner script stays in slot 1. Replace it with the
device-specific script:

```bash
python3 tools/put_script.py ${DEVICE} 1 \
    the_pill/MODBUS/<Vendor>/device_name.shelly.js
```

Or delete the slot to free it:

```bash
curl -s -X POST "http://${DEVICE}/rpc/Script.Stop" \
  -H "Content-Type: application/json" -d '{"id":1}'
curl -s -X POST "http://${DEVICE}/rpc/Script.Delete" \
  -H "Content-Type: application/json" -d '{"id":1}'
```

---

## Quick reference — scan CONFIG knobs

```js
var CONFIG = {
  BAUD_RATES:       [1200, 2400, 4800, 9600, 19200],
  MODES:            ['8N1', '8E1', '8O1', '8N2'],
  SLAVE_ID_MIN:     1,
  SLAVE_ID_MAX:     30,
  RESPONSE_TIMEOUT: 300,   // ms — increase for slow sensors
  DEBUG:            false,
};
```
