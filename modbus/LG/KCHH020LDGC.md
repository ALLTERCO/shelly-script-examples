# LG KCHH020LDGC chiller via RS485

[`lg-kchh020ldgc-pro-rs485-vc.shelly.js`](lg-kchh020ldgc-pro-rs485-vc.shelly.js)
is a standalone bridge for one selected LG KCHH020LDGC chiller. It creates
exactly nine firmware-managed Virtual Components, reads the physical controller
before accepting commands, and confirms each attempted write by reading back.

## Hardware and communication

- Compatible Shelly Pro host with the Pro RS485/Modbus Add-on selected in device settings.
- Working managed-VC (`@meta`, `Script.getVcHandle`) and `jsuart`/`UART` APIs.
  A firmware version number alone is not a compatibility check.
- The host must advertise `jsuart` on `serial:100` and provide `UART.get(100)`.
- LG external Modbus connection: **CH4 A+/B-**. The original HMI remains on **CH3**.
- RS485 Modbus RTU, **9600 baud, 8N1**; one active client per physical bus.

Pro EM-50 can host the Modbus bridge. For simultaneous measurement of all three
chiller supply phases, use a compatible **Pro 3EM** with appropriately rated CTs.
Metering is provided by the host's native energy components and does not consume
the bridge's nine Virtual Components. This script controls the LG controller's
enable request; it does not switch the chiller's mains supply.

Follow the LG installation manual and Shelly add-on instructions for isolation,
signal reference, shielding and termination. Stop other bus masters before running.

## Nine managed components

| Role | Type | Purpose |
| --- | --- | --- |
| `power` | Boolean | Chiller enable/stop request; not compressor-running feedback |
| `mode` | Enum | Cooling / Heating; Unknown blocks synchronization |
| `cool` | Number | Cooling setpoint, 4-25 degrees C, whole-degree commands |
| `heat` | Number | Heating setpoint, 30-60 degrees C, whole-degree commands |
| `ewt` | Number | Entering-water temperature, read only |
| `lwt` | Number | Leaving-water temperature, read only |
| `address` | Number | Persistent destination Modbus address, integer 1-247 |
| `fault` | Number | LG fault code, read only |
| `link` | Text | Readiness, last-good uptime, command result and stale-data status |

The complete `@meta` declaration is the first physical line and is 943 characters,
below the 1024-character firmware/repository limit. Keep it on one line. Additional
UI configuration is applied sequentially to the script-owned roles before any
serial setup or bus requests. Firmware allocates IDs; the script uses role handles.

`address` selects the existing LG server to query; it does **not** change the LG
controller's own address. Selection works even in read-only commissioning mode.
An address change discards queued commands, cancels obsolete callbacks, waits for
old traffic to clear, and reads the new server before enabling its controls.
An already transmitted command to the old server cannot be undone.

Install/update the entire file in the same script slot to preserve managed roles.
Firmware replaces the former outdoor-temperature role with `address` on upgrade.
Managed roles do not automatically adopt manually created Virtual Components;
back up and identify any obsolete components before removing them for capacity.

## Register profile

These are zero-based wire offsets, not displayed 4xxxx addresses.

| Point | Display address | Wire offset | Read / write |
| --- | --- | --- | --- |
| Enable request | Coil 00001 | 0 | FC01 / FC05 |
| Operating mode | Holding 40002 | 1 | FC03 / FC06 |
| Cooling target | Holding 40003 | 2 | FC03 / FC06 |
| Heating target | Holding 40004 | 3 | FC03 / FC06 |
| Leaving water | Input 30004 | 3 | FC04 / read only |
| Entering water | Input 30005 | 4 | FC04 / read only |
| Fault | Input 30010 | 9 | FC04 / read only |

The source is LG KCHH installation manual **MFL67262630, Rev.00_011025**,
pages 51-52, 127, 161, 163 and 167. That table names Cooling=0; Heating=4 and
the candidate temperature scale 0.1 come from the supplied installation YAML.
The contributor reported successful physical testing, but no exact controller
firmware or per-function test record was supplied. Confirm encoding on each
installation rather than transferring it to other LG families.

`SETPOINT_SCALE` and `SENSOR_SCALE` are independent configuration values, either
0.1 or 1. The script does not guess them. Compare raw console values with the HMI.
Demand Limit holding 40001 is omitted because it is absent from this manual table.
Holding 40005/40006 are read diagnostically and never changed automatically.

FC05 is implemented directly over UART: Shelly `MbRtuClient.WriteCoils` uses FC15,
which is not the single-coil function documented for this LG profile. FC06 is used
for supported holding writes. The implementation sends one request at a time,
checks slave/function/length/CRC, bounds buffers and commands, retries reads once,
and never blindly retries an uncertain write. Even a missing acknowledgement
triggers fresh readback, and an echo is not accepted as proof of operation.

## Commissioning and validation

1. Select the RS485 add-on, wire CH4 and verify the APIs required above.
2. Paste the complete script, preserving the first line; leave `ENABLE_WRITES: false`.
3. Save and run; select the controller's real address in **LG Modbus Address**.
4. Compare water temperatures, mode, setpoints and fault code with the HMI.
5. Verify the LG remote/Modbus settings through the manufacturer-approved procedure.
6. Enable writes only for the verified installation and restart the script.

The contributor confirmed a real-device test on **2026-10-19**. This is
source-reported testing, not independent hardware validation. Publication-format
changes, asynchronous VC setup and failure paths are covered by deterministic
simulation; the exact host/firmware and physical coverage remain unspecified.

Run automated checks from the repository root:

```sh
node --check modbus/LG/lg-kchh020ldgc-pro-rs485-vc.shelly.js
node modbus/LG/tests/kchh020-bridge.test.cjs
python3 tools/check-manifest-integrity.py --check-headers --check-sync
```

The tests model metadata lifecycle, ownership/capacity, startup, FC05/FC06,
readback, lost replies, CRC faults, rejected writes, stale queues, reconnect,
address changes, persistence and configuration failure. They do not execute on
the Shelly interpreter, measure its heap, or validate real RS485 electrical timing.

Read-only telemetry uses read-only component permissions. Cloud/app access uses
the device's ordinary Shelly Cloud connection; verify the actual app/card support.
While offline, the last readings remain visible and `link` marks them stale.

## Stop and rollback

Set `ENABLE_WRITES: false`, disable autostart, and stop the script. Original serial
configuration is saved once per port in `Script.storage` under `lgser100`. Restore
it only when no other script uses that port. Deleting the script also removes its
managed roles and script storage, so preserve the backup before deletion.

## Sources

- [LG KCHH installation manual](https://cms.intermetal.bg/storage/uploads/2025/06/25/685bc65a31f95MFL67262630_00_250120_06_WEB_English-2_compressed.pdf)
- [Shelly UART API](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/UART/)
- [Shelly managed Virtual Components](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/)
- [Shelly Serial API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Serial/)
- [Shelly Pro RS485 add-on](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellyRs485Addon/)
