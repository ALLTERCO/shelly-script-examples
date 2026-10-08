# Power Energy

Power monitoring, load management, and energy control scripts for Shelly devices.

Use these to monitor consumption, automatically manage loads to stay within power limits, integrate third-party energy hardware, and implement transfer-switch logic.

## Scripts

| File | Description |
|------|-------------|
| [`advanced-load-shedding.shelly.js`](advanced-load-shedding.shelly.js) | Advanced load shedding with schedule, device, and notification templates built on top of the base load-shedding script. |
| [`consume-limited-power.shelly.js`](consume-limited-power.shelly.js) | Turns off the output after the accumulated energy consumption since last switch-on exceeds a configurable threshold. |
| [`failure-monitor.shelly.js`](failure-monitor.shelly.js) | Alerts when measured power drops to 0 while the switch is still on, indicating a possible load failure. |
| [`load-shedding.shelly.js`](load-shedding.shelly.js) | Keeps total measured power between a low and high watt threshold by toggling secondary loads on or off (requires Shelly Pro 4PM and Pro 3EM). |
| [`monitor-production.shelly.js`](monitor-production.shelly.js) | Companion to `advanced-load-shedding.shelly.js` — adds a second power source (PV, generator, grid) to the shedding calculation. |
| [`plus-plug-s-led-power-states.shelly.js`](plus-plug-s-led-power-states.shelly.js) | Shows Shelly Plus Plug S power consumption as fixed LED ring states or a green-to-red gradient. |
| [`power-outages.shelly.js`](power-outages.shelly.js) | Monitors any device or service via HTTP/HTTPS and executes webhooks or publishes MQTT topics on failure or recovery. |
| [`power-threshold-limit-output.shelly.js`](power-threshold-limit-output.shelly.js) | Turns off configured channels when total power consumption exceeds a threshold. |
| [`pro4pm-load-shedding.shelly.js`](pro4pm-load-shedding.shelly.js) | Monitors the combined current of all four switch channels on a Shelly Pro 4PM and sheds loads in reverse-priority order to stay below 16 A, restoring them highest-priority first once current drops back down. |
| [`victron-ble-bridge.shelly.js`](victron-ble-bridge.shelly.js) | Forwards received BLE advertisements to a Victron GX device over HTTPS so bridged sensors show up under Settings → Bluetooth Sensors. Requires Shelly firmware 1.5.0+ and GX firmware 3.80+; configured via Virtual Components or a `venus-host` KVS key. |
| [`victron-mppt-solar-controller_vc.shelly.js`](victron-mppt-solar-controller_vc.shelly.js) | Decrypts Victron SmartSolar MPPT Bluetooth advertisements and updates Shelly Virtual Components with live solar charger values. |

## Other Files

| File | Description |
|------|-------------|
| [`victron-to-shelly-virtual.nodered.json`](victron-to-shelly-virtual.nodered.json) | Node-RED flow that reads live Victron telemetry (battery, VE.Bus inverter, MPPT solar charger) and forwards each value to the corresponding Shelly virtual Number component via `Number.Set`. |

## Subdirectories

| Directory | Description |
|-----------|-------------|
| [`automatic-transfer-switch/`](automatic-transfer-switch/) | iATS — Intelligent Automatic Transfer Switch. Two-script set that manages grid/backup contactor sequencing with input detachment, transfer delay, debounce, and optional Sensor Add-on manual override via KVS. |

