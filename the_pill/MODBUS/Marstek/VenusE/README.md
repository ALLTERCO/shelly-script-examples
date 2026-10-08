# Marstek VenusE MODBUS Examples

Read-only MODBUS-RTU telemetry for a Marstek VenusE device using The Pill and its RS485 add-on.

## Problem (The Story)
A VenusE energy storage device exposes useful local telemetry over RS485, including battery voltage/current/power, SOC, AC power, daily energy, temperatures, inverter state, alarm, and fault words. These scripts provide a Shelly-side reader so the data can be validated locally before any control automation is added.

## Persona
- Installer commissioning a VenusE battery/inverter system
- Integrator exposing VenusE telemetry to Shelly Virtual Components
- Developer validating the vendor MODBUS map before writing controls

## Screenshot

![Marstek VenusE Virtual Components](screenshot.png)

This screenshot shows `venus_e_vc.shelly.js` running on The Pill with the
Marstek VenusE connected over RS485. The Shelly UI displays the grouped live
Virtual Components for battery voltage, current, power, SOC, AC voltage, AC
power, AC frequency, internal temperature, and inverter state.

## Files
- [`venus_e.shelly.js`](venus_e.shelly.js): console telemetry reader for key live/status registers
- [`venus_e_vc.shelly.js`](venus_e_vc.shelly.js): telemetry reader that creates and updates Shelly Virtual Components with label-backed UI ranges
- [`venus_e_status_vc.shelly.js`](venus_e_status_vc.shelly.js): status-focused Virtual Components reader for SOC, limits, temperatures, daily energy, operating state, and alarm/fault count
- [`venus_e_control_vc.shelly.js`](venus_e_control_vc.shelly.js): charge/stop/discharge Virtual Component controller with adjustable power and SOC, battery-power, and operating-state telemetry
- [`screenshot.png`](screenshot.png): Shelly UI screenshot of the Virtual Components view
- [`registers/README.md`](registers/README.md): cross-linked register document index
- [`registers/runtime_information_04.md`](registers/runtime_information_04.md): read-only runtime/status register map
- [`registers/parameter_read_write_03_06_10.md`](registers/parameter_read_write_03_06_10.md): read/write parameter register map
- [`registers/runtime_function_enable.md`](registers/runtime_function_enable.md): `FuncEn` bit definitions
- [`registers/protection_function_enable.md`](registers/protection_function_enable.md): `ProtectEn` bit definitions
- [`registers/safety.md`](registers/safety.md): `Safty` enum values
- [`registers/battery_brand.md`](registers/battery_brand.md): `BatBrand` enum values
- [`registers/fault_list.md`](registers/fault_list.md): fault-code and fault-bit reference
- [`registers/protocol_change_log.md`](registers/protocol_change_log.md): source protocol change history
- [`label.md`](label.md): device identity and missing label details
- [`TODO.md`](TODO.md): remaining validation and implementation tasks

## Status
The read-only VenusE telemetry scripts are marked `production` after hardware
validation on The Pill. They do not write control registers.

The control script is marked `production` after its Virtual Component setup,
embedded-web button rendering, and runtime telemetry were validated on The
Pill. The underlying FC06 charge, stop, and discharge sequence was validated
through a USB-RS485 adapter.

Open validation items:
- 32-bit word order under non-zero load
- signed direction for current and power
- alarm/fault bit behavior during real warning or fault conditions
- extended control-script soak testing on The Pill

## Protocol And Register Reference
The register documentation lives in the cross-linked [`registers/`](registers/README.md) folder. Start with the index, then follow the document-specific links for runtime registers, writable parameters, bitfields, enum tables, faults, and protocol change history.

| Document | Purpose |
|---|---|
| [Register documents index](registers/README.md) | Cross-linked index for the exported register reference set. |
| [Runtime Information 04](registers/runtime_information_04.md) | Read-only runtime/status register map. |
| [Parameter Read/Write 03-06-10](registers/parameter_read_write_03_06_10.md) | Read/write parameter register map. |
| [Runtime Function Enable](registers/runtime_function_enable.md) | Bit definitions referenced by `FuncEn`. |
| [Protection Function Enable](registers/protection_function_enable.md) | Bit definitions referenced by `ProtectEn`. |
| [Safety](registers/safety.md) | Safety-standard enum values referenced by `Safty`. |
| [Battery Brand](registers/battery_brand.md) | Battery-brand enum values referenced by `BatBrand`. |
| [Fault List](registers/fault_list.md) | Fault-code and fault-bit reference. |
| [Protocol Change Log](registers/protocol_change_log.md) | Version history and source changes. |

Operational summary:

| Parameter | Value |
|---|---|
| Protocol | Standard Modbus RTU |
| Function code | `0x03` Read Holding Registers |
| Slave ID | `1` |
| Baud rate | `115200` |
| Mode | `8N1` |
| Register address base | direct decimal holding-register addresses from the CSV |

The device has been verified to respond with these settings on The Pill. Both Virtual Component layouts and the console reader have been tested on the target device.

## RS485 Wiring (The Pill 5-Terminal Add-on)

Marstek Venus-E 3.0 RS485 RJ45 pinout, looking into the device socket with the
clip/latch orientation matching a normal RJ45 numbering reference:

