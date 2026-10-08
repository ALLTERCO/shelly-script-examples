# INNOVA AirLeaf EWF644II

Local Shelly Script integration for an **INNOVA AirLeaf EWF644II** SMART TOUCH fan-coil controller with integrated Wi-Fi reporting `deviceType 002`.

## Script

- [`innova-airleaf-ewf644ii_vc.shelly.js`](innova-airleaf-ewf644ii_vc.shelly.js) — self-contained, memory-optimized Shelly Gen3 controller using the INNOVA local HTTP API and six fixed Virtual Components for Shelly Smart Control.

## Validated hardware

- INNOVA AirLeaf EWF644II
- `deviceType 002`
- Shelly Plug S Gen3
- firmware 2.0.0
- Shelly Smart Control

## Configuration

Set the AirLeaf local address at the top of the script:

```javascript
var CONFIG = {
  host: '192.0.2.10',
  ...
};
```

The committed address is a TEST-NET placeholder. Replace it with the installation's local AirLeaf IPv4 address.

## Virtual Components

| Component | Purpose |
|---|---|
| `boolean:200` | Power |
| `enum:201` | Heating / cooling mode |
| `number:202` | Target temperature, 16–31 °C, step 0.5 °C |
| `enum:203` | Fan: auto / night / min / max |
| `number:204` | Room temperature |
| `text:205` | Connection / command / error status |

The enum components define `meta.ui.titles` for Shelly Smart Control display labels. Number telemetry uses Cloud `measurement` metadata; state controls use `log` metadata.

## API used

- `GET /api/v/1/status`
- `POST /api/v/1/power/on`
- `POST /api/v/1/power/off`
- `POST /api/v/1/set/mode/heating`
- `POST /api/v/1/set/mode/cooling`
- `POST /api/v/1/set/setpoint`
- `POST /api/v/1/set/function/{auto|night|min|max}`

Temperature setpoints are sent in tenths of a degree Celsius, for example 22.0 °C as `{"temp":220}`.

Validated status mapping:

- `ps`: 1 = on
- `sp`: setpoint × 0.1 °C
- `ta`: room temperature × 0.1 °C
- `wm`: 3 = heating, 5 = cooling
- `fn`: 1 = auto, 2 = night, 3 = min, 4 = max

## Runtime design

The controller:

- creates or reuses the six fixed Virtual Components before starting;
- refreshes existing component metadata;
- serializes all HTTP requests;
- coalesces pending changes for the same control;
- powers the AirLeaf before a mode change when required;
- clears dependent queued commands after a failed control request;
- waits briefly and performs one physical status readback after command activity;
- rejects synchronization unless the device reports `deviceType 002`;
- filters script-generated VC events to prevent feedback loops;
- uses request IDs and a watchdog for stale/missing callbacks;
- avoids `Array.shift()` because it is unavailable on the tested Shelly mJS build.

## Memory note

An earlier generic-helper version could exhaust script memory on Plug S Gen3. This version keeps the runtime self-contained while using a compact fixed-component bootstrap and reduced runtime state.

## Scope

The protocol behavior documented here is validated for **INNOVA AirLeaf EWF644II / deviceType 002**. Other INNOVA controls or device types should not be assumed to use the same endpoint or value mapping without validation.
