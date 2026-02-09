# Nova Fitness SDS011 Air Quality Sensor

> **Under Development** - This example is currently under development and may not be fully functional.

Scripts for reading PM2.5 and PM10 particulate matter concentrations using the SDS011 laser dust sensor.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- Nova Fitness SDS011 PM sensor
- 5V power supply (4.7-5.3V, ~70mA working)

### Wiring

| SDS011 Pin | Function | Shelly |
|------------|----------|--------|
| Pin 1 | NC | Not connected |
| Pin 2 | PM2.5 (PWM) | Not connected (optional) |
| Pin 3 | 5V | 5V (4.7-5.3V) |
| Pin 4 | PM10 (PWM) | Not connected (optional) |
| Pin 5 | GND | GND |
| Pin 6 | RX | TX (GPIO) |
| Pin 7 | TX | RX (GPIO) |

**Note:** SDS011 uses 3.3V TTL logic levels for UART communication. PWM outputs are optional analog outputs.

**UART Settings:** 9600 baud, 8N1

## Files

### sds011.shelly.js

**Core API Library** - Full SDS011 UART protocol implementation.

**Features:**
- Continuous PM2.5/PM10 readings
- Active and query (passive) modes
- Sleep/wake power management
- Configurable working period (0-30 minutes)
- AQI category calculation (US EPA breakpoints)
- Event emission on new readings
- Firmware version query

**Specifications:**
- Measuring range: 0.0-999.9 μg/m³
- Resolution: 0.3 μg/m³
- Response time: 1 second
- Working temperature: -20 to +50°C
- Lifetime: ~8000 hours continuous

**Protocol:**
- Data frame: 10 bytes `[0xAA] [0xC0] [PM2.5 Lo] [PM2.5 Hi] [PM10 Lo] [PM10 Hi] [ID Lo] [ID Hi] [Checksum] [0xAB]`
- PM values in 0.1 μg/m³ units (divided by 10 for μg/m³)

**API Methods:**
```javascript
SDS011.getPM25()              // Get last PM2.5 reading (μg/m³)
SDS011.getPM10()              // Get last PM10 reading (μg/m³)
SDS011.getReadings()          // Get all readings with timestamp

SDS011.setMode(active)        // true=continuous, false=query mode
SDS011.query()                // Trigger single reading (query mode)
SDS011.wake()                 // Wake sensor (fan starts)
SDS011.sleep()                // Sleep sensor (fan stops)
SDS011.setWorkPeriod(minutes) // 0=continuous, 1-30=interval
SDS011.getFirmware()          // Query firmware version
SDS011.isAwake()              // Check if sensor is awake
```

**Events Emitted:**
```javascript
Shelly.emitEvent("air_quality", {
    pm25: 12.5,           // PM2.5 in μg/m³
    pm10: 18.3,           // PM10 in μg/m³
    deviceId: 0xABCD,     // Sensor device ID
    aqi: "Good"           // AQI category
});
```

---

### sds011_setup.shelly.js

**Virtual Components Setup** - Run ONCE to create the UI components.

Creates the following virtual components:
| Component | Description |
|-----------|-------------|
| `number:200` | PM2.5 value display (μg/m³) |
| `number:201` | PM10 value display (μg/m³) |
| `text:200` | AQI category display |
| `button:200` | Wake/Sleep toggle |

After running, you can delete or disable this script.

---

### sds011_vc.shelly.js

**Virtual Components UI** - Main script with graphical interface.

**Prerequisites:** Run `sds011_setup.shelly.js` first to create components.

**Features:**
- Displays PM2.5 and PM10 on Shelly UI
- Shows AQI category in real-time
- Wake/Sleep button for power management
- Event emission for automation

---

**AQI Categories (US EPA PM2.5 breakpoints):**
| PM2.5 (μg/m³) | Category |
|---------------|----------|
| 0-12.0 | Good |
| 12.1-35.4 | Moderate |
| 35.5-55.4 | Unhealthy (Sensitive) |
| 55.5-150.4 | Unhealthy |
| 150.5-250.4 | Very Unhealthy |
| 250.5+ | Hazardous |

## Quick Start

1. Wire the SDS011 sensor to your Shelly device
2. Upload and run `sds011.shelly.js`
3. Readings will print automatically every second

**Example Output:**
```
=================================
Air Quality Reading
PM2.5: 12.5 ug/m3
PM10:  18.3 ug/m3
AQI:   Good
=================================
```

## Power Management

The SDS011 has a limited lifespan (~8000 hours). To extend sensor life:

```javascript
// Set working period to measure every 5 minutes
SDS011.setWorkPeriod(5);

// Or manually control sleep/wake
SDS011.sleep();   // Fan stops, laser off
// ... wait ...
SDS011.wake();    // Fan starts, ~30s warm-up recommended
```

## SDS011 vs SDS018

Both sensors use the same protocol and can use the same code. Main differences:

| Feature | SDS011 | SDS018 |
|---------|--------|--------|
| Connector | 7-pin | 5-pin |
| PWM outputs | Yes (Pin 2, 4) | No |
| Size | Larger | Smaller |
| Protocol | Identical | Identical |

## References

- [PyPMS NovaFitness Documentation](https://github.com/avaldebe/PyPMS/blob/master/docs/sensors/NovaFitness.md)
- [SDS011 Control Protocol](https://cdn.sparkfun.com/assets/parts/1/2/2/7/5/Laser_Dust_Sensor_Control_Protocol_V1.3.pdf)
