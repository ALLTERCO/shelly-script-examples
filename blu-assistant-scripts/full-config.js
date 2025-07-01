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
  
  // Button & virtual-component handles
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
var virtualDeployBtn = Virtual.getHandle(CONFIG.V_CMP_CONFIG_BTN);
if (virtualDeployBtn) {
  virtualDeployBtn.on("single_push", function() {
    console.log("Virtual button pressed — Initiating BLE scan.");
    BLEScan();
  });
}

/**
 * Initialize event handlers.
 */
function init() {
  Shelly.addEventHandler(_shelly_event_handler);
  console.log("Configuration script initialized. Waiting for trigger...");
}

// Start the script
init();