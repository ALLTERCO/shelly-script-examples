/**
 * @title YS-IRTM infrared UART library + Virtual Components
 * @description UART protocol implementation for YS-IRTM to send and receive NEC IR
 *   codes with self-created Shelly Virtual Components.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/ys_irtm/ysirtm_vc.shelly.js
 */

/**
 * YS-IRTM Infrared TX/RX Module - Core API Library
 *
 * Full implementation of the YS-IRTM UART protocol for NEC IR codes.
 * This is the core library - include this in your scripts.
 *
 * Protocol Reference:
 * - TX Command (0xF1): Send 3-byte NEC code (user_hi, user_lo, cmd)
 * - RX Format: Receives 3 bytes (addr_hi, addr_lo, cmd) - inverse cmd stripped
 * - Address Change (0xF2): Set module listening address
 * - Baud Change (0xF3): Set UART baud rate
 * - Failsafe Address: 0xFA always works regardless of configured address
 *
 * @see https://github.com/mcauser/micropython-ys-irtm
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
    // UART settings
    baud: 9600,                    // Default: 9600 (options: 4800, 9600, 19200, 57600)
    mode: '8N1',                   // 8 data bits, no parity, 1 stop bit

    // Module address (0x00-0xFF, default 0xA1, failsafe 0xFA)
    address: 0xFA,                 // Using failsafe address for reliability

    // RX callback debounce (ms) - prevent duplicate readings
    rxDebounceMs: 200,

    // Debug output
    debug: true,

    // Virtual components (optional - set to null to disable)
    vc: {
        rxDisplay: 'text:200',     // Shows last received code
        txInput: 'text:201',       // Text input for sending commands
        statusLed: null            // Optional status indicator
    }
};


var VIRTUAL_COMPONENTS = {
    components: [
        { key: "rxDisplay", type: "text", id: 200, config: { name: "IR RX Code", default_value: "", persisted: false, meta: { ui: { view: "label", maxLength: 64 }, cloud: ["log"] } } },
        { key: "txInput", type: "text", id: 201, config: { name: "IR TX Command", default_value: "", persisted: false, meta: { ui: { view: "input", maxLength: 64 }, cloud: ["log"] } } }
    ],
    groups: [
        { id: 200, name: "YS-IRTM IR", components: ["rxDisplay", "txInput"] }
    ]
};

function bindVirtualComponents(readyVc) {
    CONFIG.vc.rxDisplay = readyVc.keys.rxDisplay;
    CONFIG.vc.txInput = readyVc.keys.txInput;
    vcRx = readyVc.handles.rxDisplay;
    vcTx = readyVc.handles.txInput;
}

// ============================================================================
// CONSTANTS
// ============================================================================

var CMD = {
    TRANSMIT: 0xF1,      // Send IR code
    SET_ADDR: 0xF2,      // Change module address
    SET_BAUD: 0xF3       // Change baud rate
};

var BAUD_CODES = {
    4800:  0x01,
    9600:  0x02,
    19200: 0x03,
    57600: 0x04
};

var FAILSAFE_ADDR = 0xFA;

// ============================================================================
// STATE
// ============================================================================

var uart = null;
var lastRxTime = 0;
var lastRxCode = null;
var rxBuffer = '';
var rxCallbacks = [];

// Virtual component handles
var vcRx = null;
var vcTx = null;
var vcStatus = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert a byte to 2-char uppercase hex string
 */
function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

/**
 * Convert byte array to hex string with spaces
 */
function bytesToHexStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += (i ? ' ' : '') + toHex(bytes[i]);
    }
    return s;
}

/**
 * Convert byte array to binary string for UART write
 */
function bytesToStr(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i] & 0xFF);
    }
    return s;
}

/**
 * Convert binary string to byte array
 */
function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
    }
    return bytes;
}

/**
 * Debug print helper
 */
function dbg(msg) {
    if (CONFIG.debug) {
        print('[YS-IRTM] ' + msg);
    }
}

// ============================================================================
// YS-IRTM CORE API
// ============================================================================

