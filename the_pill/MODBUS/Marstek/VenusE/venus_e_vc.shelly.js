/**
 * @title Marstek VenusE MODBUS-RTU reader + Virtual Components
 * @description Reads key Marstek VenusE live MODBUS registers and
 *   updates Shelly Virtual Components for battery, AC, energy, and status data.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e_vc.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU Reader + Virtual Components
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting, UART, and Virtual
 * Components support.
 * Device compatibility: The Pill with 5-terminal RS485 add-on.
 * External hardware: Marstek Venus-E 3.0 connected through its RS485 RJ45
 * port. Use normal RJ45 pin numbering while looking into the device socket.
 *
 * Hardware Connection:
 * - Venus RJ45 pin 1 (RS485 A) -> The Pill A
 * - Venus RJ45 pin 2 (RS485 B) -> The Pill B
 * - Venus RJ45 pin 7 or 8 (GND) -> The Pill GND (recommended)
 * - Venus RJ45 pins 3 and 6 -> Leave disconnected
 * - Venus RJ45 pins 4 and 5 (+5 V) -> Leave disconnected
 *
 * Do not connect either Venus +5 V pin to The Pill. If the MODBUS bus is
 * silent, verify the RJ45 viewing orientation and wiring against this pinout;
 * do not experiment with the +5 V pins.
 *
 * Virtual Components created:
 * - group:220   Marstek VenusE
 * - number:220  Battery Voltage, 0..100 V
 * - number:221  Battery Current, -100..100 A
 * - number:222  Battery Power, -2500..2500 W
 * - number:223  Battery SOC, 0..100 %
 * - number:224  AC Voltage, 187..253 V
 * - number:225  AC Power, -2500..2500 W
 * - number:226  AC Frequency, 45..55 Hz
 * - number:227  Internal Temperature, -10..55 C
 * - number:228  Inverter State, 0..6
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This VC variant is read-only. It does not write control registers.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 115200,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
  DEBUG: false,
};

var COMPONENT_IDS = {
  group: 220,
  firstNumber: 220,
};

var ENTITIES = [
  { name: 'Battery Voltage', addr: 32100, qty: 1, type: 'u16', scale: 0.01, unit: 'V', min: 0, max: 100, vcId: 'number:220', vcHandle: null },
  { name: 'Battery Current', addr: 32101, qty: 1, type: 's16', scale: 0.01, unit: 'A', min: -100, max: 100, vcId: 'number:221', vcHandle: null },
  { name: 'Battery Power', addr: 32102, qty: 2, type: 's32', scale: 1, unit: 'W', min: -2500, max: 2500, vcId: 'number:222', vcHandle: null },
  { name: 'Battery SOC', addr: 32104, qty: 1, type: 'u16', scale: 1, unit: '%', min: 0, max: 100, vcId: 'number:223', vcHandle: null },
  { name: 'AC Voltage', addr: 32200, qty: 1, type: 'u16', scale: 0.1, unit: 'V', min: 187, max: 253, defaultValue: 230, vcId: 'number:224', vcHandle: null },
  { name: 'AC Power', addr: 32202, qty: 2, type: 's32', scale: 1, unit: 'W', min: -2500, max: 2500, vcId: 'number:225', vcHandle: null },
  { name: 'AC Frequency', addr: 32204, qty: 1, type: 'u16', scale: 0.1, unit: 'Hz', min: 45, max: 55, defaultValue: 50, vcId: 'number:226', vcHandle: null },
  { name: 'Internal Temperature', addr: 35000, qty: 1, type: 's16', scale: 0.1, unit: 'C', min: -10, max: 55, vcId: 'number:227', vcHandle: null },
  { name: 'Inverter State', addr: 35100, qty: 1, type: 'u16', scale: 1, unit: '', min: 0, max: 6, vcId: 'number:228', vcHandle: null },
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
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[venus-e-vc] ' + msg);
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

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildReadFrame(addr, qty) {
  var frame = [
    CONFIG.SLAVE_ID & 0xFF,
    0x03,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function clearResponseTimer() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function decodePayload(payload, type) {
  var raw16;
  var hi;
  var lo;
  var value;

  if (type === 'u16' || type === 's16') {
    raw16 = (payload[0] << 8) | payload[1];
    if (type === 's16' && raw16 >= 0x8000) raw16 = raw16 - 0x10000;
    return raw16;
  }

  hi = (payload[0] << 8) | payload[1];
  lo = (payload[2] << 8) | payload[3];
  value = hi * 65536 + lo;

  if (type === 's32' && value >= 2147483648) value = value - 4294967296;
  return value;
}

function scaledValue(raw, scale) {
  var value = raw * scale;
  if (scale === 0.1) return Math.round(value * 10) / 10;
  if (scale === 0.01) return Math.round(value * 100) / 100;
  if (scale === 0.001) return Math.round(value * 1000) / 1000;
  return value;
}

// ============================================================================
// VIRTUAL COMPONENT SETUP
// ============================================================================

function ensureComponent(type, id, config, cb) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finalize() {
    var finalHandle = Virtual.getHandle(key);
    if (!finalHandle) {
      log('Failed to get handle for ' + key);
      cb(false);
      return;
    }

    finalHandle.setConfig(config);
    cb(true);
  }

  if (handle) {
    handle.setConfig(config);
    cb(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      cb(false);
      return;
    }

    finalize();
  });
}

function numberConfig(entity) {
  var defaultValue = 0;
  if (entity.defaultValue !== undefined) defaultValue = entity.defaultValue;

  return {
    name: entity.name,
    default_value: defaultValue,
    min: entity.min,
    max: entity.max,
    meta: {
      ui: {
        view: 'progressbar',
        unit: entity.unit,
        step: entity.scale < 1 ? entity.scale : 1,
      },
      persist: false,
    },
  };
}

function setupComponents(done) {
  var specs = [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: { name: 'Marstek VenusE' },
    },
  ];
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    specs.push({
      type: 'number',
      id: COMPONENT_IDS.firstNumber + i,
      config: numberConfig(ENTITIES[i]),
    });
  }

  function next(index) {
    if (index >= specs.length) {
      for (i = 0; i < ENTITIES.length; i++) {
        ENTITIES[i].vcHandle = Virtual.getHandle(ENTITIES[i].vcId);
      }
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
  var members = [];
  var i;

  for (i = 0; i < ENTITIES.length; i++) members.push(ENTITIES[i].vcId);

  Shelly.call('Group.Set', { id: COMPONENT_IDS.group, value: members }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Group.Set failed: ' + errCode + ' ' + errMsg);
    }

    done();
  });
}

function updateVc(entity, raw) {
  if (!entity.vcHandle) return;
  entity.vcHandle.setValue(scaledValue(raw, entity.scale));
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRead(entity, callback) {
  if (!state.isReady) {
    callback('Not ready', null);
    return;
  }

  if (state.pendingRequest) {
    callback('Busy', null);
    return;
  }

  state.pendingRequest = { entity: entity, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (!state.pendingRequest) return;
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    cb('Timeout', null);
  });

  state.uart.write(bytesToStr(buildReadFrame(entity.addr, entity.qty)));
}

function onReceive(data) {
  var i;
  if (!data || data.length === 0) return;

  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  var fc;
  var byteCount;
  var expectedLen;
  var frame;
  var crc;
  var recvCrc;
  var payload;
  var entity;
  var cb;

  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;
  fc = state.rxBuffer[1];

  if (fc & 0x80) {
    if (state.rxBuffer.length < 5) return;
    crc = calcCRC(state.rxBuffer.slice(0, 3));
    recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (crc !== recvCrc) return;

    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('MODBUS exception', null);
    return;
  }

  byteCount = state.rxBuffer[2];
  expectedLen = 3 + byteCount + 2;
  if (state.rxBuffer.length < expectedLen) return;

  frame = state.rxBuffer.slice(0, expectedLen);
  crc = calcCRC(frame.slice(0, expectedLen - 2));
  recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimer();
  payload = frame.slice(3, 3 + byteCount);
  entity = state.pendingRequest.entity;
  cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  cb(null, decodePayload(payload, entity.type));
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  function readNext(index) {
    var entity;

    if (index >= ENTITIES.length) {
      log('Poll complete');
      return;
    }

    entity = ENTITIES[index];
    sendRead(entity, function(err, raw) {
      if (err) {
        log(entity.name + ': ERROR (' + err + ')');
      } else {
        updateVc(entity, raw);
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
  log('Marstek VenusE MODBUS-RTU reader + VC');

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

  setupComponents(function() {
    log('Polling ' + ENTITIES.length + ' registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
