/* @meta {"vc":{"do0":{"type":"number","config":{"name":"DO0"}},"do1":{"type":"number","config":{"name":"DO1"}},"do2":{"type":"number","config":{"name":"DO2"}},"do3":{"type":"number","config":{"name":"DO3"}},"do4":{"type":"number","config":{"name":"DO4"}},"do5":{"type":"number","config":{"name":"DO5"}},"do6":{"type":"number","config":{"name":"DO6"}},"do7":{"type":"number","config":{"name":"DO7"}},"do8":{"type":"number","config":{"name":"DO8"}},"do9":{"type":"number","config":{"name":"DO9"}},"do10":{"type":"number","config":{"name":"DO10"}},"do11":{"type":"number","config":{"name":"DO11"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":2,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"ComWinTop"}}}} */

/**
 * @title Example Discrete Outputs with managed Virtual Components
 * @description Minimal MODBUS coil (digital output) write example for the
 *   ComWinTop CWT-MB308V using portable MbRtuClient RPC calls and a
 *   firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/example_discrete_outputs_vc.shelly.js
 */

/**
 * ComWinTop CWT-MB308V - Discrete Outputs Example (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using example_discrete_outputs.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - do0..do11: Digital outputs 0..11 (0/1), animated in an alternating pattern
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing do0..do11 and slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Per-role
 * min/max metadata is intentionally omitted from do0..do11 to stay inside
 * that budget - only the Modbus Slave ID keeps its full range/persistence/
 * role metadata.
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
  UPDATE_RATE: 1,
  DO_ADDR: 0,
  DO_COUNT: 12,
  DEFAULT_SLAVE_ID: 2,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MANAGED_ROLES = [
  'do0', 'do1', 'do2', 'do3', 'do4', 'do5', 'do6', 'do7', 'do8', 'do9', 'do10', 'do11',
  'slaveId', 'group'
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  flag: false,
  isPolling: false,
  pollTimer: null
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
  var members = [];
  var i;

  for (i = 0; i < CONFIG.DO_COUNT; i++) {
    members.push(managedComponentKey('do' + i, 'number'));
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

function writeCoils(addr, values, callback) {
  Shelly.call('MbRtuClient.WriteCoils', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    values: values
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(false, { code: errorCode, message: errorMessage });
      return;
    }
    callback(true, null);
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  var DOs = [];
  var i;

  if (state.isPolling) return;
  state.isPolling = true;

  // Flip the bit state (animation).
  state.flag = !state.flag;
  for (i = 0; i < CONFIG.DO_COUNT; i++) {
    DOs.push((i % 2 === 0) ? state.flag : !state.flag);
  }

  console.log('DOs States: ' + DOs);
  for (i = 0; i < DOs.length; i++) {
    if (vc['do' + i]) vc['do' + i].setValue(DOs[i] ? 1 : 0);
  }

  writeCoils(CONFIG.DO_ADDR, DOs, function(success, error) {
    state.isPolling = false;
    if (!success) console.log('Write error: ' + modbusErrorText(error));
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('ComWinTop CWT-MB308V discrete outputs example (managed VC)');

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
