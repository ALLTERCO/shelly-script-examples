# LG THERMA V via Shelly Pro EM-50

Local RS-485 / Modbus RTU integration for a compatible LG THERMA V heat pump using Shelly Pro EM-50 with Shelly Pro Modbus Add-on.

## Script

- [`lg-therma-v-pro-em50_vc.shelly.js`](lg-therma-v-pro-em50_vc.shelly.js) — self-contained Modbus bridge with automatic Virtual Component provisioning.

## Tested communication settings

- 9600 baud
- 8N1
- LG slave/server ID `2`
- Shelly Serial / `MbRtuClient` component ID `100`
- Shelly RPC addresses are zero-based in this example

## Virtual Components

The script creates or repairs exactly nine fixed components:

- `boolean:200` — Power
- `boolean:201` — DHW
- `boolean:202` — Silent Mode
- `number:203` — Heating target
- `number:204` — DHW target
- `number:205` — Inlet temperature
- `number:206` — Outlet temperature
- `number:207` — DHW temperature
- `number:209` — Error code

`number:208` is intentionally unused.

## Safety and model scope

LG THERMA V generations and controller PCBs differ. The connector name, Modbus enablement procedure, slave ID, register map, writable registers, and safe temperature limits must be verified against the service documentation for the exact target unit.

The runtime bridge performs a physical read before enabling writes and follows supported writes with readback. It must not be used to bypass manufacturer safety logic.

Work inside HVAC electrical equipment requires appropriate isolation and competence. RS-485 terminals must never be connected to mains voltage.
