/* @meta {"vc":{"ai0":{"type":"number","config":{"name":"AI0","min":0,"max":10,"unit":"V"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":2,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"ComWinTop"}}}} */

/**
 * @title Example Write Holding Register with managed Virtual Components
 * @description Minimal MODBUS holding register write example for the
 *   ComWinTop CWT-MB308V using portable MbRtuClient RPC calls and a
 *   firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/example_write_holding_register_vc.shelly.js
 */

/**
 * ComWinTop CWT-MB308V - Write Holding Register Example (Managed VCs)
 *
 * Reads the AI0 potentiometer voltage (0..10V) and echoes it back to a
 * holding register scaled by 2000, demonstrating a read-then-write cycle.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using example_write_holding_register.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - ai0: Analog input 0, scaled to volts
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing ai0 and slaveId
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
  UPDATE_RATE: 1,
  AI0_ADDR: 0,
  HOLDING_ADDR: 0,
  DEFAULT_SLAVE_ID: 2,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MANAGED_ROLES = ['ai0', 'slaveId', 'group'];

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
  var members = [managedComponentKey('ai0', 'number'), managedComponentKey('slaveId', 'number')];
  var i;

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

function readInputRegisters(addr, qty, callback) {
  Shelly.call('MbRtuClient.ReadInputRegisters', {
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
// MAIN LOGIC
// ============================================================================

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;

  readInputRegisters(CONFIG.AI0_ADDR, 1, function(values, error) {
    var voltage;

    if (error) {
      console.log('AI0 read error: ' + modbusErrorText(error));
      state.isPolling = false;
      return;
    }
    if (!values || values.length < 1) {
      console.log('AI0: invalid response');
      state.isPolling = false;
      return;
    }

    voltage = values[0] / 1100;
    console.log('Voltage: ' + voltage);
    if (vc.ai0) vc.ai0.setValue(voltage);

    writeSingleRegister(CONFIG.HOLDING_ADDR, parseInt(voltage * 2000, 10), function(success, writeError) {
      state.isPolling = false;
      if (!success) console.log('Write error: ' + modbusErrorText(writeError));
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('ComWinTop CWT-MB308V write holding register example (managed VC)');

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
