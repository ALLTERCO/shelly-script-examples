/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":16,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"LinkedGo"}}}} */

/**
 * @title LinkedGo R290 A/W Thermal Pump with managed Virtual Components
 * @description Reads all status registers and exposes write helpers for a
 *   LinkedGo R290 air-to-water thermal pump over portable MbRtuClient RPC
 *   calls and a firmware-managed Modbus Slave ID.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LinkedGo/R290/r290_aw_thermal_pump.shelly.js
 */

/**
 * LinkedGo R290 A/W Thermal Pump Reader (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using r290_aw_thermal_pump.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. This script
 * only exposes the Modbus Slave ID as a Virtual Component; every register
 * is printed to the console every poll instead.
 *
 * Control helpers (setPower, setMode, setHotWaterTarget, setHeatingTarget,
 * setCoolingTarget) are unchanged - call them from the Shelly script
 * console; they are not wired to any Virtual Component here.
 *
 * The firmware creates and reconciles all components before the script
 * starts. Their numeric IDs are intentionally not known or hard-coded by
 * the script.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  UPDATE_RATE: 12,
  DEFAULT_SLAVE_ID: 16,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  { key: 'SYSTEM_STATE', name: 'System State', units: '', addr: 1011, itype: 'u16', scale: 1 },
  { key: 'MODE', name: 'Mode', units: '', addr: 1012, itype: 'u16', scale: 1 },
  { key: 'HOT_WATER_TARGET', name: 'Hot Water Target', units: 'degC', addr: 1157, itype: 'u16', scale: 1 },
  { key: 'HEATING_TARGET', name: 'Heating Target', units: 'degC', addr: 1158, itype: 'u16', scale: 1 },
  { key: 'COOLING_TARGET', name: 'Cooling Target', units: 'degC', addr: 1159, itype: 'u16', scale: 1 },
  { key: 'RUNNING_MODE', name: 'Running Mode', units: '', addr: 2012, itype: 'u16', scale: 1 },
  { key: 'LOAD_OUTPUT', name: 'Load Output Bitmask', units: '', addr: 2019, itype: 'u16', scale: 1 },
  { key: 'SWITCH_STATE', name: 'Switch State Bitmask', units: '', addr: 2034, itype: 'u16', scale: 1 },
  { key: 'HEAT_RETURN_TEMP', name: 'Heating Return Water Temp', units: 'degC', addr: 2035, itype: 'i16', scale: 0.1 },
  { key: 'HEAT_OUTLET_TEMP', name: 'Heating Outlet Water Temp', units: 'degC', addr: 2036, itype: 'i16', scale: 0.1 },
  { key: 'INLET_WATER_TEMP', name: 'Inlet Water Temp', units: 'degC', addr: 2045, itype: 'i16', scale: 0.1 },
  { key: 'OUTLET_WATER_TEMP', name: 'Outlet Water Temp', units: 'degC', addr: 2046, itype: 'i16', scale: 0.1 },
  { key: 'DHW_TANK_TEMP', name: 'DHW Tank Water Temp', units: 'degC', addr: 2047, itype: 'i16', scale: 0.1 },
  { key: 'AMBIENT_TEMP', name: 'Ambient Temp', units: 'degC', addr: 2048, itype: 'i16', scale: 0.1 },
  { key: 'COIL_TEMP', name: 'Coil Temp', units: 'degC', addr: 2049, itype: 'i16', scale: 0.1 },
  { key: 'SUCTION_TEMP', name: 'Suction Temp', units: 'degC', addr: 2051, itype: 'i16', scale: 0.1 },
  { key: 'DISCHARGE_TEMP', name: 'Discharge Temp', units: 'degC', addr: 2053, itype: 'i16', scale: 0.1 },
  { key: 'ANTI_FREEZE_TEMP', name: 'Anti-Freeze Temp', units: 'degC', addr: 2055, itype: 'i16', scale: 0.1 },
  { key: 'ROOM_TEMP', name: 'Room Temp', units: 'degC', addr: 2058, itype: 'i16', scale: 0.1 },
  { key: 'COMPRESSOR_FREQ_SET', name: 'Compressor Frequency Set', units: 'Hz', addr: 2071, itype: 'u16', scale: 1 },
  { key: 'COMPRESSOR_FREQ_RUN', name: 'Compressor Frequency Running', units: 'Hz', addr: 2072, itype: 'u16', scale: 1 },
  { key: 'DC_FAN1_SPEED', name: 'DC Fan 1 Speed', units: 'rpm', addr: 2074, itype: 'u16', scale: 1 },
  { key: 'DC_FAN2_SPEED', name: 'DC Fan 2 Speed', units: 'rpm', addr: 2075, itype: 'u16', scale: 1 },
  { key: 'WATER_FLOW', name: 'Water Flow', units: 'raw', addr: 2077, itype: 'u16', scale: 1 },
  { key: 'FAILURE_1', name: 'Failure 1 Bitmask', units: '', addr: 2085, itype: 'u16', scale: 1 },
  { key: 'FAILURE_2', name: 'Failure 2 Bitmask', units: '', addr: 2086, itype: 'u16', scale: 1 },
  { key: 'FAILURE_3', name: 'Failure 3 Bitmask', units: '', addr: 2087, itype: 'u16', scale: 1 },
  { key: 'FAILURE_4', name: 'Failure 4 Bitmask', units: '', addr: 2088, itype: 'u16', scale: 1 },
  { key: 'FAILURE_5', name: 'Failure 5 Bitmask', units: '', addr: 2089, itype: 'u16', scale: 1 },
  { key: 'FAILURE_6', name: 'Failure 6 Bitmask', units: '', addr: 2090, itype: 'u16', scale: 1 },
  { key: 'FAILURE_7', name: 'Failure 7 Bitmask', units: '', addr: 2081, itype: 'u16', scale: 1 },
  { key: 'FAILURE_8', name: 'Failure 8 Bitmask', units: '', addr: 2082, itype: 'u16', scale: 1 },
  { key: 'FAILURE_9', name: 'Failure 9 Bitmask', units: '', addr: 2083, itype: 'u16', scale: 1 }
];

var REG = {};
(function buildRegLookup() {
  var i;
  for (i = 0; i < ENTITIES.length; i++) REG[ENTITIES[i].key] = ENTITIES[i].addr;
})();

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  isPolling: false,
  pollTimer: null
};

// ============================================================================
// HELPERS
// ============================================================================

function decodeValue(values, itype) {
  var value;

  if (itype === 'u16') return values[0];
  value = values[0];
  return value >= 0x8000 ? value - 0x10000 : value;
}

function clampInteger(value, fallback, min, max) {
  value = Number(value);
  if (value !== value) value = fallback;
  value = Math.round(value);
  if (value < min) value = min;
  if (value > max) value = max;
  return value;
}

function getSlaveId() {
  var value = clampInteger(
    vc.slaveId.getValue(),
    CONFIG.DEFAULT_SLAVE_ID,
    CONFIG.MIN_SLAVE_ID,
    CONFIG.MAX_SLAVE_ID
  );

  if (vc.slaveId.getValue() !== value) vc.slaveId.setValue(value);
  return value;
}

function modbusErrorText(error) {
  if (!error) return 'unknown error';
  if (error.message !== undefined && error.code !== undefined) {
    return error.message + ' (code ' + error.code + ')';
  }
  return JSON.stringify(error);
}

function getModbusClientId() {
  return Shelly.getComponentConfig('serial', 100) ? 100 : 0;
}

function isModbusClientReady() {
  var id = getModbusClientId();
  var config = Shelly.getComponentConfig('serial', id);

  return config && config.mode === 'mb_client';
}

function bindManagedComponents() {
  var i;

  for (i = 0; i < MANAGED_ROLES.length; i++) {
    vc[MANAGED_ROLES[i]] = Script.getVcHandle(MANAGED_ROLES[i]);
    if (!vc[MANAGED_ROLES[i]]) {
      console.log('ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
      return false;
    }
  }

  return true;
}

function managedComponentKey(role, type) {
  var config = vc[role].getConfig();

  if (!config || config.id === undefined) return null;
  return type + ':' + config.id;
}

function setDashboardGroup() {
  var groupConfig = vc.group.getConfig();
  var members = [managedComponentKey('slaveId', 'number')];

  if (!groupConfig || groupConfig.id === undefined) {
    console.log('ERROR: managed dashboard group has no component ID');
    return;
  }
  if (!members[0]) {
    console.log('ERROR: cannot resolve managed dashboard member');
    return;
  }

  Shelly.call('Group.Set', { id: groupConfig.id, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      console.log('Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    console.log('Managed dashboard group ready');
  });
}

// ============================================================================
// MODBUS RPC
// ============================================================================

function readHoldingRegisters(addr, qty, callback) {
  Shelly.call('MbRtuClient.ReadHoldingRegisters', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    qty: qty
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(null, { code: errorCode, message: errorMessage });
      return;
    }
    callback(result && result.values ? result.values : null, null);
  });
}

function writeSingleRegister(addr, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    value: value
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(false, { code: errorCode, message: errorMessage });
      return;
    }
    callback(true, null);
  });
}

// ============================================================================
// PUBLIC CONTROL HELPERS (call from the Shelly script console)
// ============================================================================

function setPower(isOn) {
  writeSingleRegister(REG.SYSTEM_STATE, isOn ? 1 : 0, function(success, error) {
    if (success) console.log('setPower OK -> ' + (isOn ? 'ON' : 'OFF'));
    else console.log('setPower failed: ' + modbusErrorText(error));
  });
}

function setMode(modeValue) {
  writeSingleRegister(REG.MODE, modeValue, function(success, error) {
    if (success) console.log('setMode OK -> ' + modeValue);
    else console.log('setMode failed: ' + modbusErrorText(error));
  });
}

function setHotWaterTarget(tempDegC) {
  writeSingleRegister(REG.HOT_WATER_TARGET, tempDegC, function(success, error) {
    if (success) console.log('setHotWaterTarget OK -> ' + tempDegC);
    else console.log('setHotWaterTarget failed: ' + modbusErrorText(error));
  });
}

function setHeatingTarget(tempDegC) {
  writeSingleRegister(REG.HEATING_TARGET, tempDegC, function(success, error) {
    if (success) console.log('setHeatingTarget OK -> ' + tempDegC);
    else console.log('setHeatingTarget failed: ' + modbusErrorText(error));
  });
}

function setCoolingTarget(tempDegC) {
  writeSingleRegister(REG.COOLING_TARGET, tempDegC, function(success, error) {
    if (success) console.log('setCoolingTarget OK -> ' + tempDegC);
    else console.log('setCoolingTarget failed: ' + modbusErrorText(error));
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function pollNext(index) {
  var item;
  var raw;

  if (index >= ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = ENTITIES[index];
  readHoldingRegisters(item.addr, 1, function(values, error) {
    var value;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < 1) {
      console.log(item.name + ': invalid response');
    } else {
      raw = decodeValue(values, item.itype);
      if (item.itype === 'i16' && raw === 32767) {
        console.log(item.name + ': SENSOR_ERROR');
      } else {
        value = raw * item.scale;
        console.log(item.name + ': ' + value + ' [' + item.units + ']');
      }
    }

    pollNext(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  pollNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('LinkedGo R290 A/W thermal pump reader (managed VC)');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 9600 8N1');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    console.log('Modbus Slave ID changed -> ' + getSlaveId());
  });

  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.UPDATE_RATE * 1000, true, poll);
}

init();
