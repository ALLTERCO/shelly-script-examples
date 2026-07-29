/**
 * @title BLU Assistant WiFi provisioning
 * @description Provisions Shelly BLU devices with WiFi credentials via BLE scanning and RPC.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/blu-assistant/add-to-wifi.shelly.js
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
* CONFIGURATION & CONSTANTS
************************************************/
var CONFIG = {
  FILTERED_BLE_ID: "",          // Default BLE ID (must fill via text:200)
  ALLTERCO_MFD_ID: "a90b",      // Signature for Shelly devices
  SYS_BTN: "pair",              // Name of system button to trigger script
  S_SSID: "",                   // Default WiFi SSID (can override via text:201)
  S_PASS: "",                   // Default WiFi PASS (can override via text:202)
  S_ID: null,

  // Virtual Component handles are created and verified at startup.
  V_CMP_BLE_ID:       "text:200",  // BLE ID
  V_CMP_SSID:         "text:201",  // SSID
  V_CMP_PASS:         "text:202",  // Pass
  V_CMP_LOG:          "text:211",  // LOG
  V_CMP_ACTIVATE_BTN: "button:200" // Pair
};

// BLE Scan Parameters
var BLE_SCAN_PARAMS = {
  active: false,
  duration_ms: 505,
  window_ms: 95,
  interval_ms: 100,
  rssi_thr: -100
};

/************************************************
* DEPLOYMENT QUEUE
************************************************/
// We store each device as { addr: "xx:xx:xx:xx:xx", attempts: 3 }
var DEPLOY_QUEUE = {
  tasks: [],
  success: 0,
  fail: 0
};

/************************************************
* HELPER FUNCTIONS
************************************************/
/**
* Extract 2 bytes (indexes 22..25) from adv_data -> device ID (model_id).
*/
function extractDeviceID(adv_data) {
  return parseInt(adv_data.substring(22,24), 16) +
         (parseInt(adv_data.substring(24,26), 16) << 8);
}

/**
* If a virtual text component is present, returns its value; else returns _default.
*/
function virtValueOrDefault(vkey, _default) {
  var cmp = Virtual.getHandle(vkey);
  if (cmp !== null) {
    return cmp.getValue();
  }
  return _default;
}

/**
* Logs the queue status to console and, if available, to text:211.
*/
function updateLog() {
  var logField = Virtual.getHandle(CONFIG.V_CMP_LOG);
  var msg = "Remaining: " + DEPLOY_QUEUE.tasks.length +
            " | Success: " + DEPLOY_QUEUE.success +
            " | Fail: " + DEPLOY_QUEUE.fail;

  console.log(msg);
  if (logField) {
    logField.setValue(msg);
  }
}

/************************************************
* DEPLOYMENT LOGIC
************************************************/
function doDeploy() {
  // Show how many remain, plus success/fail counts
  updateLog();

  // If no tasks left, we're done
  if (DEPLOY_QUEUE.tasks.length <= 0) {
    console.log("Deployment complete. No more devices in queue.");
    return;
  }

  // Pop one device object: { addr: "...", attempts: 3 }
  var task = DEPLOY_QUEUE.tasks.pop();
  doRemoteRPC(task);
}

/************************************************
* RPC LOGIC
************************************************/
/**
* Callback after GATTC.call for WiFi.setConfig. If err_code=0 => success,
* else we decrement attempts and re-queue if attempts > 0.
*/
function remoteRPCCallback(task, result, err_code, err_msg) {
  var methodName = "WiFi.setConfig";
  var addr = task.addr;

  if (err_code === 0) {
    // Success
    console.log("SUCCESS for device:", addr, "Method:", methodName, "Attempts left:", task.attempts);
    DEPLOY_QUEUE.success++;
  } else {
    // Fail => decrement attempts, possibly re-queue
    console.log("ERROR for device:", addr, "Method:", methodName, "-", err_msg, "Attempts left:", task.attempts);
    task.attempts--;

    if (task.attempts > 0) {
      console.log("Will retry device:", addr, "Remaining attempts:", task.attempts);
      DEPLOY_QUEUE.tasks.push(task);
    } else {
      console.log("Final fail for device:", addr);
      DEPLOY_QUEUE.fail++;
    }
  }

  doDeploy();  // move on to the next
}

/**
* Calls WiFi.setConfig for one device. If it fails, we retry until attempts=0.
*/
function doRemoteRPC(task) {
  var addr = task.addr;
  var methodName = "WiFi.setConfig";
  console.log("Executing remote RPC for device:", addr, "->", methodName, "Attempts:", task.attempts);

  // Acquire SSID/PASS from text:201/text:202 or fallback
  var _SSID = virtValueOrDefault(CONFIG.V_CMP_SSID, CONFIG.S_SSID);
  var _PASS = virtValueOrDefault(CONFIG.V_CMP_PASS, CONFIG.S_PASS);

  Shelly.call("GATTC.call",
    {
      addr: addr,
      method: methodName,
      params: {
        config: {
          sta1: {
            ssid: _SSID,
            pass: _PASS,
            enable: true
          }
        }
      }
    },
    function(result, err_code, err_msg) {
      remoteRPCCallback(task, result, err_code, err_msg);
    }
  );
}

