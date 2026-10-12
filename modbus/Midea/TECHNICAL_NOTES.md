# Midea R32 profile notes

The script implements zone-1 leaving-water control using the R32 register layout.
Mode selection, zone 2, room-temperature control, weather-curve changes,
Silent Mode control, forced heaters, disinfection, energy counters and
installer parameters are outside the command surface of this nine-component
bridge. The former Silent Mode VC has been replaced by a persisted managed
Modbus Slave ID Number (1–247). It changes the address Shelly polls, not
the heat pump controller's own configured address.

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

The previously released implementation passed 33 Node.js RPC/Modbus
integration tests on 2026-10-07. This managed-VC revision retains 33 updated
tests; its CI must be checked independently. Syntax validation used `node --check`. The harness executes the
complete standalone script with a register-server emulator and injected
transport faults. It checks the resulting Modbus writes and UI values.

The checks cover dynamic managed VC binding, startup/reconnect read-before-write,
register-0 bit preservation,
register-2 high-byte preservation, saved-slave-ID checks, mid-read target changes, signed
temperature conversion, current fault and curve guards, changed controller mode,
controller version, configured/live limits, explicit FC16, missing DHW hardware,
capacity/ownership and commands replaced during a preparatory read.

## Real-device validation

On 2026-10-10, the contributor confirmed that this bridge passed a real-device
test. The script is marked `production` and included in the example manifest.
This confirmation applies to the integration's documented R32 profile, not to
every heat pump sold under the Midea or Clivet brand.

The merged October 11 release used nine fixed-ID, self-provisioned VCs.
This follow-up changes the provisioning model to nine firmware-managed roles
in first-line `@meta` and replaces Silent Mode with a persisted selectable
Modbus slave address. The script resolves component IDs dynamically using
`Script.getVcHandle(role).getConfig().id`, and verifies each handle before
starting Modbus. Firmware manages ownership and cleanup on script deletion.
Existing manually created components are not adopted automatically; migrating
requires backing up and removing only positively identified obsolete VCs.
Hardware validation of the managed-VC startup, configurable Modbus Slave ID
and target-switch protection is still pending.

## Integration boundaries

Version register 131 is a compatibility guard; it is not a unique hardware ID.
R32, R290 and water-heater maps must not be selected by brand name alone.
An absent sensor can return a plausible constant, so `hasDhwTank` is explicit.
FC03 is required for the diagnostic values as well as writable words.

There is one Modbus client per serial line. The script serializes its own
operations. Changing the saved Modbus Slave ID increments a generation token,
invalidates cached values and discards callbacks/timers from the old target.
An in-flight command already sent to the former controller cannot be undone.
A read-modify-write preserves the word sampled immediately before the write;
a controller changing that same word concurrently can still cause a race
because the interface does not provide an atomic masked-write operation.

Virtual Component updates can trigger scenes/webhooks. Keep scene conditions
idempotent and do not create a feedback loop between reported values and commands.
