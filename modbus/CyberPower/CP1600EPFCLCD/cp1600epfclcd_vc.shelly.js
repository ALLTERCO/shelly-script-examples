/* @meta {"vc":{"p0":{"type":"number","config":{"name":"Battery Runtime Low"}},"p1":{"type":"number","config":{"name":"Battery Design Capacity"}},"p2":{"type":"number","config":{"name":"Battery Charge Warning"}},"p3":{"type":"number","config":{"name":"Battery Charge Low"}},"p4":{"type":"number","config":{"name":"Battery Voltage Nominal"}},"p5":{"type":"number","config":{"name":"Input Voltage Nominal"}},"p6":{"type":"number","config":{"name":"Input Transfer Low"}},"p7":{"type":"number","config":{"name":"Input Transfer High"}},"p8":{"type":"number","config":{"name":"Timer Shutdown"}},"p9":{"type":"number","config":{"name":"Timer Start"}},"p10":{"type":"number","config":{"name":"Beeper Mode"}},"p11":{"type":"number","config":{"name":"Beeper Control"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"CyberPower"}}}} */

/**
 * @title CyberPower CP1600EPFCLCD MODBUS-RTU monitor + Virtual Components with managed Virtual Components
 * @description Modbus RTU example using portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID. Adjust registers for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/CyberPower/CP1600EPFCLCD/cp1600epfclcd_vc.shelly.js
 */

/**
 * CyberPower CP1600EPFCLCD MODBUS-RTU monitor + Virtual Components (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started.
 *
 * Managed Virtual Component roles:
 * - p0..p11: Battery Runtime Low, Battery Design Capacity, Battery Charge Warning, Battery Charge Low, Battery Voltage Nominal, Input Voltage Nominal, Input Transfer Low, Input Transfer High, Timer Shutdown, Timer Start, Beeper Mode, Beeper Control
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing p0..p11 and slaveId
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
  UPDATE_RATE: 3,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  { name: 'Battery Runtime Low', units: 's', addr: 6, itype: 'u16', scale: 1, role: 'p0' },
  { name: 'Battery Design Capacity', units: '%', addr: 7, itype: 'u16', scale: 1, role: 'p1' },
  { name: 'Battery Charge Warning', units: '%', addr: 8, itype: 'u16', scale: 1, role: 'p2' },
  { name: 'Battery Charge Low', units: '%', addr: 9, itype: 'u16', scale: 1, role: 'p3' },
  { name: 'Battery Voltage Nominal', units: 'V', addr: 11, itype: 'u16', scale: 0.1, role: 'p4' },
  { name: 'Input Voltage Nominal', units: 'V', addr: 12, itype: 'u16', scale: 1, role: 'p5' },
  { name: 'Input Transfer Low', units: 'V', addr: 13, itype: 'u16', scale: 1, role: 'p6' },
  { name: 'Input Transfer High', units: 'V', addr: 14, itype: 'u16', scale: 1, role: 'p7' },
  { name: 'Timer Shutdown', units: 's', addr: 17, itype: 'i16', scale: 1, role: 'p8' },
  { name: 'Timer Start', units: 's', addr: 18, itype: 'i16', scale: 1, role: 'p9' },
  { name: 'Beeper Mode', units: '', addr: 15, itype: 'u16', scale: 1, role: 'p10' },
  { name: 'Beeper Control', units: '', addr: 32, itype: 'u16', scale: 1, role: 'p11' }
];

var MANAGED_ROLES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'slaveId', 'group'];

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
  var members = [
    managedComponentKey('p0', 'number'),
    managedComponentKey('p1', 'number'),
    managedComponentKey('p2', 'number'),
    managedComponentKey('p3', 'number'),
    managedComponentKey('p4', 'number'),
    managedComponentKey('p5', 'number'),
    managedComponentKey('p6', 'number'),
    managedComponentKey('p7', 'number'),
    managedComponentKey('p8', 'number'),
    managedComponentKey('p9', 'number'),
    managedComponentKey('p10', 'number'),
    managedComponentKey('p11', 'number'),
    managedComponentKey('slaveId', 'number')
  ];
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

function pollNext(index) {
  var item;
  var qty;

  if (index >= ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = ENTITIES[index];
  qty = (item.itype === 'u32' || item.itype === 'i32') ? 2 : 1;
  readHoldingRegisters(item.addr, qty, function(values, error) {
    var raw;
    var value;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < qty) {
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
  console.log('CyberPower CP1600EPFCLCD MODBUS-RTU monitor + Virtual Components (managed VC)');

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

