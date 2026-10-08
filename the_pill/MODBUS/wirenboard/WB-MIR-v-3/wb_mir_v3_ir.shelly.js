/**
 * @title WB-MIR v3 IR Utility
 * @description Dedicated MODBUS-RTU utility for WB-MIR v3 infrared functions.
 *   Supports learning IR commands to ROM or RAM, playing stored commands,
 *   dumping IR buffers, and erasing all saved IR commands.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3_ir.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - Infrared Utility for Shelly (The Pill)
 *
 * This script is dedicated to the WB-MIR v3 IR transceiver registers.
 * It does not poll temperature or button counters. Instead, it performs a
 * single IR-related operation selected in CONFIG.ACTION.
 *
 * Supported actions:
 *   - play_rom      Play a command already stored in ROM slot N
 *   - learn_rom     Learn one IR command from a remote into ROM slot N
 *   - learn_ram     Learn one IR command into RAM only, then dump the buffer
 *   - play_ram      Play the IR command currently stored in RAM buffer
 *   - dump_rom      Open ROM slot N for editing and print its raw IR buffer
 *   - erase_all_rom Delete all saved ROM IR commands
 *
 * Key IR registers from the Wirenboard IR manual:
 *   5000  Erase all ROM commands
 *   5001  Learn command into RAM
 *   5002  Play command from RAM
 *   5500  Play command from ROM by slot number
 *   5501  Open ROM command for editing in holding registers 2000+
 *   5502  Learn command into ROM by slot number
 *   2000+ Raw IR buffer in holding registers
 *
 * Notes:
 *   - Slot numbering is 1-based for the WB-MIR v3 IR command banks.
 *   - Only one IR operation can be active at a time; the device returns BUSY
 *     or an exception if another IR job is already running.
 *   - For reliable learning, point the remote at the WB-MIR receiver and press
 *     the remote button once from close range during the learn window.
 *
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *   WB-MIR IR Manual: https://wiki.wirenboard.com/wiki/WB-MSx_Consumer_IR_Manual
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N2',

  // play_rom | learn_rom | learn_ram | play_ram | dump_rom | erase_all_rom
  ACTION: 'play_rom',

  // WB-MIR IR banks are 1-based.
  ROM_SLOT: 1,

  RESPONSE_TIMEOUT: 1500,
  OP_TIMEOUT: 20000,
  POLL_INTERVAL: 250,
  LEARN_WINDOW_MS: 10000,

  BUFFER_START: 2000,
  BUFFER_CHUNK_REGS: 32,
  BUFFER_MAX_REGS: 256,

  DEBUG: true,
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
var DEFAULT_SLAVE_ID = 62;
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
    { id: 299, name: 'Wirenboard WB-MIR-v3 IR Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


/* === REGISTER MAP === */
var REG = {
  ERASE_ALL_ROM: 5000,
  LEARN_RAM: 5001,
  PLAY_RAM: 5002,
  PLAY_ROM: 5500,
  EDIT_ROM: 5501,
  LEARN_ROM: 5502,
  BUFFER_START: 2000,
};

/* === CRC-16 TABLE (MODBUS polynomial 0xA001) === */
var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

/* === STATE === */
var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  opTimer: null,
};

/* === HELPERS === */

function debug(msg) {
  if (CONFIG.DEBUG) print('[WB-MIR IR] ' + msg);
}

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) {
    s += toHex(bytes[i]);
    if (i < bytes.length - 1) s += ' ';
  }
  return s;
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xFF);
  }
  return s;
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var crc;
  var i;
  for (i = 0; i < data.length; i++) {
    frame.push(data[i] & 0xFF);
  }
  crc = calcCRC(frame);
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

function clearOpTimer() {
  if (state.opTimer) {
    Timer.clear(state.opTimer);
    state.opTimer = null;
  }
}

function fail(msg) {
  clearResponseTimer();
  clearOpTimer();
  print('[WB-MIR IR] ERROR: ' + msg);
}

/* === MODBUS CORE === */

