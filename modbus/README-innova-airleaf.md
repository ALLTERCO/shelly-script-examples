# INNOVA AirLeaf Modbus RTU examples

**Status: hardware-tested by the contributor; upstream review pending.** The contributor confirms all three INNOVA profiles work on physical hardware. This is contributor-reported validation, not independent maintainer certification. Modbus writes are disabled by default in the published files and must be explicitly enabled for control.

**AI assistance disclosure:** These examples were produced with AI assistance and reviewed/submitted with user direction. Please check the repository's authorship requirements before accepting this contribution.

# INNOVA AirLeaf ↔ Shelly The Pill (Modbus RTU)

**Status: UNDER DEVELOPMENT / UNTESTED ON PHYSICAL INNOVA HARDWARE.** Three device-profile source variants, not three scripts to run together. Code syntax was checked with Node.js, **not** with the embedded Shelly mJS engine.

## Source profile selection

| File | Documented controller / board | Notes |
|---|---|---|
| `innova-airleaf-b32.shelly.js` | ECA644/ECA647 with INN-FR-B32 | Board-specific water temperature (reg. 1) and commanded motor-speed register (reg. 15) |
| `innova-airleaf-ese645.shelly.js` | EDA649/EDB649 with ESE645 | Uses common registers; auxiliary VC reports real setpoint (reg. 8), motor VC reports raw PRG word (reg. 201) |
| `innova-airleaf-ese648.shelly.js` | ESE648 board in N273025C configurations | Same common-register VC behavior; exact installed controller must be checked |

The source document lists common register parameters resident on INN-FR-B32, ESE645/ESE648 and ECA644/ECA647/EDA649/EDB649 wall controls. `*` registers are only for INN-FR-B32. Other INNOVA products, including EWF644II, are **not** presumed compatible. Do not install on an unverified board.

## Nine virtual components

1. INNOVA Power (boolean) — PRG register 201, bit 7.
2. Room temperature (number) — register 0 (0.1 C).
3. Target temperature (number) — register 231 (0.1 C).
4. Operating mode (enum) — register 233, 3/5/0.
5. Fan mode (enum) — PRG 201, bits 0-2, values 0-3.
6. Water temperature (B32) / actual setpoint (ESE) — register 1 or 8.
7. Motor speed **command** (B32) / raw program flags (ESE) — register 15 or 201. **Not measured fan RPM.**
8. Modbus diagnostics / alarm flags (text) — register 105 and communication errors.
9. Modbus online (boolean) — tracks read outcomes.

No group component is declared (nine out of maximum ten device-wide VCs). Do not run more than one profile at once or alongside nine other VCs.

## First commissioning steps

1. Back up any existing The Pill script and VCs; stop the old INNOVA script before testing.
2. Identify the actual INNOVA controller board, its slave address, and its serial settings. *Never* scan/write unknown devices blindly.
3. Confirm electrical connection A↔A, B↔B, common/reference and termination according to hardware manuals; never connect mains to RS485.
4. In The Pill, verify the `Serial` mode is `mb_client`, and set the serial settings to **match the INNOVA**. The scripts check but never alter serial config. They expect **9600 8N1**; the Pill previously reported **115200 8N1**, which will cause a deliberate refusal to start polling.
5. Set `SLAVE_ID` to the actual device ID (default **1**, not verified for your device).
6. Upload the appropriate profile via the Shelly script UI. Start with `ENABLE_WRITES=false`.
7. Confirm room temperature, setpoint, alarm flags, and online status against the physical controller. Allow enough time for each register to be read; each polls at approximately one register per 3.5 s.
8. Only after checking Modbus scaling, bit maps, terminal wiring, physical reactions, and the installation safety design, consider changing `ENABLE_WRITES=true` to allow four user-facing command VCs. Writes use FC06 and read-back polling. Treat any mismatch as a failed commissioning test.

## Read-only diagnostics

- `http://192.168.111.141/rpc/Shelly.GetDeviceInfo`
- `http://192.168.111.141/rpc/Serial.GetConfig?id=0`
- `http://192.168.111.141/rpc/Shelly.GetComponents`
- `http://192.168.111.141/rpc/Script.GetStatus?id=1` (script ID might differ)

No attempt has been made from this environment to contact the LAN IP.

## Limitations / safety

- **Not production-certified**. No claim of Shelly mJS runtime, cloud, RS485, or actual fan coil testing.
- The source uses firmware-managed VCs; firmware 2.0.1 display was observed in the user-provided screenshot, but support and memory behavior must still be validated on that specific firmware.
- Managed `@meta` must be first line and <=1024 characters (verified by build process). Script-owned VCs may be removed if the script is deleted.
- The `power` VC reflects requested standby configuration, not measured electrical power.
- A successful FC06 reply does not prove the mechanical output changed; poll read-back and physical inspection remain required.
- Actual setpoint can be modified by local controls and limits. Commission write permissions cautiously.
- Timeout responses are handled in a minimal fashion; no write retries, so uncertain commands are not repeated automatically.
- Do not use as a primary equipment-safety interlock, freeze guard, or thermal protection mechanism.

## Register documentation

[INNOVA N273025C Rev.01 PDF](https://www.innova.it/site/assets/files/2792/n273025c_kit_bridge_modbus_rtu_rev_01_en.pdf)

[Shelly Modbus RTU Client RPC](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/MbRtuClient/)

[Shelly Virtual Components API](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/)

[Shelly Serial component](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Serial/)