/************************************************
* BLE SCAN CALLBACK
************************************************/
function BLEScanCb(scan_result) {
  if (!scan_result || !Array.isArray(scan_result.results)) {
    console.log("Invalid BLE scan result, exit.");
    return;
  }

  var BLE_devices = scan_result.results;
  var shellyDevices = [];
  var matchedDevices = [];

  // Read BLE ID from text:200; default is blank
  var rawBleIdStr = virtValueOrDefault(CONFIG.V_CMP_BLE_ID, CONFIG.FILTERED_BLE_ID);
  if (!rawBleIdStr) {
    console.log("❗️ No BLE ID specified (text:200). Aborting scan.");
    return;
  }
  var parsedBleId = parseInt(rawBleIdStr, 16);

  // Single pass: find all Shelly devices by "a90b" at index=10
  for (var i = 0; i < BLE_devices.length; i++) {
    var dev = BLE_devices[i];
    if (typeof dev.adv_data === "string" && dev.adv_data.indexOf(CONFIG.ALLTERCO_MFD_ID) === 10) {
      shellyDevices.push(dev);
    }
  }

  if (shellyDevices.length === 0) {
    console.log("Scan complete. No Shelly devices found.");
    return;
  }

  console.log("Scan complete. Detected", shellyDevices.length, "Shelly device(s).");

  // Filter by the BLE ID
  for (var j = 0; j < shellyDevices.length; j++) {
    var device = shellyDevices[j];
    var model_id = extractDeviceID(device.adv_data);
    if (model_id === parsedBleId) {
      matchedDevices.push(device);
    }
  }

  if (matchedDevices.length > 0) {
    console.log("Detected", matchedDevices.length, "Shelly device(s) matching BLE ID:", rawBleIdStr);

    // Add each discovered device to DEPLOY_QUEUE.tasks with attempts=3
    for (var k = 0; k < matchedDevices.length; k++) {
      var d = matchedDevices[k];
      console.log("Discovered matching Shelly device (#" + (k+1) + "):", d.addr);
      DEPLOY_QUEUE.tasks.push({ addr: d.addr, attempts: 3 });
    }

    // Start the process
    doDeploy();

  } else {
    console.log("No Shelly devices matched BLE ID:", rawBleIdStr);
  }
}

/************************************************
* BLE SCAN INITIATION
************************************************/
function BLEScan() {
  var bleConfig = Shelly.getComponentConfig("BLE");
  if (!bleConfig || bleConfig.enable === false) {
    console.log("BLE disabled.");
    return;
  }

  Shelly.call("GATTC.Scan", BLE_SCAN_PARAMS, BLEScanCb);
}

/************************************************
* MAIN ACTION FUNCTION
************************************************/
function activateScanAndExecute() {
  // Clear the queue & counters
  DEPLOY_QUEUE.tasks.splice(0, DEPLOY_QUEUE.tasks.length);
  DEPLOY_QUEUE.success = 0;
  DEPLOY_QUEUE.fail = 0;

  // Start scanning
  BLEScan();
}

/************************************************
* SYSTEM BUTTON EVENT HANDLER
************************************************/
function _shelly_event_handler(ev) {
  if (!ev.info) return;
  if (ev.info.component !== "sys" || ev.info.event !== "brief_btn_down") return;
  if (ev.info.name !== CONFIG.SYS_BTN) return;

  console.log("System button pressed:", CONFIG.SYS_BTN);
  activateScanAndExecute();
}

/************************************************
* INITIALIZATION
************************************************/
function bindVirtualComponents(readyVc) {
  CONFIG.V_CMP_BLE_ID = readyVc.keys.bleId;
  CONFIG.V_CMP_SSID = readyVc.keys.ssid;
  CONFIG.V_CMP_PASS = readyVc.keys.pass;
  CONFIG.V_CMP_LOG = readyVc.keys.log;
  CONFIG.V_CMP_ACTIVATE_BTN = readyVc.keys.connectWifi;
}

function init() {
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log("Virtual component setup failed.");
      return;
    }
    bindVirtualComponents(readyVc);
    Shelly.addEventHandler(_shelly_event_handler);
    var deployBtn = readyVc.handles.connectWifi;
    if (deployBtn) {
      deployBtn.on("single_push", function() {
        console.log("Virtual button pressed - Starting BLE scan & deployment.");
        activateScanAndExecute();
      });
    }
  });
}

init();
