/* @meta {"vc":{"p0":{"type":"number","config":{"name":"System Status"}},"p1":{"type":"number","config":{"name":"PV1 Power","unit":"W"}},"p2":{"type":"number","config":{"name":"PV2 Power","unit":"W"}},"p3":{"type":"number","config":{"name":"Output Power","unit":"W"}},"p4":{"type":"number","config":{"name":"Battery Voltage","unit":"V"}},"p5":{"type":"number","config":{"name":"Battery SOC","unit":"%"}},"p6":{"type":"number","config":{"name":"AC Input Voltage","unit":"V"}},"p7":{"type":"number","config":{"name":"Inverter Temperature","unit":"C"}},"p8":{"type":"number","config":{"name":"Battery Power","unit":"W"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Growatt"}}}} */

/**
 * @title Growatt SPF5000 MODBUS-RTU monitor + Virtual Components with managed Virtual Components
 * @description Modbus RTU example using portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID. Adjust registers for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/SFP5000/sfp5000_vc.shelly.js
 */

/**
 * Growatt SPF5000 MODBUS-RTU monitor + Virtual Components (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started.
 *
 * Managed Virtual Component roles:
 * - p0..p8: System Status, PV1 Power, PV2 Power, Output Power, Battery Voltage, Battery SOC, AC Input Voltage, Inverter Temperature, Battery Power
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
  UPDATE_RATE: 5,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var ENTITIES = [
  { name: 'System Status', units: '', addr: 0, itype: 'u16', scale: 1, role: 'p0' },
  { name: 'PV1 Voltage', units: 'V', addr: 1, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV2 Voltage', units: 'V', addr: 2, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV1 Power', units: 'W', addr: 3, itype: 'u32', scale: 0.1, role: 'p1' },
  { name: 'PV2 Power', units: 'W', addr: 5, itype: 'u32', scale: 0.1, role: 'p2' },
  { name: 'Buck1 Current', units: 'A', addr: 7, itype: 'u16', scale: 0.1, role: null },
  { name: 'Buck2 Current', units: 'A', addr: 8, itype: 'u16', scale: 0.1, role: null },
  { name: 'Output Power', units: 'W', addr: 9, itype: 'u32', scale: 0.1, role: 'p3' },
  { name: 'Output VA', units: 'VA', addr: 11, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Charge Power', units: 'W', addr: 13, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Charge VA', units: 'VA', addr: 15, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Voltage', units: 'V', addr: 17, itype: 'u16', scale: 0.01, role: 'p4' },
  { name: 'Battery SOC', units: '%', addr: 18, itype: 'u16', scale: 1, role: 'p5' },
  { name: 'Bus Voltage', units: 'V', addr: 19, itype: 'u16', scale: 0.1, role: null },
  { name: 'AC Input Voltage', units: 'V', addr: 20, itype: 'u16', scale: 0.1, role: 'p6' },
  { name: 'AC Input Frequency', units: 'Hz', addr: 21, itype: 'u16', scale: 0.01, role: null },
  { name: 'Output Voltage', units: 'V', addr: 22, itype: 'u16', scale: 0.1, role: null },
  { name: 'Output Frequency', units: 'Hz', addr: 23, itype: 'u16', scale: 0.01, role: null },
  { name: 'Output DC Voltage', units: 'V', addr: 24, itype: 'u16', scale: 0.1, role: null },
  { name: 'Inverter Temperature', units: 'C', addr: 25, itype: 'u16', scale: 0.1, role: 'p7' },
  { name: 'DC-DC Temperature', units: 'C', addr: 26, itype: 'u16', scale: 0.1, role: null },
  { name: 'Load Percent', units: '%', addr: 27, itype: 'u16', scale: 0.1, role: null },
  { name: 'Battery Port Voltage', units: 'V', addr: 28, itype: 'u16', scale: 0.01, role: null },
  { name: 'Battery Bus Voltage', units: 'V', addr: 29, itype: 'u16', scale: 0.01, role: null },
  { name: 'Work Time Total', units: 's', addr: 30, itype: 'u32', scale: 0.5, role: null },
  { name: 'Buck1 Temperature', units: 'C', addr: 32, itype: 'u16', scale: 0.1, role: null },
  { name: 'Buck2 Temperature', units: 'C', addr: 33, itype: 'u16', scale: 0.1, role: null },
  { name: 'Output Current', units: 'A', addr: 34, itype: 'u16', scale: 0.1, role: null },
  { name: 'Inverter Current', units: 'A', addr: 35, itype: 'u16', scale: 0.1, role: null },
  { name: 'AC Input Power', units: 'W', addr: 36, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Input VA', units: 'VA', addr: 38, itype: 'u32', scale: 0.1, role: null },
  { name: 'Fault Code', units: '', addr: 40, itype: 'u32', scale: 1, role: null },
  { name: 'Warning Code', units: '', addr: 42, itype: 'u16', scale: 1, role: null },
  { name: 'PV1 Energy Today', units: 'kWh', addr: 48, itype: 'u32', scale: 0.1, role: null },
  { name: 'PV1 Energy Total', units: 'kWh', addr: 50, itype: 'u32', scale: 0.1, role: null },
  { name: 'PV2 Energy Today', units: 'kWh', addr: 52, itype: 'u32', scale: 0.1, role: null },
  { name: 'PV2 Energy Total', units: 'kWh', addr: 54, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Charge Energy Today', units: 'kWh', addr: 56, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Charge Energy Total', units: 'kWh', addr: 58, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Discharge Today', units: 'kWh', addr: 60, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Discharge Total', units: 'kWh', addr: 62, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Discharge Energy Today', units: 'kWh', addr: 64, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Discharge Energy Total', units: 'kWh', addr: 66, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Charge Current', units: 'A', addr: 68, itype: 'u16', scale: 0.1, role: null },
  { name: 'AC Discharge Power', units: 'W', addr: 69, itype: 'u32', scale: 0.1, role: null },
  { name: 'AC Discharge VA', units: 'VA', addr: 71, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Discharge Power', units: 'W', addr: 73, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Discharge VA', units: 'VA', addr: 75, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery Power', units: 'W', addr: 77, itype: 'i32', scale: 0.1, role: 'p8' },
  { name: 'Battery Over Charge', units: '', addr: 80, itype: 'u16', scale: 1, role: null },
  { name: 'MPPT Fan Speed', units: '%', addr: 81, itype: 'u16', scale: 1, role: null },
  { name: 'Inverter Fan Speed', units: '%', addr: 82, itype: 'u16', scale: 1, role: null },
  { name: 'BMS Status', units: '', addr: 90, itype: 'u16', scale: 1, role: null },
  { name: 'BMS Error', units: '', addr: 91, itype: 'u16', scale: 1, role: null },
  { name: 'BMS Warning', units: '', addr: 92, itype: 'u16', scale: 1, role: null },
  { name: 'BMS SOC', units: '%', addr: 93, itype: 'u16', scale: 1, role: null },
  { name: 'BMS Battery Voltage', units: 'V', addr: 94, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS Battery Current', units: 'A', addr: 95, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS Battery Temp', units: 'C', addr: 96, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS Max Current', units: 'A', addr: 97, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS CV Voltage', units: 'V', addr: 98, itype: 'u16', scale: 0.1, role: null }
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
  readInputRegisters(item.addr, qty, function(values, error) {
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
  console.log('Growatt SPF5000 MODBUS-RTU monitor + Virtual Components (managed VC)');

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

