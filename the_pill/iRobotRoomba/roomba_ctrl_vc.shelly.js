/**
 * @title iRobot Roomba button controller + Virtual Components
 * @description Controls Roomba via self-created virtual buttons and physical inputs over UART.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/iRobotRoomba/roomba_ctrl_vc.shelly.js
 */

/**
 * iRobot Roomba 560 - Button Control Script
 *
 * Controls Roomba 560 via virtual buttons and physical inputs.
 * Uses The Pill UART to communicate with Roomba via mini-DIN connector.
 *
 * Button Mappings:
 * - Button 1 (single): Clean / Start cleaning
 * - Button 1 (double): Stop / Emergency stop
 * - Button 1 (long):   Dock / Return to base
 * - Button 2 (single): Spot clean
 *
 * Hardware Connection:
 * - Roomba mini-DIN pin 3 (RXD) -> Shelly TX
 * - Roomba mini-DIN pin 4 (TXD) -> Shelly RX
 * - Roomba mini-DIN pin 5 (BRC) -> Optional wake pin
 * - Roomba mini-DIN pin 6,7 (GND) -> Shelly GND
 *
 * @see https://github.com/orlin369/Roomba
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


// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
    // UART settings (Roomba 500 series default: 115200)
    baud: 115200,
    mode: '8N1',

    // Command delay between OI commands (ms)
    cmdDelayMs: 50,

    // Debug output
    debug: true,

    // Button components for control
    buttons: {
        main: 'button:200',     // Main control button
        spot: 'button:201'      // Spot clean button
    },

    // Virtual components for status display
    vc: {
        statusDisplay: 'text:200',
        batteryDisplay: 'number:200'
    },

    // Battery monitor interval (ms) - 0 to disable
    batteryPollMs: 60000
};


var VIRTUAL_COMPONENTS = {
    components: [
        { key: "mainButton", type: "button", id: 200, config: { name: "Roomba Main", meta: { ui: { view: "button" }, cloud: ["events"] } } },
        { key: "spotButton", type: "button", id: 201, config: { name: "Roomba Spot", meta: { ui: { view: "button" }, cloud: ["events"] } } },
        { key: "statusDisplay", type: "text", id: 200, config: { name: "Roomba Status", default_value: "", persisted: false, meta: { ui: { view: "label", maxLength: 128 }, cloud: ["log"] } } },
        { key: "batteryDisplay", type: "number", id: 200, config: { name: "Roomba Battery", default_value: 0, min: 0, max: 100, meta: { ui: { view: "progressbar", unit: "%", step: 1 }, cloud: ["measurement"] } } }
    ],
    groups: [
        { id: 200, name: "Roomba Control", components: ["mainButton", "spotButton", "statusDisplay", "batteryDisplay"] }
    ]
};

function bindVirtualComponents(readyVc) {
    CONFIG.buttons.main = readyVc.keys.mainButton;
    CONFIG.buttons.spot = readyVc.keys.spotButton;
    CONFIG.vc.statusDisplay = readyVc.keys.statusDisplay;
    CONFIG.vc.batteryDisplay = readyVc.keys.batteryDisplay;
    vcStatus = readyVc.handles.statusDisplay;
    vcBattery = readyVc.handles.batteryDisplay;
}

// ============================================================================
// OI OPCODES
// ============================================================================

var OI = {
    START: 128,
    SAFE: 131,
    FULL: 132,
    POWER: 133,
    SPOT: 134,
    COVER: 135,
    DOCK: 143,
    DRIVE: 137,
    DRIVERS: 138,
    SENSORS: 142
};

// ============================================================================
// SENSOR PACKET IDS
// ============================================================================

var SENSOR = {
    GROUP_3: 3,
    BUMPS_WHEELDROPS: 7
};

// ============================================================================
// CONSTANTS
// ============================================================================

var MODE = {
    OFF: 0,
    PASSIVE: 1,
    SAFE: 2,
    FULL: 3
};

// ============================================================================
// STATE
// ============================================================================

var uart = null;
var currentMode = MODE.OFF;
var isReady = false;
var isCleaning = false;

// Virtual component handles
var vcStatus = null;
var vcBattery = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

function bytesToHexStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += (i ? ' ' : '') + toHex(bytes[i]);
    }
    return s;
}

function int16ToBytes(val) {
    val = val & 0xFFFF;
    return [(val >> 8) & 0xFF, val & 0xFF];
}

function dbg(msg) {
    if (CONFIG.debug) {
        print('[ROOMBA] ' + msg);
    }
}

// ============================================================================
// ROOMBA CONTROL
// ============================================================================

function sendRaw(bytes) {
    if (!uart) return;
    dbg('TX: ' + bytesToHexStr(bytes));
    uart.write(bytesToStr(bytes));
}

function sendCmd(opcode) {
    sendRaw([opcode & 0xFF]);
}

function start() {
    sendCmd(OI.START);
    currentMode = MODE.PASSIVE;
    dbg('Started OI -> Passive mode');
    updateStatus('Passive');
}

function safe() {
    sendCmd(OI.SAFE);
    currentMode = MODE.SAFE;
    dbg('Safe mode');
    updateStatus('Safe');
}

function power() {
    sendCmd(OI.POWER);
    currentMode = MODE.PASSIVE;
    isCleaning = false;
    dbg('Power off');
    updateStatus('Power Off');
}

function spot() {
    sendCmd(OI.SPOT);
    isCleaning = true;
    dbg('Spot cleaning');
    updateStatus('Spot');
}

function clean() {
    sendCmd(OI.COVER);
    isCleaning = true;
    dbg('Cleaning');
    updateStatus('Cleaning');
}

function dock() {
    sendCmd(OI.DOCK);
    isCleaning = false;
    dbg('Seeking dock');
    updateStatus('Docking');
}

function stop() {
    var velBytes = int16ToBytes(0);
    var radBytes = int16ToBytes(0);
    sendRaw([OI.DRIVE, velBytes[0], velBytes[1], radBytes[0], radBytes[1]]);
    sendRaw([OI.DRIVERS, 0]);
    isCleaning = false;
    dbg('STOP');
    updateStatus('Stopped');
}

function wakeUp(callback) {
    dbg('Waking up Roomba...');

    Timer.set(100, false, function() {
        start();

        Timer.set(CONFIG.cmdDelayMs, false, function() {
            safe();

            Timer.set(CONFIG.cmdDelayMs, false, function() {
                isReady = true;
                dbg('Roomba ready');
                updateStatus('Ready');
                if (callback) callback();
            });
        });
    });
}

// ============================================================================
// VIRTUAL COMPONENTS
// ============================================================================

function updateStatus(status) {
    if (vcStatus) {
        try {
            vcStatus.setValue(status);
        } catch (e) { }
    }
}

function updateBattery(percent) {
    if (vcBattery) {
        try {
            vcBattery.setValue(percent);
        } catch (e) { }
    }
}

function initVirtualComponents(callback) {
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
        if (!ok) {
            print('[ROOMBA] ERROR: Virtual component setup failed');
            return;
        }
        bindVirtualComponents(readyVc);
        dbg('Virtual components ready');
        if (callback) callback();
    });
}

// ============================================================================
// BUTTON HANDLERS
// ============================================================================

function onMainButton(event) {
    dbg('Main button: ' + event);

    if (!isReady) {
        wakeUp(function() {
            onMainButton(event);
        });
        return;
    }

    if (event === 'single_push') {
        if (isCleaning) {
            stop();
        } else {
            clean();
        }
    } else if (event === 'double_push') {
        stop();
    } else if (event === 'long_push') {
        dock();
    }
}

function onSpotButton(event) {
    dbg('Spot button: ' + event);

    if (!isReady) {
        wakeUp(function() {
            onSpotButton(event);
        });
        return;
    }

    if (event === 'single_push') {
        spot();
    }
}

function onEvent(ev) {
    if (!ev.info || !ev.info.event) return;

    var event = ev.info.event;

    if (ev.component === CONFIG.buttons.main) {
        onMainButton(event);
    } else if (ev.component === CONFIG.buttons.spot) {
        onSpotButton(event);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    print('[ROOMBA] Initializing Roomba 560 controller...');

    // Initialize UART
    uart = UART.get();
    if (!uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
        print('[ROOMBA] ERROR: Failed to configure UART');
        return;
    }

    // Initialize virtual components before binding button events
    initVirtualComponents(function() {
        // Register event handler
        Shelly.addEventHandler(onEvent);

        // Setup battery monitoring
        if (CONFIG.batteryPollMs > 0) {
            Timer.set(CONFIG.batteryPollMs, true, function() {
                if (isReady) {
                    sendRaw([OI.SENSORS, SENSOR.GROUP_3]);
                }
            });
        }

        updateStatus('Initialized');
        dbg('Initialized @ ' + CONFIG.baud + ' baud');
        dbg('Main button: ' + CONFIG.buttons.main);
        dbg('Spot button: ' + CONFIG.buttons.spot);
        print('[ROOMBA] Ready. Press main button to wake and control Roomba.');
    });
}

init();
