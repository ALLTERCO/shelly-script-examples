/* @meta {
  "vc": {
    "soc": {
      "type": "number",
      "config": {
        "name": "Battery SOC",
        "min": 0,
        "max": 100,
        "default_value": 0,
        "persisted": false,
        "meta": { "ui": { "view": "progressbar", "unit": "%" }, "cloud": ["measurement"] }
      }
    },
    "inverterState": {
      "type": "text",
      "config": {
        "name": "Inverter State",
        "default_value": "unknown",
        "persisted": false,
        "meta": { "ui": { "view": "label", "maxLength": 32 }, "cloud": ["measurement"] }
      }
    },
    "controlPower": {
      "type": "number",
      "config": {
        "name": "Control Power",
        "min": 100,
        "max": 2500,
        "default_value": 500,
        "persisted": true,
        "meta": { "ui": { "view": "slider", "unit": "W" }, "cloud": ["measurement"] }
      }
    },
    "chargeControl": {
      "type": "enum",
      "config": {
        "name": "Charge Control",
        "options": ["Charge", "Stop", "Discharge"],
        "default_value": "Stop",
        "persisted": false,
        "meta": { "ui": { "view": "dropdown" } }
      }
    }
  }
} */

/**
 * @title Marstek VenusE control with managed Virtual Components
 * @description Monitors and controls a Marstek VenusE through MbRtuClient RPC
 *   and script-owned Virtual Components declared in the @meta block.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_control_managed_vc.shelly.js
 */

