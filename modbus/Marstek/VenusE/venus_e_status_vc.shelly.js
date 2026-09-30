/* @meta {"vc":{"soc":{"type":"number","config":{"name":"Battery SOC","unit":"%"}},"chargeLimit":{"type":"number","config":{"name":"Charge Current Limit","unit":"A"}},"dischargeLimit":{"type":"number","config":{"name":"Discharge Current Limit","unit":"A"}},"internalTemp":{"type":"number","config":{"name":"Internal Temperature","unit":"C"}},"maxCellTemp":{"type":"number","config":{"name":"Max Cell Temperature","unit":"C"}},"dailyCharge":{"type":"number","config":{"name":"Daily Charging Energy","unit":"kWh"}},"dailyDischarge":{"type":"number","config":{"name":"Daily Discharging Energy","unit":"kWh"}},"inverterState":{"type":"number","config":{"name":"Inverter State"}},"alarmFaultCount":{"type":"number","config":{"name":"Alarm/Fault Count"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Marstek"}}}} */

/**
 * @title Marstek VenusE status MODBUS-RTU + managed Virtual Components
 * @description Reads Marstek VenusE SOC, charge/discharge limits,
 *   temperatures, daily energy, operating state, and alarm/fault count over
 *   portable MbRtuClient RPC calls, with a firmware-managed status dashboard.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_status_vc.shelly.js
 */

/**
 * Marstek VenusE Status MODBUS-RTU Reader + Managed Virtual Components
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using venus_e_status_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - soc: Battery SOC
 * - chargeLimit, dischargeLimit: charge/discharge current limits
 * - internalTemp, maxCellTemp: temperatures
 * - dailyCharge, dailyDischarge: daily energy counters
 * - inverterState: raw inverter state code (0..6)
 * - alarmFaultCount: count of active bits across registers 36000, 36001,
 *   36100, 36101, 36103, and 36104
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 10 value/config components
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Per-role
 * min/max/persisted metadata is intentionally omitted from the curated
 * telemetry roles to stay inside that budget - only the Modbus Slave ID
 * keeps its full range/persistence/role metadata.
 *
 * Important:
 * - This variant is read-only. It does not write control registers.
 * - This is a different curated dashboard from venus_e_managed_vc.shelly.js
 *   (which focuses on live power flow); this one focuses on operational
 *   status.
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

var COMPONENTS = [
  { name: 'Battery SOC', addr: 32104, qty: 1, itype: 'u16', scale: 1, unit: '%', role: 'soc' },
  { name: 'Charge Current Limit', addr: 35111, qty: 1, itype: 'u16', scale: 0.1, unit: 'A', role: 'chargeLimit' },
  { name: 'Discharge Current Limit', addr: 35112, qty: 1, itype: 'u16', scale: 0.1, unit: 'A', role: 'dischargeLimit' },
  { name: 'Internal Temperature', addr: 35000, qty: 1, itype: 'i16', scale: 0.1, unit: 'C', role: 'internalTemp' },
  { name: 'Max Cell Temperature', addr: 35010, qty: 1, itype: 'i16', scale: 0.1, unit: 'C', role: 'maxCellTemp' },
  { name: 'Daily Charging Energy', addr: 33004, qty: 2, itype: 'u32', scale: 0.01, unit: 'kWh', role: 'dailyCharge' },
  { name: 'Daily Discharging Energy', addr: 33006, qty: 2, itype: 'u32', scale: 0.01, unit: 'kWh', role: 'dailyDischarge' },
  { name: 'Inverter State', addr: 35100, qty: 1, itype: 'u16', scale: 1, unit: '', isState: true, role: 'inverterState' }
];

var ALARM_FAULT_REGS = [
  { name: 'Alarm Word 36000', addr: 36000, qty: 1 },
  { name: 'Alarm Word 36001', addr: 36001, qty: 1 },
  { name: 'Fault Word 36100', addr: 36100, qty: 1 },
  { name: 'Fault Word 36101', addr: 36101, qty: 1 },
  { name: 'Fault Word 36103', addr: 36103, qty: 1 },
  { name: 'Fault Word 36104', addr: 36104, qty: 1 }
];

var MANAGED_ROLES = [
  'soc', 'chargeLimit', 'dischargeLimit', 'internalTemp', 'maxCellTemp',
  'dailyCharge', 'dailyDischarge', 'inverterState', 'alarmFaultCount',
  'slaveId', 'group'
];

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

function stateName(raw) {
  if (raw === 0) return 'sleep';
  if (raw === 1) return 'standby';
  if (raw === 2) return 'charge';
  if (raw === 3) return 'discharge';
  if (raw === 4) return 'backup mode';
  if (raw === 5) return 'OTA upgrade';
  if (raw === 6) return 'bypass';
  return 'unknown';
}

function countBits(value) {
  var n = value & 0xFFFF;
  var count = 0;

  while (n > 0) {
    if (n & 1) count++;
    n = n >> 1;
  }

  return count;
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
  var members = [
    managedComponentKey('soc', 'number'),
    managedComponentKey('chargeLimit', 'number'),
    managedComponentKey('dischargeLimit', 'number'),
    managedComponentKey('internalTemp', 'number'),
    managedComponentKey('maxCellTemp', 'number'),
    managedComponentKey('dailyCharge', 'number'),
    managedComponentKey('dailyDischarge', 'number'),
    managedComponentKey('inverterState', 'number'),
    managedComponentKey('alarmFaultCount', 'number'),
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
// TELEMETRY
// ============================================================================

function finishPoll() {
  state.isPolling = false;
}

function pollAlarmFault(index, count) {
  var item;

  if (index >= ALARM_FAULT_REGS.length) {
    console.log('Alarm/Fault Count: ' + count);
    if (vc.alarmFaultCount) vc.alarmFaultCount.setValue(count);
    finishPoll();
    return;
  }

  item = ALARM_FAULT_REGS[index];
  readHoldingRegisters(item.addr, item.qty, function(values, error) {
    var raw;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < item.qty) {
      console.log(item.name + ': invalid response');
    } else {
      raw = values[0];
      count += countBits(raw);
      if (raw !== 0) console.log(item.name + ': 0x' + raw.toString(16));
    }

    pollAlarmFault(index + 1, count);
  });
}

function pollNext(index) {
  var item;

  if (index >= COMPONENTS.length) {
    pollAlarmFault(0, 0);
    return;
  }

  item = COMPONENTS[index];
  readHoldingRegisters(item.addr, item.qty, function(values, error) {
    var raw;
    var value;
    var line;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < item.qty) {
      console.log(item.name + ': invalid response');
    } else {
      raw = decodeValue(values, item.itype);
      value = raw * item.scale;

      line = item.name + ': ' + value;
      if (item.unit) line += ' [' + item.unit + ']';
      if (item.isState) line += ' (' + stateName(raw) + ')';
      console.log(line);

      if (item.role && vc[item.role]) vc[item.role].setValue(item.isState ? raw : value);
    }

    pollNext(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- Marstek VenusE Status ---');
  pollNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Marstek VenusE status MODBUS-RTU + managed Virtual Components');

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
