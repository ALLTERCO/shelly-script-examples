/**
 * @title BLU device label printer
 * @description Scans for Shelly BLU devices and sends device info to an online label printer.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/blu-assistant/print-label-online.shelly.js
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

   function bindVirtualComponents(readyVc) {
    CONFIG.V_CMP_BLE_ID = readyVc.keys.bleId;
    CONFIG.V_CMP_LOG = readyVc.keys.log;
    CONFIG.V_CMP_PRINTER_URL = readyVc.keys.printerUrl;
    CONFIG.V_CMP_ACTIVATE_BTN = readyVc.keys.printLabel;
   }

   function attachVirtualButton(readyVc) {
    var deployBtn = readyVc.handles.printLabel;
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
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
        if (!ok) {
            console.log("Virtual component setup failed.");
            return;
        }
        bindVirtualComponents(readyVc);
        Shelly.addEventHandler(_shelly_event_handler);
        attachVirtualButton(readyVc);
        console.log("Label printer script initialized.");
    });
   }

   init();
