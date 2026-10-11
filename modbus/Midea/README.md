# Midea/Clivet R32 via Shelly Pro Modbus Add-on

Local RS485 / Modbus RTU monitoring and control for Midea R32 hydronic heat
pumps and compatible Clivet controllers. The standalone script provisions
**exactly nine Virtual Components** and uses the original heat-pump controller.

A successful real-device test was confirmed by the contributor on 2026-10-10.
The production profile remains scoped to the controller/register layout below.

- Script: [midea-clivet-r32-pro-modbus-vc.shelly.js](midea-clivet-r32-pro-modbus-vc.shelly.js)
- Protocol and source details: [TECHNICAL_NOTES.md](TECHNICAL_NOTES.md)
- Software checks: [tests/bridge.test.cjs](tests/bridge.test.cjs)

## Profile and connection

The profile targets the documented Midea R32 / 171H120F-compatible register
layout with **zone 1 under leaving-water control**. Check the exact wired
controller and its service manual. Brand names alone do not select the map.
R290 controllers, Clivet SWAN-2 water heaters and room-control installations
require their own profiles.

On the controller described by this profile:

| Controller | RS485 Add-on |
| --- | --- |
| H2 / A+ | A |
| H1 / B- | B |
| Signal reference, if specified | Follow the controller's wiring manual |

Do not substitute another two-wire bus or A/B power terminals for H1/H2.
Use twisted-pair cable, one Modbus client on the line, and the termination and
shield arrangement specified for the installation. The original controller
and the heat pump's built-in protections remain in service.

Use a compatible Shelly Pro host, its Pro Modbus Add-on, and firmware 2.0.0 or
later with `Serial`, `MbRtuClient`, scripting and Virtual Components. Select
the RS485 add-on in the device configuration and reboot if requested.

## Nine components

Default `vcBase: 220` produces the following components:

| Key | Name | Purpose |
| --- | --- | --- |
| `boolean:220` | Zone 1 Enable | Water-control enable flag for zone 1 |
| `boolean:221` | DHW Enable | Domestic hot water request |
| `boolean:222` | Silent Mode | Silent-mode enable flag |
| `number:223` | Zone 1 Water Target | Zone-1 target, integer degrees C |
| `number:224` | DHW Target | Tank target, integer degrees C |
| `number:225` | Inlet Temperature | Water return temperature |
| `number:226` | Outlet Temperature | Water leaving temperature |
| `number:227` | Tank Temperature | T5 sensor, when configured |
| `text:228` | Status | Online/read-only/control, actual mode, fault and version |

Operating mode is selected on the original controller. Its actual operating
mode is included in Status. Zone 1 Enable is not a mains switch or a global
override of zone 2. The script does not change the silent-mode level.

No groups are created. Existing unrelated components are not modified or
deleted. The script checks capacity before provisioning; nine slots are needed
within the device's ten-component limit. An ID/name conflict stops setup.
Change `vcBase` to a free range or dedicate a host to this bridge.

## Configuration and first synchronization

Create one Shelly script, paste the complete `.shelly.js` file and edit `CONFIG`:

```javascript
serialId: 100,
slaveId: 1,
baud: 9600,
format: '8N1',
enableWrites: false,
expectedControllerVersion: null,
hasDhwTank: false,
allowCooling: false
```

`serialId` identifies the Shelly Serial/MbRtuClient instance. `slaveId` is the
address configured on the heat-pump controller. They are different identifiers.
Address 1 is an example; some controllers use a different address, including 16.
Find the Serial instance with `Shelly.GetComponents` if its ID differs from 100.

Set `hasDhwTank: true` only when the tank and T5 sensor are present and correctly
configured. Otherwise tank-temperature and DHW-limit reads are omitted, DHW
writes are blocked, and the tank-temperature tile is unused. The default
zero in that unused tile is not a physical measurement.

Start in read-only mode. The script creates/reuses its components, configures
`mode: 'mb_client'`, reads the physical values, and publishes them. It logs:

```text
[Midea] Controller version (register 131) = <reported word>
[Midea] READY: 9 components synchronized; read-only mode
```