var YSIRTM = {
    /**
     * Initialize the module
     * @returns {boolean} true if successful
     */
    init: function() {
        uart = UART.get();

        if (!uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
            print('[YS-IRTM] ERROR: Failed to configure UART');
            return false;
        }

        // Setup RX handler
        uart.recv(this._onReceive.bind(this));

        // Setup virtual components if configured
        this._initVirtualComponents();

        dbg('Initialized @ ' + CONFIG.baud + ' baud, address 0x' + toHex(CONFIG.address));
        return true;
    },

    /**
     * Send an IR code (NEC format)
     * @param {number} userHi - User code high byte (0x00-0xFF)
     * @param {number} userLo - User code low byte (0x00-0xFF)
     * @param {number} cmd - Command byte (0x00-0xFF)
     * @param {function} [callback] - Optional callback(success, error)
     */
    send: function(userHi, userLo, cmd, callback) {
        var frame = [
            CONFIG.address & 0xFF,
            CMD.TRANSMIT,
            userHi & 0xFF,
            userLo & 0xFF,
            cmd & 0xFF
        ];

        dbg('TX: ' + bytesToHexStr(frame) +
            ' (code: ' + toHex(userHi) + ' ' + toHex(userLo) + ' ' + toHex(cmd) + ')');

        uart.write(bytesToStr(frame));

        if (callback) {
            Timer.set(50, false, function() {
                callback(true, null);
            });
        }
    },

    /**
     * Send IR code from a 3-byte array
     * @param {number[]} code - [userHi, userLo, cmd]
     * @param {function} [callback]
     */
    sendCode: function(code, callback) {
        if (!code || code.length < 3) {
            if (callback) callback(false, 'Invalid code format');
            return;
        }
        this.send(code[0], code[1], code[2], callback);
    },

    /**
     * Send IR code from hex string (e.g., "00 BF 0D" or "00BF0D")
     * @param {string} hexStr - Hex string with or without spaces
     * @param {function} [callback]
     */
    sendHex: function(hexStr, callback) {
        var clean = hexStr.replace(/[\s:-]/g, '').toUpperCase();
        if (clean.length !== 6) {
            if (callback) callback(false, 'Hex string must be 6 characters (3 bytes)');
            return;
        }

        var code = [
            parseInt(clean.substr(0, 2), 16),
            parseInt(clean.substr(2, 2), 16),
            parseInt(clean.substr(4, 2), 16)
        ];

        this.sendCode(code, callback);
    },

    /**
     * Register a callback for received IR codes
     * @param {function} callback - callback(code) where code = {userHi, userLo, cmd, raw}
     * @returns {number} callback ID for unregistering
     */
    onReceive: function(callback) {
        var id = rxCallbacks.length;
        rxCallbacks.push(callback);
        return id;
    },

    /**
     * Unregister a receive callback
     * @param {number} id - callback ID from onReceive
     */
    offReceive: function(id) {
        if (id >= 0 && id < rxCallbacks.length) {
            rxCallbacks[id] = null;
        }
    },

    /**
     * Change the module's listening address
     * @param {number} newAddr - New address (0x00-0xFF)
     * @param {function} [callback]
     */
    setAddress: function(newAddr, callback) {
        var frame = [
            CONFIG.address & 0xFF,
            CMD.SET_ADDR,
            newAddr & 0xFF,
            0x00,
            0x00
        ];

        dbg('Setting address to 0x' + toHex(newAddr));
        uart.write(bytesToStr(frame));

        Timer.set(100, false, function() {
            CONFIG.address = newAddr & 0xFF;
            dbg('Address changed to 0x' + toHex(CONFIG.address));
            if (callback) callback(true, null);
        });
    },

    /**
     * Reset address using failsafe
     * @param {number} newAddr - New address to set
     * @param {function} [callback]
     */
    resetAddress: function(newAddr, callback) {
        var frame = [
            FAILSAFE_ADDR,
            CMD.SET_ADDR,
            newAddr & 0xFF,
            0x00,
            0x00
        ];

        dbg('Resetting address via failsafe to 0x' + toHex(newAddr));
        uart.write(bytesToStr(frame));

        Timer.set(100, false, function() {
            CONFIG.address = newAddr & 0xFF;
            if (callback) callback(true, null);
        });
    },

    /**
     * Change the module's baud rate
     * @param {number} baudRate - 4800, 9600, 19200, or 57600
     * @param {function} [callback]
     */
    setBaudRate: function(baudRate, callback) {
        var baudCode = BAUD_CODES[baudRate];
        if (!baudCode) {
            if (callback) callback(false, 'Invalid baud rate. Use: 4800, 9600, 19200, or 57600');
            return;
        }

        var frame = [
            CONFIG.address & 0xFF,
            CMD.SET_BAUD,
            baudCode,
            0x00,
            0x00
        ];

        dbg('Setting baud rate to ' + baudRate);
        uart.write(bytesToStr(frame));

        Timer.set(200, false, function() {
            CONFIG.baud = baudRate;
            uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode });
            dbg('Baud rate changed to ' + baudRate);
            if (callback) callback(true, null);
        });
    },

    /**
     * Get last received code
     * @returns {object|null} {userHi, userLo, cmd, raw, timestamp}
     */
    getLastCode: function() {
        return lastRxCode;
    },

    // ------------------------------------------------------------------------
    // Internal handlers
    // ------------------------------------------------------------------------

    _onReceive: function(data) {
        if (!data || data.length === 0) return;

        var bytes = strToBytes(data);

        // Check for command ACK (single byte F1, F2, or F3)
        if (bytes.length === 1) {
            var ack = bytes[0];
            if (ack === CMD.TRANSMIT || ack === CMD.SET_ADDR || ack === CMD.SET_BAUD) {
                dbg('ACK: 0x' + toHex(ack));
                return;
            }
        }

        // Buffer incoming data (RX comes as 3 bytes)
        rxBuffer += data;

        // Process complete 3-byte codes
        while (rxBuffer.length >= 3) {
            var chunk = rxBuffer.substring(0, 3);
            rxBuffer = rxBuffer.substring(3);

            var codeBytes = strToBytes(chunk);
            this._processRxCode(codeBytes);
        }
    },

    _processRxCode: function(bytes) {
        var now = Date.now();

        // Debounce duplicate readings
        if (now - lastRxTime < CONFIG.rxDebounceMs) {
            if (lastRxCode &&
                lastRxCode.raw[0] === bytes[0] &&
                lastRxCode.raw[1] === bytes[1] &&
                lastRxCode.raw[2] === bytes[2]) {
                return;
            }
        }

        lastRxTime = now;

        var code = {
            userHi: bytes[0],
            userLo: bytes[1],
            cmd: bytes[2],
            raw: bytes,
            hex: toHex(bytes[0]) + ' ' + toHex(bytes[1]) + ' ' + toHex(bytes[2]),
            timestamp: now
        };

        lastRxCode = code;

        dbg('RX: ' + code.hex);

        // Update virtual component display
        if (vcRx) {
            vcRx.setValue(code.hex);
        }

        // Notify all registered callbacks
        for (var i = 0; i < rxCallbacks.length; i++) {
            if (rxCallbacks[i]) {
                try {
                    rxCallbacks[i](code);
                } catch (e) {
                    print('[YS-IRTM] Callback error: ' + e);
                }
            }
        }
    },

    _initVirtualComponents: function() {
        var self = this;
        ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
            if (!ok) {
                print('[YS-IRTM] ERROR: Virtual component setup failed');
                return;
            }
            bindVirtualComponents(readyVc);
            if (vcTx) vcTx.on('change', self._onTxInput.bind(self));
            dbg('Virtual components ready');
        });
    },

    _onTxInput: function() {
        if (!vcTx) return;

        var val = vcTx.getValue();
        if (!val || typeof val !== 'string') return;

        val = val.trim().toUpperCase();
        if (!val.length) return;

        // Check for named command in CODES map
        if (typeof CODES !== 'undefined' && CODES[val]) {
            this.sendCode(CODES[val]);
        } else {
            // Try parsing as hex
            this.sendHex(val);
        }

        vcTx.setValue('');
    }
};

