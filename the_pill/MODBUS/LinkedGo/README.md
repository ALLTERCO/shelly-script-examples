# LinkedGo MODBUS Examples

LinkedGo HVAC/thermal examples for RS485 MODBUS-RTU on The Pill.

## Problem (The Story)
LinkedGo controllers expose important operating data and controls, but installers often need a direct local path for commissioning and automation. These examples provide practical register-level integrations for thermostat and thermal pump devices.

## Persona
- HVAC installer commissioning LinkedGo equipment
- Building integrator connecting heat systems to local logic
- Advanced user replacing opaque controller apps with transparent scripts

## Device Folders
- [`ST802/`](ST802/): ST802 thermostat BMS-client examples
- [`R290/`](R290/): R290 air-to-water thermal pump example

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
