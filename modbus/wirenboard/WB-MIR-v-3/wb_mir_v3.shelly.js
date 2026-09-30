/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":62,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Wirenboard"}}}} */

/**
 * @title WB-MIR v3 MODBUS-RTU Reader with managed Virtual Components
 * @description MODBUS-RTU reader for the Wirenboard WB-MIR v3 IR
 *   transceiver and environment sensor over portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID, printing readings to console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - MODBUS-RTU Reader (Managed Virtual Components)
 *
 * WB-MIR v3 features:
 *   - IR transceiver (send/receive IR commands, up to 80 stored commands)
 *   - 1-Wire input for DS18B20 temperature sensor
 *   - Discrete input (button) with short / long / double press detection
 *   - RS485 MODBUS-RTU slave
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 62 (adjust if
 * different). NOTE: factory default stop-bits = 2, so the Serial
 * component mode must be configured as "8N2", not "8N1".
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using wb_mir_v3.shelly.js on that firmware.
 *
 * This script prints all values to the console; only the Modbus Slave ID is
 * backed by a managed Virtual Component (it is configuration, not sensor
 * data). See wb_mir_v3_managed_vc.shelly.js for a version that also
 * publishes selected channels as Virtual Components.
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
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  UPDATE_RATE: 5,
  DEFAULT_SLAVE_ID: 62,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  // --- Discrete Inputs (FC 0x02) ---
  { name: 'Input 1W State', units: '', rtype: 'DISCRETE', addr: 0 },
  { name: '1-Wire Probe Status', units: '', rtype: 'DISCRETE', addr: 16 },
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  { name: '1-Wire Temperature', units: 'degC', rtype: 'INPUT', addr: 7, itype: 'i16', qty: 1, scale: 0.0625, isTemperature: true },
  { name: 'Uptime', units: 's', rtype: 'INPUT', addr: 104, itype: 'u32', qty: 2, scale: 1 },
  { name: 'Supply Voltage', units: 'mV', rtype: 'INPUT', addr: 121, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Min Supply Voltage', units: 'mV', rtype: 'INPUT', addr: 122, itype: 'u16', qty: 1, scale: 1 },
  { name: 'MCU Supply Voltage', units: 'mV', rtype: 'INPUT', addr: 123, itype: 'u16', qty: 1, scale: 1 },
  { name: 'MCU Temperature', units: 'degC', rtype: 'INPUT', addr: 124, itype: 'i16', qty: 1, scale: 0.1 },
  { name: 'IR Transceiver', units: '', rtype: 'INPUT', addr: 375, itype: 'u16', qty: 1, scale: 1 },
  { name: '1-Wire Sensor', units: '', rtype: 'INPUT', addr: 376, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Short Press Counter', units: '', rtype: 'INPUT', addr: 464, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Long Press Counter', units: '', rtype: 'INPUT', addr: 480, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Double Press Counter', units: '', rtype: 'INPUT', addr: 496, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Short+Long Counter', units: '', rtype: 'INPUT', addr: 512, itype: 'u16', qty: 1, scale: 1 },
  // --- Holding Registers (FC 0x03) - configuration (read-only here) ---
  { name: 'Conn Loss Timeout', units: 's', rtype: 'HOLDING', addr: 8, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Sensor Poll Period', units: 's', rtype: 'HOLDING', addr: 101, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Input 1W Mode', units: '', rtype: 'HOLDING', addr: 275, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Debounce Time', units: 'ms', rtype: 'HOLDING', addr: 340, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Long Press Duration', units: 'ms', rtype: 'HOLDING', addr: 1100, itype: 'u16', qty: 1, scale: 1 },
  { name: 'Double Press Wait', units: 'ms', rtype: 'HOLDING', addr: 1140, itype: 'u16', qty: 1, scale: 1 }
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

function readEntityRaw(entity, callback) {
  var method = entity.rtype === 'DISCRETE' ? 'MbRtuClient.ReadDiscreteInputs' :
    entity.rtype === 'INPUT' ? 'MbRtuClient.ReadInputRegisters' : 'MbRtuClient.ReadHoldingRegisters';

  Shelly.call(method, {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: entity.addr,
    qty: entity.qty || 1
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
  readEntityRaw(item, function(values, error) {
    var raw;
    var value;

    if (!values) {
      console.log(item.name + ' read error: ' + JSON.stringify(error));
      updateNext(index + 1);
      return;
    }

    if (item.rtype === 'DISCRETE') {
      console.log(item.name + ': ' + values[0]);
      updateNext(index + 1);
      return;
    }

    raw = decodeValue(values, item.itype);
    if (item.isTemperature && raw === 0x7FFF) {
      console.log(item.name + ': sensor error');
      updateNext(index + 1);
      return;
    }

    value = raw * item.scale;
    console.log(item.name + ': ' + value + ' [' + item.units + ']');
    updateNext(index + 1);
  });
}

function update() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- WB-MIR v3 ---');
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
    console.log('ERROR: configure the serial component as mb_client at 9600 8N2');
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
