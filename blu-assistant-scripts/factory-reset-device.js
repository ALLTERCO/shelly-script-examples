/************************************************
 * CONFIGURATION & CONSTANTS
 ************************************************/
var CONFIG = {
 FILTERED_BLE_ID: 0x1800,    // Default numeric hex ID (0x1800)
 ALLTERCO_MFD_ID: "a90b",    // Signature for Shelly devices
 SYS_BTN: "sys",             // Name of system button to trigger script
 S_ID: null,

 // Virtual Component Handles (adjust to your needs)
 V_CMP_BLE_ID: "text:200",
 V_CMP_LOG: "text:203",
 V_CMP_ACTIVATE_BTN: "button:201"
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
// Each device is an object { addr: "xx:xx:xx:xx:xx", attempts: 3 }
var DEPLOY_QUEUE = {
 tasks: [],     // We store discovered devices needing reset
 success: 0,    // Count of successful calls
 fail: 0        // Count of final failed calls
};

/************************************************
* HELPER FUNCTIONS
************************************************/
/**
* Extract 2 bytes from adv_data (indexes 22..25) to form device ID.
*/
function extractDeviceID(adv_data) {
 return parseInt(adv_data.substring(22,24), 16) +
        (parseInt(adv_data.substring(24,26), 16) << 8);
}

/**
* If a virtual text component is present, use its value; else use _default.
*/
function virtValueOrDefault(vkey, _default) {
 var cmp = Virtual.getHandle(vkey);
 if (cmp !== null) {
   return cmp.getValue();
 }
 return _default;
}

/**
* Show queue status (Remaining / Success / Fail) in console and text:203 if present
*/
function updateLog() {
 var logField = Virtual.getHandle(CONFIG.V_CMP_LOG);
 var msg =
   "Remaining: " + DEPLOY_QUEUE.tasks.length +
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
 updateLog();

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
* Callback after GATTC.call for Shelly.FactoryReset. 
* If err_code=0 => success; else we decrement attempts, re-queue if any remain.
*/
function remoteRPCCallback(task, result, err_code, err_msg) {
 var addr = task.addr;
 var methodName = "Shelly.FactoryReset";

 if (err_code === 0) {
   console.log("SUCCESS for device:", addr, "Method:", methodName, "Attempts left:", task.attempts);
   DEPLOY_QUEUE.success++;
 } else {
   console.log("ERROR for device:", addr, "Method:", methodName, "-", err_msg, "Attempts left:", task.attempts);
   task.attempts--;

   if (task.attempts > 0) {
     console.log("Will retry device:", addr, "Remaining attempts:", task.attempts);
     // re-queue the device
     DEPLOY_QUEUE.tasks.push(task);
   } else {
     // final fail
     console.log("Final fail for device:", addr);
     DEPLOY_QUEUE.fail++;
   }
 }

 doDeploy();
}

/**
* Calls Shelly.FactoryReset. If fail => schedule a retry until attempts=0.
*/
function doRemoteRPC(task) {
 var addr = task.addr;
 var methodName = "Shelly.FactoryReset";

 console.log("Executing remote RPC for device:", addr, "->", methodName, "Attempts:", task.attempts);

 Shelly.call("GATTC.call",
   {
     addr: addr,
     method: methodName,
     params: {}
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

 // Possibly user input for BLE ID (default "1800")
 var rawBleIdStr = virtValueOrDefault(CONFIG.V_CMP_BLE_ID, "1800");
 var parsedBleId = parseInt(rawBleIdStr, 16);

 // Filter by Shelly signature "a90b" at index=10
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

 // Among Shelly devices, see which match user-specified or default BLE ID
 for (var j = 0; j < shellyDevices.length; j++) {
   var device = shellyDevices[j];
   var model_id = extractDeviceID(device.adv_data);
   if (model_id === parsedBleId) {
     matchedDevices.push(device);
   }
 }

 if (matchedDevices.length > 0) {
   console.log("Detected", matchedDevices.length, "Shelly device(s) matching BLE ID:", rawBleIdStr);

   // For each matched device, add { addr, attempts: 3 } to tasks
   for (var k = 0; k < matchedDevices.length; k++) {
     var d = matchedDevices[k];
     console.log("Discovered matching Shelly device (#" + (k+1) + "):", d.addr);

     // Start with 3 attempts (adjust as desired)
     DEPLOY_QUEUE.tasks.push({ addr: d.addr, attempts: 3 });
   }

   // Start deployment
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
 // Clear the queue
 DEPLOY_QUEUE.tasks = [];
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
 if (ev.info.component !== "sys" || ev.info.event !== "brief_btn_down") {
   return;
 }
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

 // Attach virtual button with ID=201 if present
 var deployBtn = Virtual.getHandle(CONFIG.V_CMP_ACTIVATE_BTN);
 if (deployBtn) {
   deployBtn.on("single_push", function() {
     console.log("Virtual button 201 pressed - Starting BLE scan & factory reset.");
     activateScanAndExecute();
   });
 }
}

// Initialize
init();