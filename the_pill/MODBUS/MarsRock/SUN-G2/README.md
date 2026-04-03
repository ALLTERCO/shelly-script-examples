# MarsRock G2 SUN Series Grid-Tie Inverter MODBUS Examples

Read-only telemetry from a MarsRock G2 (Generation 2) SUN Series grid-tie micro-inverter over RS485 MODBUS-RTU using The Pill.

## Problem (The Story)
A solar monitoring setup needs live AC output power, grid voltage, DC input voltage, and inverter temperature from a MarsRock G2 micro-inverter without relying on any cloud service or vendor app. These scripts read key registers locally and surface values to console logs or Virtual Components.

## Persona
- Home solar enthusiast tracking micro-inverter output
- Installer commissioning or validating grid-tie inverter operation
- Energy automation engineer connecting inverter data to local logic

## Files
- [`sun_g2.shelly.js`](sun_g2.shelly.js): console telemetry reader
- [`sun_g2_vc.shelly.js`](sun_g2_vc.shelly.js): telemetry + Virtual Components

## RS485 Wiring (The Pill 5-Terminal Add-on)
| The Pill Pin | Inverter RS485 |
|---|---|
| `IO1 (TX)` -> `B (D-)` | `B` / `D-` |
| `IO2 (RX)` -> `A (D+)` | `A` / `D+` |
| `IO3` -> `DE/RE` | transceiver direction |
| `GND` -> `GND` | common reference |

Default communication parameters: `9600`, `8N1`, slave `1` (configurable 1–16 via jumpers J1–J4).

## Virtual Component Mapping
Pre-create these Virtual Components before running `sun_g2_vc.shelly.js`:

| VC ID | Name | Unit |
|---|---|---|
| `number:200` | AC Output Power | W |
| `number:201` | Grid Voltage | V |
| `number:202` | DC Input Voltage | V |
| `number:203` | Temperature | C |
| `group:200` | SUN-G2 Inverter | (group) |

## References
- [MarsRock G2 User Manual](https://marsrock.com.cn/u_file/2405/09/file/G2SeriesMicroinverterSolarUserManual.pdf)
- [SUN GTIL2 RS485 Interface (register map source)](https://github.com/trucki-eu/RS485-Interface-for-Sun-GTIL2-1000)
