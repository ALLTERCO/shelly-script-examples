# INNOVA AirLeaf EWF644II

Local Shelly Script integration for an **INNOVA AirLeaf EWF644II** SMART TOUCH fan-coil controller with integrated Wi-Fi that reports `deviceType` `002`.

## Script

- [`innova-airleaf-ewf644ii_vc.shelly.js`](innova-airleaf-ewf644ii_vc.shelly.js) — self-contained Shelly Gen3 controller using the INNOVA local HTTP API and six fixed Virtual Components for Shelly Smart Control.

## Requirements

- Shelly Gen3 device with Scripts and Dynamic Virtual Components.
- INNOVA AirLeaf EWF644II reachable from Shelly over local IPv4 HTTP.
- Target status response must report `deviceType` `002`.
- Configure `CONFIG.host` at the top of the script.

## API used

- `GET /api/v/1/status`
- `POST /api/v/1/power/on`
- `POST /api/v/1/power/off`
- `POST /api/v/1/set/mode/heating`
- `POST /api/v/1/set/mode/cooling`
- `POST /api/v/1/set/setpoint`
- `POST /api/v/1/set/function/{auto|night|min|max}`

The controller serializes HTTP requests, validates the device type, confirms accepted commands with a fresh status read, and uses a watchdog for missing HTTP callbacks.

## Virtual Components

The script creates or repairs fixed component IDs `200` through `205` for power, mode, temperature setpoint, fan function, room temperature, and connection status before starting the HTTP controller. These components provide the Shelly Smart Control representation of the AirLeaf controller.

## Scope

Protocol behavior has been validated for a real AirLeaf installation reporting `deviceType` `002`. The target hardware is **INNOVA AirLeaf EWF644II**. Do not assume other INNOVA controls or device types expose identical fields or endpoint semantics without validation.