function sendRequest(functionCode, data, callback) {
  var frame;
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  frame = buildFrame(getSlaveId(), functionCode, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { functionCode: functionCode, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    var cb;
    if (state.pendingRequest) {
      cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      cb('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  var i;
  if (!data || data.length === 0) return;
  for (i = 0; i < data.length; i++) {
    state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  }
  processResponse();
}

function processResponse() {
  var fc, expectedLen, frame, crc, recvCrc, cb, data, exCode;

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
    if (crc === recvCrc) {
      exCode = state.rxBuffer[2];
      clearResponseTimer();
      cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      state.rxBuffer = [];
      cb('Exception 0x' + toHex(exCode), null);
    }
    return;
  }

  if (fc === 0x06) {
    if (state.rxBuffer.length < 8) return;
    frame = state.rxBuffer.slice(0, 8);
    crc = calcCRC(frame.slice(0, 6));
    recvCrc = frame[6] | (frame[7] << 8);
    if (crc !== recvCrc) return;

    debug('RX: ' + bytesToHex(frame));
    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, true);
    return;
  }

  if (fc === 0x03) {
    expectedLen = 3 + state.rxBuffer[2] + 2;
    if (state.rxBuffer.length < expectedLen) return;
    frame = state.rxBuffer.slice(0, expectedLen);
    crc = calcCRC(frame.slice(0, expectedLen - 2));
    recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
    if (crc !== recvCrc) return;

    debug('RX: ' + bytesToHex(frame));
    clearResponseTimer();
    data = frame.slice(2, expectedLen - 2);
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, data);
  }
}

function writeSingleRegister(addr, value, callback) {
  var data = [
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ];
  sendRequest(0x06, data, callback);
}

function readHoldingRegisters(addr, qty, callback) {
  var data = [
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];

  sendRequest(0x03, data, function(err, response) {
    var regs = [];
    var i;
    if (err) {
      callback(err, null);
      return;
    }
    for (i = 1; i < response.length; i += 2) {
      regs.push((response[i] << 8) | response[i + 1]);
    }
    callback(null, regs);
  });
}

/* === IR HELPERS === */

function validateSlot() {
  if (CONFIG.ROM_SLOT < 1 || CONFIG.ROM_SLOT > 80) {
    fail('CONFIG.ROM_SLOT must be between 1 and 80');
    return false;
  }
  return true;
}

function monitorRegisterZero(reg, label, callback) {
  var remainingMs = CONFIG.OP_TIMEOUT;

  function poll() {
    readHoldingRegisters(reg, 1, function(err, regs) {
      var v;
      if (err) {
        callback(err);
        return;
      }
      v = regs[0];
      debug(label + ' reg ' + reg + ' = ' + v);
      if (v === 0) {
        callback(null);
        return;
      }
      if (v === 0xFFFF) {
        callback('Device reported error 0xFFFF');
        return;
      }
      remainingMs -= CONFIG.POLL_INTERVAL;
      if (remainingMs <= 0) {
        callback(label + ' timeout');
        return;
      }
      Timer.set(CONFIG.POLL_INTERVAL, false, poll);
    });
  }

  poll();
}

function findDoubleZero(buf) {
  var i;
  for (i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0) return i;
  }
  return -1;
}

function printIrBuffer(buf) {
  var term = findDoubleZero(buf);
  var last = term >= 0 ? term + 2 : buf.length;
  var i;
  print('IR buffer words: ' + last);
  for (i = 0; i < last; i++) {
    print('  [' + i + '] = ' + buf[i]);
  }
}

function dumpIrBuffer(callback) {
  var all = [];

  function readChunk(offset) {
    var addr = CONFIG.BUFFER_START + offset;
    var remaining = CONFIG.BUFFER_MAX_REGS - offset;
    var qty = remaining > CONFIG.BUFFER_CHUNK_REGS ? CONFIG.BUFFER_CHUNK_REGS : remaining;
    var i;
    var term;

    if (qty <= 0) {
      callback(null, all);
      return;
    }

    readHoldingRegisters(addr, qty, function(err, regs) {
      if (err) {
        callback(err, null);
        return;
      }

      for (i = 0; i < regs.length; i++) all.push(regs[i]);

      term = findDoubleZero(all);
      if (term >= 0 || all.length >= CONFIG.BUFFER_MAX_REGS) {
        callback(null, all);
        return;
      }

      Timer.set(50, false, function() {
        readChunk(offset + qty);
      });
    });
  }

  readChunk(0);
}

/* === ACTIONS === */

