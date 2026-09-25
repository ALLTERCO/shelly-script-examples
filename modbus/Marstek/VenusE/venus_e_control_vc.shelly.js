/**
 * @title Marstek VenusE charge/discharge control + Virtual Components
 * @description Monitors Marstek VenusE SOC, power, and operating state using
 *   the native Shelly ModbusController, and provides guarded Virtual
 *   Component dropdown control for charge, stop, and discharge.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_control_vc.shelly.js
 */

/**
 * Marstek VenusE Charge/Discharge Control + Virtual Components
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Components created (7 total):
 * - group:220   Marstek VenusE Control
 * - number:220  Battery SOC, 0..100 %
 * - number:221  Battery Power, -2500..2500 W
 * - text:222    Inverter State (sleep/standby/charge/discharge/backup mode/OTA upgrade/bypass)
 * - number:223  Control Power, 100..2500 W (persisted)
 * - enum:220    Charge Control - Charge / Stop / Discharge dropdown
 * - number:299  Modbus Slave ID, 1..247 (persisted)
 *
 * Control sequence (triggered by selecting a Charge Control option):
 * - Charge: write 0x55AA to 42000, power to 42020, then 1 to 42010.
 * - Stop: write 0 to 42010, then disable RS485 control with 0x55BB at 42000.
 * - Discharge: write 0x55AA to 42000, power to 42021, then 2 to 42010.
 * - Control writes use MbRtuClient.WriteSingleRegister (MODBUS FC06).
 *
 * Safety:
 * - Default control power is 500 W.
 * - Control power is clamped to 100..2500 W before every command.
 * - Control writes are spaced 1 second apart for Gen3 firmware compatibility.
 * - Only one control sequence runs at a time (a queued mode waits for the
 *   current sequence to finish).
 */

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print('[VC] ' + msg);
  }

  function componentKey(type, id) {
    return type + ':' + String(id);
  }

  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === 'meta') {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === 'object' && desired[k] !== null) {
        if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
      } else if (desired[k] !== current[k]) {
        return false;
      }
    }

    return true;
  }

  function normalizeComponent(spec) {
    if (!spec.config) spec.config = {};
    if (!spec.config.name) spec.config.name = spec.key;
    return spec;
  }

  function findExistingByName(type, name) {
    var i;
    var c;

    for (i = 0; i < state.existing.length; i++) {
      c = state.existing[i];
      if (c.type === type && c.name === name) return c;
    }

    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state.ids[spec.key] = id;
    state.keys[spec.key] = key;
    state.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    var id;

    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
        state.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log('Created ' + state.keys[spec.key] + ' ' + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        cb(true);
      });
    });
  }

  function ensureOne(spec, cb) {
    var current;
    var existing;
    var key;

    spec = normalizeComponent(spec);

    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);

      if (current) {
        if (shallowConfigMatches(spec.config, current)) {
          remember(spec, spec.id);
          cb(true);
          return;
        }

        log('Recreating mismatched ' + key + ' ' + spec.config.name);
        deleteComponent(key, function() {
          addComponent(spec, cb);
        });
        return;
      }

      addComponent(spec, cb);
      return;
    }

    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) {
      remember(spec, existing.id);
      cb(true);
      return;
    }

    if (existing) {
      log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
    }
    addComponent(spec, cb);
  }

  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) {
      cb();
      return;
    }

    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        ensureList(index + 1, cb);
      });
    });
  }

  function createGroupConfig(name) {
    return { name: name, meta: { ui: { view: 'group' } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state.keys[logicalKey]) members.push(state.keys[logicalKey]);
    }

    return members;
  }

  function ensureGroup(index, cb) {
    var groups = manifest.groups || [];
    var group;
    var cfg;
    var current;
    var key;

    if (index >= groups.length) {
      cb();
      return;
    }

    group = groups[index];
    cfg = createGroupConfig(group.name);
    key = componentKey('group', group.id);
    current = getConfig('group', group.id);

    function setMembersAndContinue() {
      Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() {
          ensureGroup(index + 1, cb);
        });
      });
    }

    function addGroup() {
      Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() {
            ensureGroup(index + 1, cb);
          });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg));
        state.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || '').split(':');
        state.existing.push({
          key: c.key || componentKey(c.type || keyParts[0], cfg.id),
          type: c.type || keyParts[0],
          id: cfg.id,
          name: cfg.name,
          config: cfg
        });
      }

      if (offset + raw.length < total && raw.length > 0) {
        readExistingPage(offset + raw.length, cb);
      } else {
        cb();
      }
    });
  }

  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() {
        done(state.ok, {
          ids: state.ids,
          keys: state.keys,
          handles: state.handles
        });
      });
    });
  });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  INTER_REQUEST_DELAY: 1000,
  POLL_INTERVAL: 5000,
  MODBUS_CLIENT_ID: 0,
  DEFAULT_POWER: 500,
  MIN_POWER: 100,
  MAX_POWER: 2500
};

