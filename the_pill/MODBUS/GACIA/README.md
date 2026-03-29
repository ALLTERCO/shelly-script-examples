# GACIA MODBUS Examples

Gacia Electrical Appliance smart circuit breaker examples for RS485 MODBUS-RTU on The Pill.

## Problem (The Story)
GACIA smart MCBs combine traditional overcurrent protection with built-in metering and IoT connectivity. These examples provide local RS485 MODBUS-RTU integrations — monitoring and control without cloud dependency.

## Persona
- Electrician or installer commissioning GACIA smart breakers
- Building automation engineer integrating per-circuit metering into a local BMS
- Energy monitoring enthusiast replacing Tuya cloud control with local logic

## Device Folders

- [`AICB2SP/`](AICB2SP/): AICB2SP Smart IoT MCB reader and switch control

## RS485 Wiring (The Pill 5-Terminal Add-on)

- `IO1 (TX)` → `B (D-)`
- `IO2 (RX)` → `A (D+)`
- `IO3` → `DE/RE` for half-duplex direction
- `GND` shared
