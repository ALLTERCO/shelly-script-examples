/**
 * @title Gen3 Matter firmware updater
 * @description Updates Shelly Gen3 devices to Matter firmware via BLE provisioning and OTA.
 */

/************************************************
 * CONFIGURATION & CONSTANTS
 ************************************************/
var CONFIG = {
    // RSSI threshold for including devices in queue
    RSSI_THRESHOLD: -35,
    
    // WiFi credentials
    WIFI_SSID: "YOUR_WIFI_SSID",          // WiFi SSID
    WIFI_PASS: "YOUR_WIFI_PASSWORD",       // WiFi password
  
    // Number of retry attempts when no update is found
    NO_UPDATE_RETRIES: 3,
  
    // Delay durations (ms)
    DELAY_AFTER_WIFI: 10000,      // 10 seconds
    DELAY_POST_UPDATE: 120000,    // 2 minutes
    DELAY_AFTER_REBOOT: 10000,    // 10 seconds
  
    // Manufacturer signature (if needed)
    ALLTERCO_MFD_ID: "a90b",
  
    // BLE Scan Parameters: we include RSSI threshold directly
    BLE_SCAN_PARAMS: {
      active: false,
      duration_ms: 750,
      window_ms: 95,
      interval_ms: 100,
      rssi_thr: -35  // only devices with RSSI ≥ –35
    },
  
    // How many GATT calls to run in parallel
    MAX_CONCURRENT: 4,
  
    // Button configuration
    SYS_BTN: "pair",
    V_CMP_ACTIVATE_BTN: "button:200"
  };
  
  // Queue for devices to process
  var deviceQueue = [];
  
  /************************************************
   * VERSION COMPARISON
   ************************************************/
  function versionCompare(v1, v2) {
    var a1 = v1.split('.').map(Number);
    var a2 = v2.split('.').map(Number);
    for (var i = 0; i < Math.max(a1.length, a2.length); i++) {
      var n1 = a1[i] || 0, n2 = a2[i] || 0;
      if (n1 > n2) return true;
      if (n1 < n2) return false;
    }
    return true;
  }
  
  /************************************************
   * HELPER FUNCTIONS
   ************************************************/
  
  /**
   * Extract the model ID from advertisement data (if needed)
   */
  function extractDeviceID(adv_data) {
    return parseInt(adv_data.substring(22,24), 16) +
           (parseInt(adv_data.substring(24,26), 16) << 8);
  }
  
  /**
   * Add a device to the queue if its RSSI meets the threshold
   */
  function queueDevice(dev) {
    if (dev.rssi >= CONFIG.RSSI_THRESHOLD) {
      console.log("Queueing device:", dev.addr, "RSSI:", dev.rssi);
      deviceQueue.push({ addr: dev.addr, rssi: dev.rssi });
    }
  }
  
  /************************************************
   * REMOTE RPC COMMAND FUNCTIONS
   ************************************************/
  
  function setWiFi(addr, ssid, pass, cb) {
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "WiFi.setConfig",
      params: {
        config: {
          sta1: { ssid: ssid, pass: pass, enable: true },
          ap: { enable: false }
        }
      }
    }, cb);
  }
  
  function getIPAddress(addr, cb) {
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "WiFi.GetStatus",
      params: {}
    }, function(res, err, msg) {
      if (err !== 0) {
        console.log("Error getting IP for", addr, msg);
        return cb(null);
      }
      cb(res.sta_ip);
    });
  }
  
  function getDeviceInfo(addr, cb) {
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "Shelly.GetDeviceInfo",
      params: {}
    }, cb);
  }
  
  function checkForFirmwareUpdate(addr, cb) {
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "Shelly.CheckForUpdate",
      params: {}
    }, function(result, err, msg) {
      if (err !== 0) {
        console.log("Error checking update for", addr, msg);
        return cb(false, null);
      }
      if (result && result.stable && result.stable.version) {
        cb(true, { version: result.stable.version, build: result.stable.build_id });
      } else {
        cb(false, null);
      }
    });
  }
  
  function triggerUpdate(addr, cb) {
    // Attempts to start firmware update and return error code/message
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "Shelly.Update",
      params: { stage: "stable" }
    }, function(res, err, msg) {
      if (err !== 0) {
        console.log("Error triggering update for", addr, msg);
      } else {
        console.log("Update triggered for", addr);
      }
      cb(err, msg);
    });
  }
  
  function rebootDevice(addr, cb) {
    console.log("Rebooting device", addr);
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "Sys.Reboot",
      params: {}
    }, cb);
  }
  
  function getMatterSetupCode(addr, cb) {
    Shelly.call("GATTC.call", {
      addr: addr,
      method: "Matter.GetSetupCode",
      params: {}
    }, function(res, err, msg) {
      cb(res, err, msg);
    });
  }
  
  /************************************************
   * BULK ACTION WITH CONCURRENCY THROTTLING
   ************************************************/
  function bulkAction(items, action, cb) {
    if (!items.length) return cb();
    var remaining = items.length, idx = 0, active = 0;
    function nextOne() {
      while (active < CONFIG.MAX_CONCURRENT && idx < items.length) {
        active++;
        (function(item) {
          action(item, function() {
            active--;
            remaining--;
            if (remaining === 0) return cb();
            nextOne();
          });
        })(items[idx++]);
      }
    }
    nextOne();
  }
  
  /************************************************
   * QUEUE PROCESSING SEQUENCE (PARALLEL)
   ************************************************/
  
  function runBatch() {
    console.log("== BATCH START == Devices to process:", deviceQueue.length);
    console.log("🔍 Phase 1: Configuring WiFi for all devices");
    deviceQueue.forEach(function(dev, idx) { dev.id = idx + 1; });
  
    // Phase 1: WiFi
    bulkAction(deviceQueue, function(dev, next) {
      console.log("Dev" + dev.id + " - Phase 1: Config WiFi for", dev.addr, "(RSSI:", dev.rssi + ")");
      setWiFi(dev.addr, CONFIG.WIFI_SSID, CONFIG.WIFI_PASS, next);
    }, function() {
      console.log("⌛ Waiting " + (CONFIG.DELAY_AFTER_WIFI/1000) + "s for all devices WiFi setup...");
      Timer.set(CONFIG.DELAY_AFTER_WIFI, false, function() {
  
        // Phase 2: IP
        console.log("📶 Phase 2: Retrieving device IPs");
        var attempts = 0;
        function tryIPs(devs) {
          attempts++;
          bulkAction(devs, function(dev, next) {
            getIPAddress(dev.addr, function(ip) {
              dev.ip = ip || null;
              console.log("Dev" + dev.id + " - " + dev.addr + " IP:", ip || "<none>");
              next();
            });
          }, function() {
            var success = devs.filter(function(d) { return d.ip; });
            var fail    = devs.filter(function(d) { return !d.ip; });
            console.log("📡 Devices with IP:", success.length);
            if (fail.length && attempts < CONFIG.NO_UPDATE_RETRIES) {
              console.log("🔄 Retrying", fail.length, "device(s) after 5s (retry", attempts, ")");
              Timer.set(5000, false, function() { tryIPs(fail); });
            } else {
              deviceQueue = success;
              if (!deviceQueue.length) {
                console.log("No devices with IP, aborting.");
                return;
              }
              phase3();
            }
          });
        }
        tryIPs(deviceQueue);
  
        // Phase 3: Current firmware
        function phase3() {
          console.log("🔍 Phase 3: Retrieving current firmware versions");
          bulkAction(deviceQueue, function(dev, next) {
            getDeviceInfo(dev.addr, function(info, err) {
              dev.currentVer = (err === 0 && info.ver) ? info.ver : "<unknown>";
              console.log("Dev" + dev.id + " - Current firmware for", dev.addr + ":", dev.currentVer);
              next();
            });
          }, phase4);
        }
  
        // Phase 4: Trigger updates if needed
        function phase4() {
          console.log("💡 Phase 4: Checking & triggering necessary updates");
  
          // Split into up-to-date vs needs-update
          var upToDate = [], toUpdate = [], updateErrors = [];
  
          deviceQueue.forEach(function(dev) {
            if (dev.currentVer && versionCompare(dev.currentVer, "1.6.1")) {
              console.log("Dev" + dev.id + " - Skipping update, firmware ≥1.6.1");
              upToDate.push(dev);
            } else {
              console.log("Dev" + dev.id + " - Firmware <1.6.1, scheduling update for", dev.addr);
              toUpdate.push(dev);
            }
          });
  
          // Attempt updates with retries
          var updated = [], failedUpdates = [];
          bulkAction(toUpdate, function(dev, next) {
            var attempts = 0;
            function tryTrigger() {
              attempts++;
              triggerUpdate(dev.addr, function(err, msg) {
                if (err) {
                  console.log("Dev" + dev.id + " - Update attempt", attempts, "failed:", msg);
                  if (attempts < CONFIG.NO_UPDATE_RETRIES) {
                    console.log("Dev" + dev.id + " - Retrying update in 5s");
                    Timer.set(5000, false, tryTrigger);
                  } else {
                    console.log("Dev" + dev.id + " - Giving up after", attempts, "attempts");
                    updateErrors.push("Dev" + dev.id + " update error: " + msg);
                    failedUpdates.push(dev);
                    next();
                  }
                } else {
                  console.log("Dev" + dev.id + " - Update triggered successfully");
                  updated.push(dev);
                  next();
                }
              });
            }
            tryTrigger();
          }, function() {
            // Phase 4b: Reboot only successfully updated
            console.log("🔄 Phase 4b: Rebooting updated devices:", updated.length);
            bulkAction(updated, function(dev, next) {
              console.log("Dev" + dev.id + " - Rebooting", dev.addr);
              rebootDevice(dev.addr, next);
            }, function() {
              console.log("⌛ Waiting " + (CONFIG.DELAY_AFTER_REBOOT/1000) + "s before Matter enable...");
              Timer.set(CONFIG.DELAY_AFTER_REBOOT, false, function() {
                // Merge upToDate + updated for Phase 5
                var phase5List = [];
                upToDate.forEach(function(d) { phase5List.push(d); });
                updated.forEach(function(d) { phase5List.push(d); });
                phase5(phase5List, updateErrors);
              });
            });
          });
        }
  
        // Phase 5: Enable Matter & retrieve codes
        function phase5(devices, updateErrors) {
          console.log("🔧 Phase 5: Enabling Matter on", devices.length, "devices");
          var matterErrors = [];
  
          devices.forEach(function(dev) {
            console.log("Dev" + dev.id + " - Enabling Matter for", dev.addr);
            Shelly.call("GATTC.call", {
              addr: dev.addr,
              method: "Matter.SetConfig",
              params: { config: { enable: true } }
            }, function(resCfg, errCfg, msgCfg) {
              if (errCfg !== 0) {
                console.log("Dev" + dev.id + " - Matter enable error:", msgCfg);
                matterErrors.push("Dev" + dev.id + " Matter error: " + msgCfg);
              } else {
                console.log("Dev" + dev.id + " - Matter.SetConfig response:", JSON.stringify(resCfg));
              }
            });
          });
  
          console.log("⌛ Waiting " + (CONFIG.DELAY_AFTER_REBOOT/1000) + "s after Matter enable...");
          Timer.set(CONFIG.DELAY_AFTER_REBOOT, false, function() {
            console.log("📜 Retrieving Matter setup codes for all devices");
            devices.forEach(function(dev) {
              getMatterSetupCode(dev.addr, function(resCode, errCode, msgCode) {
                // ← only check for manual_code & qr_code, then log existence
                if (errCode === 0 && resCode && resCode.manual_code && resCode.qr_code) {
                  console.log("Dev" + dev.id + " - Matter setup code exists");
                } else {
                  console.log("Dev" + dev.id + " - Error retrieving Matter code:", msgCode);
                  matterErrors.push("Dev" + dev.id + " getMatter code error: " + msgCode);
                }
              });
            });
  
            // Final error summary
            Timer.set(500, false, function() {
              if (updateErrors.length) {
                console.log("=== Update Errors ===");
                updateErrors.forEach(function(e) { console.log(e); });
              }
              if (matterErrors.length) {
                console.log("=== Matter Errors ===");
                matterErrors.forEach(function(e) { console.log(e); });
              }
            });
          });
        }
  
      }); // end DELAY_AFTER_WIFI callback
    });   // end Phase 1 bulkAction callback
  }       // end runBatch()
  
  /************************************************
   * BLE SCANNING
   ************************************************/
  function BLEScanCb(scan_result) {
    if (!scan_result || !Array.isArray(scan_result.results)) return;
    console.log("🔍 Starting BLE scan...");
    console.log("📡 Found", scan_result.results.length, "BLE advertisements");
    deviceQueue = [];
    scan_result.results.forEach(queueDevice);
    console.log("📡 Queued devices:", deviceQueue.length);
    if (deviceQueue.length > 0) runBatch();
    else console.log("No devices met RSSI threshold.");
  }
  
  function BLEScan() {
    console.log("🔍 Initiating BLE scan…");
    Shelly.call("GATTC.Scan", CONFIG.BLE_SCAN_PARAMS, BLEScanCb);
  }
  
  /************************************************
   * EVENT HANDLERS & INITIALIZATION
   ************************************************/
  
  function _shelly_event_handler(ev) {
    if (!ev.info || ev.info.component !== "sys" || ev.info.event !== "brief_btn_down") return;
    if (ev.info.name === CONFIG.SYS_BTN) {
      console.log("System button pressed — starting batch process.");
      BLEScan();
    }
  }
  
  var virtualDeployBtn = Virtual.getHandle(CONFIG.V_CMP_ACTIVATE_BTN);
  if (virtualDeployBtn) {
    virtualDeployBtn.on("single_push", function() {
      console.log("Virtual button pressed — starting batch process.");
      BLEScan();
    });
  }
  
  function init() {
    Shelly.addEventHandler(_shelly_event_handler);
    console.log("Batch update script initialized. Waiting for trigger...");
  }
  
  init();