# V-TAC MODBUS Examples

RS485/MODBUS notes and examples for V-TAC-branded energy devices on The Pill.

## Problem (The Story)
V-TAC devices may expose useful local telemetry and controls over RS485, but the available documentation is often device-specific and incomplete. This folder keeps each device in its own subfolder so register maps, assumptions, and validation status do not get mixed.

## Persona
- Installer commissioning V-TAC equipment over RS485
- Integrator replacing vendor-cloud-only telemetry with local readings
- Developer validating MODBUS maps before adding control automation

## Device Folders
- [`VT6607103/`](VT6607103/): V-TAC `VT-66036103` / `VT-6607103` hybrid inverter discovery work

## RS485 Wiring (The Pill 5-Terminal Add-on)

```
                        |=============|              |==============|
                   /====|         VCC |              |              |
                   |    | GND     GND |              | SLAVE DEVICE |
/========\         |    | TX      +5V |              |              |
|The Pill|-----=||||    | RX        A |------\/------| A            |
\========/         |    | RE/DE     B |------/\------| B            |
                   |    | +5V       A |              |              |
                   \====|           B |              |              |
                        |=============|              |==============|
```
