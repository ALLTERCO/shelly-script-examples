/* @meta {"vc":{"p0":{"type":"number","config":{"name":"Time of Use Time 1"}},"p1":{"type":"number","config":{"name":"Time of Use Time 2"}},"p2":{"type":"number","config":{"name":"Time of Use Time 3"}},"p3":{"type":"number","config":{"name":"Time of Use Time 4"}},"p4":{"type":"number","config":{"name":"Time of Use Time 5"}},"p5":{"type":"number","config":{"name":"Time of Use Time 6"}},"p6":{"type":"number","config":{"name":"Time of Use Power 1"}},"p7":{"type":"number","config":{"name":"Time of Use Power 2"}},"p8":{"type":"number","config":{"name":"Time of Use Power 3"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Deye"}}}} */

/**
 * @title Get Time Use with managed Virtual Components
 * @description Modbus RTU example using portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID. Adjust registers for your target device.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_time_use_vc.shelly.js
 */

/**
 * Get Time Use (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started.
 *
 * Managed Virtual Component roles:
 * - p0..p8: Time of Use Time 1, Time of Use Time 2, Time of Use Time 3, Time of Use Time 4, Time of Use Time 5, Time of Use Time 6, Time of Use Power 1, Time of Use Power 2, Time of Use Power 3
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing p0..p8 and slaveId
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
  { name: 'Time of Use Time 1', units: '', addr: 250, itype: 'u16', scale: 1, role: 'p0' },
  { name: 'Time of Use Time 2', units: '', addr: 251, itype: 'u16', scale: 1, role: 'p1' },
  { name: 'Time of Use Time 3', units: '', addr: 252, itype: 'u16', scale: 1, role: 'p2' },
  { name: 'Time of Use Time 4', units: '', addr: 253, itype: 'u16', scale: 1, role: 'p3' },
  { name: 'Time of Use Time 5', units: '', addr: 254, itype: 'u16', scale: 1, role: 'p4' },
  { name: 'Time of Use Time 6', units: '', addr: 255, itype: 'u16', scale: 1, role: 'p5' },
  { name: 'Time of Use Power 1', units: '', addr: 256, itype: 'u16', scale: 1, role: 'p6' },
  { name: 'Time of Use Power 2', units: '', addr: 257, itype: 'u16', scale: 1, role: 'p7' },
  { name: 'Time of Use Power 3', units: '', addr: 258, itype: 'u16', scale: 1, role: 'p8' },
  { name: 'Time of Use Power 4', units: '', addr: 259, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Power 5', units: '', addr: 260, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Power 6', units: '', addr: 261, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 1', units: '', addr: 268, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 2', units: '', addr: 269, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 3', units: '', addr: 270, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 4', units: '', addr: 271, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 5', units: '', addr: 272, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 6', units: '', addr: 273, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 1', units: '', addr: 274, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 2', units: '', addr: 275, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 3', units: '', addr: 276, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 4', units: '', addr: 277, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 5', units: '', addr: 278, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Enable 6', units: '', addr: 279, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use', units: '', addr: 248, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Voltage 1', units: 'V', addr: 262, itype: 'u16', scale: 0.01, role: null },
  { name: 'Time of Use Voltage 2', units: 'V', addr: 263, itype: 'u16', scale: 0.01, role: null },
  { name: 'Time of Use Voltage 3', units: 'V', addr: 264, itype: 'u16', scale: 0.01, role: null },
  { name: 'Time of Use Voltage 4', units: 'V', addr: 265, itype: 'u16', scale: 0.01, role: null },
  { name: 'Time of Use Voltage 5', units: 'V', addr: 266, itype: 'u16', scale: 0.01, role: null },
  { name: 'Time of Use Voltage 6', units: 'V', addr: 267, itype: 'u16', scale: 0.01, role: null }
];

var MANAGED_ROLES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'slaveId', 'group'];

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
  console.log('Get Time Use (managed VC)');

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

