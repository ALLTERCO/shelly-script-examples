/**
 * @title MODBUS Register Discovery Scanner
 * @description Walks a known MODBUS-RTU device register space over RS485 using
 *   single-register FC03 and FC04 reads on The Pill.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/utils/modbus_register_scan.shelly.js
 */

/**
 * Generic MODBUS Register Discovery Scanner for Shelly (The Pill)
 *
 * This utility assumes the bus parameters are already known and controlled
 * from CONFIG at the top of the file.
 *
 * It probes the target register map one address at a time with quantity 1:
 * - FC 0x03 (Read Holding Registers), configured address range
 * - FC 0x04 (Read Input Registers),   configured address range
 *
 * Output behavior:
 * - Successful reads print the register address and 16-bit value
 * - Exception and timeout counts are reported only in the final summary
 *
 * This is intentionally slow and explicit because the goal is discovery, not
 * production polling. Once useful registers are identified, use those results
 * to build a dedicated reader script.
 *
 * Current workspace configuration:
 * - Slave ID: 1
 * - Baud rate list: [9600]
 * - UART mode: 8N1
 * - Address range: 0..5000
 *
 * The Pill 5-Terminal Add-on wiring:
 *
 *                         |=============|              |==============|
 *                    /====|         VCC |              |              |
 *                    |    | GND     GND |              | SLAVE DEVICE |
 * /========\         |    | TX      +5V |              |              |
 * |The Pill|-----=||||    | RX        A |------\/------| A            |
 * \========/         |    | RE/DE     B |------/\------| B            |
 *                    |    | +5V       A |              |              |
 *                    \====|           B |              |==============|
 *                         |=============|
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATES: [9600],
  MODE: '8N1',

  FC_LIST: [0x03, 0x04],
  ADDR_START: 0,
  ADDR_END: 5000,
  QTY: 1,

  RESPONSE_TIMEOUT_MS: 400,
  INTER_FRAME_MS: 40,
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
    { id: 299, name: 'MODBUS Register Discovery Scanner Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


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

var state = {
  uart: null,
  rxBuf: [],
  pending: false,
  timer: null,
  baudIdx: 0,
  fcIdx: 0,
  addr: CONFIG.ADDR_START,
  results: {},
  readable: {},
};

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function toHex16(n) {
  return toHex((n >> 8) & 0xFF) + toHex(n & 0xFF);
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildFrame(slaveAddr, fc, addr, qty) {
  var frame = [
    slaveAddr & 0xFF,
    fc & 0xFF,
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

function clearTimer() {
  if (state.timer) {
    Timer.clear(state.timer);
    state.timer = null;
  }
}

function schedule(fn, delayMs) {
  Timer.set(delayMs, false, fn);
}

function currentFc() {
  return CONFIG.FC_LIST[state.fcIdx];
}

function currentBaud() {
  return CONFIG.BAUD_RATES[state.baudIdx];
}

function currentBucket() {
  return currentBaud() + '/0x' + toHex(currentFc());
}

function currentLabel() {
  return currentFc() === 0x03 ? 'HOLDING' : 'INPUT';
}

function currentReadableKey() {
  return currentBaud() + '_' + currentLabel().toLowerCase();
}

function currentValue16() {
  if (state.rxBuf.length < 7) return null;
  return ((state.rxBuf[3] & 0xFF) << 8) | (state.rxBuf[4] & 0xFF);
}

function printResult(status, extra) {
  var line = '[' + currentBaud() + '][' + currentLabel() + '] addr=' + state.addr + ' (0x' + toHex16(state.addr) + ') -> ' + status;
  if (extra) line += ' ' + extra;
  print(line);
}

function onData(data) {
  if (!state.pending || !data || data.length === 0) return;

  var i;
  for (i = 0; i < data.length; i++) state.rxBuf.push(data.charCodeAt(i) & 0xFF);
  checkResponse();
}

function checkResponse() {
  var len = state.rxBuf.length;
  if (len < 5) return;

  var crc = calcCRC(state.rxBuf.slice(0, len - 2));
  var recvd = state.rxBuf[len - 2] | (state.rxBuf[len - 1] << 8);
  if (crc !== recvd) return;

  clearTimer();
  state.pending = false;
  onResponse();
}

function sendRead() {
  var fc = currentFc();
  var frame = buildFrame(getSlaveId(), fc, state.addr, CONFIG.QTY);

  state.rxBuf = [];
  state.pending = true;
  state.timer = Timer.set(CONFIG.RESPONSE_TIMEOUT_MS, false, onTimeout);
  state.uart.write(bytesToStr(frame));
}

function onResponse() {
  var fc = currentFc();
  var rxFc = state.rxBuf[1];
  var bucket = state.results[currentBucket()];
  var readable;

  if (rxFc === (fc | 0x80)) {
    bucket.exception++;
  } else if (rxFc === fc && state.rxBuf[2] === 2) {
    bucket.ok++;
    readable = state.readable[currentReadableKey()];
    readable.push(state.addr);
    var value = currentValue16();
    printResult('OK', 'value=' + value + ' hex=0x' + toHex16(value));
  } else {
    bucket.exception++;
  }

  advance();
}

function onTimeout() {
  state.pending = false;
  state.rxBuf = [];
  state.results[currentBucket()].timeout++;
  advance();
}

function advance() {
  state.addr++;

  if (state.addr > CONFIG.ADDR_END) {
    state.fcIdx++;
    if (state.fcIdx >= CONFIG.FC_LIST.length) {
      state.fcIdx = 0;
      state.baudIdx++;
      if (state.baudIdx >= CONFIG.BAUD_RATES.length) {
        printSummary();
        return;
      }
      if (!state.uart.configure({ baud: currentBaud(), mode: CONFIG.MODE })) {
        print('ERROR: UART reconfigure failed');
        return;
      }
      print('');
      print('=== Switching to baud ' + currentBaud() + ' ===');
    }

    state.addr = CONFIG.ADDR_START;
    print('');
    print('--- ' + currentBaud() + ' / FC 0x' + toHex(currentFc()) + ' / ' + currentLabel() + ' REGISTERS ---');
  }

  schedule(sendRead, CONFIG.INTER_FRAME_MS);
}

function ensureResultBuckets() {
  var i;
  var j;
  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    for (j = 0; j < CONFIG.FC_LIST.length; j++) {
      var key = CONFIG.BAUD_RATES[i] + '/0x' + toHex(CONFIG.FC_LIST[j]);
      var readableKey;
      if (!state.results[key]) {
        state.results[key] = { ok: 0, exception: 0, timeout: 0 };
      }
      if (CONFIG.FC_LIST[j] === 0x03) readableKey = CONFIG.BAUD_RATES[i] + '_holding';
      else readableKey = CONFIG.BAUD_RATES[i] + '_input';
      if (!state.readable[readableKey]) {
        state.readable[readableKey] = [];
      }
    }
  }
}

function printFcSummary(baud, fc) {
  var key = baud + '/0x' + toHex(fc);
  var item = state.results[key];
  var name = fc === 0x03 ? 'Holding Registers' : 'Input Registers';

  print(name + ' (' + baud + ', 0x' + toHex(fc) + '):');
  print('  OK: ' + item.ok);
  print('  Exception: ' + item.exception);
  print('  Timeout: ' + item.timeout);
}

function printSummary() {
  var i;

  print('');
  print('========================================');
  print('MODBUS Register Discovery Summary');
  print('========================================');
  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    print('Baud ' + CONFIG.BAUD_RATES[i] + ':');
    printFcSummary(CONFIG.BAUD_RATES[i], 0x03);
    printFcSummary(CONFIG.BAUD_RATES[i], 0x04);
    print('  Readable holding addresses: ' + state.readable[CONFIG.BAUD_RATES[i] + '_holding'].length);
    print('  Readable input addresses: ' + state.readable[CONFIG.BAUD_RATES[i] + '_input'].length);
  }
  print('========================================');
}

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

  print('');
  print('MODBUS Register Discovery Scanner');
  print('=================================');
  print('Slave:   ' + getSlaveId());
  print('UART:    ' + CONFIG.BAUD_RATES.join(', ') + ' ' + CONFIG.MODE);
  print('Range:   ' + CONFIG.ADDR_START + '..' + CONFIG.ADDR_END);
  print('Qty:     ' + CONFIG.QTY);
  print('');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: currentBaud(), mode: CONFIG.MODE })) {
    print('ERROR: UART configure failed');
    return;
  }

  state.uart.recv(onData);
  ensureResultBuckets();

  print('--- ' + currentBaud() + ' / FC 0x' + toHex(currentFc()) + ' / ' + currentLabel() + ' REGISTERS ---');
  schedule(sendRead, 300);

    });
}

init();
