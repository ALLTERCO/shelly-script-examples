/**
 * @title Marstek VenusE MODBUS-RTU reader
 * @description Reads live battery, AC, energy, temperature, state, alarm, and
 *   limit registers from a Marstek VenusE device over MODBUS-RTU.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU Reader
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting and UART access.
 * Device compatibility: The Pill with RS485 add-on connected to VenusE RS485.
 * External hardware: RS485 A/B pair, shared GND recommended.
 *
 * Register source:
 * - modbus marstek - address.csv
 * - modbus marstek - ex_info.csv
 * - Venus-E 3.0 485 Protocol v1.0, 2024-07-08
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This script only reads telemetry and status registers. Writable control
 *   registers from the CSV are documented in README.md but not written here.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 115200,
  MODE: '8N1',
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
  DEBUG: false,
};

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state2 = {
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

    for (i = 0; i < state2.existing.length; i++) {
      c = state2.existing[i];
      if (c.type === type && c.name === name) return c;
    }

    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state2.ids[spec.key] = id;
    state2.keys[spec.key] = key;
    state2.handles[spec.key] = Virtual.getHandle(key);
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
        state2.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state2.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log('Created ' + state2.keys[spec.key] + ' ' + spec.config.name);
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
      if (state2.keys[logicalKey]) members.push(state2.keys[logicalKey]);
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
          state2.ok = false;
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
          state2.ok = false;
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
        state2.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || '').split(':');
        state2.existing.push({
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
        done(state2.ok, {
          ids: state2.ids,
          keys: state2.keys,
          handles: state2.handles
        });
      });
    });
  });
}

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

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// This script prints all values to the console; only the Modbus Slave ID is
// backed by a Virtual Component (it is configuration, not sensor data).

var VIRTUAL_COMPONENTS = {
  components: [
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
        meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    { id: 299, name: 'Marstek VenusE Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


var ENTITIES = [
  { name: 'Battery Voltage', addr: 32100, qty: 1, type: 'u16', scale: 0.01, unit: 'V' },
  { name: 'Battery Current', addr: 32101, qty: 1, type: 's16', scale: 0.01, unit: 'A' },
  { name: 'Battery Power', addr: 32102, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'Battery SOC', addr: 32104, qty: 1, type: 'u16', scale: 1, unit: '%' },
  { name: 'Battery Total Energy', addr: 32105, qty: 1, type: 'u16', scale: 0.001, unit: 'kWh' },
  { name: 'AC Voltage', addr: 32200, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'AC Power', addr: 32202, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'AC Frequency', addr: 32204, qty: 1, type: 'u16', scale: 0.1, unit: 'Hz' },
  { name: 'AC Offgrid Voltage', addr: 32300, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'AC Offgrid Power', addr: 32302, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'Daily Charging Energy', addr: 33004, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh' },
  { name: 'Daily Discharging Energy', addr: 33006, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh' },
  { name: 'Internal Temperature', addr: 35000, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Max Cell Temperature', addr: 35010, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Min Cell Temperature', addr: 35011, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Inverter State', addr: 35100, qty: 1, type: 'u16', scale: 1, unit: '' },
  { name: 'Alarm Word 36000', addr: 36000, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'alarm36000' },
  { name: 'Alarm Word 36001', addr: 36001, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'alarm36001' },
  { name: 'Fault Word 36100', addr: 36100, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36100' },
  { name: 'Fault Word 36101', addr: 36101, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36101' },
  { name: 'Fault Word 36103', addr: 36103, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36103' },
  { name: 'Fault Word 36104', addr: 36104, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36104' },
  { name: 'Charge Voltage Limit', addr: 35110, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'Charge Current Limit', addr: 35111, qty: 1, type: 'u16', scale: 0.1, unit: 'A' },
  { name: 'Discharge Current Limit', addr: 35112, qty: 1, type: 'u16', scale: 0.1, unit: 'A' },
];

var BIT_NAMES = {
  alarm36000: [
    'PLL Abnormal Restart',
    'Overtemperature Limit',
    'Low Temperature Limit',
    'Fan Abnormal Warning',
    'Low Battery SOC Warning',
    'Output Overcurrent Warning',
    'Abnormal Line Sequence Detection',
  ],
  alarm36001: [
    'WIFI abnormal',
    'BLE abnormal',
    'Network abnormal',
    'CT connection abnormal',
  ],
  fault36100: [
    'Grid overvoltage',
    'Grid undervoltage',
    'Grid overfrequency',
    'Grid underfrequency',
    'Grid peak voltage abnormal',
    'Current Dcover',
    'Voltage Dcover',
  ],
  fault36101: [
    'BAT overvoltage',
    'BAT undervoltage',
    'BAT overcurrent',
    'BAT low SOC',
    'BAT communication failure',
    'BMS protect',
  ],
  fault36103: [
    'hardware Bus overvoltage',
    'hardware Output overcurrent',
    'hardware trans overcurrent',
    'hardware Battery overcurrent',
    'Hardware protection',
    'Output overcurrent',
    'High voltage bus overvoltage',
    'High voltage bus undervoltage',
    'Overpower protection',
    'FSM abnormal',
    'Overtemperature protection',
    'Inverter soft start timeout',
  ],
  fault36104: [
    'self-test fault',
    'eeprom fault',
    'other system fault',
  ],
};

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
  print('[venus-e] ' + msg);
}

function debug(msg) {
  if (CONFIG.DEBUG) log(msg);
}

function hexByte(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  var j;

  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    for (j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
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
    getSlaveId() & 0xFF,
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

function formatValue(value, scale) {
  var scaled = value * scale;
  if (scale === 1) return '' + scaled;
  if (scale === 0.1) return scaled.toFixed(1);
  if (scale === 0.01) return scaled.toFixed(2);
  if (scale === 0.001) return scaled.toFixed(3);
  return '' + scaled;
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

  debug('Read addr=' + entity.addr + ' qty=' + entity.qty);
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
    var exCode;
    if (state.rxBuffer.length < 5) return;
    crc = calcCRC(state.rxBuffer.slice(0, 3));
    recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (crc !== recvCrc) return;

    exCode = state.rxBuffer[2];
    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('Exception 0x' + hexByte(exCode), null);
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
  var results = [];

  function readNext(index) {
    var entity;

    if (index >= ENTITIES.length) {
      var i;
      print('--- Marstek VenusE ---');
      for (i = 0; i < results.length; i++) print(results[i]);
      print('');
      return;
    }

    entity = ENTITIES[index];
    sendRead(entity, function(err, raw) {
      var line;

      if (err) {
        results.push(entity.name + ': ERROR (' + err + ')');
      } else {
        line = entity.name + ': ' + formatValue(raw, entity.scale);
        if (entity.unit !== '') line += ' ' + entity.unit;
        line += ' raw=' + raw;
        if (entity.addr === 35100) line += ' (' + stateName(raw) + ')';
        if (entity.bits) line += ' (' + describeBits(raw, entity.bits) + ')';
        results.push(line);
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
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      print('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;
    slaveIdHandle.on('change', function() {
      debug('Slave ID changed -> ' + getSlaveId());
    });

  log('Marstek VenusE MODBUS-RTU reader');
  log('Slave=' + getSlaveId() + ' Baud=' + CONFIG.BAUD_RATE + ' Mode=' + CONFIG.MODE);

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

  log('Polling ' + ENTITIES.length + ' registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);

  });
}

init();
