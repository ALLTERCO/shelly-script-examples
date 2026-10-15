# MODBUS Integration Validation Proposal

This proposal defines the validation flow for every new The Pill MODBUS-RTU integration before a script is promoted to production.

## Goals
- Confirm the physical bus is wired correctly and stable.
- Confirm the documented serial settings and slave ID.
- Validate register address base, data type, scaling, sign, and word order.
- Keep write/control behavior separated from read-only telemetry until it is proven safe.
- Produce enough evidence for future maintainers to trust the script and README.

## 1. Source Material
Collect and store the source material in the device folder:

| Item | Required | Notes |
|---|---|---|
| Vendor register map | yes | PDF, XLSX, CSV, HTML, or screenshot export |
| Protocol notes | yes | Baud rate, parity, stop bits, slave ID, function codes |
| Device label notes | yes | Exact model, variant, capacity, firmware if available |
| Connector pinout | yes | Include polarity, GND, supply pins, and unsafe pins |
| Alarm/fault tables | if available | Decode bit fields when practical |

If source data is converted, keep the original file and the cleaned derivative.

## 2. Physical Layer
Validate wiring before script work:

- Confirm RS485 `A/B` polarity from the device label or vendor documentation.
- Confirm whether `GND` is available and whether it should be connected.
- Identify supply pins on RJ45 or terminal blocks and mark them clearly as `do not connect` unless used intentionally.
- Note termination requirements and cable length if relevant.
- Add the final pinout to the device README.

## 3. Communication Probe
Before polling many registers, prove the bus:

- Confirm slave ID.
- Confirm baud rate and mode.
- Read one simple stable register, such as firmware version, SOC, voltage, or device name.
- If no response, swap only `A/B` first; do not experiment with supply pins.
- Record the confirmed settings in the README and label notes.

## 4. Register Validation
Validate read registers in groups:

| Register type | Validation method |
|---|---|
| `u16` values | Compare with device screen/app or expected range |
| `s16` values | Test both positive and negative operating states if possible |
| `u32` / `s32` values | Confirm word order with non-zero values |
| Scaled values | Confirm decimal scaling against known values |
| Enums | Capture values in each reachable state |
| Bit fields | Capture normal state and at least one non-zero state when practical |
| Strings / MAC | Confirm byte length, order, and terminator behavior |

Do not mark word order or signed direction as validated from all-zero readings.

## 5. Script Scope
Use two scripts when possible:

- Console reader: reads broad telemetry and prints raw plus scaled values.
- Virtual Component reader: exposes only the highest-value telemetry that fits The Pill VC limits.

For The Pill firmware with a 10-VC limit, use one group plus up to nine telemetry components unless the device has a higher confirmed limit.

## 6. Write/Control Safety
Keep write registers out of telemetry scripts.

Before adding any write script:
- Confirm the enable/gating register, if one exists.
- Confirm allowed ranges and units.
- Test one reversible low-risk setting first.
- Add guard rails in the script configuration.
- Document rollback steps.
- Keep force charge/discharge and schedule programming in separate guarded scripts.

## 7. Evidence To Capture
Each integration should include:

- README screenshot of the Shelly UI when Virtual Components exist.
- Console output or notes from a successful read cycle.
- The confirmed serial settings.
- The confirmed pinout.
- A TODO list with only unresolved validation items.
- Changelog entry for added scripts, docs, screenshots, and behavior changes.

## 8. Production Checklist
Promote a script to `@status production` only when:

- The script has a standard metadata header and correct `@link`.
- Hardware has responded at documented settings.
- Core values were validated against a known source.
- Multi-register word order is proven with non-zero values.
- Signed direction conventions are tested where relevant.
- Virtual Components fit the target firmware limits.
- README, register docs, label notes, screenshot, TODO, and changelog are current.
- Manifest verification passes.

## Open Validation Format
Use explicit TODO wording when a validation cannot be completed yet:

```markdown
- Confirm 32-bit word order. Current test had no load, so non-zero values were not available.
- Confirm signed direction conventions. Requires an office test with charge/discharge or load.
```
