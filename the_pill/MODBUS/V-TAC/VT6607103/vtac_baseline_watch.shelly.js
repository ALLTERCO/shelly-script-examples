/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher
 * @description Polls all currently known readable holding and input registers
 *   from the V-TAC VT-66036103 and compares them against embedded baseline
 *   values captured from local discovery.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/V-TAC/VT6607103/vtac_baseline_watch.shelly.js
 */

/**
 * Latest working hypotheses from live testing:
 * - 5776 (0x1690) = pv1_voltage, scale 0.1 V
 * - 5778 (0x1692) = pv2_voltage, scale 0.1 V
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5788 (0x169C) = igbt_temperature, scale 0.01 °C
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  RESPONSE_TIMEOUT: 1200,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60,
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
    { id: 299, name: 'V-TAC VT6607103 Baseline Watch Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


var BLOCKS = [
  '3,5632,12,',
  '3,5664,1,',
  '3,5674,1,',
  '3,5684,1,',
  '3,5694,1,',
  '3,5704,1,',
  '3,5714,1,',
  '3,5724,1,',
  '3,5734,1,',
  '3,5744,1,0=4',
  '3,5752,1,0=6405',
  '3,5756,3,0=7',
  '3,5760,16,',
  '3,5777,1,',
  '3,5779,5,',
  '3,5785,1,',
  '3,5787,3,0=1|1=10|2=1',
  '3,5791,1,',
  '3,5793,2,0=100',
  '3,5796,1,',
  '3,5798,4,0=240|1=540|2=240',
  '3,5804,1,',
  '3,5810,1,',
  '3,5824,8,0=7|2=9|4=7|6=10',
  '3,5873,2,',
  '3,5936,1,',
  '3,5960,1,',
];


var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0,
};

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

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
  }
  return crc;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var i;
  for (i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function fcLabel(fc) {
  return fc === 3 ? 'HOLDING' : 'INPUT';
}

function makeKey(fc, addr) {
  return fc + ':' + addr;
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function parseBlock(s) {
  var parts = s.split(',');
  return {
    fc: JSON.parse(parts[0]),
    start: JSON.parse(parts[1]),
    len: JSON.parse(parts[2]),
    nz: parts.length > 3 ? parts[3] : '',
  };
}

function baselineAt(block, offset) {
  if (block.nz === '') return 0;
  var items = block.nz.split('|');
  var i;
  for (i = 0; i < items.length; i++) {
    var kv = items[i].split('=');
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function sendRead(fc, addr, qty, callback) {
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var data = [(addr >> 8) & 0xFF, addr & 0xFF, (qty >> 8) & 0xFF, qty & 0xFF];
  var frame = buildFrame(getSlaveId(), fc, data);
  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var done = state.pendingRequest.callback;
      state.pendingRequest = null;
      done('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!state.pendingRequest || !data || data.length === 0) return;

  var i;
  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];
  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
      var excFrame = state.rxBuffer.slice(0, 5);
      var excCrc = calcCRC(excFrame.slice(0, 3));
      var excRecvCrc = excFrame[3] | (excFrame[4] << 8);
      if (excCrc === excRecvCrc) {
        clearResponseTimeout();
        var exCode = state.rxBuffer[2];
        var exDone = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        exDone('Exception: 0x' + toHex(exCode), null);
      }
    }
    return;
  }

  if (state.rxBuffer.length < 3) return;
  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimeout();

  var byteCount = frame[2];
  var values = [];
  var i;
  for (i = 0; i < byteCount; i += 2) values.push((frame[3 + i] << 8) | frame[4 + i]);

  var done = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  done(null, values);
}

function handleValue(fc, addr, baseline, raw) {
  var key = makeKey(fc, addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print('[' + fcLabel(fc) + '] CHANGED addr=' + addr + ' (0x' + toHex16(addr) + ') default=' + baseline + ' current=' + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print('[' + fcLabel(fc) + '] RESTORED addr=' + addr + ' (0x' + toHex16(addr) + ') value=' + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.fc, block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print('[V-TAC] Previous cycle still running; skipping this interval');
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    if (index >= BLOCKS.length) {
      print('[V-TAC] Cycle done: blocks=' + BLOCKS.length + ' deviations=' + state.cycleDeviations + ' errors=' + state.cycleErrors);
      print('');
      state.cycleRunning = false;
      return;
    }

    var block = parseBlock(BLOCKS[index]);
    sendRead(block.fc, block.start, block.len, function(err, values) {
      if (err) {
        state.cycleErrors++;
        print('[' + fcLabel(block.fc) + '] ERROR addr=' + block.start + ' qty=' + block.len + ' (' + err + ')');
      } else {
        processBlock(block, values);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print('[V-TAC] Starting baseline comparison cycle');
  readNext(0);
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

  print('V-TAC VT-66036103 baseline MODBUS watcher');
  print('==========================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);

  print('Baseline blocks: ' + BLOCKS.length);
  print('Polling every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, runCycle);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);

    });
}

init();