/**
 * Marstek VenusE Control with Managed Virtual Components
 *
 * Firmware requirements: firmware with managed Virtual Component support
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using venus_e_control_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - soc: Battery state of charge
 * - inverterState: Current inverter state
 * - controlPower: Persisted charge/discharge power setting
 * - chargeControl: Charge / Stop / Discharge dropdown
 *
 * Compatibility Virtual Components created through RPC:
 * - number:299: Persisted MODBUS server ID
 * - group:200: Home-page group containing all value/control components
 *
 * Tested Pro 3EM firmware provisions only four managed roles reliably, so the
 * classic Slave ID field and dashboard group remain RPC-managed. Battery power
 * is printed to the script log.
 *
 * The firmware creates and reconciles these components before the script
 * starts. Their numeric IDs are intentionally not known or used by the script.
 * MODBUS client component ID 100 (Pro RS485 Add-on) is detected automatically;
 * other devices use client ID 0.
 * Do not run this controller together with venus_e_control_vc.shelly.js.
 *
 * Control sequence:
 * - Charge: write 0x55AA to 42000, power to 42020, then 1 to 42010.
 * - Stop: write 0 to 42010, then disable RS485 control with 0x55BB at 42000.
 * - Discharge: write 0x55AA to 42000, power to 42021, then 2 to 42010.
 * - Writes use MODBUS FC06 and are spaced one second apart.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  INTER_REQUEST_DELAY: 1000,
  POLL_INTERVAL: 5000,
  DEFAULT_POWER: 500,
  MIN_POWER: 100,
  MAX_POWER: 2500,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var REG = {
  SOC: { addr: 32104 },
  BATTERY_POWER: { addr: 32102 },
  INVERTER_STATE: { addr: 35100 },
  RS485_CONTROL: { addr: 42000 },
  CONTROL_COMMAND: { addr: 42010 },
  CHARGE_POWER: { addr: 42020 },
  DISCHARGE_POWER: { addr: 42021 }
};

var TELEMETRY = [
  { role: 'soc', name: 'Battery SOC', units: '%', reg: REG.SOC, qty: 1, type: 'u16' },
  { role: 'batteryPower', name: 'Battery Power', units: 'W', reg: REG.BATTERY_POWER, qty: 2, type: 'i32' },
  { role: 'inverterState', name: 'Inverter State', units: '', reg: REG.INVERTER_STATE, qty: 1, type: 'state' }
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var slaveIdHandle = null;
var state = {
  isControlling: false,
  isPolling: false,
  queuedMode: null,
  stopRequested: false,
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
    slaveIdHandle ? slaveIdHandle.getValue() : CONFIG.DEFAULT_SLAVE_ID,
    CONFIG.DEFAULT_SLAVE_ID,
    CONFIG.MIN_SLAVE_ID,
    CONFIG.MAX_SLAVE_ID
  );

  if (slaveIdHandle && slaveIdHandle.getValue() !== value) slaveIdHandle.setValue(value);
  return value;
}

function getControlPower() {
  var value = clampInteger(
    vc.controlPower.getValue(),
    CONFIG.DEFAULT_POWER,
    CONFIG.MIN_POWER,
    CONFIG.MAX_POWER
  );

  if (vc.controlPower.getValue() !== value) vc.controlPower.setValue(value);
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
  var roles = ['soc', 'inverterState', 'controlPower', 'chargeControl'];
  var i;

  for (i = 0; i < roles.length; i++) {
    vc[roles[i]] = Script.getVcHandle(roles[i]);
    if (!vc[roles[i]]) {
      console.log('ERROR: managed Virtual Component role not available: ' + roles[i]);
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
  var members = [
    managedComponentKey('soc', 'number'),
    managedComponentKey('inverterState', 'text'),
    managedComponentKey('controlPower', 'number'),
    'number:299',
    managedComponentKey('chargeControl', 'enum')
  ];
  var i;

  for (i = 0; i < members.length; i++) {
    if (!members[i]) {
      console.log('ERROR: cannot resolve managed dashboard member');
      return;
    }
  }

  Shelly.call('Group.Set', { id: 200, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      console.log('Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    console.log('Managed dashboard group ready');
  });
}

function ensureClassicComponents(done) {
  function ensureGroup() {
    if (Shelly.getComponentConfig('group', 200)) {
      setDashboardGroup();
      done();
      return;
    }

    Shelly.call('Virtual.Add', {
      type: 'group',
      id: 200,
      config: { name: 'Marstek VenusE Control', meta: { ui: { view: 'group' } } }
    }, function(result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        console.log('Virtual.Add group failed: ' + errorCode + ' ' + errorMessage);
        return;
      }
      setDashboardGroup();
      done();
    });
  }

  if (Shelly.getComponentConfig('number', 299)) {
    slaveIdHandle = Virtual.getHandle('number:299');
    ensureGroup();
    return;
  }

  Shelly.call('Virtual.Add', {
    type: 'number',
    id: 299,
    config: {
      name: 'Modbus Slave ID',
      min: CONFIG.MIN_SLAVE_ID,
      max: CONFIG.MAX_SLAVE_ID,
      default_value: CONFIG.DEFAULT_SLAVE_ID,
      persisted: true,
      meta: { ui: { view: 'field', step: 1 }, cloud: ['status'], role: 'modbus_id' }
    }
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      console.log('Virtual.Add Modbus Slave ID failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    slaveIdHandle = Virtual.getHandle('number:299');
    ensureGroup();
  });
}

// ============================================================================
// MODBUS RPC
// ============================================================================

function readHoldingRegisters(reg, qty, callback) {
  Shelly.call('MbRtuClient.ReadHoldingRegisters', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: reg.addr,
    qty: qty
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(null, { code: errorCode, message: errorMessage });
      return;
    }
    callback(result && result.values ? result.values : null, null);
  });
}

function writeSingleRegister(reg, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: reg.addr,
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
// CONTROL
// ============================================================================

function finishControl(error, message) {
  var queuedMode;

  state.isControlling = false;

  if (error) console.log('Control error: ' + modbusErrorText(error));
  else if (message) console.log(message);

  if (state.stopRequested) {
    state.stopRequested = false;
    stopControl();
    return;
  }

  if (state.queuedMode) {
    queuedMode = state.queuedMode;
    state.queuedMode = null;
    startControl(queuedMode);
  }
}

function stopControl() {
  if (state.isPolling) {
    state.stopRequested = true;
    console.log('Stop queued: waiting for telemetry polling');
    return;
  }

  if (state.isControlling) {
    state.stopRequested = true;
    return;
  }

  state.isControlling = true;
  writeSingleRegister(REG.CONTROL_COMMAND, 0, function(success, error) {
    if (!success) {
      finishControl(error, '');
      return;
    }

    Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
      writeSingleRegister(REG.RS485_CONTROL, 0x55BB, function(disableSuccess, disableError) {
        finishControl(disableSuccess ? null : disableError, 'Charge/discharge stopped; RS485 control released');
      });
    });
  });
}

function startControl(mode) {
  var power;
  var powerRegister;
  var command;
  var modeName;

  if (state.isControlling || state.isPolling) {
    state.queuedMode = mode;
    console.log(mode + ' queued: waiting for the current control sequence');
    return;
  }

  state.queuedMode = null;
  power = getControlPower();
  powerRegister = mode === 'charge' ? REG.CHARGE_POWER : REG.DISCHARGE_POWER;
  command = mode === 'charge' ? 1 : 2;
  modeName = mode === 'charge' ? 'Charging' : 'Discharging';
  state.isControlling = true;

  writeSingleRegister(REG.RS485_CONTROL, 0x55AA, function(enableSuccess, enableError) {
    if (!enableSuccess) {
      finishControl(enableError, '');
      return;
    }

    Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
      writeSingleRegister(powerRegister, power, function(powerSuccess, powerError) {
        if (!powerSuccess) {
          finishControl(powerError, '');
          return;
        }

        Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
          writeSingleRegister(REG.CONTROL_COMMAND, command, function(commandSuccess, commandError) {
            finishControl(commandSuccess ? null : commandError, modeName + ' started at ' + power + ' W');
          });
        });
      });
    });
  });
}

function onChargeControlChange(event) {
  var mode = event && event.value !== undefined ? event.value : vc.chargeControl.getValue();

  console.log('Charge Control changed -> ' + mode);
  if (mode === 'Charge') startControl('charge');
  else if (mode === 'Discharge') startControl('discharge');
  else if (mode === 'Stop') stopControl();
  else console.log('Ignoring unsupported Charge Control value: ' + mode);
}

// ============================================================================
// TELEMETRY
// ============================================================================

function decodeTelemetry(item, values) {
  var value;

  if (!values || values.length < item.qty) return null;
  if (item.type === 'i32') {
    value = (values[0] << 16) | values[1];
  } else {
    value = values[0];
  }
  if (item.type === 'state') return stateName(value);
  return value;
}

function finishPoll() {
  var queuedMode;

  state.isPolling = false;
  if (state.stopRequested) {
    state.stopRequested = false;
    stopControl();
    return;
  }
  if (state.queuedMode) {
    queuedMode = state.queuedMode;
    state.queuedMode = null;
    startControl(queuedMode);
  }
}

function pollNext(index) {
  var item;

  if (index >= TELEMETRY.length) {
    finishPoll();
    return;
  }

  item = TELEMETRY[index];
  readHoldingRegisters(item.reg, item.qty, function(values, error) {
    var value;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else {
      value = decodeTelemetry(item, values);
      if (value === null) {
        console.log(item.name + ': invalid response');
      } else {
        console.log(item.name + ': ' + value + (item.units ? ' [' + item.units + ']' : ''));
        if (vc[item.role]) vc[item.role].setValue(value);
      }
    }
    pollNext(index + 1);
  });
}

function poll() {
  if (state.isControlling || state.isPolling) return;
  state.isPolling = true;
  pollNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Marstek VenusE control with managed Virtual Components');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 115200 8N1');
    return;
  }

  ensureClassicComponents(function() {
    slaveIdHandle.on('change', function() {
      console.log('Modbus Slave ID changed -> ' + getSlaveId());
    });
    vc.chargeControl.on('change', onChargeControlChange);

    console.log('Ready; control power is ' + getControlPower() + ' W');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
