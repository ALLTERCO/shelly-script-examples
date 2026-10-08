# Weather env

Weather and environment-based automations.

Use these to make automations react to weather, temperature, and environmental sensors.

## Scripts

- `cover-control-weather.shelly.js`
- `ntc-conversion.shelly.js`
- `precipitation-irrigation.shelly.js`
- `script-temperature-adjust.shelly.js`
- `turn-on-weather.shelly.js`

## Other Files

| File | Description |
|------|-------------|
| [`ws90-shelly-to-victron.nodered.json`](ws90-shelly-to-victron.nodered.json) | Node-RED flow for Venus OS Large that reads Ecowitt WS90 BTHome advertisements through two Shelly BLE gateways, selects the freshest observation, merges the WS90's alternating packets, and publishes supported values as Victron virtual Temperature and Meteo devices. Update the two Shelly IP addresses and the WS90 MAC address before use. |
