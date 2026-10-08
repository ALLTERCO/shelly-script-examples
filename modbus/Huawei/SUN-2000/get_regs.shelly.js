/**
 * @title Get Regs
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_regs.shelly.js
 */

// Huawei SUN2000 – MODBUS entities for Shelly Script

let ENTITIES = [
  // ---------- sun2000_status ----------
  {
    name: "Running status",
    units: "",
    reg: {
      addr: /* TODO: status register */,     // e.g. 32000
      rtype: ModbusController.REGTYPE_INPUT, // or HOLDING, check manual
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Alarm code",
    units: "",
    reg: {
      addr: /* TODO: alarm register */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Work mode",
    units: "",
    reg: {
      addr: /* TODO: work mode register */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  // ---------- sun2000_pv ----------
  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: /* TODO: PV1 Voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1, // example, check doc
    rights: "R"
  },
  {
    name: "PV1 Current",
    units: "A",
    reg: {
      addr: /* TODO: PV1 Current */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: {
      addr: /* TODO: PV1 Power */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32", // often 32-bit, check doc
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Voltage",
    units: "V",
    reg: {
      addr: /* TODO: PV2 Voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
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
      addr: /* TODO: PV2 Current */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "PV2 Power",
    units: "W",
    reg: {
      addr: /* TODO: PV2 Power */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  // Add PV3/PV4 here if your model has them...

  // ---------- sun2000_grid ----------
  {
    name: "Active Power",
    units: "W",
    reg: {
      addr: /* TODO: active power */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i32", // often signed 32-bit
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Grid Voltage L1",
    units: "V",
    reg: {
      addr: /* TODO: grid L1 voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Voltage L2",
    units: "V",
    reg: {
      addr: /* TODO: grid L2 voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Voltage L3",
    units: "V",
    reg: {
      addr: /* TODO: grid L3 voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Frequency",
    units: "Hz",
    reg: {
      addr: /* TODO: grid frequency */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Power Factor",
    units: "",
    reg: {
      addr: /* TODO: PF */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i16", // PF * 1000 or *100 typically
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.001,
    rights: "R"
  },

  // ---------- sun2000_energy ----------
  {
    name: "Today Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: today energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: total energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Today Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: PV1 today energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Total Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: PV1 total energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Today Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: PV2 today energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Total Energy",
    units: "kWh",
    reg: {
      addr: /* TODO: PV2 total energy */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },

  // ---------- sun2000_battery (hybrid models only) ----------
  {
    name: "Battery Voltage",
    units: "V",
    reg: {
      addr: /* TODO: battery voltage */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Current",
    units: "A",
    reg: {
      addr: /* TODO: battery current */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Battery Power",
    units: "W",
    reg: {
      addr: /* TODO: battery power */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: {
      addr: /* TODO: SOC */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Battery Temperature",
    units: "°C",
    reg: {
      addr: /* TODO: batt temp */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },

  // ---------- sun2000_env ----------
  {
    name: "Inverter Temperature",
    units: "°C",
    reg: {
      addr: /* TODO: inverter temp */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Radiator Temperature",
    units: "°C",
    reg: {
      addr: /* TODO: radiator temp */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Insulation Resistance",
    units: "kΩ",
    reg: {
      addr: /* TODO: insulation */,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  // ---------- sun2000_settings (write carefully!) ----------
  {
    name: "Active Power Limit",
    units: "%",
    reg: {
      addr: /* TODO: power limit */,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1, // 0–100
    rights: "RW"
  },
  {
    name: "Reactive Power Mode",
    units: "",
    reg: {
      addr: /* TODO: Q mode */,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "RW"
  }
];
