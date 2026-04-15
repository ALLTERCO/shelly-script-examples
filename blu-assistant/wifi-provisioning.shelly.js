/**
 * @title BLU Assistant WiFi provisioning
 * @description Scans for Shelly devices matching a configurable list of model IDs and
 *   provisions them as WiFi STA clients. Call startProvisioning() via Script.Eval
 *   (e.g. from button-event-source.shelly.js) to trigger a scan-and-deploy cycle.
 * @status production
 * @link https://github.com/orlin369/shelly-script-examples/blob/main/blu-assistant/wifi-provisioning.shelly.js
 */

// ===================== CONFIG =====================
var PROV_CONFIG = {
  // Allterco/Shelly manufacturer signature in adv_data at index 10
  ALLTERCO_MFD_ID: "a90b",

  // Model IDs to provision (add more as needed).
  // --- Gen3 Wi-Fi+BLE devices ---
  // 0x1005  Shelly 2PM Gen3           (S3SW-002P16EU)
  // 0x1013  Shelly 2L Gen3            (S3SW-0A2X4EUL)
  // 0x1014  Shelly 1L Gen3            (S3SW-0A1X1EUL)
  // 0x1015  Shelly 1 Mini Gen3        (S3SW-001X8EU)
  // 0x1016  Shelly 1PM Mini Gen3      (S3SW-001P8EU)
  // 0x1018  Shelly 1 Gen3             (S3SW-001X16EU)
  // 0x1019  Shelly 1PM Gen3           (S3SW-001P16EU)
  // 0x1023  Shelly PM Mini Gen3       (S3PM-001PCEU16)
  // 0x1026  Shelly 3EM-63 Gen3        (S3EM-003CXCEU63)
  // 0x1027  Shelly EM Gen3            (S3EM-002CXCEU)
  // 0x1039  Shelly Shutter Gen3       (S3SH-0A2P4EU)
  // 0x1071  Shelly DALI Dimmer Gen3   (S3DM-0A1WW)
  // 0x1072  Shelly Dimmer 0/1-10V PM Gen3 (S3DM-0010WW)
  // 0x1073  Shelly Dimmer Gen3        (S3DM-0A101WWL)
  // 0x1805  Shelly Plug S MTR Gen3    (S3PL-00112EU)
  // 0x1809  Shelly H&T Gen3           (S3SN-0U12A)
  // 0x1812  Shelly i4 Gen3            (S3SN-0024X)
  // 0x1817  Shelly BLU Gateway Gen3   (S3GW-1DBT001)
  // 0x1829  The Pill by Shelly        (S3SN-0U53X)
  // 0x1850  Shelly AZ Plug Gen3       (S3PL-10112EU)
  // 0x1853  Shelly Outdoor Plug S Gen3 (S3PL-20112EU)
  // 0x1854  Shelly Plug PM Gen3       (S3PL-30116EU)
  // 0x1865  Shelly Plug M Gen3        (S3PL-30110EU)
  // --- Gen4 Wi-Fi+BLE devices ---
  // 0x1028  Shelly 1 Gen4             (S4SW-001X16EU)
  // 0x1029  Shelly 1PM Gen4           (S4SW-001P16EU)
  // 0x1030  Shelly 1 Mini Gen4        (S4SW-001X8EU)
  // 0x1031  Shelly 1PM Mini Gen4      (S4SW-001P8EU)
  // 0x1032  Shelly 2PM Gen4           (S4SW-002P16EU)
  // 0x1033  Shelly EM Mini Gen4       (S4EM-001PXCEU16)
  // 0x1075  Shelly Dimmer Gen4        (S4DM-0A101WWL)
  // 0x1076  Shelly Dimmer Gen4 US     (S4DM-0A102US)
  // 0x1822  Shelly Flood Gen4         (S4SN-0071A)
  // 0x1851  Shelly Power Strip 4 Gen4 (S4PL-00416EU)
  // 0x1852  Shelly Plug US Gen4       (S4PL-00116US)
  TARGET_MODEL_IDS: [0x1829],  // 0x1829 = The Pill

  // WiFi credentials to push to discovered devices
  WIFI_SSID: "your-ssid",
  WIFI_PASS: "your-password",

  // Max provisioning attempts per device before giving up
  MAX_ATTEMPTS: 3
};

