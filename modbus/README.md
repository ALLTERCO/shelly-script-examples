# MODBUS Examples

MODBUS examples for Shelly devices using built-in MODBUS clients or RS485 add-ons.

## Problem (The Story)

Many inverters, batteries, meters, and plant controllers expose useful local
telemetry over MODBUS. These examples turn that device data into Shelly logs,
Virtual Components, or automation-ready values without relying on vendor cloud
services.

## Persona

- Installer integrating local energy telemetry into a Shelly-based system
- Advanced user replacing cloud-only monitoring with local MODBUS reads
- Engineer validating register maps and automation logic on real devices

## Structure

Each device folder below has a paired `*_vc.shelly.js` script: it reads the
device's entire documented register set every poll (printed to the console),
and self-deploys a Virtual Components dashboard (via the standard
`ensureVirtualComponents` helper used throughout this repo) for the 9 most
valuable parameters, grouped together. The original single-purpose example
scripts in each folder remain available for narrower reads/writes or as
simpler starting points.

- [`ComWinTop/MB308V/`](ComWinTop/MB308V/): generic 8-AI/4-AO/8-DI/12-DO IO
  expansion module - `mb308v_vc.shelly.js`
- [`CyberPower/CP1600EPFCLCD/`](CyberPower/CP1600EPFCLCD/): UPS - `cp1600epfclcd_vc.shelly.js`
- [`Davis/Pyranometer/`](Davis/Pyranometer/): RS-485 solar irradiance sensor - `pyranometer_vc.shelly.js`
- [`Deye/SG01HP3/`](Deye/SG01HP3/): hybrid inverter, dual battery + generator + UPS load - `sg01hp3_vc.shelly.js`
- [`Deye/SG02LP1/`](Deye/SG02LP1/): hybrid inverter with battery - `sg02lp1_vc.shelly.js`
- [`Deye/SG03LP1/`](Deye/SG03LP1/): grid-tie inverter, no battery - `sg03lp1_vc.shelly.js`
- [`Deye/SG04LP3/`](Deye/SG04LP3/): grid-tie inverter, no battery - `sg04lp3_vc.shelly.js`
- [`DFRobot/SEN0492/`](DFRobot/SEN0492/): RS-485 laser ranging sensor - `sen0492_vc.shelly.js`
- [`GACIA/AICB2SP/`](GACIA/AICB2SP/): smart IoT circuit breaker (metering + remote switch) - `aicb2sp_vc.shelly.js`
- [`Growatt/MIC_2500TL-X/`](Growatt/MIC_2500TL-X/): grid-tie inverter with battery block - `mic_2500tl_x_vc.shelly.js`
- [`Growatt/MIN_4200TL-XE/`](Growatt/MIN_4200TL-XE/): grid-tie inverter with battery block - `min_4200tl_xe_vc.shelly.js`
- [`Growatt/SFP5000/`](Growatt/SFP5000/): off-grid/hybrid inverter - `sfp5000_vc.shelly.js`
- [`Growatt/SPH_10000TL3_BH-UP/`](Growatt/SPH_10000TL3_BH-UP/): grid-tie inverter with battery block - `sph_10000tl3_bh_up_vc.shelly.js`
- [`Huawei/SUN-2000/`](Huawei/SUN-2000/): grid-tie inverter - `sun2000_vc.shelly.js`
- [`IGEN/DTSD422/`](IGEN/DTSD422/): six-circuit energy meter (CT1-CT4 documented) - `dtsd422_vc.shelly.js`
- [`JKESS/JK200-MBS/`](JKESS/JK200-MBS/): Jikong JK-PB series BMS (cell voltages + pack telemetry) - `jk200_vc.shelly.js`
- [`LG/`](LG/): LG THERMA V heat pump via Shelly Pro EM-50 - `lg-therma-v-pro-em50_vc.shelly.js`
- [`Midea/`](Midea/): Midea/Clivet R32 heat pump bridge with nine self-provisioned controls/measurements, controller guards and command readback - `midea-clivet-r32-pro-modbus-vc.shelly.js`
- [`LinkedGo/R290/`](LinkedGo/R290/): R290 air-to-water thermal pump - `r290_aw_thermal_pump_vc.shelly.js`
- [`LinkedGo/ST802/`](LinkedGo/ST802/): Youth Smart Thermostat + BMS command simulation - `st802_bms_vc.shelly.js`
- [`MarsRock/G2_SUN_Series_Grid_Tie_Inverter/`](MarsRock/G2_SUN_Series_Grid_Tie_Inverter/): micro-inverter, only 5 registers total (all promoted to VC) - `g2_sun_series_vc.shelly.js`
- [`Marstek/VenusE/`](Marstek/VenusE/): battery/inverter, plus dedicated Charge / Stop / Discharge controllers using either self-provisioned fixed-ID VCs or a fully managed seven-role dashboard. The managed variant keeps its complete `@meta` declaration on the first line within the firmware's 1024-character limit and uses portable `MbRtuClient` RPC reads/writes; it works on the tested Pro 3EM RS485 Add-on, but not on tested Pill Gen3 firmware 2.0.1-ge1a198b - `venus_e_vc.shelly.js`, `venus_e_control_vc.shelly.js`, `venus_e_control_managed_vc.shelly.js`
- [`Sigenergy/`](Sigenergy/): Sigenergy/SigenStor MODBUS examples for Shelly Pro RS485 Addon
- [`V-TAC/VT6607103/`](V-TAC/VT6607103/): hybrid inverter, six inferred live registers - `vtac_six_register_example_vc.shelly.js`
- [`wirenboard/WB-M1W2-v3/`](wirenboard/WB-M1W2-v3/): 1-Wire to RS-485 converter (DS18B20 + discrete inputs) - `wb_m1w2_v3_vc.shelly.js`
- [`wirenboard/WB-MIR-v-3/`](wirenboard/WB-MIR-v-3/): IR transceiver + environment sensor - `wb_mir_v3_vc.shelly.js`
- [`utils/`](utils/): vendor-agnostic MODBUS-RTU discovery tools (`modbus_scan.shelly.js`, `modbus_register_scan.shelly.js`)
- [`http-bridge/`](http-bridge/): HTTP endpoint that bridges arbitrary MODBUS register reads/writes to JSON (`modbus_http_bridge.shelly.js`)

