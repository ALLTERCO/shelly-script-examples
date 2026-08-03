/**
 * @title Yahoo Finance stock monitor with virtual components
 * @description Polls Yahoo Finance chart API for a stock symbol and updates
 *   Virtual Components with current price, daily delta, and quote fields.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/finance-yahoo/stock-monitor_vc.shelly.js
 */

/**
 * Stock Price Monitor
 *
 * Fetches one-day quote data for STOCK_SYMBOL and writes values to Virtual
 * Components.
 *
 * Script-owned Virtual Components:
 * - number:200..205  Price, volume, open, close, low, high
 * - text:200..202    Symbol, daily change, last updated
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


const STOCK_SYMBOL = 'SLYG.DE';

const vcComponents = {
  group: {
    id: 200,
    key: 'stock_monitor',
    name: 'Stock Monitor',
    type: 'group'
  },
  components: [
    {
      id: 200,
      key: 'price',
      type: 'number',
      name: 'Current Price',
      unit: '€'
    },
    {
      id: 201,
      key: 'volume',
      type: 'number',
      name: 'Volume',
      unit: 'shares'
    },
    {
      id: 202,
      key: 'open',
      type: 'number',
      name: 'Open',
      unit: '€'
    },
    {
      id: 203,
      key: 'close',
      type: 'number',
      name: 'Close',
      unit: '€'
    },
    {
      id: 204,
      key: 'low',
      type: 'number',
      name: 'Low',
      unit: '€'
    },
    {
      id: 205,
      key: 'high',
      type: 'number',
      name: 'High',
      unit: '€'
    },
    {
      id: 200,
      key: 'symbol',
      type: 'text',
      name: 'Stock Symbol',
      default: STOCK_SYMBOL
    },
    {
      id: 201,
      key: 'delta',
      type: 'text',
      name: 'Change today'
    },
    {
      id: 202,
      key: 'time',
      type: 'text',
      name: 'Last Updated',
      webIcon: 13
    }
  ]
};

var vcHandles = {};

function vcConfig(comp) {
  var ui = { view: comp.type === 'number' ? 'label' : 'label' };
  if (comp.unit) ui.unit = comp.unit;
  if (comp.webIcon !== undefined) ui.webIcon = comp.webIcon;

  if (comp.type === 'text') {
    return {
      name: comp.name,
      default_value: comp.default || '',
      persisted: false,
      meta: { ui: ui, cloud: ['log'] }
    };
  }

  return {
    name: comp.name,
    default_value: 0,
    min: comp.min !== undefined ? comp.min : -999999999999999,
    max: comp.max !== undefined ? comp.max : 999999999999999,
    meta: { ui: ui, cloud: ['measurement'] }
  };
}

function buildVirtualComponentsManifest() {
  var manifest = { components: [], groups: [] };
  var members = [];
  var i;
  var comp;

  for (i = 0; i < vcComponents.components.length; i++) {
    comp = vcComponents.components[i];
    manifest.components.push({ key: comp.key, type: comp.type, id: comp.id, config: vcConfig(comp) });
    members.push(comp.key);
  }

  manifest.groups = [
    { id: vcComponents.group.id, name: vcComponents.group.name, components: members }
  ];

  return manifest;
}

function bindVirtualComponents(readyVc) {
  vcHandles = readyVc.handles;
}

function getTimestamp(ts) {
  return new Date(ts).toString().split('GMT')[0].trim();
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

function getDate(ts) {
  const date = new Date(ts);
  return pad2(date.getDate()) + "-" + pad2(date.getMonth() + 1);
}

function formatNum(n) {
  const x = Number(n);
  return isFinite(x) ? Number(x.toFixed(2)) : 0;
}

function setValue(key, value) {
  if (!vcHandles[key]) return;
  vcHandles[key].setValue(value);
}

function updateStockPrice() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + STOCK_SYMBOL + '?interval=1d&range=1d';
  Shelly.call('HTTP.GET',
    {
      url: url,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    },
    function (response) {
      if (!response || response.code !== 200) {
        console.log('Error: HTTP', response);
        return;
      }
      try {
        const data = JSON.parse(response.body);
        const meta = data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose;
        const ts = meta.regularMarketTime * 1000;
        const delta = price - prev;
        const deltaPct = prev !== 0 ? (delta / prev) * 100 : 0;
        const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
        const trend = delta > 0 ? '⬆️ ' : delta < 0 ? '🔻 ' : '';
        const deltaText =
                  trend  + sign +
                formatNum(Math.abs(delta)) + '€ (' +
                sign + formatNum(Math.abs(deltaPct)) + '%) / ' + getDate(ts);
        const quote = data.chart.result[0].indicators.quote[0];
        setValue('price', formatNum(price));
        setValue('time', getTimestamp(ts));
        setValue('delta', deltaText);
        setValue('open', formatNum(quote.open[0]));
        setValue('close', formatNum(quote.close[0]));
        setValue('high', formatNum(quote.high[0]));
        setValue('low', formatNum(quote.low[0]));
        setValue('volume', quote.volume[0]);
      } catch (err) {
        console.log('Error parsing JSON:', err);
      }
    },
  );
}

ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
  if (!ok) {
    console.log('Virtual component setup failed');
    return;
  }

  bindVirtualComponents(readyVc);
  updateStockPrice();
  Timer.set(5 * 60 * 1000, true, updateStockPrice);
});
