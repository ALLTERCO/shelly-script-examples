/**
 * @title BLU Assistant MQTT configuration
 * @description Configures MQTT settings on Shelly BLU devices via BLE scanning and RPC.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/blu-assistant/config-mqtt.shelly.js
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


/************************************************
* CONFIGURATION
************************************************/
var CONFIG = {
  FILTERED_BLE_ID: '', // default BLE ID
  ALLTERCO_MFD_ID: 'a90b',

  MQTT_SERVER: '',
  MQTT_CLIENT_ID: '',
  MQTT_PREFIX: '',

  URL_CA_BUNDLE: '',
  URL_CLIENT_CERT: '',
  URL_CLIENT_KEY: '',

  SYS_BTN: 'pair',
  VIRTUAL_BTN: 'button:202', // MQTT deploy button

  // --- IDs of your virtual UI components ---
  UI_FILTERED_BLE_ID: 'text:200', // BLE ID
  UI_MQTT_SERVER: 'text:205', // MQTT Server
  UI_MQTT_CLIENT_ID: 'text:206', // MQTT Client ID
  UI_MQTT_PREFIX: 'text:207', // MQTT Prefix
  UI_URL_CA_BUNDLE: 'text:208', // CA Bundle URL
  UI_URL_CLIENT_CERT: 'text:209', // Client Cert URL
  UI_URL_CLIENT_KEY: 'text:210', // Client Key URL
}

var BLE_SCAN = { active: false, duration_ms: 750, window_ms: 95, interval_ms: 100, rssi_thr: -60 }

/************************************************
* OVERRIDE CONFIG WITH UI FIELDS
************************************************/
var uiBleId = null
var uiServer = null
var uiClientId = null
var uiPrefix = null
var uiCaBundle = null
var uiCert = null
var uiKey = null
var uiDeployBtn = null

function refreshConfig() {
  var v
  if (uiBleId) {
    v = uiBleId.getValue()
    // parse hex or decimal input
    CONFIG.FILTERED_BLE_ID = (v.indexOf('0x') === 0 ? parseInt(v, 16) : parseInt(v, 10)) || CONFIG.FILTERED_BLE_ID
  }
  if (uiServer && (v = uiServer.getValue())) CONFIG.MQTT_SERVER = v
  if (uiClientId && (v = uiClientId.getValue())) CONFIG.MQTT_CLIENT_ID = v
  if (uiPrefix && (v = uiPrefix.getValue())) CONFIG.MQTT_PREFIX = v
  if (uiCaBundle && (v = uiCaBundle.getValue())) CONFIG.URL_CA_BUNDLE = v
  if (uiCert && (v = uiCert.getValue())) CONFIG.URL_CLIENT_CERT = v
  if (uiKey && (v = uiKey.getValue())) CONFIG.URL_CLIENT_KEY = v

  console.log(
    'CONFIG ← UI:',
    JSON.stringify({
      FILTERED_BLE_ID: CONFIG.FILTERED_BLE_ID,
      MQTT_SERVER: CONFIG.MQTT_SERVER,
      MQTT_CLIENT_ID: CONFIG.MQTT_CLIENT_ID,
      MQTT_PREFIX: CONFIG.MQTT_PREFIX,
      URL_CA_BUNDLE: CONFIG.URL_CA_BUNDLE,
      URL_CLIENT_CERT: CONFIG.URL_CLIENT_CERT,
      URL_CLIENT_KEY: CONFIG.URL_CLIENT_KEY,
    })
  )
}

/************************************************
* HTTP GET helper – accepts body / body_b64 / body_base64
************************************************/
function fetch(url, cb) {
  console.log('HTTP GET', url)
  Shelly.call('HTTP.GET', { url: url, binary: true }, function (res, ec, em) {
    if (ec || !res || res.code !== 200) {
      console.log('HTTP GET failed', ec, em)
      cb(null)
      return
    }

    var txt = null

    if (typeof res.body === 'string') {
      /* plain text             */
      txt = res.body
      console.log('HTTP GET -> body', txt.length, 'bytes')
    } else if (typeof res.body_b64 === 'string') {
      txt = atob(res.body_b64)
      console.log('HTTP GET -> body_b64', txt.length, 'bytes')
    } else if (typeof res.body_base64 === 'string') {
      txt = atob(res.body_base64)
      console.log('HTTP GET -> body_base64', txt.length, 'bytes')
    } else {
      console.log('HTTP GET unknown payload keys:', JSON.stringify(res))
    }

    cb(txt)
  })
}