## What is Modbus?

Modbus is a communication protocol widely used for connecting electronic devices. It follows a Client-Server architecture:

- **Client** (formerly "Master"): Initiates all communication, reads and writes data
- **Server** (formerly "Slave"): Responds to client requests, exports data through registers

**Key characteristics:**
- Only the Client can initiate transactions
- Servers are passive and cannot notify the Client of events
- Simple, robust, and widely supported across many devices

## Transport Types

| Transport | Description |
|-----------|-------------|
| **Serial/RTU** | Binary protocol over RS-485 (most common, used by Shelly) |
| Serial/ASCII | Text-based protocol over serial |
| TCP/IP | Modbus over Ethernet/WiFi |

## Data Model

Modbus organizes data into four register spaces, each with up to 65,536 (2^16) registers:

|            | 1-bit | 16-bit |
|------------|-------|--------|
| **Read-only** | Discrete Inputs | Input Registers |
| **Read-write** | Coils | Holding Registers |

### Register Types Explained

```
+-------------------------------------------------------------------------+
|                        Modbus Server                                    |
|                                                                         |
| +---------+  +----------------+  +----------------+  +----------------+ |
| | Coils   |  | Discrete Inputs|  | Holding Regs   |  | Input Regs     | |
| | (RW,1b) |  | (RO,1b)        |  | (RW,16b)       |  | (RO,16b)       | |
| |0x0000   |  |0x0000          |  |0x0000          |  |0x0000          | |
| |  ...    |  |   ...          |  |   ...          |  |   ...          | |
| |0xffff   |  |0xffff          |  |0xffff          |  |0xffff          | |
| +---------+  +----------------+  +----------------+  +----------------+ |
+-------------------------------------------------------------------------+
```

