/* @meta {"vc":{"input1":{"type":"number","config":{"name":"Input #1 State"}},"input2":{"type":"number","config":{"name":"Input #2 State"}},"sensor1":{"type":"number","config":{"name":"Sensor #1 Status"}},"sensor2":{"type":"number","config":{"name":"Sensor #2 Status"}},"ch1":{"type":"number","config":{"name":"Ch1 Temperature","unit":"degC"}},"ch2":{"type":"number","config":{"name":"Ch2 Temperature","unit":"degC"}},"supply":{"type":"number","config":{"name":"Supply Voltage","unit":"V"}},"counter1":{"type":"number","config":{"name":"Counter Ch1"}},"counter2":{"type":"number","config":{"name":"Counter Ch2"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":13,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Wirenboard"}}}} */

/**
 * @title WB-M1W2 v3 MODBUS-RTU + managed Virtual Components
 * @description MODBUS-RTU reader for the Wirenboard WB-M1W2 v3 1-Wire to
 *   RS-485 converter over portable MbRtuClient RPC calls, publishing the 9
 *   most valuable parameters plus a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-M1W2-v3/wb_m1w2_v3_vc.shelly.js
 */

/**
 * Wirenboard WB-M1W2 v3 - MODBUS-RTU + Virtual Components (Managed)
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
 * using wb_m1w2_v3_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - input1, input2, sensor1, sensor2: discrete input states (0/1)
 * - ch1, ch2: DS18B20 1-Wire channel temperatures
 * - supply: supply voltage
 * - counter1, counter2: pulse counters
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 10
 *
 * Only these 9 of the full register map are promoted to Virtual Components;
 * remaining registers (filter threshold, baud rate, parity, stop bits,
 * reset, slave address, input modes) are configuration registers, not
 * live telemetry, and are left out of the @meta budget. See
 * wb_m1w2_v3.shelly.js / wb_m1w2_v3_managed.shelly.js for the full map.
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
  { key: 'input1', name: 'Input #1 State', units: '', rtype: 'DISCRETE', addr: 0 },
  { key: 'input2', name: 'Input #2 State', units: '', rtype: 'DISCRETE', addr: 1 },
  { key: 'sensor1', name: 'Sensor #1 Status', units: '', rtype: 'DISCRETE', addr: 16 },
  { key: 'sensor2', name: 'Sensor #2 Status', units: '', rtype: 'DISCRETE', addr: 17 },
  { key: 'ch1', name: 'Ch1 Temperature', units: 'degC', rtype: 'INPUT', addr: 7, itype: 'i16', scale: 0.0625, isTemperature: true },
  { key: 'ch2', name: 'Ch2 Temperature', units: 'degC', rtype: 'INPUT', addr: 8, itype: 'i16', scale: 0.0625, isTemperature: true },
  { key: 'supply', name: 'Supply Voltage', units: 'V', rtype: 'INPUT', addr: 121, itype: 'u16', scale: 0.001 },
  { key: 'counter1', name: 'Counter Ch1', units: '', rtype: 'INPUT', addr: 277, itype: 'u16', scale: 1 },
  { key: 'counter2', name: 'Counter Ch2', units: '', rtype: 'INPUT', addr: 278, itype: 'u16', scale: 1 }
];

var MANAGED_ROLES = ['input1', 'input2', 'sensor1', 'sensor2', 'ch1', 'ch2', 'supply', 'counter1', 'counter2', 'slaveId', 'group'];

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
  var members = [];
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    members.push(managedComponentKey(ENTITIES[i].key, 'number'));
  }
  members.push(managedComponentKey('slaveId', 'number'));

  if (!groupConfig || groupConfig.id === undefined) {
    console.log('ERROR: managed dashboard group has no component ID');
    return;
  }
  for (i = 0; i < members.length; i++) {
    if (!members[i]) {
      console.log('ERROR: cannot resolve managed dashboard member');
      return;
    }
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
  var method = entity.rtype === 'DISCRETE' ? 'MbRtuClient.ReadDiscreteInputs' : 'MbRtuClient.ReadInputRegisters';

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
      value = values[0];
      console.log(item.name + ': ' + value);
      if (vc[item.key]) vc[item.key].setValue(value);
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
    if (vc[item.key]) vc[item.key].setValue(value);
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