function actionPlayRom() {
  if (!validateSlot()) return;
  print('Playing IR command from ROM slot ' + CONFIG.ROM_SLOT + '...');
  writeSingleRegister(REG.PLAY_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('play_rom start failed: ' + err);
      return;
    }
    monitorRegisterZero(REG.PLAY_ROM, 'play_rom', function(err) {
      if (err) {
        fail('play_rom failed: ' + err);
        return;
      }
      print('IR playback complete.');
    });
  });
}

function actionLearnRom() {
  if (!validateSlot()) return;
  print('Learning IR command into ROM slot ' + CONFIG.ROM_SLOT + '...');
  print('Point the remote at WB-MIR and press the desired button once.');
  writeSingleRegister(REG.LEARN_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('learn_rom start failed: ' + err);
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_ROM, 0, function(stopErr) {
        if (stopErr) {
          fail('learn_rom stop failed: ' + stopErr);
          return;
        }
        print('Learn window closed for ROM slot ' + CONFIG.ROM_SLOT + '.');
      });
    });
  });
}

function actionLearnRam() {
  print('Learning IR command into RAM...');
  print('Point the remote at WB-MIR and press the desired button once.');
  writeSingleRegister(REG.LEARN_RAM, 1, function(err) {
    if (err) {
      fail('learn_ram start failed: ' + err);
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_RAM, 0, function(stopErr) {
        if (stopErr) {
          fail('learn_ram stop failed: ' + stopErr);
          return;
        }
        print('Learn window closed. Dumping RAM buffer...');
        dumpIrBuffer(function(dumpErr, buf) {
          if (dumpErr) {
            fail('buffer dump failed: ' + dumpErr);
            return;
          }
          printIrBuffer(buf);
        });
      });
    });
  });
}

function actionPlayRam() {
  print('Playing IR command from RAM buffer...');
  writeSingleRegister(REG.PLAY_RAM, 1, function(err) {
    if (err) {
      fail('play_ram start failed: ' + err);
      return;
    }
    monitorRegisterZero(REG.PLAY_RAM, 'play_ram', function(doneErr) {
      if (doneErr) {
        fail('play_ram failed: ' + doneErr);
        return;
      }
      print('RAM playback complete.');
    });
  });
}

function actionDumpRom() {
  if (!validateSlot()) return;
  print('Opening ROM slot ' + CONFIG.ROM_SLOT + ' for buffer dump...');
  writeSingleRegister(REG.EDIT_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('dump_rom open failed: ' + err);
      return;
    }

    dumpIrBuffer(function(dumpErr, buf) {
      if (dumpErr) {
        fail('dump_rom read failed: ' + dumpErr);
        return;
      }
      printIrBuffer(buf);
      writeSingleRegister(REG.EDIT_ROM, 0, function(closeErr) {
        if (closeErr) {
          fail('dump_rom close failed: ' + closeErr);
          return;
        }
        print('ROM slot ' + CONFIG.ROM_SLOT + ' closed.');
      });
    });
  });
}

function actionEraseAllRom() {
  print('Erasing all IR commands from ROM...');
  writeSingleRegister(REG.ERASE_ALL_ROM, 1, function(err) {
    if (err) {
      fail('erase_all_rom failed: ' + err);
      return;
    }
    print('All ROM IR commands erase requested.');
  });
}

/* === INIT === */

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

  print('WB-MIR v3 - IR Utility');
  print('======================');
  print('Action: ' + CONFIG.ACTION);
  print('Slave ID: ' + getSlaveId());
  print('');

  state.uart = UART.get();
  if (!state.uart) {
    fail('UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    fail('UART configure failed');
    return;
  }

  state.uart.recv(onReceive);

  Timer.set(300, false, function() {
    if (CONFIG.ACTION === 'play_rom') {
      actionPlayRom();
    } else if (CONFIG.ACTION === 'learn_rom') {
      actionLearnRom();
    } else if (CONFIG.ACTION === 'learn_ram') {
      actionLearnRam();
    } else if (CONFIG.ACTION === 'play_ram') {
      actionPlayRam();
    } else if (CONFIG.ACTION === 'dump_rom') {
      actionDumpRom();
    } else if (CONFIG.ACTION === 'erase_all_rom') {
      actionEraseAllRom();
    } else {
      fail('Unknown CONFIG.ACTION: ' + CONFIG.ACTION);
    }
  });

    });
}

init();
