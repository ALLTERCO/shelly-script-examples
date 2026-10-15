# Skill: Manage Shelly Virtual Components

Create, delete, group, and verify Virtual Components (VCs) on a Shelly gen-3
device via the HTTP RPC API — and make them visible on the home screen.

---

## Prerequisites

- Shelly gen-3 device (Plus, Pro, Mini gen-3, or The Pill).
- Firmware ≥ 1.3.0.
- `curl` available.
- **Maximum 10 VCs per device** — plan the VC layout before creating them.

---

## Concepts

| Term | Meaning |
|---|---|
| `number` | Numeric display / input widget |
| `boolean` | Toggle switch |
| `button` | One-shot trigger |
| `text` | String display |
| `group` | Container that makes its members visible on the home screen |
| `key` | VC identifier in the form `"<type>:<id>"`, e.g. `"number:200"` |
| `id` | Numeric slot, ≥ 200 by convention for user-created VCs |

A group VC itself does **not** count toward the 10-VC limit in a way that
hides members; but every individual VC (including the group) is counted.

---

## 1. List existing VCs

```bash
export DEVICE=<shelly-ip>

curl -s "http://${DEVICE}/rpc/Shelly.GetComponents" \
  | python3 -m json.tool | grep '"key"'
```

---

## 2. Create a number VC

```bash
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "number",
    "id": 200,
    "config": {
      "name": "Solar Irradiance",
      "persisted": false,
      "unit": "W/m2",
      "min": 0,
      "max": 2000
    }
  }'
```

Common `unit` strings: `"W"`, `"V"`, `"A"`, `"Hz"`, `"%"`, `"degC"`,
`"W/m2"`, `"mA"`, `""` (none).

Set `"persisted": true` if the value should survive a reboot (e.g. user
setpoints read by a script). Leave `false` for sensor readings written by
a script.

---

## 3. Create a group VC

Create the group **after** the member VCs exist:

```bash
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Add" \
  -H "Content-Type: application/json" \
  -d '{"type":"group","id":200,"config":{"name":"Davis Pyranometer"}}'
```

Then assign its members (this is what makes them visible on the home screen):

```bash
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" \
  -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200"]}'
```

For multiple members list all keys:

```bash
curl -s -X POST "http://${DEVICE}/rpc/Group.Set" \
  -H "Content-Type: application/json" \
  -d '{"id":200,"value":["number:200","number:201","number:202"]}'
```

> **Home screen visibility rule**: a VC is visible on the Shelly home screen
> only if it is a member of a group. Creating a number VC alone is not enough
> — it must be added to a group via `Group.Set`.

---

## 4. Verify VC values

```bash
# Single VC
curl -s "http://${DEVICE}/rpc/Virtual.GetStatus?key=number:200" \
  | python3 -m json.tool
```

Expected:
```json
{ "id": 200, "value": 786.0 }
```

```bash
# Group membership
curl -s -X POST "http://${DEVICE}/rpc/Group.GetStatus" \
  -H "Content-Type: application/json" \
  -d '{"id":200}'
```

---

## 5. Delete a VC

```bash
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
  -H "Content-Type: application/json" \
  -d '{"key":"number:200"}'
```

---

## 6. Clear all VCs (reset to zero)

When switching devices or layouts, delete all existing VCs first:

```bash
# Delete number VCs 200-208
for id in 200 201 202 203 204 205 206 207 208; do
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"number:${id}\"}" && echo ""
done

# Delete button VCs 200-201 (if created)
for id in 200 201; do
  curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"button:${id}\"}" && echo ""
done

# Delete the group
curl -s -X POST "http://${DEVICE}/rpc/Virtual.Delete" \
  -H "Content-Type: application/json" \
  -d '{"key":"group:200"}'
```

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| VC not on home screen | No group created or VC not in group | Create group, run `Group.Set` with the VC key |
| Script reports `vcHandle null` | Script started before VC was created | Stop and restart the script |
| `Virtual.Add` returns error | 10-VC limit reached | Delete unused VCs first |
| Value stuck at old reading | Script not running | `Script.Start` → check log |
| Group empty after device reboot | `Group.Set` not called | Re-run `Group.Set` after `Virtual.Add` |

---

## 8. VC initialization order in scripts

`Virtual.getHandle(vcId)` must be called **after** the VC exists on the
device and the script is **started after** the VC is created.

```
Create VCs on device  →  Upload script  →  Start script
```

If the script was uploaded before the VC was created, restart it:

```bash
curl -s -X POST "http://${DEVICE}/rpc/Script.Stop"  -H "Content-Type: application/json" -d '{"id":1}'
curl -s -X POST "http://${DEVICE}/rpc/Script.Start" -H "Content-Type: application/json" -d '{"id":1}'
```
