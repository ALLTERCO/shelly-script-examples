/**
 * @title Get Battery
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_battery.shelly.js
 */

// Huawei SUN2000 – core MODBUS entities for Shelly Script
// Addresses from: SUN2000MA Modbus Interface Definitions, Issue 08 (2024-11-07)

// All values are read-only (rights: "R").
// Scale is chosen so: display_value = raw_register_value * scale

let ENTITIES = [
  // ---------- sun2000_status ----------

  {
    name: "Running status (remote communication)",
    units: "",
    reg: {
      addr: 32000,  // Bitfield1, 16 bits
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Running status (monitoring processing)",
    units: "",
    reg: {
      addr: 32002,  // Bitfield2, 16 bits
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Running status (power processing)",
    units: "",
    reg: {
      addr: 32003,  // Bitfield3, 32 bits (2 registers)
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Alarm 1",
    units: "",
    reg: {
      addr: 32008,  // Bitfield4, 32 bits
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Alarm 2",
    units: "",
    reg: {
      addr: 32010,  // Bitfield4, 32 bits
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Alarm 3",
    units: "",
    reg: {
      addr: 32012,  // Bitfield4, 32 bits
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  // ---------- sun2000_pv (string inputs) ----------

  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 32016,   // I16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,      // V = reg / 10
    rights: "R"
  },
  {
    name: "PV1 Current",
    units: "A",
    reg: {
      addr: 32017,   // I16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,     // A = reg / 100
    rights: "R"
  },
  {
    name: "PV2 Voltage",
    units: "V",
    reg: {
      addr: 32018,   // I16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Current",
    units: "A",
    reg: {
      addr: 32019,   // I16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "PV3 Voltage",
    units: "V",
    reg: {
      addr: 32020,   // I16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV3 Current",
    units: "A",
    reg: {
      addr: 32021,   // I16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "PV4 Voltage",
    units: "V",
    reg: {
      addr: 32022,   // I16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV4 Current",
    units: "A",
    reg: {
      addr: 32023,   // I16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },

  {
    name: "Input power (total PV)",
    units: "kW",
    reg: {
      addr: 32064,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,    // kW = reg / 1000
    rights: "R"
  },

  // ---------- sun2000_grid (AC side) ----------

  {
    name: "Grid voltage L1 / Phase A",
    units: "V",
    reg: {
      addr: 32066,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid voltage L2 / Phase B",
    units: "V",
    reg: {
      addr: 32067,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid voltage L3 / Phase C",
    units: "V",
    reg: {
      addr: 32068,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Phase A voltage",
    units: "V",
    reg: {
      addr: 32069,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Phase B voltage",
    units: "V",
    reg: {
      addr: 32070,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Phase C voltage",
    units: "V",
    reg: {
      addr: 32071,   // U16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },

  {
    name: "Grid / Phase A current",
    units: "A",
    reg: {
      addr: 32072,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Phase B current",
    units: "A",
    reg: {
      addr: 32074,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Phase C current",
    units: "A",
    reg: {
      addr: 32076,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },

  {
    name: "Peak active power (today)",
    units: "kW",
    reg: {
      addr: 32078,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Active power (total AC)",
    units: "kW",
    reg: {
      addr: 32080,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Reactive power",
    units: "kVar",
    reg: {
      addr: 32082,   // I32, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Power factor",
    units: "",
    reg: {
      addr: 32084,   // I16, gain 1000  (e.g. 1000 => 1.000)
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },
  {
    name: "Grid frequency",
    units: "Hz",
    reg: {
      addr: 32085,   // U16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Efficiency",
    units: "%",
    reg: {
      addr: 32086,   // U16, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Internal temperature",
    units: "°C",
    reg: {
      addr: 32087,   // I16, gain 10
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Insulation resistance",
    units: "MΩ",
    reg: {
      addr: 32088,   // U16, gain 1000
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },

  // ---------- sun2000_device_state ----------

  {
    name: "Device status",
    units: "",
    reg: {
      addr: 32089,   // ENUM1, but underlying UINT16
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Fault code",
    units: "",
    reg: {
      addr: 32090,   // U16
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Startup time",
    units: "s",
    reg: {
      addr: 32091,   // EPOCHTIME, 2 regs -> U32
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,        // Epoch seconds (local time)
    rights: "R"
  },
  {
    name: "Shutdown time",
    units: "s",
    reg: {
      addr: 32093,   // EPOCHTIME, 2 regs -> U32
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  // ---------- sun2000_energy ----------

  {
    name: "Total energy yield",
    units: "kWh",
    reg: {
      addr: 32106,   // U32, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,     // kWh = reg / 100
    rights: "R"
  },
  {
    name: "Daily energy yield",
    units: "kWh",
    reg: {
      addr: 32114,   // U32, gain 100
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  }
];
