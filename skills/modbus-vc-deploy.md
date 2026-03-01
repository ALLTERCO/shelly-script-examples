# Skill: Deploy a MODBUS + Virtual Component Script

This skill walks through the complete workflow for any `*_vc.shelly.js`
Modbus device script: read the VC requirements from the file, create the
Virtual Components on the Shelly device, upload the script, run it, and
verify correct behaviour.

See also: [`skills/shelly-script-deploy.md`](shelly-script-deploy.md) for the
generic script upload reference.

---

## Prerequisites

- Shelly **gen-3** device (Plus, Pro, Mini gen-3, or newer) — Virtual
  Components require gen-3 firmware.
- Firmware ≥ 1.3.0.
- Device reachable on the local network (same VLAN / Wi-Fi segment).
- Python 3 available on your workstation (for `tools/put_script.py`).
- `curl` available (for VC creation and verification).

---

## Step 1 — Read the VC requirements from the script

Open the `*_vc.shelly.js` file and look for the **Virtual Component mapping**
table in the file-header comment, and for `vcId` fields in the `ENTITIES`
array.

### What to look for

```
// Virtual Component mapping (pre-create with skills/modbus-vc-deploy.md):
//   number:200  Room Temperature  degC
//   number:201  Humidity          %
//   ...
//   group:200   ST802 Thermostat  (group)
```

Collect:
| Field | Meaning |
|-------|---------|
| `type` | `number`, `text`, `boolean`, `button`, `group` |
| `id`   | Numeric slot (≥ 200 by convention) |
| `name` | Human-readable label (from `entity.name` in ENTITIES) |
| `units`| Physical unit (from `entity.units`) |

### Quick grep

```bash
grep 'vcId' the_pill/MODBUS/.../the_*_vc.shelly.js | grep -v null
```

---

## Step 2 — Verify device reachability

```bash
export DEVICE=192.168.1.100          # replace with your device IP

curl -s "http://${DEVICE}/rpc/Shelly.GetDeviceInfo" | python3 -m json.tool
```

Expected response includes:
```json
{
  "id": "shellyplus1-AABBCC112233",
  "app": "Plus1",
  "ver": "1.4.4",
  ...
}
```

If `app` contains "Plus", "Pro", or "Mini" with gen-3 firmware you are good.

---

## Step 3 — Create Virtual Components

### 3a. Create number VCs

One `curl` call per data VC. Adjust `name` and `unit` to match the entity.

```bash
# Template:
# curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
#   -H "Content-Type: application/json" \
#   -d '{"type":"number","id":<ID>,"config":{"name":"<NAME>","persisted":false,"unit":"<UNIT>","min":-1000000,"max":1000000}}'

# --- Deye SG02LP1 (number:200-208) ---
for cfg in \
  '200|Total Power|W' \
  '201|Battery Power|W' \
  '202|PV1 Power|W' \
  '203|Total Grid Power|W' \
  '204|Battery SOC|%' \
  '205|PV1 Voltage|V' \
  '206|Grid Voltage L1|V' \
  '207|Current L1|A' \
  '208|AC Frequency|Hz'
do
  id=$(echo $cfg | cut -d'|' -f1)
  name=$(echo $cfg | cut -d'|' -f2)
  unit=$(echo $cfg | cut -d'|' -f3)
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"number\",\"id\":${id},\"config\":{\"name\":\"${name}\",\"persisted\":false,\"unit\":\"${unit}\",\"min\":-1000000,\"max\":1000000}}"
  echo ""
done
```

### 3b. Per-device VC tables

#### Deye SG02LP1 (`the_pill_mbsa_deye_vc.shelly.js`)

| curl id | Name | Unit |
|---------|------|------|
| 200 | Total Power | W |
| 201 | Battery Power | W |
| 202 | PV1 Power | W |
| 203 | Total Grid Power | W |
| 204 | Battery SOC | % |
| 205 | PV1 Voltage | V |
| 206 | Grid Voltage L1 | V |
| 207 | Current L1 | A |
| 208 | AC Frequency | Hz |

