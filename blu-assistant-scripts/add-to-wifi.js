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

  // Virtual Component Handles (must exist if you want to use them)
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
function init() {
  // Attach system button event
  Shelly.addEventHandler(_shelly_event_handler);

  // Attach virtual button with ID=button:200 if present
  var deployBtn = Virtual.getHandle(CONFIG.V_CMP_ACTIVATE_BTN);
  if (deployBtn) {
    deployBtn.on("single_push", function() {
      console.log("Virtual button pressed - Starting BLE scan & deployment.");
      activateScanAndExecute();
    });
  }
}

// Initialize everything
init();