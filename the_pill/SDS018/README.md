# Nova Fitness SDS018 Air Quality Sensor

Scripts for reading PM2.5 and PM10 particulate matter concentrations using the SDS018 laser dust sensor.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- Nova Fitness SDS018 PM sensor
- 5V power supply (4.7-5.3V, >1W)

### Wiring

| SDS018 Pin | Function | Shelly |
|------------|----------|--------|
| Pin 1 | 5V | 5V (4.7-5.3V) |
| Pin 2 | NC | Not connected |
| Pin 3 | GND | GND |
| Pin 4 | RX | TX (GPIO) |
| Pin 5 | TX | RX (GPIO) |

**Note:** SDS018 uses 3.3V TTL logic levels for UART communication.

**UART Settings:** 9600 baud, 8N1

## Files

### sds018.shelly.js

**Core API Library** - Full SDS018 UART protocol implementation.

**Features:**
- Continuous PM2.5/PM10 readings
- Active and query (passive) modes
- Sleep/wake power management
- Configurable working period (0-30 minutes)
- AQI category calculation (US EPA breakpoints)
- Event emission on new readings
- Firmware version query

**Protocol:**
- Data frame: 10 bytes `[0xAA] [0xC0] [PM2.5 Lo] [PM2.5 Hi] [PM10 Lo] [PM10 Hi] [ID Lo] [ID Hi] [Checksum] [0xAB]`
- PM values in 0.1 μg/m³ units (divided by 10 for μg/m³)

**API Methods:**
```javascript
SDS018.getPM25()              // Get last PM2.5 reading (μg/m³)
SDS018.getPM10()              // Get last PM10 reading (μg/m³)
SDS018.getReadings()          // Get all readings with timestamp

SDS018.setMode(active)        // true=continuous, false=query mode
SDS018.query()                // Trigger single reading (query mode)
SDS018.wake()                 // Wake sensor (fan starts)
SDS018.sleep()                // Sleep sensor (fan stops)
SDS018.setWorkPeriod(minutes) // 0=continuous, 1-30=interval
SDS018.getFirmware()          // Query firmware version
SDS018.isAwake()              // Check if sensor is awake
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

1. Wire the SDS018 sensor to your Shelly device
2. Upload and run `sds018.shelly.js`
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

The SDS018 has a limited lifespan (~8000 hours). To extend sensor life:

```javascript
// Set working period to measure every 5 minutes
SDS018.setWorkPeriod(5);

// Or manually control sleep/wake
SDS018.sleep();   // Fan stops, laser off
// ... wait ...
SDS018.wake();    // Fan starts, ~30s warm-up recommended
```

## References

- [PyPMS NovaFitness Documentation](https://github.com/avaldebe/PyPMS/blob/master/docs/sensors/NovaFitness.md)
- [SDS011/SDS018 Protocol](https://cdn.sparkfun.com/assets/parts/1/2/2/7/5/Laser_Dust_Sensor_Control_Protocol_V1.3.pdf)