/************************************************
* upload PEM with progress
************************************************/
function putPem(addr, method, text, cb) {
  if (!text) {
    console.log(method, 'input NULL – abort')
    cb(false)
    return
  }
  var lines = text.split('\n'), i = 0, bytes = 0
  function next(app) {
    var chunk = lines[i++] + '\n'
    bytes += chunk.length
    if (i % 10 === 0 || i === lines.length) console.log(method, '…', i, '/', lines.length)
    Shelly.call(
      'GATTC.call',
      {
        addr: addr,
        method: method,
        params: { data: chunk, append: app },
      },
      function (r, e, m) {
        if (e) {
          console.log(method, 'error', m)
          cb(false)
        } else if (i < lines.length) next(true)
        else {
          console.log(method, 'DONE', bytes, 'bytes')
          cb(true)
        }
      }
    )
  }
  next(false)
}

/************************************************
* push MQTT config
************************************************/
function mqttConfig(addr, cb) {
  var cfg = {
    enable: true,
    server: CONFIG.MQTT_SERVER,
    client_id: CONFIG.MQTT_CLIENT_ID,
    topic_prefix: CONFIG.MQTT_PREFIX,
    ssl_ca: 'user_ca.pem',
    rpc_ntf: true,
    status_ntf: true,
    enable_control: true,
    enable_rpc: true,
    use_client_cert: true,
  }
  console.log('MQTT.SetConfig sending…')
  Shelly.call(
    'GATTC.call',
    {
      addr: addr,
      method: 'MQTT.SetConfig',
      params: { config: cfg },
    },
    function (r, e, m) {
      if (e) {
        console.log('MQTT.SetConfig ERROR', m)
        cb(false)
      } else {
        console.log('MQTT.SetConfig OK – restart required')
        cb(true)
      }
    }
  )
}

/************************************************
* full deployment chain
************************************************/
function fetchCa(context) {
  fetch(CONFIG.URL_CA_BUNDLE, function (ca) {
    if (!ca) {
      console.log('CA download NULL – abort')
      return
    }
    context.ca = ca
    fetchClientCert(context)
  })
}

function fetchClientCert(context) {
  fetch(CONFIG.URL_CLIENT_CERT, function (cc) {
    if (!cc) {
      console.log('Client-cert download NULL – abort')
      return
    }
    context.cc = cc
    fetchClientKey(context)
  })
}

function fetchClientKey(context) {
  fetch(CONFIG.URL_CLIENT_KEY, function (ck) {
    if (!ck) {
      console.log('Client-key download NULL – abort')
      return
    }
    context.ck = ck
    putUserCa(context)
  })
}

function putUserCa(context) {
  putPem(context.addr, 'Shelly.PutUserCA', context.ca, function (ok1) {
    if (!ok1) {
      console.log('CA upload failed – abort')
      return
    }
    putClientCert(context)
  })
}

function putClientCert(context) {
  putPem(context.addr, 'Shelly.PutTLSClientCert', context.cc, function (ok2) {
    if (!ok2) {
      console.log('Cert upload failed – abort')
      return
    }
    putClientKey(context)
  })
}

function putClientKey(context) {
  putPem(context.addr, 'Shelly.PutTLSClientKey', context.ck, function (ok3) {
    if (!ok3) {
      console.log('Key upload failed – abort')
      return
    }
    mqttConfigProcess(context)
  })
}

function mqttConfigProcess(context) {
  console.log('All certificates uploaded OK')
  mqttConfig(context.addr, function (ok4) {
    if (!ok4) {
      console.log('MQTT config failed – abort')
      return
    }
    reboot(context)
  })
}

