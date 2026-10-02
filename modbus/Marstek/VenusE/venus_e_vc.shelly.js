/* @meta {"vc":{"battVoltage":{"type":"number","config":{"name":"Battery Voltage","unit":"V"}},"battCurrent":{"type":"number","config":{"name":"Battery Current","unit":"A"}},"battPower":{"type":"number","config":{"name":"Battery Power","unit":"W"}},"battSoc":{"type":"number","config":{"name":"Battery SOC","unit":"%"}},"acVoltage":{"type":"number","config":{"name":"AC Voltage","unit":"V"}},"acPower":{"type":"number","config":{"name":"AC Power","unit":"W"}},"acFreq":{"type":"number","config":{"name":"AC Frequency","unit":"Hz"}},"internalTemp":{"type":"number","config":{"name":"Internal Temperature","unit":"C"}},"inverterState":{"type":"number","config":{"name":"Inverter State"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Marstek"}}}} */

/**
 * @title Marstek VenusE MODBUS-RTU + managed Virtual Components
 * @description Reads live battery, AC, energy, temperature, state, alarm, and
 *   limit registers from a Marstek VenusE device over MODBUS-RTU using
 *   portable MbRtuClient RPC calls. Exposes the 9 most valuable parameters
 *   plus a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_vc.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU + Managed Virtual Components
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using venus_e_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - battVoltage, battCurrent, battPower, battSoc: battery telemetry
 * - acVoltage, acPower, acFreq: AC-side telemetry
 * - internalTemp: internal temperature
 * - inverterState: raw inverter state code (0..6)
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 10 value/config components
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Per-role
 * min/max/persisted metadata is intentionally omitted from the curated
 * telemetry roles to stay inside that budget - only the Modbus Slave ID
 * keeps its full range/persistence/role metadata. Every other register
 * (alarm/fault words, limits, offgrid readings) is printed to the console
 * every poll instead of being promoted to a Virtual Component.
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

var ENTITIES = [
  { name: 'Battery Voltage', units: 'V', addr: 32100, qty: 1, itype: 'u16', scale: 0.01, role: 'battVoltage' },
  { name: 'Battery Current', units: 'A', addr: 32101, qty: 1, itype: 'i16', scale: 0.01, role: 'battCurrent' },
  { name: 'Battery Power', units: 'W', addr: 32102, qty: 2, itype: 'i32', scale: 1, role: 'battPower' },
  { name: 'Battery SOC', units: '%', addr: 32104, qty: 1, itype: 'u16', scale: 1, role: 'battSoc' },
  { name: 'Battery Total Energy', units: 'kWh', addr: 32105, qty: 1, itype: 'u16', scale: 0.001 },
  { name: 'AC Voltage', units: 'V', addr: 32200, qty: 1, itype: 'u16', scale: 0.1, role: 'acVoltage' },
  { name: 'AC Power', units: 'W', addr: 32202, qty: 2, itype: 'i32', scale: 1, role: 'acPower' },
  { name: 'AC Frequency', units: 'Hz', addr: 32204, qty: 1, itype: 'u16', scale: 0.1, role: 'acFreq' },
  { name: 'AC Offgrid Voltage', units: 'V', addr: 32300, qty: 1, itype: 'u16', scale: 0.1 },
  { name: 'AC Offgrid Power', units: 'W', addr: 32302, qty: 2, itype: 'i32', scale: 1 },
  { name: 'Daily Charging Energy', units: 'kWh', addr: 33004, qty: 2, itype: 'u32', scale: 0.01 },
  { name: 'Daily Discharging Energy', units: 'kWh', addr: 33006, qty: 2, itype: 'u32', scale: 0.01 },
  { name: 'Internal Temperature', units: 'C', addr: 35000, qty: 1, itype: 'i16', scale: 0.1, role: 'internalTemp' },
  { name: 'Max Cell Temperature', units: 'C', addr: 35010, qty: 1, itype: 'i16', scale: 0.1 },
  { name: 'Min Cell Temperature', units: 'C', addr: 35011, qty: 1, itype: 'i16', scale: 0.1 },
  { name: 'Inverter State', units: '', addr: 35100, qty: 1, itype: 'u16', scale: 1, isState: true, role: 'inverterState' },
  { name: 'Alarm Word 36000', units: '', addr: 36000, qty: 1, itype: 'u16', scale: 1, bits: 'alarm36000' },
  { name: 'Alarm Word 36001', units: '', addr: 36001, qty: 1, itype: 'u16', scale: 1, bits: 'alarm36001' },
  { name: 'Fault Word 36100', units: '', addr: 36100, qty: 1, itype: 'u16', scale: 1, bits: 'fault36100' },
  { name: 'Fault Word 36101', units: '', addr: 36101, qty: 1, itype: 'u16', scale: 1, bits: 'fault36101' },
  { name: 'Fault Word 36103', units: '', addr: 36103, qty: 1, itype: 'u16', scale: 1, bits: 'fault36103' },
  { name: 'Fault Word 36104', units: '', addr: 36104, qty: 1, itype: 'u16', scale: 1, bits: 'fault36104' },
  { name: 'Charge Voltage Limit', units: 'V', addr: 35110, qty: 1, itype: 'u16', scale: 0.1 },
  { name: 'Charge Current Limit', units: 'A', addr: 35111, qty: 1, itype: 'u16', scale: 0.1 },
  { name: 'Discharge Current Limit', units: 'A', addr: 35112, qty: 1, itype: 'u16', scale: 0.1 }
];

var BIT_NAMES = {
  alarm36000: [
    'PLL Abnormal Restart', 'Overtemperature Limit', 'Low Temperature Limit',
    'Fan Abnormal Warning', 'Low Battery SOC Warning', 'Output Overcurrent Warning',
    'Abnormal Line Sequence Detection'
  ],
  alarm36001: ['WIFI abnormal', 'BLE abnormal', 'Network abnormal', 'CT connection abnormal'],
  fault36100: [
    'Grid overvoltage', 'Grid undervoltage', 'Grid overfrequency', 'Grid underfrequency',
    'Grid peak voltage abnormal', 'Current Dcover', 'Voltage Dcover'
  ],
  fault36101: [
    'BAT overvoltage', 'BAT undervoltage', 'BAT overcurrent', 'BAT low SOC',
    'BAT communication failure', 'BMS protect'
  ],
  fault36103: [
    'hardware Bus overvoltage', 'hardware Output overcurrent', 'hardware trans overcurrent',
    'hardware Battery overcurrent', 'Hardware protection', 'Output overcurrent',
    'High voltage bus overvoltage', 'High voltage bus undervoltage', 'Overpower protection',
    'FSM abnormal', 'Overtemperature protection', 'Inverter soft start timeout'
  ],
  fault36104: ['self-test fault', 'eeprom fault', 'other system fault']
};

var MANAGED_ROLES = [
  'battVoltage', 'battCurrent', 'battPower', 'battSoc',
  'acVoltage', 'acPower', 'acFreq', 'internalTemp', 'inverterState',
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

function describeBits(raw, key) {
  var names = BIT_NAMES[key];
  var active = [];
  var i;

  if (!names) return '';
  for (i = 0; i < names.length; i++) {
    if (raw & (1 << i)) active.push(names[i]);
  }

  if (active.length === 0) return 'normal';
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
  var members = [
    managedComponentKey('battVoltage', 'number'),
    managedComponentKey('battCurrent', 'number'),
    managedComponentKey('battPower', 'number'),
    managedComponentKey('battSoc', 'number'),
    managedComponentKey('acVoltage', 'number'),
    managedComponentKey('acPower', 'number'),
    managedComponentKey('acFreq', 'number'),
    managedComponentKey('internalTemp', 'number'),
    managedComponentKey('inverterState', 'number'),
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

function pollNext(index) {
  var item;

  if (index >= ENTITIES.length) {
    finishPoll();
    return;
  }

  item = ENTITIES[index];
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
      if (item.units !== '') line += ' [' + item.units + ']';
      if (item.isState) line += ' (' + stateName(raw) + ')';
      if (item.bits) line += ' (' + describeBits(raw, item.bits) + ')';
      console.log(line);

      if (item.role && vc[item.role]) vc[item.role].setValue(item.isState ? raw : value);
    }

    pollNext(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- Marstek VenusE ---');
  pollNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Marstek VenusE MODBUS-RTU + managed Virtual Components');

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
