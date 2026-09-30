/* @meta {"vc":{"p0":{"type":"number","config":{"name":"MOSFET Temperature","unit":"degC"}},"p1":{"type":"number","config":{"name":"Pack Voltage","unit":"mV"}},"p2":{"type":"number","config":{"name":"Pack Power","unit":"mW"}},"p3":{"type":"number","config":{"name":"Pack Current","unit":"mA"}},"p4":{"type":"number","config":{"name":"Temperature 1","unit":"degC"}},"p5":{"type":"number","config":{"name":"Temperature 2","unit":"degC"}},"p6":{"type":"number","config":{"name":"Alarm Bitmask"}},"p7":{"type":"number","config":{"name":"Balance Current","unit":"mA"}},"p8":{"type":"number","config":{"name":"State of Charge","unit":"%"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"JKESS"}}}} */

/**
 * @title JKESS JK200-MBS BMS + managed Virtual Components
 * @description Reads all 16 cell voltages and pack telemetry from a Jikong
 *   JK-PB series BMS over portable MbRtuClient RPC calls, publishing the 9
 *   pack-level parameters as managed Virtual Components.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/JKESS/JK200-MBS/jk200_vc.shelly.js
 */

/**
 * JKESS JK200-MBS BMS Reader + Managed Virtual Components
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using jk200_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - p0..p8: MOSFET Temperature, Pack Voltage, Pack Power, Pack Current,
 *   Temperature 1, Temperature 2, Alarm Bitmask, Balance Current, State of
 *   Charge
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 10
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. All 16 cell
 * voltages are printed to the console every poll but not backed by
 * individual Virtual Components, to stay inside that budget.
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
  CELL_COUNT: 16,
  CELL_BASE_ADDR: 0x1200,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MAIN_ENTITIES = [
  { name: 'MOSFET Temperature', units: 'degC', addr: 0x128A, qty: 1, itype: 'i16', scale: 0.1, role: 'p0' },
  { name: 'Pack Voltage', units: 'mV', addr: 0x128D, qty: 2, itype: 'u32', scale: 1, role: 'p1' },
  { name: 'Pack Power', units: 'mW', addr: 0x128F, qty: 2, itype: 'i32', scale: 1, role: 'p2' },
  { name: 'Pack Current', units: 'mA', addr: 0x1291, qty: 2, itype: 'i32', scale: 1, role: 'p3' },
  { name: 'Temperature 1', units: 'degC', addr: 0x1293, qty: 1, itype: 'i16', scale: 0.1, role: 'p4' },
  { name: 'Temperature 2', units: 'degC', addr: 0x1294, qty: 1, itype: 'i16', scale: 0.1, role: 'p5' },
  { name: 'Alarm Bitmask', units: '', addr: 0x1295, qty: 2, itype: 'u32', scale: 1, role: 'p6' },
  { name: 'Balance Current', units: 'mA', addr: 0x1297, qty: 1, itype: 'i16', scale: 1, role: 'p7' },
  { name: 'State of Charge', units: '%', addr: 0x1298, qty: 1, itype: 'u16', scale: 1, role: 'p8' }
];

var ALARM_LABELS = [
  'Cell undervoltage', 'Cell overvoltage', 'Discharge overcurrent', 'Charge overcurrent',
  'Low temperature (chg)', 'High temperature (dis)', 'MOS overtemperature', 'Short circuit',
  'Cell delta too large', 'Pack undervoltage', 'Pack overvoltage', 'Low SOC'
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

function alarmsText(bitmask) {
  var active = [];
  var b;

  if (bitmask === 0) return 'none';
  for (b = 0; b < ALARM_LABELS.length; b++) {
    if (bitmask & (1 << b)) active.push(ALARM_LABELS[b]);
  }
  if (bitmask & 0x8000) active.push('Manual shutdown');
  return active.join(', ');
}

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

  for (i = 0; i < MAIN_ENTITIES.length; i++) {
    members.push(managedComponentKey(MAIN_ENTITIES[i].role, 'number'));
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

function pollCells(index, minV, maxV, minCell, maxCell) {
  if (index >= CONFIG.CELL_COUNT) {
    console.log('Cell Delta: ' + (maxV - minV) + ' mV (min cell ' + minCell + ', max cell ' + maxCell + ')');
    pollMain(0);
    return;
  }

  readHoldingRegisters(CONFIG.CELL_BASE_ADDR + index, 1, function(values, error) {
    var v;

    if (error) {
      console.log('Cell ' + (index + 1) + ' read error: ' + modbusErrorText(error));
    } else if (values && values.length >= 1) {
      v = values[0];
      console.log('Cell ' + (index + 1) + ': ' + v + ' [mV]');
      if (v < minV) { minV = v; minCell = index + 1; }
      if (v > maxV) { maxV = v; maxCell = index + 1; }
    }
    pollCells(index + 1, minV, maxV, minCell, maxCell);
  });
}

function pollMain(index) {
  var item;

  if (index >= MAIN_ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = MAIN_ENTITIES[index];
  readHoldingRegisters(item.addr, item.qty, function(values, error) {
    var raw;
    var value;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < item.qty) {
      console.log(item.name + ': invalid response');
    } else {
      raw = decodeValue(values, item.itype);
      value = raw * item.scale;
      if (item.name === 'Alarm Bitmask') console.log('Alarms: ' + alarmsText(value));
      else console.log(item.name + ': ' + value + ' [' + item.units + ']');
      if (vc[item.role]) vc[item.role].setValue(value);
    }

    pollMain(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- JK200 BMS ---');
  pollCells(0, 65535, 0, 0, 0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('JKESS JK200-MBS BMS reader + managed Virtual Components');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 115200 8N1');
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