function reboot(context) {
  Shelly.call('GATTC.call', { addr: context.addr, method: 'Shelly.Reboot', params: {} }, function (r, e, m) {
    if (e) {
      console.log('Reboot RPC error', m)
      return
    }
    console.log('Rebooting … wait 10 s')
    Timer.set(10000, false, function () {
      Shelly.call('GATTC.call', { addr: context.addr, method: 'MQTT.GetStatus', params: {} }, function (res, ec, em) {
        if (ec) console.log('MQTT.GetStatus error', em)
        else console.log('MQTT connected?', res && res.connected)
      })
    })
  })
}

function deploy(addr) {
  console.log('=== provisioning', addr, '===')
  var context = { addr: addr }
  fetchCa(context)
}

/************************************************
* BLE scan selecting strongest RSSI
************************************************/
function idFromAdv(a) {
  return parseInt(a.substr(22, 2), 16) + (parseInt(a.substr(24, 2), 16) << 8)
}

function sortRSSI(devices) {
  for (var i = 0; i < devices.length; i++) {
    for (var j = i + 1; j < devices.length; j++) {
      if (devices[i].rssi < devices[j].rssi) {
        var temp = devices[i]
        devices[i] = devices[j]
        devices[j] = temp
      }
    }
  }
}

function scanCb(res) {
  if (!res || !Array.isArray(res.results)) {
    console.log('BLE scan invalid')
    return
  }
  var matchedDevices = res.results.filter(function (dev) {
    return (
      typeof dev.adv_data === 'string' &&
      dev.adv_data.indexOf(CONFIG.ALLTERCO_MFD_ID) === 10 &&
      idFromAdv(dev.adv_data) === CONFIG.FILTERED_BLE_ID
    )
  })
  if (!matchedDevices.length) {
    console.log('No matching devices')
    return
  }
  sortRSSI(matchedDevices)
  var target = matchedDevices[0]
  console.log('Target', target.addr, 'RSSI', target.rssi)
  deploy(target.addr)
}

function scan() {
  console.log('BLE scan…')
  Shelly.call('GATTC.Scan', BLE_SCAN, scanCb)
}

/************************************************
* triggers
************************************************/
Shelly.addEventHandler(function (ev) {
  if (ev.info && ev.info.component === 'sys' && ev.info.event === 'brief_btn_down' && ev.info.name === CONFIG.SYS_BTN) {
    console.log('System button -> scan')
    scan()
  }
})

function bindVirtualComponents(readyVc) {
  CONFIG.UI_FILTERED_BLE_ID = readyVc.keys.bleId
  CONFIG.UI_MQTT_SERVER = readyVc.keys.mqttServer
  CONFIG.UI_MQTT_CLIENT_ID = readyVc.keys.mqttClientId
  CONFIG.UI_MQTT_PREFIX = readyVc.keys.mqttPrefix
  CONFIG.UI_URL_CA_BUNDLE = readyVc.keys.caBundle
  CONFIG.UI_URL_CLIENT_CERT = readyVc.keys.clientCert
  CONFIG.UI_URL_CLIENT_KEY = readyVc.keys.clientKey
  CONFIG.VIRTUAL_BTN = readyVc.keys.mqttConfig
  uiBleId = readyVc.handles.bleId
  uiServer = readyVc.handles.mqttServer
  uiClientId = readyVc.handles.mqttClientId
  uiPrefix = readyVc.handles.mqttPrefix
  uiCaBundle = readyVc.handles.caBundle
  uiCert = readyVc.handles.clientCert
  uiKey = readyVc.handles.clientKey
  uiDeployBtn = readyVc.handles.mqttConfig
}

function init() {
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('Virtual component setup failed.')
      return
    }
    bindVirtualComponents(readyVc)
    refreshConfig()
    var uiHandles = [uiBleId, uiServer, uiClientId, uiPrefix, uiCaBundle, uiCert, uiKey]
    uiHandles.forEach(function (h) {
      if (h && h.on) h.on('change', refreshConfig)
    })
    if (uiDeployBtn) {
      uiDeployBtn.on('single_push', function () {
        console.log('Virtual deploy button pressed -> scan')
        scan()
      })
    }
    console.log('Ready - press the physical or virtual button to provision MQTT')
  })
}

init()
