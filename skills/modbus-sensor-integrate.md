# Skill: Integrate a New MODBUS Sensor End-to-End

Full workflow for adding a previously unknown MODBUS-RTU sensor to the
repository: discovery → script → Virtual Components → README → commit.

---

## Overview

```
Scan (discover params)
  → Write pyranometer.shelly.js  (plain reader)
  → Write pyranometer_vc.shelly.js  (reader + Virtual Components)
  → Create VCs on device
  → Upload & test script
  → Write README.md
  → /simplify → commit → push
```

---

## Step 1 — Discover the device

Follow `skills/modbus-scan-discover.md` to find:
- Slave ID, baud rate, serial mode
- Function code(s) that respond (FC03 / FC04)
- Register addresses and raw values

Record all parameters before continuing.

---

## Step 2 — Create the directory

```
the_pill/MODBUS/<VendorName>/
```

Use `PascalCase` for the vendor folder name (e.g. `Davis`, `Deye`, `JKESS`).

---

## Step 3 — Write the plain reader script

File: `<VendorName>/device_name.shelly.js`

Minimal structure:

```js
/**
 * @title  <Vendor> <Model> MODBUS example
 * @description  Reads <measurement> from a <description> over MODBUS-RTU.
 * @status  production
 * @link  https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/<VendorName>/device_name.shelly.js
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 5000,
  DEBUG: false,
};
```

Include:
- Full MODBUS-RTU frame builder (`buildFrame`)
- CRC-16 table (copy from any existing script — polynomial `0xA001`)
- `sendRequest` / `onReceive` / `processResponse` / `clearResponseTimer`
- One `read<Measurement>` function per logical value
- `poll()` calling each read function in sequence
- `init()` opening UART and starting the timer

**Key correctness rules (from simplify review):**
- Minimum buffer length check in `processResponse` must be `< 5` (not `< 3`)
  before inspecting FC and CRC bytes.
- Exception code must be read from `state.rxBuffer[2]`, not from the FC byte.
- Confirm the device exception response length (4 bytes + 1 CRC = 5 total)
  before slicing `rxBuffer`.

---

## Step 4 — Write the Virtual Component variant

File: `<VendorName>/device_name_vc.shelly.js`

Start from the plain reader and add:

```js
var ENTITIES = [
  {
    name:     '<Measurement Name>',
    units:    '<unit>',
    reg:      { addr: 0x0000, rtype: 0x04, itype: 'u16', bo: 'BE', wo: 'BE' },
    scale:    1,
    rights:   'R',
    vcId:     'number:200',
    vcHandle: null,
  },
];
```

Add `updateVc` helper:

```js
function updateVc(entity, value) {
  if (!entity || !entity.vcHandle) return;
  entity.vcHandle.setValue(value);
  debug(entity.name + ' -> ' + value + ' [' + entity.units + ']');
}
```

In `init()`, resolve handles before starting the poll timer:

```js
for (var i = 0; i < ENTITIES.length; i++) {
  var ent = ENTITIES[i];
  if (ent.vcId) {
    ent.vcHandle = Virtual.getHandle(ent.vcId);
  }
}
```

In `poll()`, call `updateVc` after a successful read:

```js
updateVc(ENTITIES[0], measuredValue);
```

**Header comment must list the VC mapping:**

```
 * Virtual Component mapping (pre-create in the Shelly UI before running):
 *   number:200  <Measurement Name>  <unit>
```

---

## Step 5 — Create Virtual Components on the device

Follow `skills/shelly-vc-manage.md`.

For a single-measurement sensor:

```bash
export DEVICE=<shelly-ip>

# Create the number VC
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
  -H "Content-Type: application/json" \
  -d '{"type":"number","id":200,"config":{"name":"<Measurement>","persisted":false,"unit":"<unit>","min":0,"max":<max>}}'

# Create the group so it appears on the home screen
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
  -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"<Device Name>"}}'

curl -s -X POST "http://${DEVICE}/rpc/Group.Set" \
  -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200"]}'
```

If the device has existing VCs from a previous sensor, delete them first
(see `skills/shelly-vc-manage.md` §6). The device limit is 10 VCs total.

---

## Step 6 — Upload and test

```bash
# Upload and start the _vc script in slot 1
python3 tools/put_script.py ${DEVICE} 1 \
    the_pill/MODBUS/<VendorName>/device_name_vc.shelly.js

# Stream the log
curl -s -N "http://${DEVICE}/debug/log"
```

Expected log:
```
<Device Name> - MODBUS-RTU Reader + Virtual Components
=======================================================
Poll: 5 s

[PYR] Irradiance: 786 W/m2
```

Verify the VC value via HTTP:
```bash
curl -s "http://${DEVICE}/rpc/Virtual.GetStatus?key=number:200"
```

If `vcHandle` is null in the log, the script was started before the VC
was created — stop and restart the script.

---

## Step 7 — Write README.md

File: `<VendorName>/README.md`

Required sections (see `Deye/README.md` for a reference):

```markdown
# <Device Name> MODBUS Examples

<One sentence: what the sensor measures and how.>

## Problem (The Story)
<Why this integration exists; use case narrative.>

## Persona
- <Role 1>
- <Role 2>

## Files
- [`device_name.shelly.js`](device_name.shelly.js): console reader
- [`device_name_vc.shelly.js`](device_name_vc.shelly.js): reader + Virtual Components

## Register Map

| Address | FC | Type | Unit | Range | Description |
|---|---|---|---|---|---|
| `0x0000` | `0x04` | UINT16 | W/m² | 0–2000 | <Measurement> |

## Virtual Component Mapping

| Component | Name | Unit |
|---|---|---|
| `number:200` | <Measurement Name> | <unit> |
| `group:200` | <Device Name> | group |

## RS485 Wiring (The Pill 5-Terminal Add-on)

| The Pill Pin | Sensor |
|---|---|
| `IO1 (TX)` -> `B (D-)` | `B` / `D-` |
| `IO2 (RX)` -> `A (D+)` | `A` / `D+` |
| `IO3` -> `DE/RE` | transceiver direction |
| `GND` -> `GND` | recommended |
| `9–24 VDC` | sensor power supply (separate) |

Default communication parameters: slave `1`, `9600 baud`, `8N1`.
```

---

## Step 8 — Code review and commit

Run the simplify skill to catch quality issues before committing:

```
/simplify
```

Then commit following `skills/git-commit-merge-cleanup.md`:

```bash
git add the_pill/MODBUS/<VendorName>/
git commit -m "Add <VendorName> <Model> MODBUS-RTU example

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin dev
```

---

## Checklist

- [ ] Directory name is `PascalCase`
- [ ] Both scripts have `@status production` in JSDoc header
- [ ] `@link` URL uses the correct capitalised path
- [ ] CRC table is copied verbatim (polynomial `0xA001`)
- [ ] `processResponse` length guard is `< 5`
- [ ] Exception code uses `state.rxBuffer[2]`, not the FC byte
- [ ] `_vc` script lists VC mapping in file header comment
- [ ] VCs created on device **before** script is started
- [ ] Group VC created and `Group.Set` called with all member keys
- [ ] Script restarted after VC creation if started beforehand
- [ ] Registers that consistently return 0 are removed from ENTITIES
- [ ] README covers: register map, VC map, wiring table, default params
- [ ] `/simplify` run and issues fixed
- [ ] Committed and pushed to dev branch
