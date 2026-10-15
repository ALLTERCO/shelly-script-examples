# Shekran External Display

Script: `shekran.shelly.js`

## What this example is about
This script reads live data from a Deye SG02LP1 solar inverter over Modbus RTU and pushes it to a SHEKRAN IoT ePaper display via its JSON-RPC 2.0 API.

The SHEKRAN is an ESP32-based device with a 2.13" black-and-white ePaper screen. It accepts widget updates over HTTP and renders them on demand.

## How it works
1. **Initialization**: 
   - At startup, the script registers all Modbus entities and associates them with virtual components on the Shelly device.
   - It sends an initial command to the SHEKRAN display to load the `main` screen and performs a full refresh.
2. **Scheduled Updates**: Every `UPDATE_RATE` seconds (default 60s), the script:
   - Reads the latest values from the inverter for all configured Modbus registers.
   - Updates the corresponding virtual components on the Shelly device.
   - Sends a single JSON-RPC 2.0 batch request to the SHEKRAN display to update all mapped widgets (`ui.set`).
   - Triggers a partial `screen.refresh` so the ePaper renders the new values.
3. **Maintenance**:
   - Once every 24 hours, a full `screen.refresh` is performed to clear ePaper ghosting.

## Mappings

The script maps Modbus registers to Shelly virtual components and SHEKRAN display widgets.

| Description        | Modbus Register | Scale  | Shelly Virtual Component | SHEKRAN Widget ID |
|--------------------|-----------------|--------|--------------------------|-------------------|
| **Total Power**    | 175 (i16)       | 1      | `number:200`             | `load_power`      |
| **Battery Power**  | 190 (i16)       | 1      | `number:201`             | `battery_power`   |
| **PV1 Power**      | 186 (u16)       | 1      | `number:202`             | `pv_power`        |
| **Total Grid Power**| 169 (i16)      | 10     | `number:203`             | `grid_power`      |
| **Battery SOC**    | 184 (u16)       | 1      | `number:204`             | `battery`         |
| PV1 Voltage        | 109 (u16)       | 0.1    | `number:205`             | -                 |
| Grid Voltage L1    | 150 (u16)       | 0.1    | `number:206`             | -                 |
| Current L1         | 164 (i16)       | 0.01   | `number:207`             | -                 |
| AC Frequency       | 192 (u16)       | 0.01   | `number:208`             | -                 |

*Note: Some values are read from the inverter and stored in virtual components but are not displayed on the SHEKRAN screen by default.*

## Screen definitions

The `screens/` folder contains the XML screen definitions downloaded from the SHEKRAN device:

- `main.xml` - Inverter dashboard with SOC bar, power values, and connection status.
- `status.xml` - System status page (WiFi, heap, uptime, RPC, display).
- `gauges.xml` - Temperature and humidity arc gauges for external sensors.
- `connect.xml` - QR code screen for WiFi provisioning in AP mode.

To upload a screen to the device use `screen.upload` via the JSON-RPC API:
```bash
curl -X POST http://<shekran-ip>/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "screen.upload",
    "params": {
      "name": "main",
      "content": "<xml content here>"
    },
    "id": 1
  }'
```

## Use cases this solves
- Display live solar inverter metrics on a low-power ePaper screen.
- Wall-mounted energy dashboard that is always visible without a backlight.
- Combining Modbus RTU data acquisition with HTTP-based display output.

## Configuration
Edit these variables at the top of the script:
- `UPDATE_RATE` - polling interval in seconds (default: 60).
- `INVERTER_ID` - Modbus slave address of the inverter (default: 1).
- `SHEKRAN_RPC_URL` - HTTP endpoint of the SHEKRAN display.

## Notes before use
- The Shelly device must have Modbus RTU connectivity to the Deye inverter (RS-485).
- The SHEKRAN display must be on the same network and reachable via HTTP.
- Virtual components `number:200` through `number:208` must exist on the Shelly device.
- The `main` screen XML must contain the widget IDs listed in the mapping table above.