// ============================================================================
// IR CODE LIBRARY
// ============================================================================

var CODES = {};

/**
 * Add or update a code in the library
 */
function addCode(name, userHi, userLo, cmd) {
    CODES[name.toUpperCase()] = [userHi & 0xFF, userLo & 0xFF, cmd & 0xFF];
}

/**
 * Send a named code from the library
 */
function sendNamed(name, callback) {
    var code = CODES[name.toUpperCase()];
    if (code) {
        YSIRTM.sendCode(code, callback);
        return true;
    }
    print('[YS-IRTM] Unknown code: ' + name);
    return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Setup button trigger for IR commands
 * @param {string} component - e.g., "button:200" or "input:0"
 * @param {string} event - e.g., "single_push", "double_push", "long_push"
 * @param {string|number[]} code - Named code string or [userHi, userLo, cmd] array
 */
function onButtonSend(component, event, code) {
    Shelly.addEventHandler(function(ev) {
        if (ev.component === component && ev.event === event) {
            if (typeof code === 'string') {
                sendNamed(code);
            } else {
                YSIRTM.sendCode(code);
            }
        }
    });
    dbg('Button trigger: ' + component + ':' + event + ' -> ' +
        (typeof code === 'string' ? code : bytesToHexStr(code)));
}

/**
 * Setup IR receive to switch control
 * @param {number[]} code - [userHi, userLo, cmd] to match
 * @param {number} switchId - Switch ID to toggle
 * @param {string} [action] - 'toggle', 'on', or 'off' (default: toggle)
 */
function onReceiveSwitch(code, switchId, action) {
    action = action || 'toggle';

    YSIRTM.onReceive(function(rx) {
        if (rx.raw[0] === code[0] && rx.raw[1] === code[1] && rx.raw[2] === code[2]) {
            dbg('Matched code -> Switch ' + switchId + ' ' + action);

            if (action === 'toggle') {
                Shelly.call('Switch.Toggle', { id: switchId });
            } else if (action === 'on') {
                Shelly.call('Switch.Set', { id: switchId, on: true });
            } else if (action === 'off') {
                Shelly.call('Switch.Set', { id: switchId, on: false });
            }
        }
    });
}

/**
 * Learn mode - print received codes for a specified duration
 * @param {number} durationSec - How long to listen (seconds)
 */
function learnMode(durationSec) {
    durationSec = durationSec || 30;

    print('[YS-IRTM] === LEARN MODE ===');
    print('[YS-IRTM] Point remote at receiver and press buttons.');
    print('[YS-IRTM] Listening for ' + durationSec + ' seconds...');

    var learnCallback = YSIRTM.onReceive(function(code) {
        print('[LEARN] Code: [0x' + toHex(code.userHi) + ', 0x' +
              toHex(code.userLo) + ', 0x' + toHex(code.cmd) + ']  Hex: ' + code.hex);
    });

    Timer.set(durationSec * 1000, false, function() {
        YSIRTM.offReceive(learnCallback);
        print('[YS-IRTM] === LEARN MODE ENDED ===');
    });
}

print('[YS-IRTM] API loaded. Call YSIRTM.init() to start.');
