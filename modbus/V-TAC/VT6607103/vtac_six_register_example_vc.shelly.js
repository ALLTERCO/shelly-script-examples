/* @meta {"vc":{"pv1":{"type":"number","config":{"name":"PV1 Voltage","unit":"V","meta":{"ui":{"view":"progressbar"}}}},"pv2":{"type":"number","config":{"name":"PV2 Voltage","unit":"V","meta":{"ui":{"view":"progressbar"}}}},"inputVoltage":{"type":"number","config":{"name":"Input Voltage","unit":"V","meta":{"ui":{"view":"progressbar"}}}},"outputVoltage":{"type":"number","config":{"name":"Output Voltage","unit":"V","meta":{"ui":{"view":"progressbar"}}}},"power":{"type":"number","config":{"name":"Power","unit":"W","meta":{"ui":{"view":"progressbar"}}}},"frequency":{"type":"number","config":{"name":"Frequency","unit":"Hz","meta":{"ui":{"view":"progressbar"}}}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"V-TAC"}}}} */

/**
 * @title V-TAC VT-66036103 six-register example + managed Virtual Components
 * @description Reads six currently inferred live holding registers from the
 *   V-TAC VT-66036103 over portable MbRtuClient RPC calls, publishing all
 *   six plus a firmware-managed Modbus Slave ID as Virtual Components.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js
 */

/**
 * V-TAC VT-66036103 Six-Register Example + Virtual Components (Managed)
 *
 * This is a minimal example reader built from current live-testing results.
 * It focuses only on the six most interesting live registers discovered so far:
 * - PV1 voltage
 * - PV2 voltage
 * - input voltage
 * - output voltage
 * - power
 * - frequency
 *
 * Important:
 * - These names and scales are still inferred, not vendor-confirmed.
 * - This script is intended as a compact example, not a final production map.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using vtac_six_register_example_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - pv1, pv2, inputVoltage, outputVoltage, power, frequency: telemetry
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 7
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
  { name: 'PV1 Voltage', units: 'V', addr: 5776, scale: 0.1, role: 'pv1' },
  { name: 'PV2 Voltage', units: 'V', addr: 5778, scale: 0.1, role: 'pv2' },
  { name: 'Input Voltage', units: 'V', addr: 5784, scale: 0.1, role: 'inputVoltage' },
  { name: 'Output Voltage', units: 'V', addr: 5786, scale: 0.1, role: 'outputVoltage' },
  { name: 'Power', units: 'W', addr: 5790, scale: 0.01, role: 'power' },
  { name: 'Frequency', units: 'Hz', addr: 5792, scale: 0.01, role: 'frequency' }
];

var MANAGED_ROLES = ['pv1', 'pv2', 'inputVoltage', 'outputVoltage', 'power', 'frequency', 'slaveId', 'group'];

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
    members.push(managedComponentKey(ENTITIES[i].role, 'number'));
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
    var value;

    if (!values) {
      console.log(item.name + ' read error: ' + JSON.stringify(error));
    } else {
      value = values[0] * item.scale;
      console.log(item.name + ': ' + value + ' [' + item.units + ']');
      if (vc[item.role]) vc[item.role].setValue(value);
    }

    updateNext(index + 1);
  });
}

function update() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- V-TAC six-register example ---');
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
