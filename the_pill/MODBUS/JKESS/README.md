# JKESS MODBUS Examples

JKESS area for battery-related MODBUS examples on The Pill.

## Problem (The Story)
Battery systems often expose internal state over RS485 but remain isolated from the rest of automation logic. This folder groups scripts that convert those battery registers into usable local telemetry/control.

## Persona
- Off-grid or hybrid power user
- BMS-focused integrator
- Technician troubleshooting battery pack behavior

## Available Device Folders
- [`JK200-MBS/`](JK200-MBS/): JK-PB (JK200-class) BMS examples

## RS485 Wiring (The Pill 5-Terminal Add-on)
Use The Pill mapping from the MODBUS root README:
- `IO1 (TX)` -> `B (D-)`
- `IO2 (RX)` -> `A (D+)`
- `IO3` -> `DE/RE`
- `GND` shared
