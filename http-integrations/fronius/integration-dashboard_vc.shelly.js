/**
 * @title Fronius multi-channel energy dashboard
 * @description Polls Fronius Solar API endpoints and updates Shelly Virtual
 *   Components for PV, load, grid, battery, Wattpilot, and ELWA / boiler data.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/fronius/integration-dashboard_vc.shelly.js
 */

/**
 * Reads one or more Fronius JSON endpoints from a local inverter and writes up
 * to 10 Shelly number Virtual Components created and verified at startup.
 *
 * Default Virtual Components:
 * - number:200  Solar Production   W
 * - number:201  House Consumption  W
 * - number:202  Grid Export        W
 * - number:203  Battery SoC        %
 * - number:204  Battery Power      W
 * - number:205  Wattpilot Power    W
 * - number:206  ELWA Power         W
 * - number:207  ELWA Temp 1        degC
 * - number:208  ELWA Temp 2        degC
 * - number:209  Boiler SoC         %
 * - group:200   Fronius Energy     (optional group)
 *
 * Notes:
 * - This script is local-only and creates/verifies its own VCs at startup.
 * - Shelly dashboards on this device class practically top out at 10 VCs, so
 *   the requested values are mapped into 10 slots and integrated energy is
 *   printed in logs as kWh.
 * - The core GEN24 fields come from `GetPowerFlowRealtimeData.fcgi`.
 * - Battery SoC / battery power and the Wattpilot / ELWA / boiler channels
 *   differ between Fronius installs. The default lookup arrays include
 *   conservative fallbacks, but you should expect to adjust them per site.
 * - `CONFIG.batteryPositiveMode` defines what a positive Battery Power value
 *   means in the Shelly app and in the integrated kWh counters.
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

var CONFIG = {
  froniusBaseUrl: 'http://192.168.178.32',
  intervalMs: 5000,
  logEveryPoll: true,
  updateVcMetadata: true,
  batteryPositiveMode: 'charge', // 'charge' or 'discharge'
  sources: {
    powerFlow: {
      enabled: true,
      url: '/solar_api/v1/GetPowerFlowRealtimeData.fcgi'
    },
    storage: {
      enabled: true,
      url: '/solar_api/v1/GetStorageRealtimeData.cgi?Scope=System'
    },
    wattpilot: {
      enabled: false,
      url: ''
    },
    elwa: {
      enabled: false,
      url: ''
    }
  }
};

var SOURCE_KEYS = ['powerFlow', 'storage', 'wattpilot', 'elwa'];

var METRICS = [
  {
    key: 'solarProduction',
    name: 'Solar Production',
    unit: 'W',
    vcId: 'number:200',
    decimals: 0,
    enabled: true,
    energyBucket: 'solarKWh',
    transform: 'nonNegative',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_PV'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '1', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '0', 'P'] }
    ],
    vcHandle: null
  },
  {
    key: 'houseConsumption',
    name: 'House Consumption',
    unit: 'W',
    vcId: 'number:201',
    decimals: 0,
    enabled: true,
    energyBucket: 'houseKWh',
    transform: 'nonNegative',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Load'] }
    ],
    vcHandle: null
  },
  {
    key: 'gridExport',
    name: 'Grid Export',
    unit: 'W',
    vcId: 'number:202',
    decimals: 0,
    enabled: true,
    transform: 'gridExport',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Grid'] }
    ],
    vcHandle: null
  },
  {
    key: 'batterySoc',
    name: 'Battery SoC',
    unit: '%',
    vcId: 'number:203',
    decimals: 1,
    enabled: true,
    transform: 'percent',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '1', 'SOC'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '0', 'SOC'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'StateOfCharge_Relative'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'StateOfCharge'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'SOC'] }
    ],
    vcHandle: null
  },
  {
    key: 'batteryPower',
    name: 'Battery Power',
    unit: 'W',
    vcId: 'number:204',
    decimals: 0,
    enabled: true,
    transform: 'batterySigned',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Akku'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'P'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'Power'] }
    ],
    vcHandle: null
  },
  {
    key: 'wattpilotPower',
    name: 'Wattpilot Power',
    unit: 'W',
    vcId: 'number:205',
    decimals: 0,
    enabled: true,
    energyBucket: 'wattpilotKWh',
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'SmartLoads', 'Wattpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Smartloads', 'Wattpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'SmartLoads', '1', 'P'] },
      { source: 'wattpilot', path: ['power'] },
      { source: 'wattpilot', path: ['Body', 'Data', 'power'] },
      { source: 'wattpilot', path: ['Body', 'Data', 'Power'] }
    ],
    vcHandle: null
  },
  {
    key: 'elwaPower',
    name: 'ELWA Power',
    unit: 'W',
    vcId: 'number:206',
    decimals: 0,
    enabled: true,
    energyBucket: 'elwaKWh',
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Power'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilots', '1', 'P'] },
      { source: 'elwa', path: ['power'] },
      { source: 'elwa', path: ['actualPower'] },
      { source: 'elwa', path: ['Body', 'Data', 'power'] }
    ],
    vcHandle: null
  },
  {
    key: 'elwaTemp1',
    name: 'ELWA Temp 1',
    unit: 'degC',
    vcId: 'number:207',
    decimals: 1,
    enabled: true,
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temperature1'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temp1'] },
      { source: 'elwa', path: ['temperature1'] },
      { source: 'elwa', path: ['temp1'] },
      { source: 'elwa', path: ['Body', 'Data', 'temperature1'] }
    ],
    vcHandle: null
  },
  {
    key: 'elwaTemp2',
    name: 'ELWA Temp 2',
    unit: 'degC',
    vcId: 'number:208',
    decimals: 1,
    enabled: true,
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temperature2'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temp2'] },
      { source: 'elwa', path: ['temperature2'] },
      { source: 'elwa', path: ['temp2'] },
      { source: 'elwa', path: ['Body', 'Data', 'temperature2'] }
    ],
    vcHandle: null
  },
  {
    key: 'boilerSoc',
    name: 'Boiler SoC',
    unit: '%',
    vcId: 'number:209',
    decimals: 1,
    enabled: true,
    transform: 'percent',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'BoilerSoC'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'StateOfCharge'] },
      { source: 'elwa', path: ['boilerSoc'] },
      { source: 'elwa', path: ['stateOfCharge'] },
      { source: 'elwa', path: ['Body', 'Data', 'boilerSoc'] }
    ],
    vcHandle: null
  }
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  lastPollTs: 0,
  pollInFlight: false,
  missingVc: {},
  missingMetric: {},
  sourceErrors: {},
  metadataQueue: [],
  metadataBusy: false,
  metadataIndex: 0,
  energy: {
    solarKWh: 0,
    houseKWh: 0,
    gridImportKWh: 0,
    gridExportKWh: 0,
    batteryChargeKWh: 0,
    batteryDischargeKWh: 0,
    wattpilotKWh: 0,
    elwaKWh: 0
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function toNumber(value) {
  if (isNumber(value)) return value;
  if (typeof value === 'string' && value !== '') {
    value = parseFloat(value);
    if (isNumber(value)) return value;
  }
  return null;
}

function roundValue(value, decimals) {
  var factor;
  if (!isNumber(value)) return value;
  factor = Math.pow(10, decimals || 0);
  return Math.round(value * factor) / factor;
}

function clamp(value, minValue, maxValue) {
  if (!isNumber(value)) return value;
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

function formatPower(value) {
  if (!isNumber(value)) return 'n/a';
  if (Math.abs(value) >= 1000) return roundValue(value / 1000, 2) + ' kW';
  return roundValue(value, 0) + ' W';
}

function formatEnergy(value) {
  if (!isNumber(value)) return '0.000 kWh';
  return roundValue(value, 3) + ' kWh';
}

function capitalize(text) {
  if (!text || !text.length) return text;
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

function parseVcId(vcId) {
  var parts;
  if (!vcId) return null;
  parts = vcId.split(':');
  if (parts.length !== 2) return null;
  return {
    type: parts[0],
    id: parseInt(parts[1], 10)
  };
}

function getPathValue(obj, path) {
  var i;
  var value = obj;
  if (!obj || !path) return null;
  for (i = 0; i < path.length; i++) {
    if (value === null || typeof value === 'undefined') return null;
    value = value[path[i]];
  }
  return value;
}

function getMetricByKey(metricKey) {
  var i;
  for (i = 0; i < METRICS.length; i++) {
    if (METRICS[i].key === metricKey) return METRICS[i];
  }
  return null;
}

function resolveSourceUrl(sourceCfg) {
  if (!sourceCfg || !sourceCfg.url) return null;
  if (sourceCfg.url.indexOf('http://') === 0 || sourceCfg.url.indexOf('https://') === 0) {
    return sourceCfg.url;
  }
  return CONFIG.froniusBaseUrl + sourceCfg.url;
}

function fetchJson(url, callback) {
  Shelly.call('HTTP.GET', { url: url }, function(res, errorCode, errorMessage) {
    var data;

    if (errorCode !== 0) {
      callback('HTTP error [' + errorCode + ']: ' + errorMessage);
      return;
    }

    if (!res || res.code !== 200) {
      callback('Unexpected HTTP response');
      return;
    }

    try {
      data = JSON.parse(res.body);
    } catch (err) {
      callback('JSON parse error: ' + err);
      return;
    }

    callback(null, data);
  });
}

function fetchSources(index, responses, done) {
  var sourceKey;
  var sourceCfg;
  var url;

  if (index >= SOURCE_KEYS.length) {
    done(responses);
    return;
  }

  sourceKey = SOURCE_KEYS[index];
  sourceCfg = CONFIG.sources[sourceKey];

  if (!sourceCfg || !sourceCfg.enabled) {
    fetchSources(index + 1, responses, done);
    return;
  }

  url = resolveSourceUrl(sourceCfg);
  if (!url) {
    fetchSources(index + 1, responses, done);
    return;
  }

  fetchJson(url, function(err, data) {
    if (err) {
      if (!state.sourceErrors[sourceKey]) {
        state.sourceErrors[sourceKey] = true;
        print('[Fronius] ' + sourceKey + ' error: ' + err);
      }
    } else {
      state.sourceErrors[sourceKey] = false;
      responses[sourceKey] = data;
    }
    fetchSources(index + 1, responses, done);
  });
}

function readMetricRawValue(metric, responses) {
  var i;
  var lookup;
  var response;
  var value;
  var numberValue;

  for (i = 0; i < metric.lookups.length; i++) {
    lookup = metric.lookups[i];
    response = responses[lookup.source];
    if (!response) continue;

    value = getPathValue(response, lookup.path);
    numberValue = toNumber(value);
    if (isNumber(numberValue)) return numberValue;
  }

  if (!state.missingMetric[metric.key]) {
    state.missingMetric[metric.key] = true;
    print('[Fronius] No value found for ' + metric.name + '. Review its lookup paths.');
  }
  return null;
}

function transformMetricValue(metric, rawValue) {
  if (!isNumber(rawValue)) return null;

  if (metric.transform === 'nonNegative') {
    return rawValue < 0 ? 0 : rawValue;
  }

  if (metric.transform === 'gridExport') {
    return rawValue < 0 ? Math.abs(rawValue) : 0;
  }

  if (metric.transform === 'percent') {
    return clamp(rawValue, 0, 100);
  }

  if (metric.transform === 'batterySigned') {
    if (CONFIG.batteryPositiveMode === 'discharge') return -rawValue;
    return rawValue;
  }

  return rawValue;
}

function collectSnapshot(responses) {
  var i;
  var metric;
  var rawValue;
  var value;
  var snapshot = {};

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    snapshot[metric.key] = {
      found: false,
      raw: null,
      value: null
    };

    if (!metric.enabled) continue;

    rawValue = readMetricRawValue(metric, responses);
    if (!isNumber(rawValue)) continue;

    value = transformMetricValue(metric, rawValue);
    if (!isNumber(value)) continue;

    snapshot[metric.key] = {
      found: true,
      raw: rawValue,
      value: roundValue(value, metric.decimals)
    };
  }

  return snapshot;
}

function setVcValue(metric, value) {
  if (!metric.vcHandle) {
    if (!state.missingVc[metric.vcId]) {
      state.missingVc[metric.vcId] = true;
      print('[Fronius] Missing virtual component: ' + metric.vcId);
    }
    return;
  }

  metric.vcHandle.setValue(value);
}

function updateVirtualComponents(snapshot) {
  var i;
  var metric;
  var point;

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    if (!metric.enabled) continue;

    point = snapshot[metric.key];
    if (!point || !point.found) continue;

    setVcValue(metric, point.value);
  }
}

function addEnergy(bucket, powerW, dtSeconds) {
  if (!bucket || !isNumber(powerW) || powerW <= 0 || dtSeconds <= 0) return;
  state.energy[bucket] += (powerW * dtSeconds) / 3600000;
}

function updateIntegratedEnergy(snapshot, dtSeconds) {
  var batteryPoint;

  if (dtSeconds <= 0) return;

  addEnergy('solarKWh', snapshot.solarProduction.value, dtSeconds);
  addEnergy('houseKWh', snapshot.houseConsumption.value, dtSeconds);
  addEnergy('wattpilotKWh', snapshot.wattpilotPower.value, dtSeconds);
  addEnergy('elwaKWh', snapshot.elwaPower.value, dtSeconds);

  if (snapshot.gridExport.found) {
    if (snapshot.gridExport.raw > 0) {
      addEnergy('gridImportKWh', snapshot.gridExport.raw, dtSeconds);
    } else if (snapshot.gridExport.raw < 0) {
      addEnergy('gridExportKWh', Math.abs(snapshot.gridExport.raw), dtSeconds);
    }
  }

  batteryPoint = snapshot.batteryPower;
  if (!batteryPoint.found) return;

  if (CONFIG.batteryPositiveMode === 'charge') {
    if (batteryPoint.value > 0) {
      addEnergy('batteryChargeKWh', batteryPoint.value, dtSeconds);
    } else if (batteryPoint.value < 0) {
      addEnergy('batteryDischargeKWh', Math.abs(batteryPoint.value), dtSeconds);
    }
  } else {
    if (batteryPoint.value > 0) {
      addEnergy('batteryDischargeKWh', batteryPoint.value, dtSeconds);
    } else if (batteryPoint.value < 0) {
      addEnergy('batteryChargeKWh', Math.abs(batteryPoint.value), dtSeconds);
    }
  }
}

function logSnapshot(snapshot) {
  var parts = [];

  if (snapshot.solarProduction.found) parts.push('PV ' + formatPower(snapshot.solarProduction.value));
  if (snapshot.houseConsumption.found) parts.push('Load ' + formatPower(snapshot.houseConsumption.value));
  if (snapshot.gridExport.found) {
    if (snapshot.gridExport.raw > 0) {
      parts.push('Grid In ' + formatPower(snapshot.gridExport.raw));
    } else {
      parts.push('Grid Out ' + formatPower(snapshot.gridExport.value));
    }
  }
  if (snapshot.batterySoc.found) parts.push('Battery SoC ' + roundValue(snapshot.batterySoc.value, 1) + '%');
  if (snapshot.batteryPower.found) parts.push('Battery ' + formatPower(snapshot.batteryPower.value));
  if (snapshot.wattpilotPower.found) parts.push('Wattpilot ' + formatPower(snapshot.wattpilotPower.value));
  if (snapshot.elwaPower.found) parts.push('ELWA ' + formatPower(snapshot.elwaPower.value));
  if (snapshot.elwaTemp1.found) parts.push('T1 ' + roundValue(snapshot.elwaTemp1.value, 1) + ' degC');
  if (snapshot.elwaTemp2.found) parts.push('T2 ' + roundValue(snapshot.elwaTemp2.value, 1) + ' degC');
  if (snapshot.boilerSoc.found) parts.push('Boiler ' + roundValue(snapshot.boilerSoc.value, 1) + '%');

  parts.push(
    'Energy PV=' + formatEnergy(state.energy.solarKWh) +
      ' Load=' + formatEnergy(state.energy.houseKWh) +
      ' GridIn=' + formatEnergy(state.energy.gridImportKWh) +
      ' GridOut=' + formatEnergy(state.energy.gridExportKWh) +
      ' BattIn=' + formatEnergy(state.energy.batteryChargeKWh) +
      ' BattOut=' + formatEnergy(state.energy.batteryDischargeKWh) +
      ' WP=' + formatEnergy(state.energy.wattpilotKWh) +
      ' ELWA=' + formatEnergy(state.energy.elwaKWh)
  );

  print('[Fronius] ' + parts.join(' | '));
}

function configureMetricVc(metric) {
  var parsed;
  var config;

  if (!metric.vcId || !CONFIG.updateVcMetadata) return;

  parsed = parseVcId(metric.vcId);
  if (!parsed || parsed.type !== 'number') return;

  config = Shelly.getComponentConfig(parsed.type, parsed.id);
  if (!config) return;

  if (!config.meta) config.meta = {};
  if (!config.meta.ui) config.meta.ui = {};

  config.name = metric.name;
  config.meta.ui.unit = metric.unit;
  config.meta.ui.view = 'label';

  state.metadataQueue.push({
    method: 'Number.SetConfig',
    params: { id: parsed.id, config: config },
    vcId: metric.vcId,
    unit: metric.unit
  });
}

function processMetadataQueue() {
  var job;

  if (state.metadataBusy || state.metadataIndex >= state.metadataQueue.length) return;

  job = state.metadataQueue[state.metadataIndex];
  state.metadataIndex++;
  state.metadataBusy = true;

  Shelly.call(job.method, job.params, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      print('[Fronius] VC config error for ' + job.vcId + ': ' + errorMessage);
    }
    state.metadataBusy = false;
    Timer.set(50, false, processMetadataQueue);
  });
}


function metricVcConfig(metric) {
  return {
    name: metric.name,
    default_value: 0,
    min: metric.min !== undefined ? metric.min : -999999999999999,
    max: metric.max !== undefined ? metric.max : 999999999999999,
    meta: { ui: { view: 'label', unit: metric.unit, step: metric.decimals > 0 ? 0.1 : 1 }, cloud: ['measurement'] }
  };
}

function buildVirtualComponentsManifest() {
  var manifest = { components: [], groups: [] };
  var members = [];
  var i;
  var metric;
  var parsed;

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    if (!metric.enabled || !metric.vcId) continue;
    parsed = parseVcId(metric.vcId);
    metric.vcKey = metric.key;
    manifest.components.push({ key: metric.vcKey, type: parsed.type, id: parsed.id, config: metricVcConfig(metric) });
    members.push(metric.vcKey);
  }

  manifest.groups = [
    { id: 200, name: 'Fronius Energy', components: members }
  ];

  return manifest;
}

function bindVirtualComponents(readyVc) {
  var i;
  var metric;

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    if (!metric.enabled || !metric.vcKey) continue;
    metric.vcHandle = readyVc.handles[metric.vcKey];
    configureMetricVc(metric);
  }

  processMetadataQueue();
}
// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  var now = Date.now();
  var dtSeconds;

  if (state.pollInFlight) {
    print('[Fronius] Poll skipped: previous cycle still in progress');
    return;
  }

  state.pollInFlight = true;

  fetchSources(0, {}, function(responses) {
    var snapshot;

    dtSeconds = 0;
    if (state.lastPollTs > 0) {
      dtSeconds = (now - state.lastPollTs) / 1000;
    }
    state.lastPollTs = now;

    snapshot = collectSnapshot(responses);
    updateIntegratedEnergy(snapshot, dtSeconds);
    updateVirtualComponents(snapshot);

    if (CONFIG.logEveryPoll) logSnapshot(snapshot);

    state.pollInFlight = false;
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

print('[Fronius] Multi-channel energy dashboard');
print('[Fronius] Battery positive mode: ' + CONFIG.batteryPositiveMode);
print('[Fronius] Local-only variant. Adjust lookup paths for Wattpilot / ELWA per site.');

ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
  if (!ok) {
    print('[Fronius] ERROR: Virtual component setup failed');
    return;
  }

  bindVirtualComponents(readyVc);
  Timer.set(CONFIG.intervalMs, true, poll);
  poll();
});
