# iATS — Intelligent Automatic Transfer Switch

Automatic grid/backup source selection and optional manual override for a two-channel Shelly device.

## Problem (The Story)

A site with both a grid connection and a backup source (generator, inverter, UPS) needs a transfer switch that reacts instantly to source availability, enforces a dead-time gap between contactors to prevent momentary paralleling, and never lets the physical Shelly inputs accidentally toggle the outputs on their own. These scripts implement the full control loop on the Shelly itself — no external controller needed — and add an optional Sensor Add-on panel for manual operator override without touching the main controller logic.

## Persona

- Installer commissioning a grid/generator or grid/inverter transfer switch
- Automation engineer replacing a discrete ATS relay panel with programmable Shelly logic
- Integrator who needs a safe, auditable transfer-switch script with a manual override path

## Scripts

### [`iats_grid_backup_controller.shelly.js`](https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/automatic-transfer-switch/iats_grid_backup_controller.shelly.js)

The main controller script, designed to run on the **Shelly Pro 2** (and compatible two-channel devices). It continuously polls `input:0` (grid available) and `input:1` (backup available), computes the correct source using the truth table, and drives `switch:1` (K1 grid contactor) and `switch:0` (K2 backup contactor) accordingly. On boot it detaches both inputs from the outputs so the Shelly firmware cannot bypass the script logic. Every source change follows a strict open-both → wait → close-target sequence to prevent contactors from being energised in parallel. An optional KVS key lets the Sensor Add-on helper override the mode to MANUAL without the controller needing to know anything about the operator panel.

### [`iats_sensor_addon_manual_control.shelly.js`](https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/automatic-transfer-switch/iats_sensor_addon_manual_control.shelly.js)

An optional companion script for the **Shelly Pro Sensor Add-on**. It reads DIN0 (`input:100`, AUTO/MANUAL selector) and DIN1 (`input:101`, GRID/PV selector) and publishes the current selection to the shared KVS key at a configurable interval. It never touches `switch:0` or `switch:1` — source availability is still validated by the controller before any contactor closes. An incrementing sequence number in the published value acts as a heartbeat; the controller reverts to AUTO mode automatically if the sequence stops updating.

## Supported Devices

The controller script requires a two-channel Shelly device in **switch profile** (not cover profile):

- Shelly Pro 2
- Shelly Pro 2PM
- Shelly Plus 2PM
- Shelly 2PM Gen3 / Gen4

The optional manual-control helper runs on any device that has the **Shelly Pro Sensor Add-on** fitted (DIN inputs `input:100` and `input:101`).

## Wiring and I/O Mapping

### Controller device

| Physical terminal | Shelly component | Role |
|---|---|---|
| Input SW1 | `input:0` | Grid available signal (dry contact) |
| Input SW2 | `input:1` | Backup available signal (dry contact) |
| Output O1 | `switch:0` | K2 — backup source contactor command |
| Output O2 | `switch:1` | K1 — grid source contactor command |

> The script detaches SW1 and SW2 from O1/O2 on boot so the Shelly firmware cannot directly toggle the contactors. The script is the **sole owner** of `switch:0` and `switch:1`.

### Sensor Add-on (optional)

| DIN terminal | Shelly component | Role |
|---|---|---|
| DIN0 | `input:100` | AUTO (LOW) / MANUAL (HIGH) |
| DIN1 | `input:101` | GRID (LOW) / PV-backup (HIGH) |

## Truth Table (AUTO mode)

| SW2 (backup) | SW1 (grid) | O2 / K1 (grid) | O1 / K2 (backup) | State |
|:---:|:---:|:---:|:---:|---|
| 0 | 0 | 0 | 0 | OFF — no source available |
| 0 | 1 | 1 | 0 | GRID |
| 1 | 0 | 0 | 1 | BACKUP |
| 1 | 1 | 1 | 0 | GRID priority |

## Safety Behaviour

