/**
 * @title INNOVA AirLeaf ECA644II local controller
 * @description Self-contained Shelly Gen3 controller for INNOVA AirLeaf ECA644II
 *   fan-coil units reporting deviceType 002 over the local HTTP API.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/innova-airleaf/innova-airleaf-eca644ii_vc.shelly.js
 */

/**
 * Hardware / protocol:
 * - Shelly Gen3 device with Scripts and Dynamic Virtual Components.
 * - INNOVA AirLeaf ECA644II reachable over local IPv4 HTTP.
 * - Validated device response: deviceType "002".
 * - API base path: /api/v/1/.
 *
 * The script creates/repairs six fixed Virtual Components (IDs 200-205),
 * serializes HTTP requests, confirms accepted commands with a fresh status read,
 * ignores script-generated feedback events, and uses an independent watchdog.
 * Home Assistant is optional and not required for runtime operation.
 */

var CONFIG = {
  host: '192.168.1.123',
  pollMs: 15000,
  httpTimeoutSec: 5,
  watchdogMs: 8000
};

var API = 'http://' + CONFIG.host + '/api/v/1/';

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'power', type: 'boolean', id: 200, config: { name: 'INNOVA Power', persisted: false, default_value: false, meta: { ui: { view: 'toggle', titles: ['Off', 'On'] } } } },
    { key: 'mode', type: 'enum', id: 201, config: { name: 'INNOVA Mode', persisted: false, default_value: 'heating', options: ['heating', 'cooling'], meta: { ui: { view: 'Dropdown' } } } },
    { key: 'setpoint', type: 'number', id: 202, config: { name: 'INNOVA Set temperature', persisted: false, default_value: 22, min: 16, max: 31, meta: { ui: { view: 'field', unit: 'C', step: 0.5 } } } },
    { key: 'fan', type: 'enum', id: 203, config: { name: 'INNOVA Fan', persisted: false, default_value: 'auto', options: ['auto', 'night', 'min', 'max'], meta: { ui: { view: 'Dropdown' } } } },
    { key: 'room', type: 'number', id: 204, config: { name: 'INNOVA Room temperature', persisted: false, default_value: 0, min: -20, max: 60, meta: { ui: { view: 'label', unit: 'C', step: 0.1 } } } },
    { key: 'status', type: 'text', id: 205, config: { name: 'INNOVA Status', persisted: false, default_value: 'starting', meta: { ui: { view: 'label', maxLength: 80 } } } }
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

var V = {};
var jobs = [];
var activeJob = null;
var requestId = 0;
var activeRequestId = 0;
var watchdogTimer = null;
var last = null;