```bash
# Deye – individual curl commands
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":200,"config":{"name":"Total Power","persisted":false,"unit":"W","min":-100000,"max":100000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":201,"config":{"name":"Battery Power","persisted":false,"unit":"W","min":-100000,"max":100000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":202,"config":{"name":"PV1 Power","persisted":false,"unit":"W","min":0,"max":100000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":203,"config":{"name":"Total Grid Power","persisted":false,"unit":"W","min":-100000,"max":100000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":204,"config":{"name":"Battery SOC","persisted":false,"unit":"%","min":0,"max":100}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":205,"config":{"name":"PV1 Voltage","persisted":false,"unit":"V","min":0,"max":1000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":206,"config":{"name":"Grid Voltage L1","persisted":false,"unit":"V","min":0,"max":300}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":207,"config":{"name":"Current L1","persisted":false,"unit":"A","min":-100,"max":100}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":208,"config":{"name":"AC Frequency","persisted":false,"unit":"Hz","min":0,"max":100}}'
```

#### JK200 BMS (`the_pill_mbsa_jk200_vc.shelly.js`)

| id | Name | Unit |
|----|------|------|
| 200 | MOSFET Temperature | degC |
| 201 | Pack Voltage | mV |
| 202 | Pack Power | mW |
| 203 | Pack Current | mA |
| 204 | Temperature 1 | degC |
| 205 | Temperature 2 | degC |
| 206 | Alarm Bitmask | - |
| 207 | Balance Current | mA |
| 208 | State of Charge | % |

```bash
# JK200 BMS
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":200,"config":{"name":"MOSFET Temperature","persisted":false,"unit":"degC","min":-50,"max":150}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":201,"config":{"name":"Pack Voltage","persisted":false,"unit":"mV","min":0,"max":1000000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":202,"config":{"name":"Pack Power","persisted":false,"unit":"mW","min":-1000000,"max":1000000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":203,"config":{"name":"Pack Current","persisted":false,"unit":"mA","min":-1000000,"max":1000000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":204,"config":{"name":"Temperature 1","persisted":false,"unit":"degC","min":-50,"max":150}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":205,"config":{"name":"Temperature 2","persisted":false,"unit":"degC","min":-50,"max":150}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":206,"config":{"name":"Alarm Bitmask","persisted":false,"unit":"-","min":0,"max":65535}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":207,"config":{"name":"Balance Current","persisted":false,"unit":"mA","min":-10000,"max":10000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":208,"config":{"name":"State of Charge","persisted":false,"unit":"%","min":0,"max":100}}'
```

#### CWT-MB308V (`mb308v_vc.shelly.js`)

Mixed layout: 2 relay toggle buttons (INPUT), 2 DI displays (OUTPUT),
2 AO sliders (INPUT, persisted), 2 AI progress bars (OUTPUT).

| type | id | Name | Direction | Notes |
|------|----|------|-----------|-------|
| button | 200 | Relay 0 | INPUT | press → toggle DO 0 |
| button | 201 | Relay 1 | INPUT | press → toggle DO 1 |
| number | 200 | Digital Input 0 | OUTPUT | live 0/1 display |
| number | 201 | Digital Input 1 | OUTPUT | live 0/1 display |
| number | 202 | Analog Output 0 | INPUT | slider 0-24000, persisted |
| number | 203 | Analog Output 1 | INPUT | slider 0-24000, persisted |
| number | 204 | Analog Input 0 | OUTPUT | progress bar 0-10216 |
| number | 205 | Analog Input 1 | OUTPUT | progress bar 0-10216 |
| group | 200 | MB308V Demo | — | contains all above |

