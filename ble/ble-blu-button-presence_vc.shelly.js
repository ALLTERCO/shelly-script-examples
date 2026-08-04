/**
 * @title Shelly BLU button presence watcher + Virtual Components
 * @description Tracks paired Shelly BLU button beacon presence through
 *   `bthomedevice` components and updates a self-created Boolean Virtual
 *   Component for nearby/away state.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/ble-blu-button-presence_vc.shelly.js
 */

/**
 * BLU Button Presence Watcher
 *
 * Intended for Shelly Gen3/Gen4 devices with both WiFi and Bluetooth enabled.
 * The script runs on a Shelly device that already has one or more BLU buttons
 * paired as `bthomedevice:*` components. If at least one tracked button is in
 * range, the aggregate presence Virtual Component becomes true. Only when all
 * tracked buttons are absent does it become false.
 *
 * Virtual Components created:
 * - boolean:210  Master Key Present
 * - group:211    Presence
 *
 * Configuration:
 * - Replace the sample `expectedAddr` values in `BUTTONS` with your real BLU
 *   button MAC addresses.
 * - `PRESENCE_TIMEOUT_SEC` controls how long a button remains present after its
 *   last received beacon or event.
 * - `DEVICE_ID_SCAN_START` / `DEVICE_ID_SCAN_END` define the `bthomedevice`
 *   ID range scanned for initial MAC-to-component binding.
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

var PRESENCE_TIMEOUT_SEC = 90;
var TICK_SEC = 1;
var WARN_ON_MISMATCH = true;

var DEVICE_ID_SCAN_START = 200;
var DEVICE_ID_SCAN_END = 210;

var BUTTONS = [
  {
    name: 'Master Key',
    expectedAddr: 'AA:BB:CC:DD:EE:01',
    enforceAddr: false
  },
  {
    name: 'Master Key 2',
    expectedAddr: 'AA:BB:CC:DD:EE:02',
    enforceAddr: false
  }
];

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'masterKeyPresent',
      type: 'boolean',
      id: 210,
      config: {
        name: 'Master Key Present',
        persisted: true,
        default_value: false,
        meta: {
          ui: {
            view: 'regular',
            titles: ['Away', 'Present']
          },
          cloud: ['log']
        }
      }
    }
  ],
  groups: [
    {
      id: 211,
      name: 'Presence',
      components: ['masterKeyPresent']
    }
  ]
};

// ============================================================================
// STATE
// ============================================================================

var buttonState = {};
var vcHandles = null;
var aggregatePresent = false;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  print('[blu-presence-vc] ' + msg);
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function up(s) {
  return ('' + s).toUpperCase();
}

function normMac(s) {
  var u;
  var out = '';
  var i;
  var ch;

  if (!s) return '';

  u = up(s);
  for (i = 0; i < u.length; i++) {
    ch = u.charAt(i);
    if (ch !== ':' && ch !== '-') out += ch;
  }

  return out;
}

function first() {
  var i;

  for (i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined) return arguments[i];
  }
}

function get(obj, a, b, c) {
  var value = obj;

  if (value == null) return;
  value = value[a];
  if (b === undefined) return value;
  if (value == null) return;
  value = value[b];
  if (c === undefined) return value;
  if (value == null) return;
  return value[c];
}

function extractAddr(x) {
  return first(
    x.addr, x.address, x.mac,
    get(x, 'delta', 'addr'), get(x, 'delta', 'address'), get(x, 'delta', 'mac'),
    get(x, 'status', 'addr'), get(x, 'status', 'address'), get(x, 'status', 'mac')
  ) || '';
}

function extractEventName(ev) {
  return first(ev.event, get(ev, 'info', 'event')) || '';
}

function ensureState(config) {
  var key = normMac(config.expectedAddr);

  if (!buttonState[key]) {
    buttonState[key] = {
      name: config.name,
      expectedAddr: config.expectedAddr,
      expectedAddrNorm: key,
      enforceAddr: config.enforceAddr,
      deviceId: null,
      deviceKey: '',
      lastSeenAt: 0
    };
  }

  return buttonState[key];
}

function getStateByDeviceId(deviceId) {
  var i;
  var state;

  for (i = 0; i < BUTTONS.length; i++) {
    state = ensureState(BUTTONS[i]);
    if (state.deviceId === deviceId) return state;
  }
}

function getStateByAddr(addr) {
  var normalized = normMac(addr);
  var i;
  var state;

  if (!normalized) return;

  for (i = 0; i < BUTTONS.length; i++) {
    state = ensureState(BUTTONS[i]);
    if (state.expectedAddrNorm === normalized) return state;
  }
}

function maybeWarn(state, addr) {
  var normalized;

  if (!WARN_ON_MISMATCH || !state || !state.expectedAddrNorm) return;

  normalized = normMac(addr);
  if (normalized && normalized !== state.expectedAddrNorm) {
    log(state.name + ': dropped update from ' + addr + ' (expected ' + state.expectedAddr + ')');
  }
}

function countPresentButtons() {
  var timeNow = now();
  var i;
  var state;
  var present = 0;

  for (i = 0; i < BUTTONS.length; i++) {
    state = ensureState(BUTTONS[i]);
    if (state.lastSeenAt > 0 && (timeNow - state.lastSeenAt) < PRESENCE_TIMEOUT_SEC) {
      present += 1;
    }
  }

  return present;
}

function setAggregatePresence(nextValue, reason) {
  if (aggregatePresent === nextValue) {
    return;
  }

  aggregatePresent = nextValue;

  if (!vcHandles || !vcHandles.masterKeyPresent) {
    return;
  }

  vcHandles.masterKeyPresent.setValue(nextValue);
  log('Presence is now ' + (nextValue ? 'TRUE' : 'FALSE') + ' via ' + reason);
}

function refreshAggregatePresence(reason) {
  setAggregatePresence(countPresentButtons() > 0, reason);
}

function seen(state, reason) {
  var wasAbsent = countPresentButtons() === 0;

  state.lastSeenAt = now();

  if (wasAbsent) {
    log(state.name + ' is back in range via ' + reason + '. Presence restored.');
  }

  refreshAggregatePresence(reason);
}

function bindStateToDeviceId(state, deviceId) {
  state.deviceId = deviceId;
  state.deviceKey = 'bthomedevice:' + deviceId;
}

function maybeBindState(deviceId, addr) {
  var state = getStateByAddr(addr);

  if (!state) return;
  if (state.deviceId === deviceId) return state;

  bindStateToDeviceId(state, deviceId);
  log(state.name + ': bound device id ' + deviceId + ' at ' + addr);
  return state;
}

function resolveBindings() {
  var id;
  var cfg;
  var addr;
  var state;

  for (id = DEVICE_ID_SCAN_START; id <= DEVICE_ID_SCAN_END; id++) {
    cfg = Shelly.getComponentConfig('bthomedevice', id);
    if (!cfg) continue;

    addr = cfg.addr || cfg.address || cfg.mac;
    state = maybeBindState(id, addr);
    if (state && state.enforceAddr && state.expectedAddrNorm !== normMac(addr)) {
      maybeWarn(state, addr);
    }
  }
}

function getStatusTimestamp(status) {
  return first(
    status.last_updated_ts,
    get(status, 'status', 'last_updated_ts'),
    get(status, 'delta', 'last_updated_ts')
  );
}

function initPresenceFromCurrentStatus(state) {
  var status;
  var timestamp;

  if (state.deviceId === null) return;

  status = Shelly.getComponentStatus('bthomedevice', state.deviceId);
  if (!status) return;

  timestamp = getStatusTimestamp(status);
  if (typeof timestamp === 'number' && (now() - Math.floor(timestamp)) > PRESENCE_TIMEOUT_SEC) {
    return;
  }

  seen(state, 'dev:init');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onDevStatus(ev) {
  var parts;
  var deviceId;
  var state;
  var addr;

  if (!ev || !ev.component) return;

  parts = ev.component.split(':');
  if (parts[0] !== 'bthomedevice') return;

  deviceId = parseInt(parts[1], 10);
  state = getStateByDeviceId(deviceId);
  addr = extractAddr(ev);

  if (!state) {
    state = maybeBindState(deviceId, addr);
  }

  if (!state) return;

  if (state.enforceAddr && state.expectedAddrNorm !== normMac(addr)) {
    maybeWarn(state, addr);
    return;
  }

  seen(state, 'dev:status');
}

function onDevEvent(ev) {
  var parts;
  var deviceId;
  var state;
  var addr;
  var eventName;

  if (!ev || !ev.component) return;

  eventName = extractEventName(ev);
  if (!eventName) return;

  parts = ev.component.split(':');
  if (parts[0] !== 'bthomedevice') return;

  deviceId = parseInt(parts[1], 10);
  state = getStateByDeviceId(deviceId);
  addr = extractAddr(ev);

  if (!state) {
    state = maybeBindState(deviceId, addr);
  }

  if (!state) return;

  if (state.enforceAddr && state.expectedAddrNorm !== normMac(addr)) {
    maybeWarn(state, addr);
    return;
  }

  seen(state, 'dev:event:' + eventName);
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function loop() {
  refreshAggregatePresence('tick');
}

function initStateFromCurrentStatus() {
  var i;
  var state;

  resolveBindings();

  for (i = 0; i < BUTTONS.length; i++) {
    state = ensureState(BUTTONS[i]);
    initPresenceFromCurrentStatus(state);
  }
}

function main() {
  log('Starting watcher for ' + BUTTONS.length + ' key(s)');

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      log('Virtual component setup failed');
      return;
    }

    vcHandles = readyVc.handles;
    vcHandles.masterKeyPresent.setValue(false);

    Shelly.addStatusHandler(onDevStatus);
    Shelly.addEventHandler(onDevEvent);

    initStateFromCurrentStatus();
    refreshAggregatePresence('init');

    Timer.set(TICK_SEC * 1000, true, loop);
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

main();
