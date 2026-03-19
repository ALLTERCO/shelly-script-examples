# WB-M1W2 v3 MODBUS Examples

MODBUS-RTU scripts for the Wirenboard WB-M1W2 v3 1-Wire to RS-485 converter.

## Problem (The Story)
You have a WB-M1W2 v3 on the RS485 bus and want to read DS18B20 temperatures from up to two 1-Wire input channels, monitor discrete input states, track pulse counters, and observe supply voltage — all from a Shelly device without a separate gateway.

## Persona
- Building automation integrator reading multi-sensor DS18B20 temperature arrays over MODBUS
- Smart home installer bridging 1-Wire thermometers into Shelly automations
- DIY user monitoring supply voltage and pulse inputs on a Wirenboard device

## Files
- [`wb_m1w2_v3.shelly.js`](wb_m1w2_v3.shelly.js): console reader (logs to print output)
- [`../../utils/modbus_scan.shelly.js`](../../utils/modbus_scan.shelly.js): universal MODBUS scanner — discovers any device by sweeping baud rates, modes, and slave IDs

## Screenshot
This screenshot shows the WB-M1W2 v3 telemetry page with both 1-Wire channels, supply voltage, counters, and input status in the Shelly UI.

![WB-M1W2 v3 screenshot](screenshot.png)

## Register Blocks Polled
| Block | FC | Addr | Qty | Data |
|---|---|---|---|---|
| A – Temperatures | FC4 | 7 | 2 | Ch1 + Ch2 DS18B20 (s16 × 0.0625 °C; 0x7FFF = absent) |
| B – Input states | FC2 | 0 | 2 | Input #1, Input #2 discrete state |
| B2 – Presence | FC2 | 16 | 2 | Sensor #1, Sensor #2 polling status |
| C – Supply voltage | FC4 | 121 | 1 | Supply voltage in mV |
| D – Counters | FC4 | 277 | 2 | Pulse counter ch1 + ch2 |

> **Note:** The built-in NTC register (addr 6, FC4) is not present on all firmware versions;
> this script reads external 1-Wire channels only (addr 7–8).

## RS485 Wiring (The Pill 5-Terminal Add-on)
| The Pill Pin | WB-M1W2 v3 Side |
|---|---|
| `IO1 (TX)` -> `B (D-)` | RS485 B |
| `IO2 (RX)` -> `A (D+)` | RS485 A |
| `IO3` -> `DE/RE` | transceiver direction (automatic) |
| `GND` -> `GND` | common reference |
| `9–28 V ext` -> `V+` | device supply (9–28 V DC) |

Default communication settings: `9600 baud`, `8N2`.
**Slave ID is printed on the device label** (factory default is `1`, but individual units may differ).
Use `modbus_scan.shelly.js` from `the_pill/MODBUS/utils/` to discover the slave ID if the label is not readable.

## References
- [WB-M1W2 Product Page](https://wirenboard.com/en/product/WB-M1W2/)
- [WB-M1W2 Wiki (EN)](https://wiki.wirenboard.com/wiki/WB-M1W2_1-Wire_to_Modbus_Temperature_Measurement_Module/en)
