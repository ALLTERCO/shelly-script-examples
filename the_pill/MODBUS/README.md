# The Pill MODBUS-RTU Examples

MODBUS-RTU examples for Shelly devices (The Pill) using RS485 half-duplex communication.

## Problem (The Story)
You have field devices (BMS, inverter, thermostat, IO module, thermal pump) that expose valuable status and controls over MODBUS, but your automation stack cannot read them directly or consistently. These examples provide a practical bridge from RS485/MODBUS to Shelly scripts and virtual components.

## Persona
- Integrator wiring The Pill into HVAC, energy, and battery systems
- Installer replacing vendor cloud dependence with local telemetry/control
- Advanced DIY user needing readable, modifiable MODBUS scripts

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

RS485 reliability notes:
- Use twisted pair for `A/B` on longer runs.
- Add 120 ohm termination at bus ends for longer cables.
- Always share `GND` between nodes.

## Structure
- [`modbus_rtu.shelly.js`](modbus_rtu.shelly.js): reusable MODBUS master core
- [`ComWinTop/`](ComWinTop/): CWT-MB308V IO module examples
- [`Davis/`](Davis/): Davis pyranometer solar irradiance reader
- [`Deye/`](Deye/): Deye inverter readers (plain + VC)
- [`DFRobot/`](DFRobot/): DFRobot industrial sensor examples
- [`GACIA/`](GACIA/): GACIA smart circuit breaker examples
- [`HTTP-Bridge/`](HTTP-Bridge/): MODBUS-RTU to HTTP bridge
- [`JKESS/`](JKESS/): JK BMS examples
- [`LinkedGo/`](LinkedGo/): LinkedGo thermostat and thermal pump examples
- [`MarsRock/`](MarsRock/): MarsRock G2 SUN Series grid-tie inverter examples
- [`wirenboard/`](wirenboard/): Wirenboard industrial sensor examples
- [`utils/`](utils/): Shared utility scripts (scanner, diagnostics)