| RJ45 pin | Function | Connect to The Pill |
|---:|---|---|
| 1 | RS485 A | `A` |
| 2 | RS485 B | `B` |
| 3 | NC | leave open |
| 4 | +5 V | leave open |
| 5 | +5 V | leave open |
| 6 | NC | leave open |
| 7 | GND | `GND` recommended |
| 8 | GND | `GND` recommended |

Do not connect the Venus-E `+5 V` pins to The Pill unless you intentionally
need that supply for an isolated adapter and have verified the current limits.
If the bus is silent, verify the RJ45 plug/socket viewing orientation and all
connections against the table; do not experiment with the `+5 V` pins.

This RJ45 pinout has been confirmed for the device used in this integration.
Keep this section as the connector reference for future wiring diagrams and
field notes.

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

## Virtual Component Mapping
`venus_e_vc.shelly.js` creates these components automatically:

| VC ID | Name | Unit | UI range | Basis |
|---|---|---|---|---|
| `group:220` | Marstek VenusE | group | n/a | container |
| `number:220` | Battery Voltage | V | `0..100` | `51.2 V` nominal battery voltage |
| `number:221` | Battery Current | A | `-100..100` | `100 Ah` battery capacity; signed register |
| `number:222` | Battery Power | W | `-2500..2500` | `2500 W / 2500 VA` device rating; signed register |
| `number:223` | Battery SOC | % | `0..100` | percentage value |
| `number:224` | AC Voltage | V | `187..253` | label grid voltage range |
| `number:225` | AC Power | W | `-2500..2500` | `2500 W / 2500 VA` device rating; signed register |
| `number:226` | AC Frequency | Hz | `45..55` | `50 Hz` nominal grid frequency with validation headroom |
| `number:227` | Internal Temperature | C | `-10..55` | label operating ambient range |
| `number:228` | Inverter State | raw enum | `0..6` | documented state enum |

The Pill currently supports 10 Virtual Components total on the tested
firmware, so the VC script uses one group plus nine high-priority telemetry
numbers. Daily energy values remain available in the console reader
`venus_e.shelly.js`.

The power component ranges intentionally use `2500 W` instead of `5000 W`.
The label identifies this as a `MST-BIE5-2500` unit with `5120 Wh` battery
energy and `2500 W / 2500 VA` power ratings, so `5000` would describe battery
energy class rather than instantaneous inverter power.

## Status Virtual Component Mapping
`venus_e_status_vc.shelly.js` is a third, status-focused VC layout. It reuses
the same `group:220` and `number:220..228` component IDs, so upload only one
VenusE VC script at a time on The Pill.

| VC ID | Name | Unit | UI range | Source |
|---|---|---|---|---|
| `group:220` | Marstek VenusE Status | group | n/a | container |
| `number:220` | Battery SOC | % | `0..100` | register `32104` |
| `number:221` | Charge Current Limit | A | `0..100` | register `35111` |
| `number:222` | Discharge Current Limit | A | `0..100` | register `35112` |
| `number:223` | Internal Temperature | C | `-10..55` | register `35000` |
| `number:224` | Max Cell Temperature | C | `-10..80` | register `35010` |
| `number:225` | Daily Charging Energy | kWh | `0..100` | register `33004` |
| `number:226` | Daily Discharging Energy | kWh | `0..100` | register `33006` |
| `number:227` | Inverter State | raw enum | `0..6` | register `35100` |
| `number:228` | Alarm/Fault Count | active bits | `0..45` | registers `36000`, `36001`, `36100`, `36101`, `36103`, `36104` |

## Charge/Discharge Control Virtual Components

`venus_e_control_vc.shelly.js` creates an eight-component control layout:

| VC ID | Name | Purpose |
|---|---|---|
| `group:220` | Marstek VenusE Control | Container for the control UI |
| `number:220` | Battery SOC | Live SOC from register `32104` |
| `number:221` | Battery Power | Live signed power from registers `32102-32103` |
| `number:222` | Inverter State | `0` sleep, `1` standby, `2` charge, `3` discharge, `4` backup, `5` OTA, `6` bypass |
| `number:223` | Control Power | Persisted `100..2500 W` setpoint; defaults to `500 W` |
| `button:220` | Force Charge | Enables RS485 control, writes `42020`, then starts charge with `42010=1` |
| `button:221` | Stop | Stops forced charge/discharge with `42010=0` |
| `button:222` | Discharge | Enables RS485 control, writes `42021`, then starts discharge with `42010=2` |

Every write uses MODBUS FC06 and must be echoed by the VenusE before the next
step runs. Stop requests are queued if another MODBUS request is in progress.
The script leaves RS485 control enabled after Stop. Do not run it alongside
either read-only VenusE VC layout because their component IDs overlap and the
tested firmware supports only 10 Virtual Components.

## Notes
- The production telemetry scripts intentionally do not write registers.
- The control script writes only the documented RS485
  control, forced-power, and forced-mode registers.
- Register-level semantics, scale exceptions, alarm/fault bits, and open validation items are centralized in [`registers/`](registers/README.md).
- The RJ45 RS485 pinout has been confirmed on the device used for this integration.
