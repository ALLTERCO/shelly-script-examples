/* @meta {"vc":{"p0":{"type":"number","config":{"name":"Total Power","unit":"W"}},"p1":{"type":"number","config":{"name":"Battery Power","unit":"W"}},"p2":{"type":"number","config":{"name":"PV1 Power","unit":"W"}},"p3":{"type":"number","config":{"name":"Total Grid Power","unit":"W"}},"p4":{"type":"number","config":{"name":"Battery SOC","unit":"%"}},"p5":{"type":"number","config":{"name":"PV1 Voltage","unit":"V"}},"p6":{"type":"number","config":{"name":"Grid Voltage L1","unit":"V"}},"p7":{"type":"number","config":{"name":"Current L1","unit":"A"}},"p8":{"type":"number","config":{"name":"AC Frequency","unit":"Hz"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Deye"}}}} */

/**
 * @title External Display with managed Virtual Components
 * @description Reads Deye SG02LP1 inverter parameters over portable
 *   MbRtuClient RPC calls, publishes them as managed Virtual Components,
 *   and cycles each value to an external HTTP-controlled display screen.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/external_display_vc.shelly.js
 */

/**
 * Deye SG02LP1 External Display Example (Managed Virtual Components)
 *
 * Cycles through the 9 tracked parameters, one per poll, sending each to an
 * external HTTP-controlled screen (hardcoded local IP, matching the
 * original example) in addition to updating the Virtual Components.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using external_display.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - p0..p8: Total Power, Battery Power, PV1 Power, Total Grid Power,
 *   Battery SOC, PV1 Voltage, Grid Voltage L1, Current L1, AC Frequency
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
  MAX_SLAVE_ID: 247,
  DISPLAY_URL: 'http://10.101.3.185/screen',
  DISPLAY_SCREEN: 'Progress',
  SLOW_DOWN: 3
};

var ENTITIES = [
  { name: 'Total Power', units: 'W', addr: 175, itype: 'i16', scale: 1, role: 'p0' },
  { name: 'Battery Power', units: 'W', addr: 190, itype: 'i16', scale: 1, role: 'p1' },
  { name: 'PV1 Power', units: 'W', addr: 186, itype: 'u16', scale: 1, role: 'p2' },
  { name: 'Total Grid Power', units: 'W', addr: 169, itype: 'i16', scale: 10, role: 'p3' },
  { name: 'Battery SOC', units: '%', addr: 184, itype: 'u16', scale: 1, role: 'p4' },
  { name: 'PV1 Voltage', units: 'V', addr: 109, itype: 'u16', scale: 0.1, role: 'p5' },
  { name: 'Grid Voltage L1', units: 'V', addr: 150, itype: 'u16', scale: 0.1, role: 'p6' },
  { name: 'Current L1', units: 'A', addr: 164, itype: 'i16', scale: 0.01, role: 'p7' },
  { name: 'AC Frequency', units: 'Hz', addr: 192, itype: 'u16', scale: 0.01, role: 'p8' }
];

var MANAGED_ROLES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  isPolling: false,
  pollTimer: null,
  currentScene: 0,
  slowDownCounter: 0
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
// EXTERNAL DISPLAY ANIMATION
// ============================================================================

function updateDisplayAnimation(latestValues) {
  var ent = ENTITIES[state.currentScene];
  var value = latestValues[state.currentScene];
  var unit = ent.name.replace(' ', '');
  var url;

  if (value !== undefined) {
    url = CONFIG.DISPLAY_URL + '?screen=' + CONFIG.DISPLAY_SCREEN +
      '&value=' + (value + ent.units) + '&unit=' + unit;
    Shelly.call('HTTP.GET', { url: url }, function(res) {
      if (res && res.code !== 200) {
        console.log('HTTP failed:', JSON.stringify(res));
      }
    });
  }

  if (state.slowDownCounter >= CONFIG.SLOW_DOWN) {
    state.currentScene++;
    state.slowDownCounter = 0;
  }
  if (state.currentScene >= ENTITIES.length) state.currentScene = 0;
  state.slowDownCounter++;
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function pollNext(index, latestValues) {
  var item;
  var qty;

  if (index >= ENTITIES.length) {
    updateDisplayAnimation(latestValues);
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
      console.log(item.name + ': ' + value + ' [' + item.units + ']');
      if (vc[item.role]) vc[item.role].setValue(value);
      latestValues[index] = value;
    }

    pollNext(index + 1, latestValues);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  pollNext(0, []);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Deye SG02LP1 external display example (managed VC)');

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
