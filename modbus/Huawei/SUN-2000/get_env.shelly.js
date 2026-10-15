/**
 * @title Get Env
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_env.shelly.js
 */

// Huawei SUN2000 – Environmental / internal sensors

let ENTITIES_ENV = [
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
    scale: 1, // or as per doc
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  for (let i = 0; i < entities.length; i++) {
    entities[i]["entity"] = endpoint.addEntity(entities[i].reg);
  }
}

/*
    🔄 Polling update
*/
function update() {
  var value = 0;
  for (var name in ENTITIES) {
    value = ENTITIES[name].entity.getValue() * ENTITIES[name].scale;
    console.log(ENTITIES[name].name + ": " + 
    value + 
    "["+ENTITIES[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();
