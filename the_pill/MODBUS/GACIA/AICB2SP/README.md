# GACIA AICB2SP Smart IoT MCB - MODBUS-RTU Examples

Read metering data and control a GACIA AICB2SP Smart IoT Miniature Circuit Breaker over RS485 MODBUS-RTU using The Pill.

## Problem (The Story)
Smart circuit breakers combine traditional overcurrent protection with IoT monitoring. These scripts read live electrical measurements (voltage, current, power, energy, frequency, power factor, temperature) and allow switching the breaker on or off via RS485 MODBUS-RTU — no cloud account required.

## Persona
- Building automation engineer integrating smart breakers into a local BMS
- Energy monitoring enthusiast logging per-circuit consumption
- Installer replacing cloud-dependent control with local Shelly automation

## Device

| Parameter | Value |
|---|---|
| Manufacturer | Gacia Electrical Appliance Co., Ltd. |
| Model | AICB2SP |
| Type | Smart IoT Miniature Circuit Breaker (MCB) |
| Poles | 1P, 2P, 3P, 4P |
| Current ratings | 6–100 A |
| Communication | RS485 (Modbus RTU) + Wi-Fi (Tuya HS01-485-WR3 bridge) |
| Standard | IEC/EN 60898-1 |

## Files

- [`aicb2sp.shelly.js`](aicb2sp.shelly.js): console metering reader + switch control

## Register Map

> **Note:** No official Modbus register map was published by GACIA at the time this script was written.
> The addresses below are derived from the KWS-303L / Tuya RS485 smart-breaker reference implementation.
> If registers return incorrect values, try the DDS238-style alternatives listed in the script header comments.
> Verify against your device manual if available.

### Read (FC 0x03 - Read Holding Registers)

| Address | Dec | Parameter | Type | Unit | Scale |
|---|---|---|---|---|---|
| `0x000D` | 13 | Voltage | INT16 | V | ÷ 100 |
| `0x0011` | 17 | Current | INT16 | A | ÷ 1000 |
| `0x0019` | 25 | Active Power | INT16 | W | ÷ 100 |
| `0x002F` | 47 | Power Factor | INT16 | — | ÷ 1000 |
| `0x0032` | 50 | Frequency | INT16 | Hz | ÷ 100 |
| `0x0036` | 54 | Total Energy | INT16 | kWh | ÷ 1000 |
| `0x003B` | 59 | Temperature | INT16 | °C | ÷ 1 |

### Write (FC 0x06 - Write Single Register)

| Address | Dec | Parameter | Value |
|---|---|---|---|
| `0x003E` | 62 | Switch ON/OFF | `1` = ON, `0` = OFF |

## RS485 Default Parameters

| Parameter | Value |
|---|---|
| Baud rate | 9600 |
| Frame format | 8N1 (try 8E1 if no response) |
| Slave ID | 1 |
| Protocol | Modbus RTU |

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

> The breaker requires its own AC supply (110/230 V). The RS485 interface is
> powered internally from the breaker; no separate 5 V is needed on the RS485 side.

## References

- [GACIA Product Page](https://www.gaciaele.com/aicb2sp-mcb-smart-iot-circuit-breaker-product/)
- [Tuya HS01-485-WR3 Module Datasheet](https://developer.tuya.com/en/docs/iot/HS01-485-WR3?id=Kaqac93fzjrdp)
- KWS-303L RS485 Tuya breaker register map (live-tested reference)
