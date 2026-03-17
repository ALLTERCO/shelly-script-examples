# WB-MIR v3 MODBUS Examples

MODBUS-RTU scripts for the Wirenboard WB-MIR v3 IR transceiver and environment sensor module.

## Problem (The Story)
You have a WB-MIR v3 on the RS485 bus and want to read DS18B20 temperature, detect button presses (short / long / double), monitor IR module presence, and track supply voltages — all from a Shelly device without a separate gateway.

## Persona
- Building automation integrator reading temperature and input events over MODBUS
- Smart home installer bridging IR control into Shelly automations
- DIY user monitoring power supply health on a Wirenboard device

## Files
- [`wb_mir_v3.shelly.js`](wb_mir_v3.shelly.js): console reader (logs to print output)
- [`wb_mir_v3_vc.shelly.js`](wb_mir_v3_vc.shelly.js): reader + Virtual Components

## Virtual Component Mapping (`wb_mir_v3_vc.shelly.js`)
| Virtual Component | Name | Unit |
|---|---|---|
| `number:200` | 1-Wire Temperature | degC |
| `number:201` | Supply Voltage | mV |
| `number:202` | MCU Temperature | degC |
| `number:203` | Short Press Counter | - |
| `number:204` | Long Press Counter | - |
| `number:205` | Double Press Counter | - |
| `number:206` | Short+Long Counter | - |
| `boolean:200` | Input 1W State | 0=open, 1=closed |
| `boolean:201` | 1-Wire Probe Status | 0=disconnected, 1=connected |
| `boolean:202` | IR Transceiver | 0=absent, 1=present |
| `boolean:203` | 1-Wire Sensor | 0=absent, 1=present |
| `group:200` | WB-MIR v3 | group |

## RS485 Wiring (The Pill 5-Terminal Add-on)
| The Pill Pin | WB-MIR v3 Side |
|---|---|
| `IO1 (TX)` -> `B (D-)` | RS485 B |
| `IO2 (RX)` -> `A (D+)` | RS485 A |
| `IO3` -> `DE/RE` | transceiver direction |
| `GND` -> `GND` | common reference |
| `12V ext` -> `PWR` | 12 V supply (required) |

Default communication settings: `9600 baud`, `8N2`, Slave ID `1`.

## References
- [WB-MIR v3 Register Map](https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers)
