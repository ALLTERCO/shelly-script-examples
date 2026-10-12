# INNOVA AirLeaf Modbus RTU examples

**Status: under upstream review.** Contributor-reported physical Modbus tests preceded this managed-VC refactor. The new managed startup/lifecycle still needs a fresh device smoke test; writes remain disabled by default.

**AI assistance disclosure:** These examples were produced with AI assistance and reviewed/submitted with user direction. Please check the repository's authorship requirements before accepting this contribution.

# INNOVA AirLeaf ↔ Shelly The Pill (Modbus RTU)

Three standalone variants are provided for distinct controller boards; install **only one**. Each script declares nine firmware-managed VCs through the first-line `@meta` and binds them by `Script.getVcHandle(role)`. Component IDs are assigned by firmware, not hard-coded. The modified startup has not yet been tested on a real Pill.

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

No group component is declared (nine of the ten device-wide VC slots). Firmware creates/reconciles managed components at startup and removes them when their owning script is deleted. Old manually created VCs do not migrate automatically. Never run multiple profiles on the same host.

## First commissioning steps

1. Back up scripts/scenes and VCs; stop the old INNOVA `Virtual.Add` script. Manually remove **only confirmed obsolete INNOVA-created VCs** before switching, or there may be insufficient capacity. Do not delete unrelated components.
2. Identify the actual INNOVA controller board, its slave address, and its serial settings. *Never* scan/write unknown devices blindly.
3. Confirm electrical connection A↔A, B↔B, common/reference and termination according to hardware manuals; never connect mains to RS485.
4. In The Pill, verify the `Serial` mode is `mb_client`, and set the serial settings to **match the INNOVA**. The scripts check but never alter serial config. They expect **9600 8N1**; the Pill previously reported **115200 8N1**, which will cause a deliberate refusal to start polling.
5. Set `SLAVE_ID` to the actual device ID (default **1**, not verified for your device).
6. Upload/start the appropriate profile with `ENABLE_WRITES=false`. Firmware creates nine managed VCs from `@meta` and the script obtains role handles without any fixed component IDs.
7. Confirm room temperature, setpoint, alarm flags, and online status against the physical controller. Allow enough time for each register to be read; each polls at approximately one register per 3.5 s.
8. Only after checking Modbus scaling, bit maps, terminal wiring, physical reactions, and the installation safety design, consider changing `ENABLE_WRITES=true` to allow four user-facing command VCs. Writes use FC06 and read-back polling. Treat any mismatch as a failed commissioning test.

## Read-only diagnostics

- `http://<SHELLY_IP>/rpc/Shelly.GetDeviceInfo`
- `http://<SHELLY_IP>/rpc/Serial.GetConfig?id=0`
- `http://<SHELLY_IP>/rpc/Shelly.GetComponents?dynamic_only=true`
- `http://<SHELLY_IP>/rpc/Script.GetStatus?id=1` (replace `1` with the actual script ID)

Read `Shelly.GetComponents` to verify all nine managed roles exist (the component IDs are firmware-assigned). No live connection to the Pill was used to validate this revision.

## Limitations / safety

- **Not production-certified**. Earlier contributor-reported controller tests do not validate the new VC provisioning on every The Pill firmware; verify on real hardware before production use.
- The `@meta` declaration must be the first physical line and remain within 1024 characters (B32: 944, ESE645/ESE648: 940).
- Managed component IDs may differ after migration. Update any external scripts/scenes referring to old IDs.
- On firmware `2.0.1-ge1a198b`, Shelly The Pill Gen3 has a documented restart problem when starting managed VC scripts. Test on a firmware known to support managed VCs; this code change does not fix firmware crashes.
- Modbus writes remain explicitly disabled by `ENABLE_WRITES=false` until commissioning and verification.
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