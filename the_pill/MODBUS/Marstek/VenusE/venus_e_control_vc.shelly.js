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
  DEBUG: false,
};

var REG = {
  SOC: 32104,
  BATTERY_POWER: 32102,
  INVERTER_STATE: 35100,
  RS485_CONTROL: 42000,
  CONTROL_COMMAND: 42010,
  CHARGE_POWER: 42020,
  DISCHARGE_POWER: 42021,
};

var COMPONENTS = {
  group: 'group:220',
  soc: 'number:220',
  batteryPower: 'number:221',
  inverterState: 'number:222',
  controlPower: 'number:223',
  forceCharge: 'button:220',
  stop: 'button:221',
  discharge: 'button:222',
};

var TELEMETRY = [
  { name: 'Battery SOC', addr: REG.SOC, qty: 1, type: 'u16', scale: 1, handle: null },
  { name: 'Battery Power', addr: REG.BATTERY_POWER, qty: 2, type: 's32', scale: 1, handle: null },
  { name: 'Inverter State', addr: REG.INVERTER_STATE, qty: 1, type: 'u16', scale: 1, handle: null },
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
  controlRetryTimer: null,
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
    qty & 0xFF,
  ]);
}

function buildWriteFrame(addr, value) {
  return addCRC([
    CONFIG.SLAVE_ID & 0xFF,
    0x06,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
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
// VIRTUAL COMPONENT SETUP
// ============================================================================

function ensureComponent(type, id, config, callback) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finish() {
    var finalHandle = Virtual.getHandle(key);
    if (!finalHandle) {
      log('ERROR: no handle for ' + key);
      callback(false);
      return;
    }
    finalHandle.setConfig(config);
    callback(true);
  }

  if (handle) {
    handle.setConfig(config);
    callback(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(result, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      callback(false);
      return;
    }
    finish();
  });
}

function numberConfig(name, min, max, unit, defaultValue, persist, view) {
  return {
    name: name,
    default_value: defaultValue,
    min: min,
    max: max,
    meta: {
      ui: {
        view: view,
        unit: unit,
        step: 1,
      },
      persist: persist,
    },
  };
}

function buttonConfig(name, icon) {
  return {
    name: name,
    meta: {
      ui: {
        view: 'button',
        icon: icon,
      },
      cloud: [],
    },
  };
}

function setupComponents(done) {
  var specs = [
    { type: 'group', id: 220, config: { name: 'Marstek VenusE Control' } },
    { type: 'number', id: 220, config: numberConfig('Battery SOC', 0, 100, '%', 0, false, 'progressbar') },
    { type: 'number', id: 221, config: numberConfig('Battery Power', -2500, 2500, 'W', 0, false, 'label') },
    { type: 'number', id: 222, config: numberConfig('Inverter State', 0, 6, '', 0, false, 'label') },
    { type: 'number', id: 223, config: numberConfig('Control Power', CONFIG.MIN_POWER, CONFIG.MAX_POWER, 'W', CONFIG.DEFAULT_POWER, true, 'slider') },
    { type: 'button', id: 220, config: buttonConfig('Force Charge', 'mdi:battery-charging') },
    { type: 'button', id: 221, config: buttonConfig('Stop', 'mdi:stop-circle-outline') },
    { type: 'button', id: 222, config: buttonConfig('Discharge', 'mdi:battery-arrow-down-outline') },
  ];

  function next(index) {
    if (index >= specs.length) {
      TELEMETRY[0].handle = Virtual.getHandle(COMPONENTS.soc);
      TELEMETRY[1].handle = Virtual.getHandle(COMPONENTS.batteryPower);
      TELEMETRY[2].handle = Virtual.getHandle(COMPONENTS.inverterState);
      state.powerHandle = Virtual.getHandle(COMPONENTS.controlPower);
      setGroupMembers(done);
      return;
    }

    ensureComponent(specs[index].type, specs[index].id, specs[index].config, function() {
      Timer.set(80, false, function() {
        next(index + 1);
      });
    });
  }

  next(0);
}

function setGroupMembers(done) {
  var members = [
    COMPONENTS.soc,
    COMPONENTS.batteryPower,
    COMPONENTS.inverterState,
    COMPONENTS.controlPower,
    COMPONENTS.forceCharge,
    COMPONENTS.stop,
    COMPONENTS.discharge,
  ];

  Shelly.call('Group.Set', { id: 220, value: members }, function(result, errCode, errMsg) {
    if (errCode !== 0) log('Group.Set failed: ' + errCode + ' ' + errMsg);
    done();
  });
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
    callback: callback,
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

  setupComponents(function() {
    log('Ready; default control power is ' + getControlPower() + ' W');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
