/**
 * @title Mitsubishi Heavy AC control via Tasmota IR bridge
 * @description Creates Virtual Components for Mitsubishi Heavy HVAC control
 *   and sends IRHVAC commands to one or more Tasmota IR bridges over HTTP.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js
 */

/**
 * Mitsubishi Heavy AC Virtual Components Controller
 *
 * This script builds a Shelly-side control panel for one or more Mitsubishi
 * Heavy indoor units controlled through Tasmota IR bridges.
 *
 * Workflow:
 * - Creates Virtual Components for power, mode, fan, temperature, swing, and target
 * - Lets the user change values in the Shelly app
 * - Sends the selected state only when the Apply button is pressed
 *
 * Tasmota requirements:
 * - Each target IP must be reachable from the Shelly device
 * - The target device must expose the Tasmota command endpoint `/cm`
 * - The IR bridge must support the `IRHVAC` command for
 *   `MITSUBISHI_HEAVY_88`
 *
 * Virtual Components created:
 * - group:208    Mitsubishi Heavy AC
 * - boolean:200  AC Power
 * - enum:202     AC Mode
 * - enum:203     AC Fan
 * - number:204   AC Temp
 * - enum:205     AC Swing V
 * - button:206   Apply HVAC
 * - enum:209     IR Target
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

var TASMOTA_CM_PATH = '/cm?cmnd=';

var IR_TARGETS = ['Zone 1', 'Zone 2', 'All'];

var IR_TARGET_IPS = {
  'Zone 1': '192.0.2.10',
  'Zone 2': '192.0.2.11'
};

var COMPONENT_IDS = {
  power: 200,
  mode: 202,
  fan: 203,
  temp: 204,
  swingV: 205,
  apply: 206,
  group: 208,
  target: 209
};

var DEFAULTS = {
  power: true,
  mode: 'Heat',
  fan: 'Auto',
  temp: 20,
  swingV: 'Auto',
  target: 'Zone 2'
};

var MODES = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
var FAN_SPEEDS = ['Auto', 'Min', 'Low', 'Med', 'High', 'Max'];
var SWING_V = ['Off', 'Auto', 'Min', 'Low', 'Mid', 'High', 'Max'];

var LEGACY_COMPONENT_KEYS = [
  'enum:204',
  'boolean:202',
  'boolean:201',
  'text:207',
  'button:210'
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  print('[mitsubishi-heavy-ac-vc] ' + msg);
}

function setStatus(msg) {
  log(msg);
}

function readValue(handle, fallback) {
  var value;

  if (!handle) return fallback;

  value = handle.getValue();
  if (value === null || value === undefined) return fallback;

  return value;
}

function toHex(code) {
  var hex = code.toString(16).toUpperCase();
  return hex.length < 2 ? '0' + hex : hex;
}

function urlEncode(str) {
  var out = '';
  var i;
  var ch;
  var code;

  for (i = 0; i < str.length; i++) {
    ch = str.charAt(i);
    code = str.charCodeAt(i);

    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      ch === '-' ||
      ch === '_' ||
      ch === '.' ||
      ch === '~'
    ) {
      out += ch;
    } else {
      out += '%' + toHex(code);
    }
  }

  return out;
}

function getTargetIps() {
  var target = readValue(vc.target, DEFAULTS.target);

  if (target === 'All') {
    return [IR_TARGET_IPS['Zone 1'], IR_TARGET_IPS['Zone 2']];
  }

  return [IR_TARGET_IPS[target]];
}

function buildAcState() {
  return {
    Vendor: 'MITSUBISHI_HEAVY_88',
    Power: readValue(vc.power, DEFAULTS.power) ? 'On' : 'Off',
    Beep: 'On',
    SwingV: readValue(vc.swingV, DEFAULTS.swingV),
    Mode: readValue(vc.mode, DEFAULTS.mode),
    FanSpeed: readValue(vc.fan, DEFAULTS.fan),
    Temp: parseInt(readValue(vc.temp, DEFAULTS.temp), 10)
  };
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function getComponentSpecs() {
  return [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: {
        name: 'Mitsubishi Heavy AC'
      }
    },
    {
      type: 'boolean',
      id: COMPONENT_IDS.power,
      config: {
        name: 'AC Power',
        persisted: true,
        default_value: DEFAULTS.power,
        meta: {
          ui: {
            view: 'toggle',
            titles: ['Off', 'On']
          }
        }
      }
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.mode,
      config: {
        name: 'AC Mode',
        persisted: true,
        default_value: DEFAULTS.mode,
        options: MODES,
        meta: { ui: { view: 'Dropdown' } }
      }
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.fan,
      config: {
        name: 'AC Fan',
        persisted: true,
        default_value: DEFAULTS.fan,
        options: FAN_SPEEDS,
        meta: { ui: { view: 'Dropdown' } }
      }
    },
    {
      type: 'number',
      id: COMPONENT_IDS.temp,
      config: {
        name: 'AC Temp',
        persisted: true,
        default_value: DEFAULTS.temp,
        min: 16,
        max: 31,
        meta: { ui: { view: 'slider', unit: 'C', step: 1 } }
      }
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.swingV,
      config: {
        name: 'AC Swing V',
        persisted: true,
        default_value: DEFAULTS.swingV,
        options: SWING_V,
        meta: { ui: { view: 'Dropdown' } }
      }
    },
    {
      type: 'button',
      id: COMPONENT_IDS.apply,
      config: {
        name: 'Apply HVAC',
        meta: { ui: { view: 'Button' } }
      }
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.target,
      config: {
        name: 'IR Target',
        persisted: true,
        default_value: DEFAULTS.target,
        options: IR_TARGETS,
        meta: { ui: { view: 'Dropdown' } }
      }
    }
  ];
}

function buildVirtualComponentsManifest() {
  var specs = getComponentSpecs();
  var manifest = { components: [], groups: [] };
  var members = [];
  var i;
  var spec;
  var key;

  for (i = 0; i < specs.length; i++) {
    spec = specs[i];
    key = spec.type + String(spec.id);

    if (spec.type === 'group') {
      manifest.groups.push({ id: spec.id, name: spec.config.name, components: members });
      continue;
    }

    manifest.components.push({ key: key, type: spec.type, id: spec.id, config: spec.config });
    members.push(key);
  }

  return manifest;
}

function bindVirtualComponents(readyVc) {
  vc.power = readyVc.handles.boolean200;
  vc.mode = readyVc.handles.enum201;
  vc.fan = readyVc.handles.enum202;
  vc.temp = readyVc.handles.number200;
  vc.swingV = readyVc.handles.enum203;
  vc.apply = readyVc.handles.button200;
  vc.target = readyVc.handles.enum204;
}

function deleteComponent(key, cb) {
  Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Delete skipped for ' + key + ': ' + errCode + ' ' + errMsg);
    }

    if (cb) cb();
  });
}

function deleteLegacyComponents(index, done) {
  if (index >= LEGACY_COMPONENT_KEYS.length) {
    done();
    return;
  }

  deleteComponent(LEGACY_COMPONENT_KEYS[index], function() {
    deleteLegacyComponents(index + 1, done);
  });
}

function ensureAllComponents(done) {
  deleteLegacyComponents(0, function() {
    ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
      if (!ok) {
        done(false);
        return;
      }

      bindVirtualComponents(readyVc);
      done(true);
    });
  });
}

// ============================================================================
// TASMOTA COMMAND DISPATCH
// ============================================================================

function sendAcState(acState, successText) {
  var payload = 'IRHVAC ' + JSON.stringify(acState);
  var targets = getTargetIps();
  var pending = targets.length;
  var failed = 0;
  var lastError = '';

  setStatus('Sending...');

  function finishOne(ok, msg) {
    pending -= 1;

    if (!ok) {
      failed += 1;
      lastError = msg;
    }

    if (pending > 0) return;

    if (failed === 0) {
      setStatus(successText);
      return;
    }

    if (failed === targets.length) {
      setStatus('Send failed: ' + lastError);
      return;
    }

    setStatus('Partial send failure: ' + lastError);
  }

  targets.forEach(function(ip) {
    var url = 'http://' + ip + TASMOTA_CM_PATH + urlEncode(payload);

    Shelly.call('HTTP.GET', { url: url, timeout: 10 }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('HTTP.GET failed for ' + ip + ': ' + errCode + ' ' + errMsg);
        finishOne(false, 'HTTP ' + errCode + ' on ' + ip);
        return;
      }

      if (!res || res.code !== 200) {
        finishOne(false, 'Tasmota ' + (res ? res.code : 'no response') + ' on ' + ip);
        return;
      }

      finishOne(true, '');
    });
  });
}

function sendCurrentState() {
  var acState = buildAcState();

  sendAcState(
    acState,
    'Sent to ' +
      readValue(vc.target, DEFAULTS.target) +
      ': ' +
      acState.Power +
      ' ' +
      acState.Mode +
      ' ' +
      acState.Temp +
      'C'
  );
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function bindHandlers() {
  vc.power = vc[COMPONENT_IDS.power];
  vc.mode = vc[COMPONENT_IDS.mode];
  vc.fan = vc[COMPONENT_IDS.fan];
  vc.temp = vc[COMPONENT_IDS.temp];
  vc.swingV = vc[COMPONENT_IDS.swingV];
  vc.apply = vc[COMPONENT_IDS.apply];
  vc.target = vc[COMPONENT_IDS.target];

  if (vc.power) {
    vc.power.on('change', function(ev) {
      setStatus('Power set to ' + (ev.value ? 'On' : 'Off') + '. Press Apply HVAC.');
    });
  }

  if (vc.mode) {
    vc.mode.on('change', function(ev) {
      setStatus('Mode set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.fan) {
    vc.fan.on('change', function(ev) {
      setStatus('Fan set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.temp) {
    vc.temp.on('change', function(ev) {
      setStatus('Temp set to ' + parseInt(ev.value, 10) + 'C. Press Apply HVAC.');
    });
  }

  if (vc.swingV) {
    vc.swingV.on('change', function(ev) {
      setStatus('Swing V set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.target) {
    vc.target.on('change', function(ev) {
      setStatus('IR target set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.apply) {
    vc.apply.on('single_push', function() {
      sendCurrentState();
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  ensureAllComponents(function(ok) {
    if (!ok) {
      setStatus('Virtual component setup failed');
      return;
    }

    bindHandlers();
    setStatus('Ready. Configure values and press Apply HVAC.');
  });
}

main();
