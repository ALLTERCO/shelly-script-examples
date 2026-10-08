/**
 * @title LG THERMA V Modbus bridge for Shelly Pro EM-50
 * @description Self-contained RS-485/Modbus RTU bridge for compatible LG THERMA V
 *   heat pumps using Shelly Pro EM-50 plus Shelly Pro Modbus Add-on.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LG/lg-therma-v-pro-em50_vc.shelly.js
 */

/**
 * Hardware / protocol:
 * - Shelly Pro EM-50 with Shelly Pro Modbus Add-on.
 * - Compatible LG THERMA V with documented Modbus RTU support.
 * - Tested settings: 9600 baud, 8N1, slave ID 2, Shelly serial/client ID 100.
 *
 * Safety / scope:
 * - Verify the exact LG model service documentation before writing values.
 * - Connector names and register maps differ by THERMA V generation/PCB.
 * - The script preserves a first-read-before-write gate and confirms writes by
 *   reading the physical device back. It does not bypass LG safety logic.
 *
 * Virtual Components:
 * - Exactly 9 fixed components: boolean:200-202 and number:203-207,209.
 * - number:208 remains intentionally unused.
 */

var CFG = {
  serialId: 100,
  slaveId: 2,
  baud: 9600,
  format: '8N1',
  pollMs: 10000,
  retryMs: 10000,
  gapMs: 100,
  settleMs: 700
};

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'power', type: 'boolean', id: 200, config: { name: 'LG Power', persisted: false, default_value: false, meta: { ui: { view: 'toggle', titles: ['Off', 'On'] } } } },
    { key: 'dhw', type: 'boolean', id: 201, config: { name: 'LG DHW', persisted: false, default_value: false, meta: { ui: { view: 'toggle', titles: ['Off', 'On'] } } } },
    { key: 'silent', type: 'boolean', id: 202, config: { name: 'LG Silent Mode', persisted: false, default_value: false, meta: { ui: { view: 'toggle', titles: ['Off', 'On'] } } } },
    { key: 'heatTarget', type: 'number', id: 203, config: { name: 'LG Heating Target', persisted: false, default_value: 35, min: 10, max: 65, meta: { ui: { view: 'field', unit: 'C', step: 0.5 } } } },
    { key: 'dhwTarget', type: 'number', id: 204, config: { name: 'LG DHW Target', persisted: false, default_value: 50, min: 25, max: 70, meta: { ui: { view: 'field', unit: 'C', step: 0.5 } } } },
    { key: 'inlet', type: 'number', id: 205, config: { name: 'LG Inlet Temperature', persisted: false, default_value: 0, min: -50, max: 100, meta: { ui: { view: 'label', unit: 'C', step: 0.1 } } } },
    { key: 'outlet', type: 'number', id: 206, config: { name: 'LG Outlet Temperature', persisted: false, default_value: 0, min: -50, max: 100, meta: { ui: { view: 'label', unit: 'C', step: 0.1 } } } },
    { key: 'dhwTemp', type: 'number', id: 207, config: { name: 'LG DHW Temperature', persisted: false, default_value: 0, min: -50, max: 100, meta: { ui: { view: 'label', unit: 'C', step: 0.1 } } } },
    { key: 'error', type: 'number', id: 209, config: { name: 'LG Error Code', persisted: false, default_value: 0, min: 0, max: 65535, meta: { ui: { view: 'label', step: 1 } } } }
  ]
};

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state = { existing: [], ids: {}, keys: {}, handles: {}, ok: true };

  function log(msg) { print('[VC] ' + msg); }
  function componentKey(type, id) { return type + ':' + String(id); }
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
    var i, c;
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
  function getConfig(type, id) { return Shelly.getComponentConfig(type, id); }
  function deleteComponent(key, cb) {
    Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }
  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;
    Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
      var id;
      if (errCode !== 0) {
        log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
        state.ok = false; cb(false); return;
      }
      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state.ok = false; cb(false); return;
      }
      remember(spec, id);
      log('Created ' + state.keys[spec.key] + ' ' + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() { cb(true); });
    });
  }
  function ensureOne(spec, cb) {
    var current, existing, key;
    spec = normalizeComponent(spec);
    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);
      if (current) {
        if (shallowConfigMatches(spec.config, current)) { remember(spec, spec.id); cb(true); return; }
        log('Recreating mismatched ' + key + ' ' + spec.config.name);
        deleteComponent(key, function() { addComponent(spec, cb); });
        return;
      }
      addComponent(spec, cb); return;
    }
    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) { remember(spec, existing.id); cb(true); return; }
    if (existing) log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
    addComponent(spec, cb);
  }
  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) { cb(); return; }
    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureList(index + 1, cb); });
    });
  }
  function createGroupConfig(name) { return { name: name, meta: { ui: { view: 'group' } } }; }
  function groupMembers(group) {
    var members = [], i, logicalKey;
    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state.keys[logicalKey]) members.push(state.keys[logicalKey]);
    }
    return members;
  }
  function ensureGroup(index, cb) {
    var groups = manifest.groups || [], group, cfg, current, key;
    if (index >= groups.length) { cb(); return; }
    group = groups[index]; cfg = createGroupConfig(group.name);
    key = componentKey('group', group.id); current = getConfig('group', group.id);
    function setMembersAndContinue() {
      Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) { log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg)); state.ok = false; }
        Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
      });
    }
    function addGroup() {
      Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg)); state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); }); return;
        }
        setMembersAndContinue();
      });
    }
    if (current && shallowConfigMatches(cfg, current)) { setMembersAndContinue(); return; }
    if (current) deleteComponent(key, addGroup); else addGroup();
  }
  function readExistingPage(offset, cb) {
    Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw, total, i, c, cfg, keyParts;
      if (errCode !== 0) { log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg)); state.ok = false; cb(); return; }
      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;
      for (i = 0; i < raw.length; i++) {
        c = raw[i]; cfg = c.config || {}; keyParts = (c.key || '').split(':');
        state.existing.push({ key: c.key || componentKey(c.type || keyParts[0], cfg.id), type: c.type || keyParts[0], id: cfg.id, name: cfg.name, config: cfg });
      }
      if (offset + raw.length < total && raw.length > 0) readExistingPage(offset + raw.length, cb); else cb();
    });
  }
  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() { done(state.ok, { ids: state.ids, keys: state.keys, handles: state.handles }); });
    });
  });
}

