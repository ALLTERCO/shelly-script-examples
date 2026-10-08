/**
 * @title BLE open windows monitor
 * @description Scans Shelly BLU DoorWindow advertisements, tracks open windows,
 *   and updates Virtual Components with aggregate open-state information.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/ble-open-windows_vc.shelly.js
 */

/**
 * BLE Open Windows Monitor
 *
 * Watches configured BLU DoorWindow devices and creates/publishes:
 * - boolean:200  true if any configured window is open
 * - number:200   count of open windows
 * - text:200     last update timestamp
 * - text:201     most recently opened window name (or None)
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

const DEVICES = {
  // Replace sample MAC addresses with your real BLU DoorWindow addresses.
  'xx:xx:xx:xx:xx:01': { res: {}, name: 'Living Room Back Window', date: null },
  'xx:xx:xx:xx:xx:02': { res: {}, name: 'Children Room Front Window', date: null }
};

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'anyOpen', type: 'boolean', id: 200, config: { name: 'Any Window Open', default_value: false, meta: { ui: { view: 'label', titles: { 'false': 'closed', 'true': 'open' } }, cloud: ['log'] } } },
    { key: 'openCount', type: 'number', id: 200, config: { name: 'Open Window Count', default_value: 0, min: 0, max: 64, meta: { ui: { view: 'label', step: 1 }, cloud: ['measurement'] } } },
    { key: 'lastUpdate', type: 'text', id: 200, config: { name: 'Last Update', default_value: '', persisted: false, meta: { ui: { view: 'label', maxLength: 64 }, cloud: ['log'] } } },
    { key: 'lastOpenName', type: 'text', id: 201, config: { name: 'Last Open Window', default_value: 'None', persisted: false, meta: { ui: { view: 'label', maxLength: 128 }, cloud: ['log'] } } }
  ],
  groups: [
    { id: 200, name: 'BLE Open Windows', components: ['anyOpen', 'openCount', 'lastUpdate', 'lastOpenName'] }
  ]
};

var vcHandles = null;

const BTHOME_SVC_ID_STR = 'fcd2';

// ============================================================================
// HELPERS
// ============================================================================

function setValue(key, value) {
  if (vcHandles && vcHandles[key]) {
    vcHandles[key].setValue(value);
  }
}

function getTimestamp(date) {
  return date.toString().split('GMT')[0];
}

function getByteSize(type) {
  if (type === uint8 || type === int8) {
    return 1;
  }
  if (type === uint16 || type === int16) {
    return 2;
  }
  if (type === uint24 || type === int24) {
    return 3;
  }
  return 255;
}

// ============================================================================
// EVENT PROCESSING
// ============================================================================

function onEvent(res) {
  const addr = res.addr;
  const device = DEVICES[addr];
  if (!device) {
    return;
  }

  const date = new Date();
  device.res = res;
  device.date = date;

  let isOpenWindow = false;
  let openWindowsCount = 0;
  let lastOpenWindowDevice = null;

  for (const dev in DEVICES) {
    const trackedDevice = DEVICES[dev];
    if (trackedDevice.res.window === 1) {
      openWindowsCount += 1;
      isOpenWindow = true;
      if (!lastOpenWindowDevice || lastOpenWindowDevice.date <= trackedDevice.date) {
        lastOpenWindowDevice = trackedDevice;
      }
    }
  }

  setValue('anyOpen', isOpenWindow);
  setValue('openCount', openWindowsCount);
  setValue('lastUpdate', getTimestamp(date));
  setValue('lastOpenName', lastOpenWindowDevice ? lastOpenWindowDevice.name : 'None');
}

function scanCB(ev, res) {
  if (
    ev !== BLE.Scanner.SCAN_RESULT ||
    !res ||
    !DEVICES[res.addr] ||
    !res.service_data ||
    !res.service_data[BTHOME_SVC_ID_STR]
  ) {
    return;
  }

  const bthomeData = ShellyBLUParser.getData(res);
  if (bthomeData) {
    onEvent(bthomeData);
    return;
  }

  print('Failed to parse BTH data:', JSON.stringify(res));
}

function startBleScan() {
  const success = BLE.Scanner.Start(
    { duration_ms: BLE.Scanner.INFINITE_SCAN, active: false },
    scanCB
  );
  print('BLE scanner running:', success !== false);
}

function startApp() {
  const bleConfig = Shelly.getComponentConfig('ble');
  if (bleConfig.enable === false) {
    print('Error: BLE not enabled');
    return;
  }

  startBleScan();
}

// ============================================================================
// BTHOME PARSER
// ============================================================================

const uint8 = 0;
const int8 = 1;
const uint16 = 2;
const int16 = 3;
const uint24 = 4;
const int24 = 5;

const BTH = [];
BTH[0x00] = { n: 'pid', t: uint8 };
BTH[0x01] = { n: 'battery', t: uint8, u: '%' };
BTH[0x02] = { n: 'temperature', t: int16, f: 0.01, u: 'tC' };
BTH[0x03] = { n: 'humidity', t: uint16, f: 0.01, u: '%' };
BTH[0x05] = { n: 'illuminance', t: uint24, f: 0.01 };
BTH[0x21] = { n: 'motion', t: uint8 };
BTH[0x2d] = { n: 'window', t: uint8 };
BTH[0x3a] = { n: 'button', t: uint8 };
BTH[0x3f] = { n: 'rotation', t: int16, f: 0.1 };

const ShellyBLUParser = {
  getData: function(res) {
    const result = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]);
    if (result) {
      result.addr = res.addr;
      result.rssi = res.rssi;
    }
    return result;
  }
};

const BTHomeDecoder = {
  utoi: function(num, bitsz) {
    const mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function(buffer) {
    return buffer.at(0);
  },
  getInt8: function(buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function(buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function(buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function(buffer) {
    return 0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0));
  },
  getInt24LE: function(buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function(type, buffer) {
    if (buffer.length < getByteSize(type)) {
      return null;
    }

    let res = null;
    if (type === uint8) {
      res = this.getUInt8(buffer);
    }
    if (type === int8) {
      res = this.getInt8(buffer);
    }
    if (type === uint16) {
      res = this.getUInt16LE(buffer);
    }
    if (type === int16) {
      res = this.getInt16LE(buffer);
    }
    if (type === uint24) {
      res = this.getUInt24LE(buffer);
    }
    if (type === int24) {
      res = this.getInt24LE(buffer);
    }
    return res;
  },
  unpack: function(buffer) {
    if (typeof buffer !== 'string' || buffer.length === 0) {
      return null;
    }

    const result = {};
    const dib = buffer.at(0);
    result.encryption = dib & 0x1 ? true : false;
    result.BTHome_version = dib >> 5;

    // Encrypted data is not handled.
    if (result.BTHome_version !== 2 || result.encryption) {
      return null;
    }

    buffer = buffer.slice(1);
    while (buffer.length > 0) {
      const bth = BTH[buffer.at(0)];
      if (typeof bth === 'undefined') {
        return null;
      }

      buffer = buffer.slice(1);
      let value = this.getBufValue(bth.t, buffer);
      if (value === null) {
        return null;
      }

      if (typeof bth.f !== 'undefined') {
        value = value * bth.f;
      }

      result[bth.n] = value;
      buffer = buffer.slice(getByteSize(bth.t));
    }

    return result;
  }
};

// ============================================================================
// STARTUP
// ============================================================================

ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
  if (!ok) {
    print('ERROR: Virtual component setup failed');
    return;
  }

  vcHandles = readyVc.handles;
  startApp();
});
