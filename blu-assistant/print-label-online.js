/************************************************
 * CONFIGURATION & CONSTANTS
 ************************************************/
var CONFIG = {
    ALLTERCO_MFD_ID: "a90b",  // Shelly devices signature
    SYS_BTN: "pair",          // System button to trigger the script
    V_CMP_BLE_ID: "text:200",
    V_CMP_LOG: "text:203",
    V_CMP_ACTIVATE_BTN: "button:202",
    V_CMP_PRINTER_URL: "text:204",
    DEFAULT_BLE_ID: "",
    DEFAULT_PRINTER_URL: ""
   };
   
   var BLE_SCAN_PARAMS = {
    active: false,
    duration_ms: 505,
    window_ms: 95,
    interval_ms: 100,
    rssi_thr: -40
   };
   
   /************************************************
   * DEPLOYMENT QUEUE (LOW RAM)
   ************************************************/
   var DEPLOY_QUEUE = {
    tasks: [],
    running: false
   };
   
   /************************************************
   * HELPER FUNCTIONS
   ************************************************/
   function virtValueOrDefault(vkey, _default) {
    var cmp = Virtual.getHandle(vkey);
    return (cmp !== null) ? cmp.getValue() : _default;
   }
   
   function extractDeviceID(adv_data) {
    return parseInt(adv_data.substring(22, 24), 16) +
        (parseInt(adv_data.substring(24, 26), 16) << 8);
   }
   
   function formatManualCode(code) {
    if (!code || code === "N/A") return code;
    var groups = [];
    for (var i = 0; i < code.length; i += 4) {
        groups.push(code.substring(i, i + 4));
    }
    return groups.join('-');
   }
   
   /************************************************
   * DEPLOYMENT LOGIC
   ************************************************/
   function doDeploy() {
    if (DEPLOY_QUEUE.running || DEPLOY_QUEUE.tasks.length === 0) return;
   
    DEPLOY_QUEUE.running = true;
    var task = DEPLOY_QUEUE.tasks.splice(0, 1)[0]; // Replaces shift()
   
    if (!task) {
        DEPLOY_QUEUE.running = false;
        return;
    }
   
    doRemoteRPC(task, function() {
        DEPLOY_QUEUE.running = false;
        doDeploy(); // Continue with the next task
    });
   }
   
   /************************************************
   * RPC LOGIC
   ************************************************/
   function doRemoteRPC(task, callback) {
    var addr = task.addr;
    var methodName = "Matter.GetSetupCode";
   
    console.log("Processing device " + addr + " for " + methodName + " (Attempts: " + task.attempts + ")");
   
    Shelly.call("GATTC.call",
        { addr: addr, method: methodName, params: {} },
        function(result, err_code, err_msg) {
            if (err_code === 0) {
                handleRPCSuccess(task, result);
            } else {
                handleRPCFailure(task, err_code, err_msg);
            }
            callback();
        }
    );
   }
   
   function handleRPCSuccess(task, result) {
    try {
        if (typeof result === "string") result = JSON.parse(result);
    } catch (e) {
        console.log("ERROR parsing RPC result for device " + task.addr + ": " + e);
        return;
    }
   
    var qr_code = result.qr_code || "N/A";
    var manual_code = formatManualCode(result.manual_code || "N/A");
   
    var zpl_template =
        "^XA^CWM,E:CSA.TTF^PQ1^FO120,140^XGE:L.GRF^FS" +
        "^FO310,185^BQI,2,15^FD" + qr_code + "^FS" +
        "^FO751,216^AMB,48,48^FD" + manual_code + "^FS" + // making the text bolder
        "^FO750,215^AMB,48,48^FD" + manual_code + "^FS ^XZ"; 
   
    console.log("QR Code: " + qr_code);
    console.log("Manual Code: " + manual_code);
    console.log("ZPL Template: " + zpl_template);
   
    sendToPrinter(zpl_template);
   }
   
   function handleRPCFailure(task, err_code, err_msg) {
    console.log("ERROR for device " + task.addr + ": " + err_msg + " | Attempts left: " + task.attempts);
    task.attempts--;
   
    if (task.attempts > 0) {
        DEPLOY_QUEUE.tasks.push(task);
    }
   }
   
   function sendToPrinter(zpl_template) {
    var printerUrl = virtValueOrDefault(CONFIG.V_CMP_PRINTER_URL, CONFIG.DEFAULT_PRINTER_URL);
    if (!printerUrl) {
        console.log("Printer URL not provided.");
        return;
    }
   
    console.log("Sending print job to " + printerUrl);
    Shelly.call("HTTP.Request",
        { method: "POST", url: printerUrl, body: zpl_template, headers: { "Content-Type": "text/plain" } },
        function(result, err_code, err_msg) {
            if (err_code === 0 || err_code === -104) {
                console.log("Print job sent successfully.");
            } else {
                console.log("Print job failed: " + err_msg);
            }
        }
    );
   }
   
   /************************************************
   * BLE SCAN CALLBACK (FIXED)
   ************************************************/
   function BLEScanCb(scan_result) {
    if (!scan_result || !scan_result.results || scan_result.results.length === 0) {
        console.log("Invalid BLE scan result or no devices found.");
        return;
    }
   
    var matterDevices = [];
    for (var i = 0; i < scan_result.results.length; i++) {
        var dev = scan_result.results[i];
        if (typeof dev.adv_data === "string" && dev.adv_data.indexOf(CONFIG.ALLTERCO_MFD_ID) === 10) {
            matterDevices.push(dev);
        }
    }
   
    if (matterDevices.length === 0) {
        console.log("No Matter (Shelly) devices found.");
        return;
    }
   
    var rawBleIdStr = virtValueOrDefault(CONFIG.V_CMP_BLE_ID, CONFIG.DEFAULT_BLE_ID);
    var parsedBleId = parseInt(rawBleIdStr, 16);
   
    var matchedDevices = [];
    for (var j = 0; j < matterDevices.length; j++) {
        if (extractDeviceID(matterDevices[j].adv_data) === parsedBleId) {
            matchedDevices.push(matterDevices[j]);
        }
    }
   
    if (matchedDevices.length > 0) {
        for (var k = 0; k < matchedDevices.length; k++) {
            DEPLOY_QUEUE.tasks.push({ addr: matchedDevices[k].addr, attempts: 3 });
        }
        console.log("Added " + matchedDevices.length + " devices to deployment queue.");
        doDeploy();
    } else {
        console.log("No matching BLE ID: " + rawBleIdStr);
    }
   }
   
   /************************************************
   * BLE SCAN INITIATION
   ************************************************/
   function BLEScan() {
    var bleConfig = Shelly.getComponentConfig("BLE");
    if (!bleConfig || !bleConfig.enable) {
        console.log("BLE is disabled.");
        return;
    }
    Shelly.call("GATTC.Scan", BLE_SCAN_PARAMS, BLEScanCb);
   }
   
   /************************************************
   * MAIN ACTION FUNCTION
   ************************************************/
   function activateScanAndExecute() {
    DEPLOY_QUEUE.tasks = [];
    DEPLOY_QUEUE.running = false;
   
    console.log("Starting BLE scan...");
    BLEScan();
   }
   
   /************************************************
   * SYSTEM BUTTON & VIRTUAL BUTTON EVENT HANDLERS
   ************************************************/
   function _shelly_event_handler(ev) {
    if (!ev.info || ev.info.component !== "sys" || ev.info.event !== "brief_btn_down" || ev.info.name !== CONFIG.SYS_BTN) return;
    
    console.log("System button pressed.");
    activateScanAndExecute();
   }
   
   function attachVirtualButton() {
    var deployBtn = Virtual.getHandle(CONFIG.V_CMP_ACTIVATE_BTN);
    if (deployBtn) {
        deployBtn.on("single_push", function() {
            console.log("Virtual button pressed. Starting BLE scan.");
            activateScanAndExecute();
        });
    }
   }
   
   /************************************************
   * INITIALIZATION
   ************************************************/
   function init() {
    Shelly.addEventHandler(_shelly_event_handler);
    attachVirtualButton();
    console.log("Matter.GetSetupCode script initialized.");
   }
   
   init();