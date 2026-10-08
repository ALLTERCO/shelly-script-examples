/**
 * @title BLU Assistant full device configuration
 * @description Configures Shelly BLU devices with WiFi, name, and timezone via BLE RPC.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/blu-assistant/full-config.shelly.js
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
  // Target device identification values
  FILTERED_BLE_ID: "",            // Device id (must fill via text:200)
  ALLTERCO_MFD_ID: "a90b",        // Manufacturer signature (position index=10)

  // Device configuration parameters
  DEVICE_NAME: "",       // Device name to set (override via text:203)
  WIFI_SSID: "",                  // WiFi SSID (override via text:201)
  WIFI_PASS: "",                 // WiFi password (override via text:202)
  LOCATION_TZ: "Europe/Sofia",    // Timezone for device location (override via text:204)

  // Button & virtual-component handles are created and verified at startup.
  SYS_BTN: "pair",                // Physical system button name
  V_CMP_BLE_ID:       "text:200", // BLE ID
  V_CMP_SSID:         "text:201", // SSID
  V_CMP_PASS:         "text:202", // Pass
  V_CMP_DEVICE_NAME:  "text:203", // Device Name
  V_CMP_LOCATION_TZ:  "text:204", // Location TZ
  V_CMP_CONFIG_BTN:   "button:201",// Config (virtual) button
  V_CMP_LOG:          "text:211"   // LOG
};

// BLE Scan Parameters
var BLE_SCAN_PARAMS = {
  active: false,
  duration_ms: 750,
  window_ms: 95,
  interval_ms: 100,
  rssi_thr: -70
};

/************************************************
 * HELPER FUNCTIONS
 ************************************************/
/**
 * Extract the model ID from the advertisement data.
 * Assumes the model ID is contained in bytes at positions 22-25.
 */
function extractDeviceID(adv_data) {
  return parseInt(adv_data.substring(22,24), 16) +
         (parseInt(adv_data.substring(24,26), 16) << 8);
}

/**
 * Bubble sort devices by RSSI (descending order).
 */
function sortDevicesByRSSI(devices) {
  for (var i = 0; i < devices.length; i++) {
    for (var j = i + 1; j < devices.length; j++) {
      if (devices[i].rssi < devices[j].rssi) {
        var tmp = devices[i];
        devices[i] = devices[j];
        devices[j] = tmp;
      }
    }
  }
}

/**
 * If a virtual text component is present, returns its value; else returns _default.
 */
function virtValueOrDefault(vkey, _default) {
  var cmp = Virtual.getHandle(vkey);
  if (cmp) {
    var v = cmp.getValue();
    if (v !== "" && v !== null && v !== undefined) return v;
  }
  return _default;
}

/************************************************
 * REMOTE RPC COMMAND FUNCTIONS
 ************************************************/
/**
 * Set the device name.
 */
function setDeviceName(addr, name, callback) {
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "Sys.SetConfig",
    params: { config: { device: { name: name } } }
  }, callback);
}

/**
 * Configure the device to connect to a WiFi network and disable AP mode.
 */
function setWiFi(addr, ssid, pass, callback) {
  console.log("Configuring WiFi for", addr, "with SSID:", ssid);
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "WiFi.setConfig",
    params: {
      config: {
        sta1: { ssid: ssid, pass: pass, enable: true },
        ap:   { enable: false }
      }
    }
  }, callback);
}

/**
 * Set the device location (timezone).
 */
function setLocation(addr, tz, callback) {
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "Sys.SetConfig",
    params: { config: { location: { tz: tz } } }
  }, callback);
}

/**
 * Trigger the firmware update command.
 */
function updateDevice(addr, callback) {
  console.log("Triggering update command for", addr, "to 'stable' stage.");
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "Shelly.Update",
    params: { stage: "stable" }
  }, callback);
}

/************************************************
 * FIRMWARE UPDATE CHECK FUNCTION
 ************************************************/
/**
 * Check for a firmware update.
 * Callback: callback(updateAvailable, stableInfo)
 */
