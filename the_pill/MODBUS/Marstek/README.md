# Marstek MODBUS Examples

Marstek energy-storage examples for RS485 MODBUS-RTU on The Pill.

## Problem (The Story)
Marstek devices expose local telemetry and controls over RS485, but the vendor map needs to be converted into practical Shelly scripts and validation notes before automation is added.

## Persona
- Installer commissioning a Marstek battery or inverter system
- Integrator exposing Marstek telemetry to Shelly Virtual Components
- Developer validating the vendor MODBUS workbook before writing controls

## Device Folders
- [`VenusE/`](VenusE/): Marstek VenusE register workbook, telemetry readers, Virtual Component reader, and validation notes

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
