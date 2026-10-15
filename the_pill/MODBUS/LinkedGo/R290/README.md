# LinkedGo R290 A/W Thermal Pump MODBUS Example

R290 thermal pump polling/control example for The Pill over RS485 MODBUS-RTU.

## Problem (The Story)
A thermal pump has rich runtime, temperature, and fault information in its MODBUS map, but day-to-day operation lacks easy local visibility and quick control hooks. This example provides a starter script to poll critical registers and issue basic control writes.

## Persona
- Heat-pump installer needing field diagnostics
- Integrator building automations around water temperatures and alarms
- Advanced homeowner optimizing heat-pump behavior locally

## Files
- [`r290_aw_thermal_pump.shelly.js`](r290_aw_thermal_pump.shelly.js): FC03 polling + FC06 helper writes

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

Protocol defaults from the provided document: slave `0x10` (16), `9600`, `8N1`.
