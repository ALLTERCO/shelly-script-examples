/* @meta {"vc":{"p0":{"type":"number","config":{"name":"Running status"}},"p1":{"type":"number","config":{"name":"PV1 Power","unit":"W"}},"p2":{"type":"number","config":{"name":"Daily Production","unit":"kWh"}},"p3":{"type":"number","config":{"name":"Battery1 Power","unit":"W"}},"p4":{"type":"number","config":{"name":"Battery1 SOC","unit":"%"}},"p5":{"type":"number","config":{"name":"Battery1 Temperature","unit":"C"}},"p6":{"type":"number","config":{"name":"Total Load Power","unit":"W"}},"p7":{"type":"number","config":{"name":"AC Temperature","unit":"C"}},"p8":{"type":"number","config":{"name":"Total Power of Gen Ports","unit":"W"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Deye"}}}} */

/**
 * @title Deye SG01HP3 MODBUS-RTU monitor + Virtual Components with managed Virtual Components
 * @description Modbus RTU example using portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID. Adjust registers for your target device.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG01HP3/sg01hp3_vc.shelly.js
 */

/**
 * Deye SG01HP3 MODBUS-RTU monitor + Virtual Components (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started.
 *
 * Managed Virtual Component roles:
 * - p0..p8: Running status, PV1 Power, Daily Production, Battery1 Power, Battery1 SOC, Battery1 Temperature, Total Load Power, AC Temperature, Total Power of Gen Ports
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
  { name: 'Running status', units: '', addr: 500, itype: 'u16', scale: 1, role: 'p0' },
  { name: 'AC relays status', units: '', addr: 552, itype: 'u16', scale: 1, role: null },
  { name: 'PV1 Power', units: 'W', addr: 672, itype: 'u16', scale: 10, role: 'p1' },
  { name: 'PV2 Power', units: 'W', addr: 673, itype: 'u16', scale: 10, role: null },
  { name: 'PV3 Power', units: 'W', addr: 674, itype: 'u16', scale: 10, role: null },
  { name: 'PV4 Power', units: 'W', addr: 675, itype: 'u16', scale: 10, role: null },
  { name: 'PV1 Voltage', units: 'V', addr: 676, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV2 Voltage', units: 'V', addr: 678, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV3 Voltage', units: 'V', addr: 680, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV4 Voltage', units: 'V', addr: 682, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV1 Current', units: 'A', addr: 677, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV2 Current', units: 'A', addr: 679, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV3 Current', units: 'A', addr: 681, itype: 'u16', scale: 0.1, role: null },
  { name: 'PV4 Current', units: 'A', addr: 683, itype: 'u16', scale: 0.1, role: null },
  { name: 'Daily Production', units: 'kWh', addr: 529, itype: 'u16', scale: 0.1, role: 'p2' },
  { name: 'Total Production', units: 'kWh', addr: 534, itype: 'u32', scale: 0.1, role: null },
  { name: 'Daily Battery Charge', units: 'kWh', addr: 514, itype: 'u16', scale: 0.1, role: null },
  { name: 'Daily Battery Discharge', units: 'kWh', addr: 515, itype: 'u16', scale: 0.1, role: null },
  { name: 'Total Battery Charge', units: 'kWh', addr: 516, itype: 'u32', scale: 0.1, role: null },
  { name: 'Total Battery Discharge', units: 'kWh', addr: 518, itype: 'u32', scale: 0.1, role: null },
  { name: 'Battery1 Power', units: 'W', addr: 590, itype: 'i16', scale: 10, role: 'p3' },
  { name: 'Battery1 Voltage', units: 'V', addr: 587, itype: 'u16', scale: 0.1, role: null },
  { name: 'Battery1 SOC', units: '%', addr: 588, itype: 'u16', scale: 1, role: 'p4' },
  { name: 'Battery1 Current', units: 'A', addr: 591, itype: 'i16', scale: 0.01, role: null },
  { name: 'Battery1 Temperature', units: 'C', addr: 586, itype: 'u16', scale: 0.1, role: 'p5' },
  { name: 'Battery2 SOC', units: '%', addr: 589, itype: 'u16', scale: 1, role: null },
  { name: 'Battery2 Voltage', units: 'V', addr: 593, itype: 'u16', scale: 0.1, role: null },
  { name: 'Battery2 Current', units: 'A', addr: 594, itype: 'i16', scale: 0.01, role: null },
  { name: 'Battery2 Power', units: 'W', addr: 595, itype: 'i16', scale: 10, role: null },
  { name: 'Battery2 Temperature', units: 'C', addr: 596, itype: 'i16', scale: 0.1, role: null },
  { name: 'Total Load Power', units: 'W', addr: 653, itype: 'u16', scale: 1, role: 'p6' },
  { name: 'Load L1 Power', units: 'W', addr: 650, itype: 'i16', scale: 1, role: null },
  { name: 'Load L2 Power', units: 'W', addr: 651, itype: 'i16', scale: 1, role: null },
  { name: 'Load L3 Power', units: 'W', addr: 652, itype: 'i16', scale: 1, role: null },
  { name: 'Load Voltage L1', units: 'V', addr: 644, itype: 'u16', scale: 0.1, role: null },
  { name: 'Load Voltage L2', units: 'V', addr: 645, itype: 'u16', scale: 0.1, role: null },
  { name: 'Load Voltage L3', units: 'V', addr: 646, itype: 'u16', scale: 0.1, role: null },
  { name: 'Daily Load Consumption', units: 'kWh', addr: 526, itype: 'u16', scale: 0.1, role: null },
  { name: 'Total Load Consumption', units: 'kWh', addr: 527, itype: 'u32', scale: 0.1, role: null },
  { name: 'Current L1', units: 'A', addr: 630, itype: 'i16', scale: 0.01, role: null },
  { name: 'Current L2', units: 'A', addr: 631, itype: 'i16', scale: 0.01, role: null },
  { name: 'Current L3', units: 'A', addr: 632, itype: 'i16', scale: 0.01, role: null },
  { name: 'Inverter L1 Power', units: 'W', addr: 633, itype: 'i16', scale: 1, role: null },
  { name: 'Inverter L2 Power', units: 'W', addr: 634, itype: 'i16', scale: 1, role: null },
  { name: 'Inverter L3 Power', units: 'W', addr: 635, itype: 'i16', scale: 1, role: null },
  { name: 'DC Temperature', units: 'C', addr: 540, itype: 'i16', scale: 0.1, role: null },
  { name: 'AC Temperature', units: 'C', addr: 541, itype: 'i16', scale: 0.1, role: 'p7' },
  { name: 'BMS1 Charging Voltage', units: 'V', addr: 210, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS1 Discharge Voltage', units: 'V', addr: 211, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS1 Charge Current Limit', units: 'A', addr: 212, itype: 'u16', scale: 1, role: null },
  { name: 'BMS1 Discharge Current Limit', units: 'A', addr: 213, itype: 'u16', scale: 1, role: null },
  { name: 'BMS1 SOC', units: '%', addr: 214, itype: 'u16', scale: 1, role: null },
  { name: 'BMS1 Voltage', units: 'V', addr: 215, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS1 Current', units: 'A', addr: 216, itype: 'i16', scale: 0.1, role: null },
  { name: 'BMS1 Temp', units: 'C', addr: 217, itype: 'i16', scale: 0.1, role: null },
  { name: 'BMS1 Charging Max Current', units: 'A', addr: 218, itype: 'i16', scale: 1, role: null },
  { name: 'BMS1 Discharge Max Current', units: 'A', addr: 219, itype: 'i16', scale: 1, role: null },
  { name: 'BMS2 Charging Voltage', units: 'V', addr: 241, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS2 Discharge Voltage', units: 'V', addr: 242, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS2 Charge Current Limit', units: 'A', addr: 243, itype: 'u16', scale: 1, role: null },
  { name: 'BMS2 Discharge Current Limit', units: 'A', addr: 244, itype: 'u16', scale: 1, role: null },
  { name: 'BMS2 SOC', units: '%', addr: 245, itype: 'u16', scale: 1, role: null },
  { name: 'BMS2 Voltage', units: 'V', addr: 246, itype: 'u16', scale: 0.1, role: null },
  { name: 'BMS2 Current', units: 'A', addr: 247, itype: 'i16', scale: 0.1, role: null },
  { name: 'BMS2 Temp', units: 'C', addr: 248, itype: 'i16', scale: 0.1, role: null },
  { name: 'BMS2 Charging Max Current', units: 'A', addr: 249, itype: 'i16', scale: 1, role: null },
  { name: 'BMS2 Discharge Max Current', units: 'A', addr: 250, itype: 'i16', scale: 1, role: null },
  { name: 'Time of Use Weekly Selling Schedule', units: '', addr: 146, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 1', units: '', addr: 148, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 2', units: '', addr: 149, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 3', units: '', addr: 150, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 4', units: '', addr: 151, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 5', units: '', addr: 152, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Time 6', units: '', addr: 153, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Power 1', units: 'W', addr: 154, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Power 2', units: 'W', addr: 155, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Power 3', units: 'W', addr: 156, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Power 4', units: 'W', addr: 157, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Power 5', units: 'W', addr: 158, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Power 6', units: 'W', addr: 159, itype: 'u16', scale: 10, role: null },
  { name: 'Time of Use Voltage 1', units: 'V', addr: 160, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use Voltage 2', units: 'V', addr: 161, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use Voltage 3', units: 'V', addr: 162, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use Voltage 4', units: 'V', addr: 163, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use Voltage 5', units: 'V', addr: 164, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use Voltage 6', units: 'V', addr: 165, itype: 'u16', scale: 0.1, role: null },
  { name: 'Time of Use SOC 1', units: '%', addr: 166, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 2', units: '%', addr: 167, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 3', units: '%', addr: 168, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 4', units: '%', addr: 169, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 5', units: '%', addr: 170, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use SOC 6', units: '%', addr: 171, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 1', units: '', addr: 172, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 2', units: '', addr: 173, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 3', units: '', addr: 174, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 4', units: '', addr: 175, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 5', units: '', addr: 176, itype: 'u16', scale: 1, role: null },
  { name: 'Time of Use Charge Enable 6', units: '', addr: 177, itype: 'u16', scale: 1, role: null },
  { name: 'Phase voltage of Gen port L1', units: 'V', addr: 661, itype: 'u16', scale: 0.1, role: null },
  { name: 'Phase voltage of Gen port L2', units: 'V', addr: 662, itype: 'u16', scale: 0.1, role: null },
  { name: 'Phase voltage of Gen port L3', units: 'V', addr: 663, itype: 'u16', scale: 0.1, role: null },
  { name: 'Phase power of Gen port L1', units: 'W', addr: 664, itype: 'i16', scale: 1, role: null },
  { name: 'Phase power of Gen port L2', units: 'W', addr: 665, itype: 'i16', scale: 1, role: null },
  { name: 'Phase power of Gen port L3', units: 'W', addr: 666, itype: 'i16', scale: 1, role: null },
  { name: 'Total Power of Gen Ports', units: 'W', addr: 667, itype: 'i16', scale: 1, role: 'p8' },
  { name: 'Daily Generator Production', units: 'kWh', addr: 536, itype: 'u16', scale: 0.1, role: null },
  { name: 'Total Generator Production', units: 'kWh', addr: 537, itype: 'u16', scale: 0.1, role: null }
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
  console.log('Deye SG01HP3 MODBUS-RTU monitor + Virtual Components (managed VC)');

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

