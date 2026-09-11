# Sigenergy SigenStor MODBUS Examples

Read Sigenergy SigenStor plant telemetry over MODBUS-RTU using a Shelly Pro
device with the Shelly Pro RS485 Addon.

## Problem (The Story)

Energy dashboards need live PV, battery, grid, load, SOC, and grid-state values.
SigenStor exposes these values locally over MODBUS-RTU, so the Shelly Pro RS485
Addon can poll them directly and publish the result into Shelly Virtual
Components.

## Persona

- Installer validating SigenStor plant telemetry without cloud dependency
- Home energy user building a local dashboard
- Integrator feeding Shelly automations from Sigenergy MODBUS values

## Files

- [`sigenstor_plant_vc.shelly.js`](sigenstor_plant_vc.shelly.js): Shelly Pro RS485 Addon MODBUS client that updates Virtual Components

## Requirements

- Shelly Pro device with firmware supporting scripts, Virtual Components, and
  the Shelly Pro RS485 Addon MODBUS client RPC.
- Shelly Pro RS485 Addon fitted and configured as:
  - `Serial id=100`
  - `mode=mb_client`
  - `9600`, `8N1`
- Sigenergy MODBUS enabled by installer.
- Sigenergy RS485-1 configured as MODBUS-RTU slave, `9600`, `8N1`.
- MODBUS slave ID `247`.

## Wiring

Sigenergy RS485-1 wiring to Shelly Pro RS485 Addon:

| Sigenergy | Shelly Pro RS485 Addon |
| --- | --- |
| A+ | pin 15 |
| B- | pin 16 |
| GND | pin 11 |

If reads return errors such as `-115` with `id 0`, the A/B pair is commonly
reversed. Swap A/B and test again.

## Virtual Components

The script creates and updates:

| Component | Name | Unit / Meaning | Iconify icon |
| --- | --- | --- | --- |
| `group:200` | Sigenergy SigenStor | Group containing all VCs | - |
| `number:200` | PV Power | W | `solar:sun-2-bold-duotone` |
| `enum:201` | Battery Status | `Charging`, `Idle`, or `Discharging` | `solar:battery-charge-bold-duotone` |
| `number:201` | Battery SOC | % | `solar:battery-full-bold-duotone` |
| `number:202` | Battery Power | W, positive means charging | `solar:battery-charge-bold-duotone` |
| `boolean:200` | On Grid | `true` when on-grid | `solar:plug-circle-bold-duotone` |
| `number:203` | Grid Power | W, positive means export | `solar:bolt-bold-duotone` |
| `enum:200` | Load Status | `Low`, `Medium`, `High`, or `Peak` vs rated inverter power | `solar:chart-2-bold-duotone` |
| `number:204` | Load Power | W | `solar:home-2-bold-duotone` |
| `enum:202` | Operating Mode | EMS work mode label | `solar:settings-bold-duotone` |

The default progress-bar limits are configured in the script:

- `CONFIG.pvMaxW`: PV array maximum for the PV Power progress bar
  (`10000 W` by default).
- `CONFIG.inverterMaxW`: inverter rated power for the Load Power progress bar
  and Load Status thresholds (`10000 W` by default).

Set both values for the actual installation before using the script.

The script also applies Shelly Cloud metadata:

- Number Virtual Components use `meta.cloud: ['measurement']`.
- Boolean and enum Virtual Components use `meta.cloud: ['log']`.
- Enum Virtual Components also set `meta.ui.titles` so each option is shown
  with its display label in the Shelly app.

## Register Notes

Based on Sigenergy MODBUS Protocol V2.7:

- Slave ID: `247`
- Function: `FC04` read input registers
- PDU addresses use the full register number
- Block A: `30003`, quantity `12`
  - EMS operating mode: word `0`
  - Grid power: `S32` at words `2..3`
  - On/off-grid state: word `6`, `0` means on-grid
  - SOC: word `11`, scale `0.1 %`
- Block B: `30035`, quantity `4`
  - PV power: `S32` at words `0..1`
  - ESS/battery power: `S32` at words `2..3`, positive means charging
- Load is calculated as `PV + grid - ESS` and clamped to `0 W`.