```bash
# MB308V — relay toggle buttons
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"button","id":200,"config":{"name":"Relay 0"}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"button","id":201,"config":{"name":"Relay 1"}}'

# MB308V — DI displays (read-only, script writes)
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":200,"config":{"name":"Digital Input 0","persisted":false,"unit":"","min":0,"max":1}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":201,"config":{"name":"Digital Input 1","persisted":false,"unit":"","min":0,"max":1}}'

# MB308V — AO sliders (user sets, script reads; persisted so value survives reboot)
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":202,"config":{"name":"Analog Output 0","persisted":true,"unit":"raw","min":0,"max":24000}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":203,"config":{"name":"Analog Output 1","persisted":true,"unit":"raw","min":0,"max":24000}}'

# MB308V — AI progress bars (read-only, script writes)
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":204,"config":{"name":"Analog Input 0","persisted":false,"unit":"raw","min":0,"max":10216}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":205,"config":{"name":"Analog Input 1","persisted":false,"unit":"raw","min":0,"max":10216}}'
```

> **Group membership note**: the `Group.Set` value array for MB308V must
> include both VC types: `"button:200"`, `"button:201"` plus `"number:200"`
> through `"number:205"` (6 numbers + 2 buttons = 8 members total).

#### LinkedGo ST802 (`st802_bms_vc.shelly.js`)

| id | Name | Unit |
|----|------|------|
| 200 | Room Temperature | degC |
| 201 | Humidity | % |
| 202 | Floor Temperature | degC |
| 203 | Relay State | - |
| 204 | Alarm | 0/1 |
| 205 | Mode | 0-7 |
| 206 | Fan Speed | 0-5 |
| 207 | Setpoint | degC |
| 208 | Power | 0/1 |

```bash
# ST802
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":200,"config":{"name":"Room Temperature","persisted":false,"unit":"degC","min":-20,"max":60}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":201,"config":{"name":"Humidity","persisted":false,"unit":"%","min":0,"max":100}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":202,"config":{"name":"Floor Temperature","persisted":false,"unit":"degC","min":-20,"max":60}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":203,"config":{"name":"Relay State","persisted":false,"unit":"-","min":0,"max":63}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":204,"config":{"name":"Alarm","persisted":false,"unit":"","min":0,"max":1}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":205,"config":{"name":"Mode","persisted":false,"unit":"","min":0,"max":7}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":206,"config":{"name":"Fan Speed","persisted":false,"unit":"","min":0,"max":5}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":207,"config":{"name":"Setpoint","persisted":false,"unit":"degC","min":5,"max":35}}'
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"number","id":208,"config":{"name":"Power","persisted":false,"unit":"","min":0,"max":1}}'
```

### 3c. Create the group VC

After all number/button VCs are created, bundle them into a group.
Run the block for your specific device:

```bash
# --- Deye SG02LP1 ---
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"Deye SG02LP1"}}'
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200","number:201","number:202","number:203","number:204","number:205","number:206","number:207","number:208"]}'

# --- JK200 BMS ---
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"JK200 BMS"}}'
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200","number:201","number:202","number:203","number:204","number:205","number:206","number:207","number:208"]}'

# --- CWT-MB308V (mixed: buttons + numbers) ---
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"MB308V Demo"}}'
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" -H "Content-Type: application/json" \
  -d '{"id":200,"value":["button:200","button:201","number:200","number:201","number:202","number:203","number:204","number:205"]}'

# --- LinkedGo ST802 ---
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"ST802 Thermostat"}}'
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200","number:201","number:202","number:203","number:204","number:205","number:206","number:207","number:208"]}'
```

### 3d. Verify components were created

```bash
curl -s "http://${DEVICE}/rpc/Shelly.GetComponents" | python3 -m json.tool | grep '"key"'
```

Expected output lists each VC:
```
"key": "number:200",
"key": "number:201",
...
"key": "group:200",
```

---

## Step 4 — Upload the script

Use the existing deploy tool:

```bash
python3 tools/put_script.py ${DEVICE} the_pill/MODBUS/Deye/the_pill_mbsa_deye_vc.shelly.js
```