var C = [
  ['Boolean', 200, 'Power', 0],
  ['Boolean', 201, 'DHW', 1],
  ['Boolean', 202, 'Silent', 2],
  ['Number', 203, 'Heating target', 2, 10, 65],
  ['Number', 204, 'DHW target', 8, 25, 70],
  ['Number', 205, 'Inlet', 2, -50, 100],
  ['Number', 206, 'Outlet', 3, -50, 100],
  ['Number', 207, 'DHW temperature', 5, -50, 100],
  ['Number', 209, 'Error code', 0, 0, 65535]
];
var READS = [
  ['ReadCoils', 0, 3],
  ['ReadHoldingRegisters', 2, 1],
  ['ReadHoldingRegisters', 8, 1],
  ['ReadInputRegisters', 0, 6]
];
var ready = false;
var baseline = [];
var observed = [];
var actual = [];
var readIndex = 0;
var controlIndex = 0;
var publishIndex = 0;
var lastFault = '';
var lastErrorCode = null;

function later(fn, ms) { Timer.set(typeof ms === 'number' ? ms : CFG.gapMs, false, fn); }
function equal(a, b) {
  if (typeof a !== typeof b) return false;
  if (typeof a === 'boolean') return a === b;
  return typeof a === 'number' && Math.abs(a - b) < 0.001;
}
function word(v) { return typeof v === 'number' && v >= 0 && v <= 65535 && v === Math.floor(v); }
function signed(v) { return v > 32767 ? v - 65536 : v; }
function valid(i, v) {
  if (i < 3) return typeof v === 'boolean';
  return typeof v === 'number' && v >= C[i][4] && v <= C[i][5];
}
function uiValue(i) {
  var s = Shelly.getComponentStatus(C[i][0].toLowerCase(), C[i][1]);
  return s ? s.value : undefined;
}
function fault(message) {
  ready = false; baseline = [];
  if (message !== lastFault) print('[LG] PAUSED: ' + message + '. Writes blocked; retrying.');
  lastFault = message; later(begin, CFG.retryMs);
}
function call(method, params, done) {
  Shelly.call(method, params, function(r, e, m) { later(function() { done(r, e, m); }, 1); });
}
function mb(method, addr, qty, done) {
  call('MbRtuClient.' + method, { id: CFG.serialId, sid: CFG.slaveId, addr: addr, qty: qty }, done);
}
function begin() {
  var i;
  for (i = 0; i < C.length; i++) {
    if (!valid(i, uiValue(i))) { fault('Missing/invalid ' + C[i][0] + ':' + C[i][1]); return; }
  }
  call('Serial.GetConfig', { id: CFG.serialId }, function(r, e, m) {
    if (e !== 0 || !r) { fault('Serial configuration: ' + m); return; }
    if (r.mode === 'mb_client' && r.serial && r.serial.baud === CFG.baud && r.serial.format === CFG.format) { startRead(); return; }
    ready = false;
    call('Serial.SetConfig', { id: CFG.serialId, config: { mode: 'mb_client', serial: { baud: CFG.baud, format: CFG.format } } }, function(r2, e2, m2) {
      if (e2 !== 0) { fault('Serial setup: ' + m2); return; }
      if (r2 && r2.restart_required) { fault('Shelly reboot required'); return; }
      later(startRead, 500);
    });
  });
}
function startRead() { actual = []; readIndex = 0; later(readNext); }
function readNext() {
  var i, j, q, v;
  if (readIndex === READS.length) {
    for (i = 0; i < C.length; i++) {
      if (!valid(i, actual[i])) { fault('LG value outside configured range: ' + C[i][2]); return; }
    }
    observed = [];
    for (j = 0; j < 5; j++) {
      observed[j] = uiValue(j);
      if (!valid(j, observed[j])) { fault('Invalid control: ' + C[j][2]); return; }
    }
    controlIndex = 0; publishIndex = 0; later(ready ? controlNext : publishNext); return;
  }
  q = READS[readIndex];
  mb(q[0], q[1], q[2], function(r, e, m) {
    if (e !== 0 || !r || !r.values || r.values.length !== q[2]) { fault(q[0] + ' @' + q[1] + ': ' + m); return; }
    v = r.values;
    for (i = 0; i < v.length; i++) {
      if (readIndex === 0 ? typeof v[i] !== 'boolean' : !word(v[i])) { fault('Malformed ' + q[0] + ' response'); return; }
    }
    if (readIndex === 0) { actual[0] = v[0]; actual[1] = v[1]; actual[2] = v[2]; }
    if (readIndex === 1) actual[3] = signed(v[0]) / 10;
    if (readIndex === 2) actual[4] = signed(v[0]) / 10;
    if (readIndex === 3) {
      actual[5] = signed(v[2]) / 10; actual[6] = signed(v[3]) / 10;
      actual[7] = signed(v[5]) / 10; actual[8] = v[0];
    }
    readIndex += 1; later(readNext);
  });
}
function controlNext() {
  var i, requested, changed, params, method;
  if (controlIndex === 5) { later(publishNext); return; }
  i = controlIndex++; requested = uiValue(i);
  if (!valid(i, requested)) { fault('Invalid command: ' + C[i][2]); return; }
  observed[i] = requested; changed = !equal(requested, baseline[i]); baseline[i] = requested;
  if (!changed || equal(requested, actual[i])) { later(controlNext); return; }
  if (i >= 3 && Math.abs(requested * 2 - Math.round(requested * 2)) > 0.001) {
    print('[LG] REJECTED ' + C[i][2] + ': use 0.5 C steps.'); later(controlNext); return;
  }
  params = { id: CFG.serialId, sid: CFG.slaveId, addr: C[i][3] };
  method = 'MbRtuClient.WriteSingleRegister';
  if (i < 3) { method = 'MbRtuClient.WriteCoils'; params.values = [requested]; }
  else params.value = Math.round(requested * 10);
  call(method, params, function(r, e, m) {
    if (e !== 0) { fault('Unconfirmed ' + C[i][2] + ': ' + m); return; }
    later(function() {
      mb(i < 3 ? 'ReadCoils' : 'ReadHoldingRegisters', C[i][3], 1, function(rr, ee, mm) {
        var raw, value;
        if (ee !== 0 || !rr || !rr.values || rr.values.length !== 1) { fault('Readback ' + C[i][2] + ': ' + mm); return; }
        raw = rr.values[0];
        if (i < 3 ? typeof raw !== 'boolean' : !word(raw)) { fault('Malformed readback: ' + C[i][2]); return; }
        value = i < 3 ? raw : signed(raw) / 10;
        if (!valid(i, value)) { fault('Invalid readback: ' + C[i][2]); return; }
        actual[i] = value;
        if (equal(value, requested)) print('[LG] CONFIRMED ' + C[i][2] + ' = ' + value);
        else print('[LG] NOT CONFIRMED ' + C[i][2] + ': requested ' + requested + ', LG reports ' + value);
        later(controlNext);
      });
    }, CFG.settleMs);
  });
}
function publishNext() {
  var i, current, j;
  if (publishIndex === C.length) {
    if (!ready) {
      for (j = 0; j < 5; j++) {
        if (!equal(uiValue(j), actual[j])) { fault('UI changed during synchronization'); return; }
      }
      ready = true; print('[LG] READY: 9/9 synchronized. Commands enabled.');
    }
    lastFault = '';
    if (lastErrorCode !== actual[8]) { lastErrorCode = actual[8]; print('[LG] error code = ' + lastErrorCode); }
    later(begin, CFG.pollMs); return;
  }
  i = publishIndex++; current = uiValue(i);
  if (!valid(i, current)) { fault('Component unavailable: ' + C[i][2]); return; }
  if (ready && i < 5 && !equal(current, observed[i])) { later(publishNext, 1); return; }
  if (equal(current, actual[i])) {
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1); return;
  }
  call(C[i][0] + '.Set', { id: C[i][1], value: actual[i] }, function(r, e, m) {
    if (e !== 0) { fault('UI update ' + C[i][2] + ': ' + m); return; }
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1);
  });
}
function startBridge() {
  print('[LG] self-contained bridge: 9 components; RTU ' + CFG.baud + ' ' + CFG.format + '; slave ' + CFG.slaveId);
  later(begin, 1);
}
ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
  if (!ok) { print('[LG] ERROR: Virtual component setup failed'); return; }
  if (!readyVc || !readyVc.handles.power || !readyVc.handles.error) { print('[LG] ERROR: Virtual component handles unavailable'); return; }
  startBridge();
});
