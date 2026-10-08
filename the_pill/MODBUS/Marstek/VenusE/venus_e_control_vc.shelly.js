/**
 * @title Marstek VenusE charge/discharge control + Virtual Components
 * @description Monitors Marstek VenusE SOC, power, and operating state, and
 *   provides guarded Virtual Component controls for charge, stop, and discharge.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e_control_vc.shelly.js
 */

/**
 * Marstek VenusE Charge/Discharge Control + Virtual Components
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting, UART, and Virtual
 * Components support.
 * Device compatibility: The Pill with 5-terminal RS485 add-on.
 * External hardware: Marstek Venus-E 3.0 RS485 RJ45 port.
 *
 * Hardware Connection:
 * - Venus RJ45 pin 1 (RS485 A) -> The Pill A
 * - Venus RJ45 pin 2 (RS485 B) -> The Pill B
 * - Venus RJ45 pin 7 or 8 (GND) -> The Pill GND (recommended)
 * - Venus RJ45 pins 3 and 6 (NC) -> Leave disconnected
 * - Venus RJ45 pins 4 and 5 (+5 V) -> Leave disconnected
 *
 * Components created (8 total):
 * - group:220   Marstek VenusE Control
 * - number:220  Battery SOC, 0..100 %
 * - number:221  Battery Power, -2500..2500 W
 * - number:222  Inverter State, 0..6
 * - number:223  Control Power, 100..2500 W (persisted)
 * - button:220  Force Charge
 * - button:221  Stop
 * - button:222  Discharge
 *
 * Control sequence:
 * - Force Charge: write 0x55AA to 42000, power to 42020, then 1 to 42010.
 * - Stop: write 0 to 42010.
 * - Discharge: write 0x55AA to 42000, power to 42021, then 2 to 42010.
 *
 * Safety:
 * - Default control power is 500 W.
 * - Control power is clamped to 100..2500 W before every command.
 * - Only one MODBUS request or control sequence runs at a time.
 * - Every FC06 write must be echoed by the VenusE before the next write.
 * - This script leaves RS485 control enabled after Stop.
 * - Use this layout instead of the other VenusE VC scripts; The Pill supports
 *   only 10 Virtual Components total on the tested firmware.
 */

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================
//
// Usage:
//
// var VIRTUAL_COMPONENTS = {
//   components: [
//     {
//       key: "soc",
//       type: "number",
//       id: 200, // optional; when omitted the helper creates the next free one
//       config: {
//         name: "Battery SOC",
//         min: 0,
//         max: 100,
//         unit: "%",
//         meta: { ui: { view: "progressbar" }, cloud: ["measurement"] }
//       }
//     },
//     {
//       key: "status",
//       type: "text",
//       config: {
//         name: "Status",
//         default_value: "",
//         persisted: false,
//         meta: { ui: { view: "label", maxLength: 255 }, cloud: ["log"] }
//       }
//     }
//   ],
//   groups: [
//     { id: 200, name: "Battery", components: ["soc", "status"] }
//   ]
// };
//
// ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, vc) {
//   if (!ok) {
//     print("Virtual Component setup failed");
//     return;
//   }
//
//   vc.handles.soc.setValue(73);
//   vc.handles.status.setValue("ready");
// });
//
// Notes:
// - `key` is only the logical name inside your script.
// - `type` is a Shelly dynamic component type: number, boolean, text, enum,
//   button, group.
// - For fixed IDs, the helper checks whether the existing component config
//   matches. If not, it deletes and recreates it.
// - Without fixed IDs, the helper searches by type + config.name. If a matching
//   component exists and fits the config, it reuses it. If not, it creates a new
//   component and stores the assigned id.
// - The callback receives `vc.ids[key]`, `vc.keys[key]`, and `vc.handles[key]`.
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
    print("[VC] " + msg);
  }

  function componentKey(type, id) {
    return type + ":" + String(id);
  }


  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === "meta") {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === "object" && desired[k] !== null) {
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
    Shelly.call("Virtual.Delete", { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log("Virtual.Delete skipped for " + key + ": " + String(errCode) + " " + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call("Virtual.Add", params, function(res, errCode, errMsg) {
      var id;

      if (errCode !== 0) {
        log("Virtual.Add failed for " + spec.key + ": " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log("Virtual.Add did not return id for " + spec.key);
        state.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log("Created " + state.keys[spec.key] + " " + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() { cb(true); });
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

        log("Recreating mismatched " + key + " " + spec.config.name);
        deleteComponent(key, function() { addComponent(spec, cb); });
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
      log("Existing " + existing.key + " does not fit " + spec.config.name + "; creating a new one");
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
    return { name: name, meta: { ui: { view: "group" } } };
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
    key = componentKey("group", group.id);
    current = getConfig("group", group.id);

    function setMembersAndContinue() {
      Shelly.call("Group.Set", { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Group.Set failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    function addGroup() {
      Shelly.call("Virtual.Add", { type: "group", id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Virtual.Add group failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log("Shelly.GetComponents failed: " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || "").split(":");
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
  BAUD_RATE: 115200,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 5000,
  INTER_REQUEST_DELAY: 100,
  DEFAULT_POWER: 500,
  MIN_POWER: 100,
  MAX_POWER: 2500,
  DEBUG: false
};

var REG = {
  SOC: 32104,
  BATTERY_POWER: 32102,
  INVERTER_STATE: 35100,
  RS485_CONTROL: 42000,
  CONTROL_COMMAND: 42010,
  CHARGE_POWER: 42020,
  DISCHARGE_POWER: 42021
};

var COMPONENTS = {
  group: 'group:220',
  soc: 'number:220',
  batteryPower: 'number:221',
  inverterState: 'number:222',
  controlPower: 'number:223',
  forceCharge: 'button:220',
  stop: 'button:221',
  discharge: 'button:222'
};

var TELEMETRY = [
  { name: 'Battery SOC', addr: REG.SOC, qty: 1, type: 'u16', scale: 1, handle: null },
  { name: 'Battery Power', addr: REG.BATTERY_POWER, qty: 2, type: 's32', scale: 1, handle: null },
  { name: 'Inverter State', addr: REG.INVERTER_STATE, qty: 1, type: 'u16', scale: 1, handle: null }
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  isReady: false,
  isControlling: false,
  powerHandle: null,
  stopRequested: false,
  stopRetryTimer: null,
  queuedMode: null,
  controlRetryTimer: null
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[venus-e-control] ' + msg);
}

function debug(msg) {
  if (CONFIG.DEBUG) log(msg);
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  var j;

  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    for (j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc = crc >> 1;
    }
  }

  return crc & 0xFFFF;
}

function addCRC(frame) {
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function bytesToStr(bytes) {
  var str = '';
  var i;
  for (i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i] & 0xFF);
  return str;
}

function buildReadFrame(addr, qty) {
  return addCRC([
    CONFIG.SLAVE_ID & 0xFF,
    0x03,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF
  ]);
}

function buildWriteFrame(addr, value) {
  return addCRC([
    CONFIG.SLAVE_ID & 0xFF,
    0x06,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF
  ]);
}

function clearResponseTimer() {
  if (!state.responseTimer) return;
  Timer.clear(state.responseTimer);
  state.responseTimer = null;
}

function decodePayload(payload, type) {
  var high;
  var low;
  var value;

  if (type === 'u16' || type === 's16') {
    value = (payload[0] << 8) | payload[1];
    if (type === 's16' && value >= 0x8000) value = value - 0x10000;
    return value;
  }

  high = (payload[0] << 8) | payload[1];
  low = (payload[2] << 8) | payload[3];
  value = high * 65536 + low;
  if (type === 's32' && value >= 2147483648) value = value - 4294967296;
  return value;
}

function stateName(value) {
  if (value === 0) return 'sleep';
  if (value === 1) return 'standby';
  if (value === 2) return 'charging';
  if (value === 3) return 'discharging';
  if (value === 4) return 'backup';
  if (value === 5) return 'OTA upgrade';
  if (value === 6) return 'bypass';
  return 'unknown';
}

function getControlPower() {
  var value = CONFIG.DEFAULT_POWER;

  if (state.powerHandle) value = Number(state.powerHandle.getValue());
  if (value !== value) value = CONFIG.DEFAULT_POWER;
  value = Math.round(value);
  if (value < CONFIG.MIN_POWER) value = CONFIG.MIN_POWER;
  if (value > CONFIG.MAX_POWER) value = CONFIG.MAX_POWER;

  if (state.powerHandle && state.powerHandle.getValue() !== value) {
    state.powerHandle.setValue(value);
  }

  return value;
}

// ============================================================================
// VIRTUAL COMPONENT CONFIGURATION
// ============================================================================

function numberConfig(name, min, max, unit, defaultValue, persisted, view) {
  return {
    name: name,
    default_value: defaultValue,
    min: min,
    max: max,
    persisted: persisted,
    meta: {
      ui: {
        view: view,
        unit: unit,
        step: 1
      }
    }
  };
}

function buttonConfig(name, icon) {
  return {
    name: name,
    meta: {
      ui: {
        view: 'button',
        icon: icon
      },
      cloud: []
    }
  };
}

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'soc', type: 'number', id: 220, config: numberConfig('Battery SOC', 0, 100, '%', 0, false, 'progressbar') },
    { key: 'batteryPower', type: 'number', id: 221, config: numberConfig('Battery Power', -2500, 2500, 'W', 0, false, 'label') },
    { key: 'inverterState', type: 'number', id: 222, config: numberConfig('Inverter State', 0, 6, '', 0, false, 'label') },
    { key: 'controlPower', type: 'number', id: 223, config: numberConfig('Control Power', CONFIG.MIN_POWER, CONFIG.MAX_POWER, 'W', CONFIG.DEFAULT_POWER, true, 'slider') },
    { key: 'forceCharge', type: 'button', id: 220, config: buttonConfig('Force Charge', 'mdi:battery-charging') },
    { key: 'stop', type: 'button', id: 221, config: buttonConfig('Stop', 'mdi:stop-circle-outline') },
    { key: 'discharge', type: 'button', id: 222, config: buttonConfig('Discharge', 'mdi:battery-arrow-down-outline') }
  ],
  groups: [
    { id: 220, name: 'Marstek VenusE Control', components: ['soc', 'batteryPower', 'inverterState', 'controlPower', 'forceCharge', 'stop', 'discharge'] }
  ]
};

function bindVcHandles(readyVc) {
  TELEMETRY[0].handle = readyVc.handles.soc;
  TELEMETRY[1].handle = readyVc.handles.batteryPower;
  TELEMETRY[2].handle = readyVc.handles.inverterState;
  state.powerHandle = readyVc.handles.controlPower;
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRequest(request, callback) {
  var frame;

  if (!state.isReady) {
    callback('UART not ready', null);
    return;
  }
  if (state.pendingRequest) {
    callback('MODBUS busy', null);
    return;
  }

  if (request.fc === 0x03) frame = buildReadFrame(request.addr, request.qty);
  else frame = buildWriteFrame(request.addr, request.value);

  state.pendingRequest = {
    request: request,
    frame: frame,
    callback: callback
  };
  state.rxBuffer = [];
  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    var cb;
    if (!state.pendingRequest) return;
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('timeout', null);
  });

  debug('FC' + request.fc + ' addr=' + request.addr);
  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  var i;
  if (!data || data.length === 0) return;
  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  var pending;
  var request;
  var expectedLength;
  var frame;
  var crc;
  var receivedCrc;
  var payload;
  var callback;
  var value;

  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }
  if (state.rxBuffer.length < 5) return;

  pending = state.pendingRequest;
  request = pending.request;

  if (state.rxBuffer[1] & 0x80) expectedLength = 5;
  else if (request.fc === 0x06) expectedLength = 8;
  else expectedLength = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLength) return;

  frame = state.rxBuffer.slice(0, expectedLength);
  crc = calcCRC(frame.slice(0, expectedLength - 2));
  receivedCrc = frame[expectedLength - 2] | (frame[expectedLength - 1] << 8);
  if (crc !== receivedCrc) {
    state.rxBuffer.shift();
    return;
  }

  clearResponseTimer();
  callback = pending.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  if (frame[0] !== CONFIG.SLAVE_ID) {
    callback('wrong slave response', null);
    return;
  }
  if (frame[1] & 0x80) {
    callback('MODBUS exception ' + frame[2], null);
    return;
  }
  if (frame[1] !== request.fc) {
    callback('unexpected function code', null);
    return;
  }

  if (request.fc === 0x06) {
    if (frame[2] !== ((request.addr >> 8) & 0xFF) ||
        frame[3] !== (request.addr & 0xFF) ||
        frame[4] !== ((request.value >> 8) & 0xFF) ||
        frame[5] !== (request.value & 0xFF)) {
      callback('write echo mismatch', null);
      return;
    }
    callback(null, request.value);
    return;
  }

  payload = frame.slice(3, expectedLength - 2);
  value = decodePayload(payload, request.type);
  callback(null, value);
}

function readRegister(addr, qty, type, callback) {
  sendRequest({ fc: 0x03, addr: addr, qty: qty, type: type }, callback);
}

function writeRegister(addr, value, callback) {
  sendRequest({ fc: 0x06, addr: addr, value: value }, callback);
}

// ============================================================================
// CONTROL
// ============================================================================

function finishControl(err, message) {
  state.isControlling = false;
  if (err) {
    log('CONTROL ERROR: ' + err);
    return;
  }
  log(message);
  Timer.set(500, false, poll);
}

function stopControl() {
  state.queuedMode = null;
  if (state.isControlling || state.pendingRequest) {
    state.stopRequested = true;
    if (!state.stopRetryTimer) {
      log('Stop queued: waiting for the current MODBUS request');
      state.stopRetryTimer = Timer.set(150, false, function() {
        state.stopRetryTimer = null;
        stopControl();
      });
    }
    return;
  }

  state.stopRequested = false;
  state.isControlling = true;
  writeRegister(REG.CONTROL_COMMAND, 0, function(err) {
    finishControl(err, 'Charge/discharge stopped');
  });
}

function startControl(mode) {
  var power;
  var powerRegister;
  var command;
  var modeName;

  if (state.isControlling || state.pendingRequest) {
    state.queuedMode = mode;
    if (!state.controlRetryTimer) {
      log(mode + ' queued: waiting for the current MODBUS request');
      state.controlRetryTimer = Timer.set(150, false, function() {
        var queuedMode = state.queuedMode;
        state.controlRetryTimer = null;
        if (!queuedMode) return;
        state.queuedMode = null;
        startControl(queuedMode);
      });
    }
    return;
  }

  state.queuedMode = null;
  power = getControlPower();
  powerRegister = mode === 'charge' ? REG.CHARGE_POWER : REG.DISCHARGE_POWER;
  command = mode === 'charge' ? 1 : 2;
  modeName = mode === 'charge' ? 'Charging' : 'Discharging';
  state.isControlling = true;

  writeRegister(REG.RS485_CONTROL, 0x55AA, function(enableErr) {
    if (enableErr) {
      finishControl('RS485 control enable failed: ' + enableErr, '');
      return;
    }

    Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
      writeRegister(powerRegister, power, function(powerErr) {
        if (powerErr) {
          finishControl('Power setting failed: ' + powerErr, '');
          return;
        }

        Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
          writeRegister(REG.CONTROL_COMMAND, command, function(commandErr) {
            finishControl(commandErr, modeName + ' started at ' + power + ' W');
          });
        });
      });
    });
  });
}

function onEvent(event) {
  var action;

  action = event.name;
  if (event.info && event.info.event) action = event.info.event;
  if (action !== 'single_push' && action !== 'push') return;

  if (event.component === COMPONENTS.forceCharge) startControl('charge');
  else if (event.component === COMPONENTS.stop) stopControl();
  else if (event.component === COMPONENTS.discharge) startControl('discharge');
}

// ============================================================================
// TELEMETRY
// ============================================================================

function poll() {
  function readNext(index) {
    var item;

    if (state.isControlling || state.pendingRequest) return;
    if (index >= TELEMETRY.length) {
      debug('Poll complete');
      return;
    }

    item = TELEMETRY[index];
    readRegister(item.addr, item.qty, item.type, function(err, raw) {
      if (err) {
        log(item.name + ': ERROR (' + err + ')');
      } else {
        if (item.handle) item.handle.setValue(raw * item.scale);
        if (item.addr === REG.INVERTER_STATE) {
          debug('Inverter state: ' + raw + ' (' + stateName(raw) + ')');
        }
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  readNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Marstek VenusE charge/discharge control + VC');

  state.uart = UART.get();
  if (!state.uart) {
    log('ERROR: UART not available');
    return;
  }
  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    log('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;
  Shelly.addEventHandler(onEvent);

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      log('ERROR: Virtual component setup failed');
      return;
    }

    bindVcHandles(readyVc);
    log('Ready; default control power is ' + getControlPower() + ' W');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