- **Coils**: Read-write single bits (e.g., on/off switches)
- **Discrete Inputs**: Read-only single bits (e.g., sensor states)
- **Holding Registers**: Read-write 16-bit values (e.g., setpoints)
- **Input Registers**: Read-only 16-bit values (e.g., measurements)

## Modbus Operations

| Register Type | Read Operation | Write Operation |
|---------------|----------------|-----------------|
| Discrete Inputs | `0x02` Read Discrete Inputs | N/A |
| Coils | `0x01` Read Coils | `0x05` Write Single Coil, `0x0F` Write Multiple Coils |
| Input Registers | `0x04` Read Input Registers | N/A |
| Holding Registers | `0x03` Read Holding Registers | `0x06` Write Single Register, `0x10` Write Multiple Registers |

## Shelly Modbus Controller

Shelly devices include a built-in Modbus RTU Controller accessible via JavaScript scripting:

```
+-------------------+
|   JS Bindings     |  <-- SHOS JS API
+-------------------+
         |
         v
+-------------------+
|   Controller      |  <-- Polling, batching, items
+-------------------+
         |
         v
+-------------------+
|     Client        |  <-- Modbus RTU protocol, UART
+-------------------+
         |
         v
 [Physical UART/RS485]
```

### Configuration Options

**Serial Settings:**
- UART port and GPIOs (RX, TX, DE)
- Baud rate, data bits, parity, stop bits
- Silent time between requests

**Controller Options:**
- Poll interval (minimum time between Modbus requests)

## Entity Types

The controller supports various data types for reading register values:

**Numeric Types:**
- `u16`, `i16` - 16-bit unsigned/signed integers
- `u32`, `i32` - 32-bit unsigned/signed integers
- `u64`, `i64` - 64-bit unsigned/signed integers
- `f32`, `f64` - 32/64-bit floating point

**Boolean and Bitfields:**
- Bitwise booleans for 1-bit registers
- Bit-masked values within 16-bit registers

**Bytes and Strings:**
- Raw bytes from adjacent registers
- Null-terminated strings

### Byte Order (Endianness)

Different devices use different byte ordering. The controller supports:

| Word Order | BE byte order | LE byte order |
|------------|---------------|---------------|
| **BE word order** | ABCD | BADC |
| **LE word order** | CDAB | DCBA |

## JavaScript API Example

```javascript
// Get the Modbus controller instance
const mc = ModbusController.get(1);

// Configure pause between requests
mc.setOptions({ pause_ms: 500 });

// Add an entity to read a 32-bit float from Input Register 135
// poll_int: -1 means poll once (not continuously)
const powerFactor = mc.addEntity({
    rtype: ModbusController.REGTYPE_INPUT,
    addr: 135,
    itype: "f32",
    poll_int: -1
});

// Listen for value changes
powerFactor.on("change", function() {
    console.log("Power Factor:", powerFactor.value());
});
```

### Polling Intervals

The `poll_int` parameter controls how often a register is read:

| Value | Behavior |
|-------|----------|
| `0` | Poll as often as possible |
| `> 0` | Poll every N milliseconds |
| `-1` | Poll once only |
| `-2` | Never poll automatically (manual read only) |

## Common Use Cases

- **Energy Meters**: Read voltage, current, power, energy consumption
- **Solar Inverters**: Monitor production, grid status, battery levels
- **Sensors**: Temperature, pressure, flow measurements
- **PLCs**: Control and monitor automated systems

## Resources

- [Modbus Controller API Reference](API.md) - Detailed API documentation
- [Modbus Organization](https://modbus.org/) - Official Modbus specifications
- [Shelly API Documentation](https://shelly-api-docs.shelly.cloud/) - Shelly scripting reference
