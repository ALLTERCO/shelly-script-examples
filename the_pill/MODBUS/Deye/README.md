# Deye SG02LP1 MODBUS Examples

Read-only Deye inverter telemetry over RS485 MODBUS-RTU using The Pill.

## Problem (The Story)
Energy dashboards and automations need live PV, battery, and grid values. Many installs expose this only through vendor tools. These scripts poll key Deye registers locally and make data available in logs or Virtual Components.

## Persona
- Home energy enthusiast tracking PV/battery/grid flows
- Installer integrating inverter values into local automations
- Engineer validating inverter behavior without cloud dependency

## Files
- [`deye.shelly.js`](deye.shelly.js): console telemetry reader
- [`deye_vc.shelly.js`](deye_vc.shelly.js): telemetry + Virtual Components

## RS485 Wiring (The Pill 5-Terminal Add-on)
| The Pill Pin | Deye RS485 |
|---|---|
| `IO1 (TX)` -> `B (D-)` | `B` / `D-` |
| `IO2 (RX)` -> `A (D+)` | `A` / `D+` |
| `IO3` -> `DE/RE` | transceiver direction |
| `GND` -> `GND` | recommended |

Default communication in examples: `9600`, `8N1`.