var REG = {
  SOC: { addr: 32104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE },
  BATTERY_POWER: { addr: 32102, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE },
  INVERTER_STATE: { addr: 35100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE },
  RS485_CONTROL: { addr: 42000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  CONTROL_COMMAND: { addr: 42010, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  CHARGE_POWER: { addr: 42020, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  DISCHARGE_POWER: { addr: 42021, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' }
};

var TELEMETRY = [
  { key: 'soc', name: 'Battery SOC', units: '%', reg: REG.SOC, scale: 1 },
  { key: 'batteryPower', name: 'Battery Power', units: 'W', reg: REG.BATTERY_POWER, scale: 1 },
  { key: 'inverterState', name: 'Inverter State', units: '', reg: REG.INVERTER_STATE, scale: 1 }
];

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 1;
var slaveIdHandle = null;

function getSlaveId() {
  var value = DEFAULT_SLAVE_ID;

  if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
  if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
  value = Math.round(value);
  if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
  if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

  if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
    slaveIdHandle.setValue(value);
  }

  return value;
}

// MODBUS-RTU endpoint; rebuilt whenever the slave ID Virtual Component changes.
var MODBUS_ENDPOINT = null;

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), { baud: 115200, mode: '8N1' });
  registerTelemetry(MODBUS_ENDPOINT, TELEMETRY);
}

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

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function numberConfig(name, min, max, unit, defaultValue, persisted, view) {
  var ui = { view: view || 'label' };
  if (unit) ui.unit = unit;

  return {
    name: name,
    min: min,
    max: max,
    default_value: defaultValue,
    persisted: !!persisted,
    meta: { ui: ui, cloud: ['measurement'] }
  };
}

function textConfig(name, defaultValue) {
  return {
    name: name,
    default_value: defaultValue,
    persisted: false,
    meta: { ui: { view: 'label', maxLength: 32 }, cloud: ['measurement'] }
  };
}

var CHARGE_CONTROL_OPTIONS = ['Charge', 'Stop', 'Discharge'];

var OBSOLETE_COMPONENTS = [
  { key: 'number:222', name: 'Inverter State' },
  { key: 'button:220', name: 'Force Charge' },
  { key: 'button:221', name: 'Stop' },
  { key: 'button:222', name: 'Discharge' }
];

function chargeControlConfig() {
  return {
    name: 'Charge Control',
    options: CHARGE_CONTROL_OPTIONS,
    default_value: 'Stop',
    persisted: false,
    meta: { ui: { view: 'dropdown' } }
  };
}