// BLE scan parameters
var BLE_SCAN_PARAMS = {
  active: false,
  duration_ms: 1500,
  window_ms: 95,
  interval_ms: 100,
  rssi_thr: -100
};

// ===================== STATE ======================
var DEPLOY_QUEUE = {
  tasks: [],
  success: 0,
  fail: 0,
  running: false
};

// ===================== HELPERS ====================
// Extract 2-byte little-endian model ID from adv_data hex string (bytes at pos 22-25)
function extractDeviceID(adv_data) {
  return parseInt(adv_data.substring(22, 24), 16) +
        (parseInt(adv_data.substring(24, 26), 16) << 8);
}

// ===================== PROVISIONING ===============
function provisioningDone() {
  print("Provisioning complete. Success: " + DEPLOY_QUEUE.success +
        " | Fail: " + DEPLOY_QUEUE.fail);
  DEPLOY_QUEUE.running = false;
}

function doNextTask() {
  if (DEPLOY_QUEUE.tasks.length === 0) {
    provisioningDone();
    return;
  }

  var task = DEPLOY_QUEUE.tasks.pop();
  print("Provisioning " + task.addr + " (attempt " +
        (PROV_CONFIG.MAX_ATTEMPTS - task.attempts + 1) + "/" + PROV_CONFIG.MAX_ATTEMPTS + ")");

  Shelly.call("GATTC.Call", {
    addr: task.addr,
    method: "Wifi.SetConfig",
    params: {
      config: {
        sta: { ssid: PROV_CONFIG.WIFI_SSID, pass: PROV_CONFIG.WIFI_PASS, enable: true }
      }
    }
  }, function(result, err_code, err_msg) {
    if (err_code === 0) {
      print("OK " + task.addr);
      DEPLOY_QUEUE.success++;
    } else {
      print("ERR " + task.addr + ": " + err_msg);
      task.attempts--;
      if (task.attempts > 0) {
        DEPLOY_QUEUE.tasks.push(task);
      } else {
        print("FAIL " + task.addr + " - no more attempts");
        DEPLOY_QUEUE.fail++;
      }
    }
    doNextTask();
  });
}

// ===================== BLE SCAN ===================
function onScanResult(scan_result) {
  if (!scan_result || !Array.isArray(scan_result.results)) {
    print("BLE scan failed or no results");
    DEPLOY_QUEUE.running = false;
    return;
  }

  var found = 0;
  var devices = scan_result.results;

  for (var i = 0; i < devices.length; i++) {
    var dev = devices[i];
    if (typeof dev.adv_data !== "string") continue;
    if (dev.adv_data.indexOf(PROV_CONFIG.ALLTERCO_MFD_ID) !== 10) continue;
    var modelId = extractDeviceID(dev.adv_data);
    var matched = false;
    for (var j = 0; j < PROV_CONFIG.TARGET_MODEL_IDS.length; j++) {
      if (modelId === PROV_CONFIG.TARGET_MODEL_IDS[j]) { matched = true; break; }
    }
    if (!matched) continue;

    print("Found device: " + dev.addr + " model=0x" + modelId.toString(16) + " RSSI=" + dev.rssi);
    DEPLOY_QUEUE.tasks.push({ addr: dev.addr, attempts: PROV_CONFIG.MAX_ATTEMPTS });
    found++;
  }

  if (found === 0) {
    print("No matching devices found");
    DEPLOY_QUEUE.running = false;
    return;
  }

  print("Starting provisioning for " + found + " device(s)...");
  doNextTask();
}

// ===================== MAIN =======================
function startProvisioning() {
  if (DEPLOY_QUEUE.running) {
    print("Provisioning already in progress");
    return;
  }

  var bleConfig = Shelly.getComponentConfig("BLE");
  if (!bleConfig || bleConfig.enable === false) {
    print("BLE is disabled - cannot scan");
    return;
  }

  DEPLOY_QUEUE.tasks = [];
  DEPLOY_QUEUE.success = 0;
  DEPLOY_QUEUE.fail = 0;
  DEPLOY_QUEUE.running = true;

  print("Scanning for " + PROV_CONFIG.TARGET_MODEL_IDS.length + " model type(s)...");
  Shelly.call("GATTC.Scan", BLE_SCAN_PARAMS, onScanResult);
}

// ===================== INIT =======================
print("WiFi provisioning script ready. Call startProvisioning() to begin.");