function log(message) { print('[INNOVA] ' + message); }
function setValue(handle, value) { if (handle && handle.getValue() !== value) handle.setValue(value); }
function setStatus(message) {
  message = String(message);
  if (message.length > 80) message = message.slice(0, 80);
  setValue(V.status, message);
}
function isInternal(event) { return event && typeof event.source === 'string' && event.source.indexOf('script') === 0; }
function applyStatus(status) {
  if (!status) return;
  last = status;
  if (typeof status.ps === 'number') setValue(V.power, status.ps === 1);
  if (typeof status.sp === 'number') setValue(V.setpoint, status.sp / 10);
  if (typeof status.ta === 'number') setValue(V.room, status.ta / 10);
  if (status.wm === 3) setValue(V.mode, 'heating');
  if (status.wm === 5) setValue(V.mode, 'cooling');
  if (status.fn === 1) setValue(V.fan, 'auto');
  if (status.fn === 2) setValue(V.fan, 'night');
  if (status.fn === 3) setValue(V.fan, 'min');
  if (status.fn === 4) setValue(V.fan, 'max');
}
function addJob(method, path, body, label, statusRequest) {
  if (jobs.length >= 6) { setStatus('error: command queue full'); return; }
  jobs.push({ method: method, path: path, body: body, label: label, statusRequest: statusRequest === true });
  nextJob();
}
function httpWatchdog() {
  if (activeJob === null) return;
  log(activeJob.label + ' timeout');
  activeJob = null; activeRequestId = 0; watchdogTimer = null; jobs = [];
  setStatus('timeout: INNOVA ' + CONFIG.host);
}
function httpDone(result, errorCode, errorMessage, callbackRequestId) {
  if (callbackRequestId !== activeRequestId || activeJob === null) return;
  var job = activeJob;
  var response;
  activeJob = null; activeRequestId = 0;
  if (watchdogTimer !== null) { Timer.clear(watchdogTimer); watchdogTimer = null; }
  if (errorCode !== 0 || !result || result.code !== 200) {
    var message = errorMessage || ('HTTP ' + (result ? result.code : 'no response'));
    log(job.label + ' failed: ' + message); setStatus('offline: ' + message); nextJob(); return;
  }
  try { response = JSON.parse(result.body); } catch (error) {
    log(job.label + ' invalid JSON'); setStatus('error: invalid JSON'); nextJob(); return;
  }
  if (!response || response.success !== true) {
    log(job.label + ' rejected'); setStatus('error: rejected by INNOVA'); nextJob(); return;
  }
  if (job.statusRequest) {
    if (!response.RESULT) setStatus('error: missing RESULT');
    else if (String(response.deviceType) !== '002') setStatus('error: device is not AirLeaf 002');
    else { applyStatus(response.RESULT); setStatus('online / type 002'); }
  } else {
    log(job.label + ' accepted');
    addJob('GET', 'status', null, 'status after command', true);
  }
  nextJob();
}
function nextJob() {
  if (activeJob !== null || jobs.length === 0) return;
  activeJob = jobs[0]; jobs = jobs.slice(1);
  requestId += 1; activeRequestId = requestId;
  watchdogTimer = Timer.set(CONFIG.watchdogMs, false, httpWatchdog);
  if (activeJob.method === 'GET') {
    Shelly.call('HTTP.GET', { url: API + activeJob.path, timeout: CONFIG.httpTimeoutSec }, httpDone, activeRequestId);
  } else {
    Shelly.call('HTTP.POST', {
      url: API + activeJob.path,
      body: activeJob.body === null ? '{}' : activeJob.body,
      content_type: 'application/json',
      timeout: CONFIG.httpTimeoutSec
    }, httpDone, activeRequestId);
  }
}
function poll() {
  if (activeJob === null && jobs.length === 0) addJob('GET', 'status', null, 'status', true);
}
function powerChanged(event) {
  if (isInternal(event)) return;
  addJob('POST', event.value === true ? 'power/on' : 'power/off', null, event.value === true ? 'power on' : 'power off', false);
}
function modeChanged(event) {
  if (isInternal(event)) return;
  if (event.value !== 'heating' && event.value !== 'cooling') return;
  if (!last || last.ps !== 1) addJob('POST', 'power/on', null, 'power on before mode', false);
  addJob('POST', 'set/mode/' + event.value, null, 'mode ' + event.value, false);
}
function setpointChanged(event) {
  if (isInternal(event)) return;
  var temperature = Math.round(Number(event.value) * 2) / 2;
  if (temperature < 16 || temperature > 31) { if (last) applyStatus(last); return; }
  addJob('POST', 'set/setpoint', JSON.stringify({ temp: Math.round(temperature * 10) }), 'temperature ' + String(temperature), false);
}
function fanChanged(event) {
  if (isInternal(event)) return;
  if (event.value !== 'auto' && event.value !== 'night' && event.value !== 'min' && event.value !== 'max') return;
  addJob('POST', 'set/function/' + event.value, null, 'fan ' + event.value, false);
}
function startApp(readyVc) {
  V.power = readyVc.handles.power;
  V.mode = readyVc.handles.mode;
  V.setpoint = readyVc.handles.setpoint;
  V.fan = readyVc.handles.fan;
  V.room = readyVc.handles.room;
  V.status = readyVc.handles.status;
  if (!V.power || !V.mode || !V.setpoint || !V.fan || !V.room || !V.status) {
    log('ERROR: Virtual Component handles unavailable'); return;
  }
  V.power.on('change', powerChanged);
  V.mode.on('change', modeChanged);
  V.setpoint.on('change', setpointChanged);
  V.fan.on('change', fanChanged);
  setStatus('connecting to ' + CONFIG.host);
  poll();
  Timer.set(CONFIG.pollMs, true, poll);
  log('Self-contained controller started for ' + CONFIG.host);
}
ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
  if (!ok) { print('[INNOVA] ERROR: Virtual component setup failed'); return; }
  startApp(readyVc);
});