1. **Input detachment** — on boot, both switch channels are configured with `in_mode: detached`. Startup halts with both outputs off if detachment cannot be verified (configurable).
2. **Open-before-close** — before selecting any new source both outputs are opened first, then the target contactor is closed after `TRANSFER_DELAY_MS`. This dead-time prevents momentary parallel-source connection.
3. **Debounce** — rapid input changes are debounced by `DEBOUNCE_MS` before triggering a new evaluation.
4. **Transfer guard** — if the target changes again during the transfer delay, the transfer is cancelled and both outputs remain open until the next evaluation.
5. **Stale-override watchdog** — if the Sensor Add-on helper stops publishing (its `sequence` counter stops incrementing), the controller reverts to AUTO + OFF after `MANUAL_CONTROL_MAX_STALE_POLLS` polls.

## Control Modes

| Mode | Trigger | Behaviour |
|---|---|---|
| `AUTO` | No KVS key, or helper publishes `mode: "AUTO"` | Source selected by truth table above |
| `MANUAL` | Helper publishes `mode: "MANUAL"` with a live `sequence` | Operator-selected source; availability still checked |
| `MANUAL_STALE` | Sequence stops incrementing for > `MANUAL_CONTROL_MAX_STALE_POLLS` polls | Both outputs forced off until AUTO resumes |

## KVS Interface

The two scripts communicate through a single KVS key. The controller reads it; the helper writes it.

**Key:** `iats.manual_control`

**Value shape:**
```json
{ "mode": "MANUAL", "target": "PV", "sequence": 42 }
```

| Field | Values | Description |
|---|---|---|
| `mode` | `"AUTO"`, `"MANUAL"` | Selected control mode |
| `target` | `"GRID"`, `"PV"` | Requested source (only used in MANUAL mode) |
| `sequence` | integer | Increments every publish; controller uses it as a liveness heartbeat |

The controller deletes the KVS key on startup so stale values from a previous session cannot pre-select MANUAL mode.

## Configuration

### Controller (`iats_grid_backup_controller.shelly.js`)

| Constant | Default | Description |
|---|---|---|
| `INPUT_GRID` | `0` | `input:` id for the grid-available signal |
| `INPUT_BACKUP` | `1` | `input:` id for the backup-available signal |
| `OUTPUT_BACKUP` | `0` | `switch:` id for the backup contactor (K2) |
| `OUTPUT_GRID` | `1` | `switch:` id for the grid contactor (K1) |
| `POLL_MS` | `1000` | Input polling interval in milliseconds |
| `DEBOUNCE_MS` | `300` | Debounce window before evaluating a source change |
| `TRANSFER_DELAY_MS` | `1000` | Dead time between opening both outputs and closing the target |
| `DETACH_INPUTS_ON_BOOT` | `true` | Set `false` if inputs are already wired to separate indicators |
| `START_IF_DETACH_VERIFICATION_FAILS` | `false` | Set `true` to continue even if detach verification fails (unsafe) |
| `MANUAL_CONTROL_KVS_KEY` | `"iats.manual_control"` | KVS key shared with the helper script |
| `MANUAL_CONTROL_MAX_STALE_POLLS` | `5` | Polls with an unchanged sequence before reverting to AUTO |

### Sensor Add-on helper (`iats_sensor_addon_manual_control.shelly.js`)

| Constant | Default | Description |
|---|---|---|
| `INPUT_AUTO_MANUAL` | `100` | `input:` id for DIN0 (AUTO/MANUAL selector) |
| `INPUT_GRID_PV` | `101` | `input:` id for DIN1 (GRID/PV selector) |
| `DIN0_HIGH_IS_MANUAL` | `true` | Set `false` to invert DIN0 polarity |
| `DIN1_HIGH_IS_PV` | `true` | Set `false` to invert DIN1 polarity |
| `PUBLISH_MS` | `1000` | KVS publish interval in milliseconds |
| `CONTROL_KVS_KEY` | `"iats.manual_control"` | Must match the controller's `MANUAL_CONTROL_KVS_KEY` |

## Installation

1. Upload `iats_grid_backup_controller.shelly.js` to the two-channel Shelly device and start it.
2. *(Optional)* Upload `iats_sensor_addon_manual_control.shelly.js` to the same device (or any device with the Sensor Add-on) and start it.
3. Verify in the script console that inputs are reported as detached and the initial source selection is logged.
