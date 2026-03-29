# DFRobot MODBUS Examples

DFRobot industrial RS485 sensor examples for MODBUS-RTU on The Pill.

## Problem (The Story)
DFRobot produces a range of IP-rated industrial sensors with RS485/MODBUS-RTU interfaces suitable for outdoor, wet, or harsh environments. These examples provide direct local integration via The Pill without any cloud dependency.

## Persona
- Automation engineer adding industrial-grade sensing to Shelly local control
- Installer deploying distance, environmental, or process sensors over RS485
- DIY user integrating DFRobot hardware into a local home-automation stack

## Device Folders

- [`SEN0492/`](SEN0492/): SEN0492 Laser Ranging Sensor RS485 (40–4000 mm)

## RS485 Wiring (The Pill 5-Terminal Add-on)

### SEN0492 Cable Colors

| The Pill Pin | Wire Color | Sensor Signal |
|---|---|---|
| `IO1 (TX)` → `B` | Green | RS485 B |
| `IO2 (RX)` → `A` | Yellow | RS485 A |
| `IO3` → `DE/RE` | — | transceiver direction (automatic) |
| `GND` | Black | GND |
| `5–36 V` (separate supply) | Red | VCC |
| not connected | White | ALARM (open-collector, active LOW) |