function removeObsoleteComponents(index, done) {
  var spec;
  var keyParts;
  var config;

  if (index >= OBSOLETE_COMPONENTS.length) {
    done();
    return;
  }

  spec = OBSOLETE_COMPONENTS[index];
  keyParts = spec.key.split(':');
  config = Shelly.getComponentConfig(keyParts[0], Number(keyParts[1]));

  if (!config || config.name !== spec.name) {
    removeObsoleteComponents(index + 1, done);
    return;
  }

  console.log('Removing obsolete Virtual Component ' + spec.key + ' (' + spec.name + ')');
  Shelly.call('Virtual.Delete', { key: spec.key }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      console.log('Virtual.Delete failed for ' + spec.key + ': ' + errCode + ' ' + errMsg);
    }
    Timer.set(150, false, function() {
      removeObsoleteComponents(index + 1, done);
    });
  });
}

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'soc', type: 'number', id: 220, config: numberConfig('Battery SOC', 0, 100, '%', 0, false, 'progressbar') },
    { key: 'batteryPower', type: 'number', id: 221, config: numberConfig('Battery Power', -2500, 2500, 'W', 0, false, 'label') },
    { key: 'inverterState', type: 'text', id: 222, config: textConfig('Inverter State', 'unknown') },
    { key: 'controlPower', type: 'number', id: 223, config: numberConfig('Control Power', CONFIG.MIN_POWER, CONFIG.MAX_POWER, 'W', CONFIG.DEFAULT_POWER, true, 'slider') },
    { key: 'chargeControl', type: 'enum', id: 220, config: chargeControlConfig() },
    {
      key: 'slaveId',
      type: 'number',
      id: 299,
      config: {
        name: 'Modbus Slave ID',
        min: MIN_SLAVE_ID,
        max: MAX_SLAVE_ID,
        default_value: DEFAULT_SLAVE_ID,
        persisted: true,
        meta: { ui: { view: 'field', step: 1 }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    { id: 220, name: 'Marstek VenusE Control', components: ['soc', 'batteryPower', 'inverterState', 'controlPower', 'chargeControl', 'slaveId'] }
  ]
};

var vcHandles = null;
var chargeControlHandle = null;

var state = {
  isControlling: false,
  queuedMode: null,
  controlRetryTimer: null,
  stopRequested: false,
  stopRetryTimer: null,
  pollTimer: null
};

function getControlPower() {
  var value = CONFIG.DEFAULT_POWER;

  if (vcHandles && vcHandles.controlPower) value = Number(vcHandles.controlPower.getValue());
  if (value !== value) value = CONFIG.DEFAULT_POWER;
  value = Math.round(value);
  if (value < CONFIG.MIN_POWER) value = CONFIG.MIN_POWER;
  if (value > CONFIG.MAX_POWER) value = CONFIG.MAX_POWER;

  if (vcHandles && vcHandles.controlPower && vcHandles.controlPower.getValue() !== value) {
    vcHandles.controlPower.setValue(value);
  }

  return value;
}

// ============================================================================
// CONTROL SEQUENCE
// ============================================================================

function modbusErrorText(error) {
  if (!error) return 'unknown error';
  if (error.message !== undefined && error.code !== undefined) {
    return error.message + ' (code ' + error.code + ')';
  }
  return JSON.stringify(error);
}

function writeSingleRegister(reg, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: CONFIG.MODBUS_CLIENT_ID,
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

function finishControl(err, message) {
  state.isControlling = false;

  if (err) {
    console.log('Control error: ' + modbusErrorText(err));
  } else if (message) {
    console.log(message);
  }

  if (state.stopRequested) {
    state.stopRequested = false;
    stopControl();
    return;
  }

  if (state.queuedMode) {
    var queuedMode = state.queuedMode;
    state.queuedMode = null;
    startControl(queuedMode);
  }
}

function stopControl() {
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

  if (state.isControlling) {
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

  writeSingleRegister(REG.RS485_CONTROL, 0x55AA, function(enableSuccess, enableErr) {
    if (!enableSuccess) {
      console.log('RS485 control enable failed');
      finishControl(enableErr, '');
      return;
    }

    Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
      writeSingleRegister(powerRegister, power, function(powerSuccess, powerErr) {
        if (!powerSuccess) {
          console.log('Power setting failed');
          finishControl(powerErr, '');
          return;
        }

        Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
          writeSingleRegister(REG.CONTROL_COMMAND, command, function(commandSuccess, commandErr) {
            finishControl(commandSuccess ? null : commandErr, modeName + ' started at ' + power + ' W');
          });
        });
      });
    });
  });
}

function onChargeControlChange(event) {
  var mode = event && event.value !== undefined ? event.value : chargeControlHandle.getValue();

  console.log('Charge Control changed -> ' + mode);
  if (mode === 'Charge') startControl('charge');
  else if (mode === 'Discharge') startControl('discharge');
  else if (mode === 'Stop') stopControl();
  else console.log('Ignoring unsupported Charge Control value: ' + mode);
}

// ============================================================================
// TELEMETRY
// ============================================================================

function registerTelemetry(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

function poll() {
  var i;
  var item;
  var raw;
  var value;

  if (state.isControlling) return;

  for (i = 0; i < TELEMETRY.length; i++) {
    item = TELEMETRY[i];
    raw = item.entity.getValue();
    value = raw * item.scale;

    console.log(item.name + ': ' + value + (item.units ? ' [' + item.units + ']' : ''));
    if (item.reg === REG.INVERTER_STATE) {
      value = stateName(raw);
      console.log('Inverter state: ' + raw + ' (' + value + ')');
    }

    if (vcHandles && vcHandles[item.key]) {
      vcHandles[item.key].setValue(value);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Marstek VenusE charge/discharge control + VC');

  removeObsoleteComponents(0, function() {
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
      if (!ok) {
        console.log('ERROR: Virtual component setup failed');
        return;
      }

      vcHandles = readyVc.handles;
      slaveIdHandle = readyVc.handles.slaveId;
      chargeControlHandle = readyVc.handles.chargeControl;

      rebuildModbusEndpoint();
      slaveIdHandle.on('change', function() {
        console.log('Modbus Slave ID changed -> ' + getSlaveId());
        rebuildModbusEndpoint();
      });
      chargeControlHandle.on('change', onChargeControlChange);

      console.log('Ready; default control power is ' + getControlPower() + ' W');
      Timer.set(500, false, poll);
      state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
    });
  });
}

init();
