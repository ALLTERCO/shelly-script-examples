# ComWinTop CWT-MB308V MODBUS Examples

Examples for ComWinTop MB308V over RS485 MODBUS-RTU on The Pill.

## Problem (The Story)
A project needs many analog/digital channels, but The Pill has limited local IO. MB308V expands IO over RS485 and these scripts make relay, input, and analog channels accessible through Shelly logic and optional virtual components.

## Persona
- Panel builder adding remote IO to an automation cabinet
- Building automation integrator needing DI/DO/AI/AO in one module
- Technician who wants quick field diagnostics from Shelly logs

## Files
- [`mb308v.shelly.js`](mb308v.shelly.js): core MB308V MODBUS example
- [`mb308v_vc.shelly.js`](mb308v_vc.shelly.js): same integration with Virtual Components

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

Default communication: `9600`, `8N1`, slave `1`.