function checkForFirmwareUpdate(addr, callback) {
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "Shelly.CheckForUpdate",
    params: {}
  }, function(result, err_code, err_msg) {
    if (err_code !== 0) {
      console.log("Error checking for update:", err_msg);
      callback(false, null);
    } else if (result && result.stable && result.stable.version) {
      var stableInfo = {
        version: result.stable.version,
        build_id: result.stable.build_id
      };
      callback(true, stableInfo);
    } else {
      callback(false, null);
    }
  });
}

/************************************************
 * CONFIGURATION VERIFICATION FUNCTIONS
 ************************************************/
/**
 * Retrieve and print essential system configuration.
 * Prints only location: timezone, latitude, and longitude.
 */
function getSysConfig(addr, callback) {
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "Sys.GetConfig",
    params: {}
  }, function(result, err_code, err_msg) {
    if (err_code !== 0) {
      console.log("Error retrieving system config:", err_msg);
    } else if (result && result.location) {
      var tz = result.location.tz || "(unknown)";
      var lat = result.location.lat;
      var lon = result.location.lon;
      console.log("Location: Timezone: " + tz + "; Lat: " + lat + ", Lon: " + lon);
    } else {
      console.log("Sys Config: Incomplete data");
    }
    callback();
  });
}

/**
 * Retrieve and print WiFi status.
 * Prints in the format: "WiFi: [status]; [sta_ip]"
 */
function getWifiStatus(addr, callback) {
  Shelly.call("GATTC.call", {
    addr: addr,
    method: "WiFi.GetStatus",
    params: {}
  }, function(result, err_code, err_msg) {
    if (err_code !== 0) {
      console.log("Error retrieving WiFi status:", err_msg);
    } else {
      var status = result.status || "(unknown)";
      var ip = result.sta_ip || "(unknown)";
      console.log("WiFi: " + status + "; " + ip);
    }
    callback();
  });
}

/************************************************
 * DEPLOYMENT SEQUENCE
 *
 * Sequence:
 * 1. Configure WiFi.
 * 2. Wait ~6 seconds, then print "WiFi configured successfully."
 * 3. Immediately, send rename and set-location commands.
 * 4. Read final configuration (WiFi and location) sequentially.
 * 5. Check for firmware update; if available, trigger it and exit.
 ************************************************/
function deployConfiguration(addr) {
  console.log("Starting deployment configuration for device:", addr);

  // 1. Configure WiFi.
  var ssid = virtValueOrDefault(CONFIG.V_CMP_SSID, CONFIG.WIFI_SSID);
  var pass = virtValueOrDefault(CONFIG.V_CMP_PASS, CONFIG.WIFI_PASS);

  setWiFi(addr, ssid, pass, function(result, err_code, err_msg) {
    if (err_code !== 0) {
      console.log("Error configuring WiFi:", err_msg);
      return;
    }

    // 2. Wait 6 seconds then print message.
    Timer.set(6000, false, function() {
      console.log("WiFi configured successfully.");

      // 3. Immediately send rename and set location commands.
      var name = virtValueOrDefault(CONFIG.V_CMP_DEVICE_NAME, CONFIG.DEVICE_NAME);
      var tz   = virtValueOrDefault(CONFIG.V_CMP_LOCATION_TZ, CONFIG.LOCATION_TZ);

      console.log("Setting device name to " + name);
      setDeviceName(addr, name, function(res1, err1, msg1) {
        if (err1 !== 0) {
          console.log("Error setting device name:", msg1);
        }
      });

      console.log("Setting location (timezone) to " + tz);
      setLocation(addr, tz, function(res2, err2, msg2) {
        if (err2 !== 0) {
          console.log("Error setting location:", msg2);
        }
      });

      // 4. Immediately read final configuration.
      getSysConfig(addr, function() {
        getWifiStatus(addr, function() {
          // 5. Then check for firmware update.
          checkForFirmwareUpdate(addr, function(updateAvailable, stableInfo) {
            if (updateAvailable) {
              console.log("Stable update available: Version: " + stableInfo.version +
                          ", Build: " + stableInfo.build_id);
              updateDevice(addr, function(res3, err3, msg3) {
                if (err3 !== 0) {
                  console.log("Error triggering update command:", msg3);
                  return;
                }
                console.log("Update initiated successfully. Update in progress. Script Done.");
              });
            } else {
              console.log("No stable firmware update available. Script Done.");
            }
          });
        });
      });
    });
  });
}