Compare temperatures, flags and targets with the original controller and
verify the register layout. Set `expectedControllerVersion` to the reported
word, configure the installed temperature limits, then set `enableWrites: true`
and restart. A matching version is an additional guard, not automatic model
identification. Configured controls become toggles/fields after restart.

## Temperature limits and controller behavior

The default configured heating/DHW ceiling is 60 C. Change limits only to
values permitted by the installed system. Target writes must satisfy both
the configured bounds and the controller's live bounds:

- Heating zone 1: low bytes of registers 203/204, upper/lower respectively.
- Cooling zone 1: low bytes of registers 201/202, upper/lower respectively.
- DHW: registers 207/208, upper/lower respectively.

Select Heat or Cool on the original controller for manual water-target control.
Cooling requests require `allowCooling: true` and an installation commissioned
for cooling. A manual water target is blocked in Auto or when the zone-1
weather curve is active. The integration does not disable the factory curve.
Room-control flag bit 0 of register 0 and an active fault block device writes.

## Register map used by this script

All reads use **Holding Registers, FC03**, including temperatures and faults.
Addresses below are wire offsets, not 4xxxx reference numbers.

| Address | Meaning | Handling |
| --- | --- | --- |
| 0, bit 1 | Zone-1 water enable | Mask 0x0002 |
| 0, bit 2 | DHW enable | Mask 0x0004 |
| 1 | Configured mode | Read only: 1 Auto, 2 Cool, 3 Heat |
| 2, low byte | Zone-1 water target | Mask 0x00ff; preserve zone-2 high byte |
| 4 | DHW target | Integer C |
| 5, bit 6 | Silent Mode | Mask 0x0040; preserve other bits |
| 100/101 | Compressor frequency / actual mode | Status diagnostics |
| 104/105 | Inlet/outlet water temperature | Signed 16-bit, integer C |
| 115 | Tank temperature | Signed 16-bit, integer C; optional |
| 124 | Current fault | Raw fault number in Status |
| 128, bit 1 | Defrost | Included in Status |
| 131 | Controller version | Read and match configured version |
| 201-204 | Cooling/heating limits | Zone-1 low bytes |
| 207/208 | DHW upper/lower limits | Optional when tank is configured |

Writes use FC06 by default. Set `writeFunction: 16` only if the exact controller
requires FC16; the script then writes a one-word list. There is no automatic
write-function fallback or blind write retry.

## Command and reconnect behavior

The first successful physical synchronization establishes the baseline. Values
left in the app or changed while the bridge is offline are not replayed on
startup/reconnect. Every changed control is checked, relevant guards refreshed,
and the target register read again before writing.

Registers 0, 2 and 5 use a masked read-modify-write. For example, changing the
zone-1 target keeps the latest zone-2 high byte. After each write the script
waits `settleMs`, reads back the register and publishes the reported value.
Unconfirmed writes are logged rather than presented as successful commands.

On a communication error, Status shows `OFFLINE | last readings stale`, commands
are blocked, and a full physical synchronization is required before control
resumes. Commands are sequential, with `gapMs` between operations and `pollMs`
between completed cycles. Normal defaults are 100 ms gaps, 700 ms settling,
and a 10-second polling pause.

## Troubleshooting and software checks

- No response: check H1/H2, polarity, configured server address, baud/format,
  add-on selection, Serial ID and competing Modbus clients.
- Illegal address: verify the controller family and register table.
- Implausible temperatures: this map uses signed **whole degrees**, not LG's
  tenths-of-a-degree conversion.
- Read-only status: check `enableWrites`, expected version and room-control flag.
- Rejected targets: check active faults, mode, weather curve and both sets of limits.
- Setup stops: check component capacity and ID/name conflicts.

Run the deterministic RPC/Modbus tests from the repository root:

```bash
node --check modbus/Midea/midea-clivet-r32-pro-modbus-vc.shelly.js
node --test modbus/Midea/tests/bridge.test.cjs
```

The harness checks nine-component provisioning, fresh bit/byte preservation,
signed temperatures, target limits, readback, timeout/reconnect handling and
UI synchronization. Details are recorded in [TECHNICAL_NOTES.md](TECHNICAL_NOTES.md).
