/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"V-TAC"}}}} */

/**
 * @title V-TAC VT-66036103 inferred MODBUS reader with managed Virtual Components
 * @description Reads a small set of inferred holding registers from the
 *   V-TAC VT-66036103 / INVT-family inverter over portable MbRtuClient RPC
 *   calls and a firmware-managed Modbus Slave ID, printing them to console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_inferred_reader.shelly.js
 */

/**
 * V-TAC VT-66036103 Inferred MODBUS Reader (Managed Virtual Components)
 *
 * This script is based on local reverse-engineering work in:
 * - registers.md
 * - register-proposals.md
 *
 * Important:
 * - The register names and scales here are inferred, not vendor-confirmed.
 * - The goal is to poll the most plausible holding registers every
 *   UPDATE_RATE seconds and keep the results visible in the console during
 *   validation.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using vtac_inferred_reader.shelly.js on that firmware.
 *
 * This script prints all values to the console; only the Modbus Slave ID is
 * backed by a managed Virtual Component (it is configuration, not sensor
 * data).
 *
 * Managed Virtual Component roles:
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary.
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
  UPDATE_RATE: 15,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  { name: 'Battery Voltage Threshold A', units: 'V', addr: 8704, itype: 'u16', scale: 0.1 },
  { name: 'Battery Voltage Threshold B', units: 'V', addr: 8705, itype: 'u16', scale: 0.1 },
  { name: 'Battery Voltage Threshold C', units: 'V', addr: 8706, itype: 'u16', scale: 0.1 },
  { name: 'Battery Voltage Threshold D', units: 'V', addr: 8707, itype: 'u16', scale: 0.1 },
  { name: 'Battery Charge Current Limit', units: 'A', addr: 8708, itype: 'u16', scale: 0.1 },
  { name: 'Battery Discharge Current Limit', units: 'A', addr: 8711, itype: 'u16', scale: 0.1 },
  { name: 'Battery Capacity', units: 'Ah?', addr: 8712, itype: 'u16', scale: 1 },
  { name: 'PV1 Max Input Current', units: 'A', addr: 8713, itype: 'u16', scale: 0.1 },
  { name: 'PV2 Max Input Current', units: 'A', addr: 8714, itype: 'u16', scale: 0.1 },
  { name: 'PV Max Voltage Limit', units: 'V', addr: 8718, itype: 'u16', scale: 0.1 },
  { name: 'MPPT Upper Limit', units: 'V', addr: 8720, itype: 'u16', scale: 0.1 },
  { name: 'MPPT Upper Recovery', units: 'V', addr: 8721, itype: 'u16', scale: 0.1 },
  { name: 'Rated AC Power', units: 'W', addr: 8725, itype: 'u16', scale: 1 },
  { name: 'AC Output Current Limit', units: 'A', addr: 8729, itype: 'u16', scale: 0.1 },
  { name: 'Model Power Class', units: 'kW', addr: 8737, itype: 'u16', scale: 0.1 },
  { name: 'Nominal Grid Frequency A', units: 'Hz', addr: 8738, itype: 'u16', scale: 1 },
  { name: 'Nominal Grid Frequency B', units: 'Hz', addr: 8739, itype: 'u16', scale: 1 },
  { name: 'Unused Marker', units: 'raw', addr: 8836, itype: 'u16', scale: 1 },
  { name: 'Percentage Limit', units: '%', addr: 8856, itype: 'u16', scale: 1 },
  { name: 'Grid High Frequency Trip', units: 'Hz', addr: 8992, itype: 'u16', scale: 0.01 },
  { name: 'Grid Low Frequency Trip', units: 'Hz', addr: 8993, itype: 'u16', scale: 0.01 },
  { name: 'Grid Voltage Threshold A', units: 'V', addr: 8994, itype: 'u16', scale: 0.1 },
  { name: 'Grid Voltage Threshold B', units: 'V', addr: 8995, itype: 'u16', scale: 0.1 }
];

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  isPolling: false
};

// ============================================================================
// HELPERS
// ============================================================================

function decodeValue(values, itype) {
  var value;

  if (itype === 'u16') return values[0];
  if (itype === 'i16') {
    value = values[0];
    return value >= 0x8000 ? value - 0x10000 : value;
  }

  value = values[0] * 65536 + values[1];
  if (itype === 'i32') return value >= 2147483648 ? value - 4294967296 : value;
  return value;
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

// ============================================================================
// MAIN LOGIC
// ============================================================================

function updateNext(index) {
  var item;

  if (index >= ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = ENTITIES[index];
  readHoldingRegisters(item.addr, 1, function(values, error) {
    var raw;
    var value;

    if (!values) {
      console.log(item.name + ' read error: ' + JSON.stringify(error));
    } else {
      raw = decodeValue(values, item.itype);
      value = raw * item.scale;
      console.log(item.name + ': ' + value + ' [' + item.units + '] raw=' + raw + ' addr=' + item.addr);
    }

    updateNext(index + 1);
  });
}

function update() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- V-TAC VT-66036103 inferred map ---');
  updateNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
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

  Timer.set(500, false, update);
  Timer.set(CONFIG.UPDATE_RATE * 1000, true, update);
}

init();
