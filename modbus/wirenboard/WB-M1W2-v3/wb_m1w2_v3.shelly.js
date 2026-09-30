/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":13,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Wirenboard"}}}} */

/**
 * @title WB-M1W2 v3 MODBUS-RTU Reader with managed Virtual Components
 * @description MODBUS-RTU reader for the Wirenboard WB-M1W2 v3 1-Wire to
 *   RS-485 converter over portable MbRtuClient RPC calls and a
 *   firmware-managed Modbus Slave ID, printing channel data to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-M1W2-v3/wb_m1w2_v3.shelly.js
 */

/**
 * Wirenboard WB-M1W2 v3 - MODBUS-RTU Reader (Managed Virtual Components)
 *
 * WB-M1W2 v3 features:
 *   - Two universal inputs, each supporting up to 20 DS18B20 1-Wire sensors in parallel
 *   - Built-in NTC thermistor for internal/ambient temperature
 *   - Discrete input detection with debounce and pulse counting
 *   - RS485 MODBUS-RTU slave (9-28 V supply)
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 13 (adjust if different).
 * NOTE: factory default stop-bits = 2, so the Serial component mode must be
 * configured as "8N2", not "8N1".
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using wb_m1w2_v3.shelly.js on that firmware.
 *
 * This script prints all values to the console; only the Modbus Slave ID is
 * backed by a managed Virtual Component (it is configuration, not sensor
 * data). See wb_m1w2_v3_managed_vc.shelly.js for a version that also
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
 *   WB-M1W2 Product Page:  https://wirenboard.com/en/product/WB-M1W2/
 *   WB-M1W2 Wiki (EN):     https://wiki.wirenboard.com/wiki/WB-M1W2_1-Wire_to_Modbus_Temperature_Measurement_Module/en
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  UPDATE_RATE: 5,
  DEFAULT_SLAVE_ID: 13,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  // --- Discrete Inputs (FC 0x02) ---
  { name: 'Input #1 State', units: '', rtype: 'DISCRETE', addr: 0 },
  { name: 'Input #2 State', units: '', rtype: 'DISCRETE', addr: 1 },
  { name: 'Sensor #1 Status', units: '', rtype: 'DISCRETE', addr: 16 },
  { name: 'Sensor #2 Status', units: '', rtype: 'DISCRETE', addr: 17 },
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  { name: 'NTC Temperature', units: 'degC', rtype: 'INPUT', addr: 6, itype: 'i16', scale: 0.0625, isTemperature: true },
  { name: 'Ch1 Temperature', units: 'degC', rtype: 'INPUT', addr: 7, itype: 'i16', scale: 0.0625, isTemperature: true },
  { name: 'Ch2 Temperature', units: 'degC', rtype: 'INPUT', addr: 8, itype: 'i16', scale: 0.0625, isTemperature: true },
  { name: 'Supply Voltage', units: 'mV', rtype: 'INPUT', addr: 121, itype: 'u16', scale: 1 },
  { name: 'Counter Ch1', units: '', rtype: 'INPUT', addr: 277, itype: 'u16', scale: 1 },
  { name: 'Counter Ch2', units: '', rtype: 'INPUT', addr: 278, itype: 'u16', scale: 1 },
  // --- Holding Registers (FC 0x03) - configuration (read-only here) ---
  { name: 'Filter Threshold', units: 'degC', rtype: 'HOLDING', addr: 99, itype: 'u16', scale: 0.0625 },
  { name: 'Baud Rate', units: 'bps', rtype: 'HOLDING', addr: 110, itype: 'u16', scale: 100 },
  { name: 'Parity', units: '', rtype: 'HOLDING', addr: 111, itype: 'u16', scale: 1 },
  { name: 'Stop Bits', units: '', rtype: 'HOLDING', addr: 112, itype: 'u16', scale: 1 },
  { name: 'Reset', units: '', rtype: 'HOLDING', addr: 120, itype: 'u16', scale: 1 },
  { name: 'Slave Address', units: '', rtype: 'HOLDING', addr: 128, itype: 'u16', scale: 1 },
  { name: 'Input #1 Mode', units: '', rtype: 'HOLDING', addr: 275, itype: 'u16', scale: 1 },
  { name: 'Input #2 Mode', units: '', rtype: 'HOLDING', addr: 276, itype: 'u16', scale: 1 }
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
    qty: 1
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
      console.log(item.name + ': absent/error');
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
  console.log('--- WB-M1W2 v3 ---');
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
