# Midea R32 profile notes

The script implements zone-1 leaving-water control using the R32 register layout.
Mode selection, zone 2, room-temperature control, weather-curve changes,
forced heaters, disinfection, energy counters and installer parameters are
outside the command surface of this nine-component bridge.

## References

- LG transport/startup/readback base: [drHouse-gif/lg-therma-v-shelly](https://github.com/drHouse-gif/lg-therma-v-shelly/blob/0a18acdafed25b9abe617cfda339fc47b0e3731b/upstream/lg-therma-v-pro-em50_vc.shelly.js).
- R32 register definitions: [Mosibi/Midea-heat-pump-ESPHome](https://github.com/Mosibi/Midea-heat-pump-ESPHome/blob/385ab6e698f6fd640abfa8c310edf257d2a94ece/models/R32-generic.yaml).
- 171H120F configuration: [timlaing/modbus_local_gateway](https://github.com/timlaing/modbus_local_gateway/blob/main/custom_components/modbus_local_gateway/device_configs/midea_heat_pump.yaml), inspected blob `75b80e19efd51b55581e6384de11603bf2f1d539`.
- [Shelly Serial API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Serial/).
- [Shelly Modbus RTU Client API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/MbRtuClient/).
- [Virtual Components](https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/Virtual/).
- [Shelly scripting language](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference/).

The host runtime uses supported synchronous component lookups, callback-based
RPC and single-shot timers. There are no imports, promises, async functions,
classes, external services or manually constructed RTU frames.

## Software verification

On 2026-10-07, Node.js 24 ran 33 deterministic RPC/Modbus integration tests with
33 passes. Syntax validation used `node --check`. The harness executes the
complete standalone script with a register-server emulator and injected
transport faults. It checks the resulting Modbus writes and UI values.

The checks cover startup/reconnect read-before-write, register-0 bit preservation,
register-2 high-byte preservation, register-5 function-bit preservation, signed
temperature conversion, current fault and curve guards, changed controller mode,
controller version, configured/live limits, explicit FC16, missing DHW hardware,
capacity/ownership and commands replaced during a preparatory read.

## Real-device validation

On 2026-10-10, the contributor confirmed that this bridge passed a real-device
test. The script is marked `production` and included in the example manifest.
This confirmation applies to the integration's documented R32 profile, not to
every heat pump sold under the Midea or Clivet brand.

The validated script retains its fixed-ID, self-provisioned nine-component
layout. Its ownership and capacity preflight deliberately stops on an unrelated
component conflict instead of deleting or replacing another integration's VCs.
It starts Modbus operations only after all nine components have been prepared.

## Integration boundaries

Version register 131 is a compatibility guard; it is not a unique hardware ID.
R32, R290 and water-heater maps must not be selected by brand name alone.
An absent sensor can return a plausible constant, so `hasDhwTank` is explicit.
FC03 is required for the diagnostic values as well as writable words.

There is one Modbus client per serial line. The script serializes its own
operations. A read-modify-write preserves the word sampled immediately before
the write; a controller changing that same word concurrently can still cause a
race because the interface does not provide an atomic masked-write operation.

Virtual Component updates can trigger scenes/webhooks. Keep scene conditions
idempotent and do not create a feedback loop between reported values and commands.
