/* @meta {"vc":{"ai0":{"type":"number","config":{"name":"AI0","unit":"V"}},"ai1":{"type":"number","config":{"name":"AI1","unit":"V"}},"ai2":{"type":"number","config":{"name":"AI2","unit":"V"}},"ai3":{"type":"number","config":{"name":"AI3","unit":"V"}},"ai4":{"type":"number","config":{"name":"AI4","unit":"V"}},"ai5":{"type":"number","config":{"name":"AI5","unit":"V"}},"ai6":{"type":"number","config":{"name":"AI6","unit":"V"}},"ai7":{"type":"number","config":{"name":"AI7","unit":"V"}},"diSummary":{"type":"number","config":{"name":"DI Summary","min":0,"max":255}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":2,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"ComWinTop"}}}} */

/**
 * @title ComWinTop CWT-MB308V MODBUS-RTU monitor + managed Virtual Components
 * @description Reads all 8 analog inputs, all 8 digital inputs, all 4 analog
 *   outputs, and all 12 digital outputs of a ComWinTop CWT-MB308V IO
 *   expansion module over portable MbRtuClient RPC calls. The 8 analog
 *   inputs plus a combined digital-input summary are managed Virtual
 *   Components; every other channel is printed to the console log.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/mb308v_vc.shelly.js
 */

/**
 * ComWinTop CWT-MB308V MODBUS-RTU Monitor + Managed Virtual Components
 *
 * Device specifications:
 * - 8 Analog Inputs (AI0-AI7): 4-20mA / 0-5V / 0-10V, read via FC 0x04
 * - 4 Analog Outputs (AO0-AO3): 0-10V / 4-20mA, read via FC 0x03
 * - 8 Digital Inputs (DI0-DI7): dry contact / NPN, read via FC 0x02
 * - 12 Digital Outputs (DO0-DO11): relay outputs, read via FC 0x01
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using mb308v_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - ai0..ai7: Analog inputs 0..7, volts
 * - diSummary: Digital-input bitmask (bit N set = DI{N} is high)
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing ai0..ai7, diSummary, and slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Analog
 * outputs and individual digital output states are read and printed to the
 * console every poll, but are not backed by a Virtual Component, to stay
 * inside that budget - this keeps the same 9 + 1 group VC curation as the
 * classical variant.
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
  UPDATE_RATE: 3,
  AI_SCALE: 1 / 1100,
  DEFAULT_SLAVE_ID: 2,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var AI_ROLES = ['ai0', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'];
var DI_COUNT = 8;
var AO_COUNT = 4;
var DO_COUNT = 12;

var MANAGED_ROLES = AI_ROLES.concat(['diSummary', 'slaveId', 'group']);

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
  var members = [];
  var i;

  for (i = 0; i < AI_ROLES.length; i++) {
    members.push(managedComponentKey(AI_ROLES[i], 'number'));
  }
  members.push(managedComponentKey('diSummary', 'number'));
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

function mbCall(method, extra, callback) {
  var params = { id: getModbusClientId(), sid: getSlaveId() };
  var key;

  for (key in extra) params[key] = extra[key];

  Shelly.call(method, params, function(result, errorCode, errorMessage) {
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

function pollAi(index) {
  if (index >= AI_ROLES.length) {
    pollDi(0, 0);
    return;
  }

  mbCall('MbRtuClient.ReadInputRegisters', { addr: index, qty: 1 }, function(values, error) {
    var voltage;

    if (error) {
      console.log(AI_ROLES[index] + ' read error: ' + modbusErrorText(error));
    } else if (values && values.length >= 1) {
      voltage = values[0] * CONFIG.AI_SCALE;
      console.log(AI_ROLES[index] + ': ' + voltage + ' [V]');
      if (vc[AI_ROLES[index]]) vc[AI_ROLES[index]].setValue(voltage);
    }
    pollAi(index + 1);
  });
}

function pollDi(index, summary) {
  if (index >= DI_COUNT) {
    console.log('DI Summary: 0x' + summary.toString(16));
    if (vc.diSummary) vc.diSummary.setValue(summary);
    pollAo(0);
    return;
  }

  mbCall('MbRtuClient.ReadDiscreteInputs', { addr: index, qty: 1 }, function(values, error) {
    var bit;

    if (error) {
      console.log('DI' + index + ' read error: ' + modbusErrorText(error));
    } else if (values && values.length >= 1) {
      bit = values[0] ? 1 : 0;
      console.log('DI' + index + ': ' + bit);
      if (bit) summary |= (1 << index);
    }
    pollDi(index + 1, summary);
  });
}

function pollAo(index) {
  if (index >= AO_COUNT) {
    pollDo(0);
    return;
  }

  mbCall('MbRtuClient.ReadHoldingRegisters', { addr: index, qty: 1 }, function(values, error) {
    if (error) console.log('AO' + index + ' read error: ' + modbusErrorText(error));
    else if (values && values.length >= 1) console.log('AO' + index + ': ' + values[0]);
    pollAo(index + 1);
  });
}

function pollDo(index) {
  if (index >= DO_COUNT) {
    state.isPolling = false;
    return;
  }

  mbCall('MbRtuClient.ReadCoils', { addr: index, qty: 1 }, function(values, error) {
    if (error) console.log('DO' + index + ' read error: ' + modbusErrorText(error));
    else if (values && values.length >= 1) console.log('DO' + index + ': ' + (values[0] ? 1 : 0));
    pollDo(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  pollAi(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('ComWinTop CWT-MB308V MODBUS-RTU monitor + managed VC');

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

  console.log('Ready; polling every ' + CONFIG.UPDATE_RATE + 's, 8 AI + 8 DI + 4 AO + 12 DO channels');
  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.UPDATE_RATE * 1000, true, poll);
}

init();