/************************************************
 * BLE SCANNING FUNCTIONS
 ************************************************/
/**
 * BLE scan callback: filters for devices matching the configured model ID
 * and selects the one with the strongest RSSI.
 */
function BLEScanCb(scan_result) {
  if (!scan_result || !Array.isArray(scan_result.results)) {
    console.log("Invalid BLE scan result.");
    return;
  }

  var devices = scan_result.results;
  var matchedDevices = [];

  // Possibly user input for BLE ID, fallback = abort if empty
  var rawBleIdStr = virtValueOrDefault(CONFIG.V_CMP_BLE_ID, "");
  if (!rawBleIdStr) {
    console.log("❗️ No BLE ID specified (text:200). Aborting scan.");
    return;
  }
  var targetId = parseInt(rawBleIdStr, 16);

  // Filter devices by manufacturer signature and model ID.
  for (var i = 0; i < devices.length; i++) {
    var dev = devices[i];
    if (typeof dev.adv_data === "string" &&
        dev.adv_data.indexOf(CONFIG.ALLTERCO_MFD_ID) === 10 &&
        extractDeviceID(dev.adv_data) === targetId) {
      matchedDevices.push(dev);
    }
  }

  if (matchedDevices.length === 0) {
    console.log("No matching devices found in BLE scan for ID:", rawBleIdStr);
    return;
  }

  sortDevicesByRSSI(matchedDevices);
  var target = matchedDevices[0];
  console.log("Found target device:", target.addr, "with RSSI:", target.rssi);
  deployConfiguration(target.addr);
}

/**
 * Initiate BLE scan.
 */
function BLEScan() {
  console.log("Starting BLE scan...");
  Shelly.call("GATTC.Scan", BLE_SCAN_PARAMS, BLEScanCb);
}

/************************************************
 * EVENT HANDLERS & INITIALIZATION
 ************************************************/
/**
 * Physical system button event handler: triggers BLE scan.
 */
function _shelly_event_handler(ev) {
  if (!ev.info) return;
  if (ev.info.component !== "sys" || ev.info.event !== "brief_btn_down") return;
  if (ev.info.name !== CONFIG.SYS_BTN) return;

  console.log("System button pressed:", CONFIG.SYS_BTN, "— Initiating BLE scan.");
  BLEScan();
}

/**
 * Optional: attach a virtual button event handler.
 */
function bindVirtualComponents(readyVc) {
  CONFIG.V_CMP_BLE_ID = readyVc.keys.bleId;
  CONFIG.V_CMP_SSID = readyVc.keys.ssid;
  CONFIG.V_CMP_PASS = readyVc.keys.pass;
  CONFIG.V_CMP_DEVICE_NAME = readyVc.keys.deviceName;
  CONFIG.V_CMP_LOCATION_TZ = readyVc.keys.locationTz;
  CONFIG.V_CMP_CONFIG_BTN = readyVc.keys.configDevice;
  CONFIG.V_CMP_LOG = readyVc.keys.log;
}

function init() {
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log("Virtual component setup failed.");
      return;
    }
    bindVirtualComponents(readyVc);
    Shelly.addEventHandler(_shelly_event_handler);
    var virtualDeployBtn = readyVc.handles.configDevice;
    if (virtualDeployBtn) {
      virtualDeployBtn.on("single_push", function() {
        console.log("Virtual button pressed - Initiating BLE scan.");
        BLEScan();
      });
    }
    console.log("Configuration script initialized. Waiting for trigger...");
  });
}

init();
