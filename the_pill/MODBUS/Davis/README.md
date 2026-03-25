# Davis Pyranometer MODBUS Examples

Read solar irradiance (W/m²) from a Davis-compatible RS485 pyranometer using The Pill.

## Problem (The Story)
Solar monitoring systems need live irradiance readings to correlate PV output with available solar resource. These scripts poll the pyranometer over MODBUS-RTU locally and make the data available in logs or Virtual Components — no cloud dependency.

## Persona
- Solar energy engineer validating PV panel performance against irradiance
- Home automation enthusiast tracking daily solar resource
- Installer integrating irradiance data into local energy dashboards

## Files
- [`pyranometer.shelly.js`](pyranometer.shelly.js): console irradiance reader
- [`pyranometer_vc.shelly.js`](pyranometer_vc.shelly.js): irradiance + Virtual Components

## Register Map

| Address | FC | Type | Unit | Range | Description |
|---|---|---|---|---|---|
| `0x0000` | `0x04` | UINT16 | W/m² | 0–2000 | Solar Irradiance |

## Virtual Component Mapping

| Component | Name | Unit |
|---|---|---|
| `number:200` | Solar Irradiance | W/m² |
| `group:200` | Davis Pyranometer | group |

## RS485 Wiring (The Pill 5-Terminal Add-on)

| The Pill Pin | Sensor |
|---|---|
| `IO1 (TX)` -> `B (D-)` | `B` / `D-` |
| `IO2 (RX)` -> `A (D+)` | `A` / `D+` |
| `IO3` -> `DE/RE` | transceiver direction |
| `GND` -> `GND` | recommended |
| `9–24 VDC` | sensor power supply (separate) |

Default communication parameters: slave `1`, `9600 baud`, `8N1`.