The tool will:
1. Stop any running script in slot 1 (default)
2. Upload the file in 1 kB chunks
3. Set the script name to the filename
4. Start the script

If `tools/put_script.py` is not available, use chunked curl manually
(see `skills/shelly-script-deploy.md` for the full procedure).

---

## Step 5 — Start and monitor

### Check script list

```bash
curl -s "http://${DEVICE}/rpc/Script.List" | python3 -m json.tool
```

Note the script `id` (usually `1`).

### Start (if not auto-started by put_script.py)

```bash
curl -s -X POST "http://${DEVICE}/rpc/Script.Start" \
  -H "Content-Type: application/json" \
  -d '{"id":1}'
```

### Stream the log

```bash
curl -s -N "http://${DEVICE}/debug/log"
```

Press `Ctrl+C` to stop streaming.

### Expected log output — good behaviour

**Deye:**
```
Deye SG02LP1 - MODBUS-RTU Reader + Virtual Components
======================================================
[DEYE] VC handle for Total Power -> number:200
...
--- Deye SG02LP1 ---
Total Power: 1250 [W]
Battery Power: -300 [W]
...
```

**JK200 BMS:**
```
JK200 BMS - MODBUS-RTU Reader + Virtual Components
===================================================
[JK200] VC handle for MOSFET Temperature -> number:200
...
--- JK200 BMS ---
  Cells (16): ...
  Pack:    48.123 V | -12.456 A | -598.765 W
  SOC:     87 %
  ...
```

**MB308V:**
```
CWT-MB308V MODBUS IO Module + Virtual Components
=================================================
  button:200/201  -> relay toggle (DO 0/1)
  number:200/201  -> DI 0/1 display
  number:202/203  -> AO 0/1 sliders
  number:204/205  -> AI 0/1 progress bars
  group:200       -> MB308V Demo

[MB308V] VC out: DI 0 -> number:200
[MB308V] VC out: DI 1 -> number:201
[MB308V] VC out: AI 0 -> number:204
[MB308V] VC out: AI 1 -> number:205
[MB308V] VC in: Relay 0 toggle -> button:200
[MB308V] VC in: Relay 1 toggle -> button:201
[MB308V] VC in: AO 0 slider -> number:202
[MB308V] VC in: AO 1 slider -> number:203
Polling every 5s...

[DI] DI0:0 DI1:1
[AI] AI0:4.12mA  AI1:8.35mA
```

**ST802:**
```
LinkedGo ST802 - BMS Modbus RTU Client + Virtual Components
[ST802] VC handle for Room Temperature -> number:200
...
[ST802] Room: 21.5degC  Humidity: 55%  Floor: 19.0degC
[ST802] Mode: Heating
[ST802] Fan: Auto
```

### Signs of problems

| Log message | Cause | Fix |
|-------------|-------|-----|
| `VC handle for X -> number:NNN` missing | VC not created | Repeat Step 3 |
| `ERROR: UART not available` | UART pin conflict | Check Shelly UART config |
| `Timeout` repeatedly | RS485 wiring, baud, slave ID | Check hardware |
| `CRC error` | Noise on bus or wrong baud rate | Check termination |
| `Exception 0x02` | Wrong register address | Check device manual |

---

## Step 6 — Verify VC values via HTTP

After at least one poll cycle completes, read values directly:

```bash
# Read a single VC
curl -s "http://${DEVICE}/rpc/Virtual.GetStatus?key=number:200" | python3 -m json.tool
```

Expected response:
```json
{
  "id": 200,
  "value": 21.5
}
```

Read all VCs in one call:
```bash
curl -s "http://${DEVICE}/rpc/Shelly.GetStatus" | python3 -m json.tool | grep -A2 '"number:'
```

---

## Automated Python helper

The snippet below discovers `vcId` values from a `*_vc.shelly.js` file,
creates all VCs on the device, then uploads and starts the script.

