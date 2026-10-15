# MarsRock MODBUS Examples

MarsRock G2 SUN Series grid-tie inverter examples for RS485 MODBUS-RTU on The Pill.

## Problem (The Story)
MarsRock G2 micro-inverters expose live AC power, grid voltage, DC input voltage, and temperature over RS485, but no local API exists. These scripts poll key registers directly and make data available in logs or Virtual Components without any cloud dependency.

## Persona
- Home solar enthusiast monitoring grid-tie micro-inverter output
- Installer integrating inverter telemetry into local automations
- Engineer validating inverter behavior without vendor software

## Device Folders
- [`SUN-G2/`](SUN-G2/): G2 (Generation 2) SUN Series grid-tie micro-inverter examples

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
