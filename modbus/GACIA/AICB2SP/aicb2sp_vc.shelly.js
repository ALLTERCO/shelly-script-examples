/* @meta {"vc":{"p0":{"type":"number","config":{"name":"Voltage","unit":"V"}},"p1":{"type":"number","config":{"name":"Current","unit":"A"}},"p2":{"type":"number","config":{"name":"Active Power","unit":"W"}},"p3":{"type":"number","config":{"name":"Power Factor"}},"p4":{"type":"number","config":{"name":"Frequency","unit":"Hz"}},"p5":{"type":"number","config":{"name":"Energy Total","unit":"kWh"}},"p6":{"type":"number","config":{"name":"Temperature","unit":"degC"}},"breakerSwitch":{"type":"number","config":{"name":"Breaker Switch","min":0,"max":1}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"GACIA"}}}} */

/**
 * @title GACIA AICB2SP Smart IoT MCB with managed Virtual Components
 * @description Reads metering registers and exposes a remote breaker
 *   switch for the GACIA AICB2SP smart circuit breaker over portable
 *   MbRtuClient RPC calls and a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/GACIA/AICB2SP/aicb2sp_vc.shelly.js
 */

/**
 * GACIA AICB2SP Smart IoT MCB - MODBUS-RTU + Managed Virtual Components
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using aicb2sp_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - p0..p6: Voltage, Current, Active Power, Power Factor, Frequency,
 *   Energy Total, Temperature
 * - breakerSwitch: remote on/off control, writes register 0x003E (FC06)
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 9
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
  UPDATE_RATE: 10,
  SWITCH_ADDR: 0x003E,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  { name: 'Voltage', units: 'V', addr: 0x000D, itype: 'i16', scale: 0.01, role: 'p0' },
  { name: 'Current', units: 'A', addr: 0x0011, itype: 'i16', scale: 0.01, role: 'p1' },
  { name: 'Active Power', units: 'W', addr: 0x0019, itype: 'i16', scale: 1, role: 'p2' },
  { name: 'Power Factor', units: '', addr: 0x002F, itype: 'i16', scale: 1, role: 'p3' },
  { name: 'Frequency', units: 'Hz', addr: 0x0032, itype: 'i16', scale: 0.01, role: 'p4' },
  { name: 'Energy Total', units: 'kWh', addr: 0x0036, itype: 'i16', scale: 0.001, role: 'p5' },
  { name: 'Temperature', units: 'degC', addr: 0x003B, itype: 'i16', scale: 1, role: 'p6' }
];

var MANAGED_ROLES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'breakerSwitch', 'slaveId', 'group'];

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

  for (i = 0; i < ENTITIES.length; i++) {
    members.push(managedComponentKey(ENTITIES[i].role, 'number'));
  }
  members.push(managedComponentKey('breakerSwitch', 'number'));
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

function pollNext(index) {
  var item;

  if (index >= ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = ENTITIES[index];
  readHoldingRegisters(item.addr, 1, function(values, error) {
    var raw;
    var value;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < 1) {
      console.log(item.name + ': invalid response');
    } else {
      raw = decodeValue(values, item.itype);
      value = raw * item.scale;
      console.log(item.name + ': ' + value + (item.units ? ' [' + item.units + ']' : ''));
      if (vc[item.role]) vc[item.role].setValue(value);
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
  console.log('GACIA AICB2SP MODBUS-RTU + managed Virtual Components');

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

  vc.breakerSwitch.on('change', function(ev) {
    writeSingleRegister(CONFIG.SWITCH_ADDR, ev.value ? 1 : 0, function(success, error) {
      if (!success) console.log('Breaker switch write failed: ' + modbusErrorText(error));
    });
  });

  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.UPDATE_RATE * 1000, true, poll);
}

init();