```python
#!/usr/bin/env python3
"""
modbus_vc_setup.py  --  auto-provision VCs and deploy a *_vc.shelly.js script.

Usage:
    python3 modbus_vc_setup.py <DEVICE_IP> <script_path>

Example:
    python3 modbus_vc_setup.py 192.168.1.100 \
        the_pill/MODBUS/Deye/the_pill_mbsa_deye_vc.shelly.js
"""
import sys, re, json, urllib.request, subprocess

def rpc(ip, method, params=None):
    url  = f"http://{ip}/rpc/{method}"
    data = json.dumps(params or {}).encode()
    req  = urllib.request.Request(url, data=data,
                                   headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def parse_vc_ids(path):
    """Extract unique non-null vcId strings from the JS file."""
    text = open(path).read()
    return sorted(set(re.findall(r'vcId:\s*"([^"]+)"', text)))

def vc_type_id(vc_str):
    t, i = vc_str.split(":")
    return t, int(i)

def vc_name_from_file(path, vc_str):
    """Find the 'name' field of the ENTITY whose vcId matches vc_str."""
    pattern = r'name:\s*"([^"]+)"[^}]*vcId:\s*"' + re.escape(vc_str) + '"'
    m = re.search(pattern, open(path).read(), re.DOTALL)
    return m.group(1) if m else vc_str

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    ip, script = sys.argv[1], sys.argv[2]
    vc_ids = parse_vc_ids(script)

    if not vc_ids:
        print("No vcId values found in", script)
        sys.exit(0)

    print(f"Found {len(vc_ids)} VCs to create: {vc_ids}")

    # Step 1: create each VC
    group_members = []
    for vc in vc_ids:
        t, i = vc_type_id(vc)
        if t == "group":
            continue  # create group last
        name = vc_name_from_file(script, vc)
        print(f"  Virtual.Add  {vc}  '{name}'")
        try:
            rpc(ip, "Virtual.Add", {
                "type": t, "id": i,
                "config": {"name": name, "persisted": False,
                           "min": -1000000, "max": 1000000}
            })
        except Exception as e:
            print(f"    WARNING: {e}")
        group_members.append(vc)

    # Step 2: create group if present
    group_ids = [vc for vc in vc_ids if vc.startswith("group:")]
    for g in group_ids:
        _, gid = vc_type_id(g)
        print(f"  Virtual.Add  {g}  (group)")
        try:
            rpc(ip, "Virtual.Add", {
                "type": "group", "id": gid,
                "config": {"name": "Modbus Device"}
            })
            rpc(ip, "Group.Set", {"id": gid, "value": group_members})
        except Exception as e:
            print(f"    WARNING: {e}")

    # Step 3: upload script
    print(f"\nUploading {script} ...")
    subprocess.run(["python3", "tools/put_script.py", ip, script], check=True)
    print("Done. Stream log with:")
    print(f"  curl -s -N http://{ip}/debug/log")

if __name__ == "__main__":
    main()
```

Save as `tools/modbus_vc_setup.py` and run:

```bash
python3 tools/modbus_vc_setup.py 192.168.1.100 \
    the_pill/MODBUS/Deye/the_pill_mbsa_deye_vc.shelly.js
```

---

## Cleanup — Remove all VCs

If you need to start over, delete all VCs created for the device.

**Deye / JK200 / ST802** (9 × number + 1 group):
```bash
for id in 200 201 202 203 204 205 206 207 208; do
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"number:${id}\"}"
done
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
  -H "Content-Type: application/json" \
  -d '{"key":"group:200"}'
```

**MB308V** (2 × button + 6 × number + 1 group):
```bash
# Remove buttons
for id in 200 201; do
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"button:${id}\"}"
done
# Remove number VCs (200-205)
for id in 200 201 202 203 204 205; do
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"number:${id}\"}"
done
# Remove group
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
  -H "Content-Type: application/json" \
  -d '{"key":"group:200"}'
```
