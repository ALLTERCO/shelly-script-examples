/**
 * @title CWT-MB308V MODBUS example + Virtual Components
 * @description Example integration for the ComWinTop MB308V IO module over
 *   MODBUS-RTU with Virtual Component integration. Exposes 2 relay buttons,
 *   2 digital input displays, 2 analog output sliders, and 2 analog input
 *   progress bars grouped in the Shelly web UI.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/ComWinTop/mb308v_vc.shelly.js
 */

/**
 * CWT-MB308V MODBUS IO Module + Virtual Components (demo layout)
 *
 * Demonstrates the Virtual Component UI for the ComWinTop CWT-MB308V
 * GPIO expander via MODBUS-RTU:
 *
 *   button:200  Relay 0 toggle    -- press to flip DO 0
 *   button:201  Relay 1 toggle    -- press to flip DO 1
 *   number:200  Digital Input 0   -- live 0/1 display  (read-only)
 *   number:201  Digital Input 1   -- live 0/1 display  (read-only)
 *   number:202  Analog Output 0   -- slider 0-24000     (writable)
 *   number:203  Analog Output 1   -- slider 0-24000     (writable)
 *   number:204  Analog Input 0    -- progress bar 0-10216 (read-only)
 *   number:205  Analog Input 1    -- progress bar 0-10216 (read-only)
 *   group:200   MB308V Demo       -- groups all above
 *
 * The Pill 5-Terminal Add-on wiring:
 *
 *                         |=============|              |==============|
 *                    /====|         VCC |              |              |
 *                    |    | GND     GND |              | SLAVE DEVICE |
 * /========\         |    | TX      +5V |              |              |
 * |The Pill|-----=||||    | RX        A |------\/------| A            |
 * \========/         |    | RE/DE     B |------/\------| B            |
 *                    |    | +5V       A |              |              |
 *                    \====|           B |              |              |
 *                         |=============|              |==============|
 *
 * Default settings: 9600 baud, 8N1, Slave ID: 1
 *
 * The script creates, verifies, and binds its own Virtual Components at startup.
 *
 * Reference: https://github.com/bgerp/ztm/blob/master/Zontromat/devices/vendors/cwt/mb308v/mb308v.py
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


/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",
    RESPONSE_TIMEOUT: 1000,
    POLL_INTERVAL: 5000,
    DEBUG: true
};

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 1;
var slaveIdHandle = null;

function getSlaveId() {
    var value = DEFAULT_SLAVE_ID;

    if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
    if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
    value = Math.round(value);
    if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
    if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

    if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
        slaveIdHandle.setValue(value);
    }

    return value;
}

/* === CWT-MB308V REGISTER MAP === */

var AI_MAX_VALUE = 10216;  // Raw full-scale for AI (4-20mA or 0-5V/0-10V)
var AO_MAX_VALUE = 24000;  // Raw full-scale for AO (0-10V or 4-20mA)

/*
 * ENTITIES documents all channels.
 *
 * vcId assignment for OUTPUT VCs (script writes value via updateVc):
 *   DI 0 -> number:200   DI 1 -> number:201
 *   AI 0 -> number:204   AI 1 -> number:205
 *
 * INPUT VCs (user sets value, script reads / reacts):
 *   DO 0 -> button:200   DO 1 -> button:201   (managed via event handler)
 *   AO 0 -> number:202   AO 1 -> number:203   (polled each cycle)
 * These are kept null in ENTITIES; handles are stored in state.vc.*
 */
var ENTITIES = [
    //
    // --- Digital Inputs (DI 0-7, FC 0x02) ---
    //
    { name: "DI 0", units: "-", reg: { addr: 0, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:200", handle: null, vcHandle: null },
    { name: "DI 1", units: "-", reg: { addr: 1, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:201", handle: null, vcHandle: null },
    { name: "DI 2", units: "-", reg: { addr: 2, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 3", units: "-", reg: { addr: 3, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 4", units: "-", reg: { addr: 4, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 5", units: "-", reg: { addr: 5, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 6", units: "-", reg: { addr: 6, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "DI 7", units: "-", reg: { addr: 7, rtype: 0x02, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    //
    // --- Digital Outputs / Relays (DO 0-11, FC 0x01) ---
    // Controlled via button:200 / button:201 (see state.vc.btn)
    //
    { name: "DO 0",  units: "-", reg: { addr: 0,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 1",  units: "-", reg: { addr: 1,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 2",  units: "-", reg: { addr: 2,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 3",  units: "-", reg: { addr: 3,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 4",  units: "-", reg: { addr: 4,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 5",  units: "-", reg: { addr: 5,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 6",  units: "-", reg: { addr: 6,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 7",  units: "-", reg: { addr: 7,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 8",  units: "-", reg: { addr: 8,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 9",  units: "-", reg: { addr: 9,  rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 10", units: "-", reg: { addr: 10, rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "DO 11", units: "-", reg: { addr: 11, rtype: 0x01, itype: "bool", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    //
    // --- Analog Inputs (AI 0-7, FC 0x04) ---
    //
    { name: "AI 0", units: "raw", reg: { addr: 0, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:204", handle: null, vcHandle: null },
    { name: "AI 1", units: "raw", reg: { addr: 1, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: "number:205", handle: null, vcHandle: null },
    { name: "AI 2", units: "raw", reg: { addr: 2, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 3", units: "raw", reg: { addr: 3, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 4", units: "raw", reg: { addr: 4, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 5", units: "raw", reg: { addr: 5, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 6", units: "raw", reg: { addr: 6, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    { name: "AI 7", units: "raw", reg: { addr: 7, rtype: 0x04, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "R",  vcId: null,         handle: null, vcHandle: null },
    //
    // --- Analog Outputs (AO 0-3, FC 0x03) ---
    // User-driven via number:202 / number:203 sliders (see state.vc.ao)
    //
    { name: "AO 0", units: "raw", reg: { addr: 0, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 1", units: "raw", reg: { addr: 1, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 2", units: "raw", reg: { addr: 2, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { name: "AO 3", units: "raw", reg: { addr: 3, rtype: 0x03, itype: "u16", bo: "BE", wo: "BE" }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null }
];

function entitiesByRtype(rtype) {
    var result = [];
    for (var i = 0; i < ENTITIES.length; i++) {
        if (ENTITIES[i].reg.rtype === rtype) result.push(ENTITIES[i]);
    }
    return result;
}


/* === VIRTUAL COMPONENT MANIFEST === */

var VIRTUAL_COMPONENTS = {
    components: [
        { key: 'relay0', type: 'button', id: 200, config: { name: 'Relay 0 toggle', meta: { ui: { view: 'button' }, cloud: [] } } },
        { key: 'relay1', type: 'button', id: 201, config: { name: 'Relay 1 toggle', meta: { ui: { view: 'button' }, cloud: [] } } },
        { key: 'di0', type: 'number', id: 200, config: { name: 'Digital Input 0', default_value: 0, min: 0, max: 1, meta: { ui: { view: 'label', unit: '-', step: 1 }, cloud: ['measurement'] } } },
        { key: 'di1', type: 'number', id: 201, config: { name: 'Digital Input 1', default_value: 0, min: 0, max: 1, meta: { ui: { view: 'label', unit: '-', step: 1 }, cloud: ['measurement'] } } },
        { key: 'ao0', type: 'number', id: 202, config: { name: 'Analog Output 0', default_value: 0, min: 0, max: AO_MAX_VALUE, persisted: true, meta: { ui: { view: 'slider', unit: 'raw', step: 1 }, cloud: ['log'] } } },
        { key: 'ao1', type: 'number', id: 203, config: { name: 'Analog Output 1', default_value: 0, min: 0, max: AO_MAX_VALUE, persisted: true, meta: { ui: { view: 'slider', unit: 'raw', step: 1 }, cloud: ['log'] } } },
        { key: 'ai0', type: 'number', id: 204, config: { name: 'Analog Input 0', default_value: 0, min: 0, max: AI_MAX_VALUE, meta: { ui: { view: 'progressbar', unit: 'raw', step: 1 }, cloud: ['measurement'] } } },
        { key: 'ai1', type: 'number', id: 205, config: { name: 'Analog Input 1', default_value: 0, min: 0, max: AI_MAX_VALUE, meta: { ui: { view: 'progressbar', unit: 'raw', step: 1 }, cloud: ['measurement'] } } },
        {
            key: 'slaveId',
            type: 'number',
            id: 299,
            config: {
                name: 'Modbus Slave ID',
                min: MIN_SLAVE_ID,
                max: MAX_SLAVE_ID,
                default_value: DEFAULT_SLAVE_ID,
                persisted: true,
                meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
            }
        }
    ],
    groups: [
        { id: 200, name: 'MB308V Demo', components: ['relay0', 'relay1', 'di0', 'di1', 'ao0', 'ao1', 'ai0', 'ai1', 'slaveId'] }
    ]
};

function bindVirtualComponents(readyVc) {
    var i;
    var ent;

    for (i = 0; i < ENTITIES.length; i++) {
        ent = ENTITIES[i];
        if (ent.vcId === 'number:200') ent.vcHandle = readyVc.handles.di0;
        else if (ent.vcId === 'number:201') ent.vcHandle = readyVc.handles.di1;
        else if (ent.vcId === 'number:204') ent.vcHandle = readyVc.handles.ai0;
        else if (ent.vcId === 'number:205') ent.vcHandle = readyVc.handles.ai1;
    }

    state.vc.btn[0] = readyVc.handles.relay0;
    state.vc.btn[1] = readyVc.handles.relay1;
    state.vc.ao[0] = readyVc.handles.ao0;
    state.vc.ao[1] = readyVc.handles.ao1;
}

/* === MODBUS FUNCTION CODES === */
var FC = {
    READ_COILS:              0x01,
    READ_DISCRETE_INPUTS:    0x02,
    READ_HOLDING_REGISTERS:  0x03,
    READ_INPUT_REGISTERS:    0x04,
    WRITE_SINGLE_COIL:       0x05,
    WRITE_SINGLE_REGISTER:   0x06
};

/* === CRC-16 TABLE (MODBUS polynomial 0xA001) === */
var CRC_TABLE = [
    0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
    0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
    0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
    0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
    0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
    0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
    0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
    0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
    0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
    0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
    0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
    0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
    0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
    0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
    0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
    0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
    0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
    0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
    0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
    0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
    0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
    0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
    0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
    0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
    0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
    0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
    0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
    0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
    0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
    0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
    0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
    0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
];

/* === STATE === */
var state = {
    uart: null,
    rxBuffer: [],
    isReady: false,
    pendingRequest: null,
    responseTimer: null,
    pollTimer: null,
    // Relay toggle states (DO 0 and DO 1)
    doState: [false, false],
    // Last AO values written to hardware (-1 = not yet sent)
    lastAo: [-1, -1],
    // Virtual component handles for interactive VCs
    vc: {
        btn: [null, null],  // button:200, button:201  (relay toggles)
        ao:  [null, null],  // number:202, number:203  (AO sliders)
    }
};

/* === HELPERS === */

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
        hex += toHex(bytes[i]);
        if (i < bytes.length - 1) hex += " ";
    }
    return hex;
}

function debug(msg) {
    if (CONFIG.DEBUG) print("[MB308V] " + msg);
}

function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return crc;
}

function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
}

function buildFrame(slaveAddr, functionCode, data) {
    var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
    if (data) {
        for (var i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
    }
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

/* === VIRTUAL COMPONENT (output: script -> VC) === */

function updateVc(entity, value) {
    if (!entity || !entity.vcHandle) return;
    entity.vcHandle.setValue(value);
    debug(entity.name + " -> " + value);
}

/* === MODBUS CORE === */

function sendRequest(functionCode, data, callback) {
    if (!state.isReady) { callback("Not initialized", null); return; }
    if (state.pendingRequest) { callback("Request pending", null); return; }

    var frame = buildFrame(getSlaveId(), functionCode, data);
    debug("TX: " + bytesToHex(frame));

    state.pendingRequest = { functionCode: functionCode, callback: callback };
    state.rxBuffer = [];

    state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
        if (state.pendingRequest) {
            var cb = state.pendingRequest.callback;
            state.pendingRequest = null;
            debug("Timeout");
            cb("Timeout", null);
        }
    });

    state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
    if (!data || data.length === 0) return;
    for (var i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
    processResponse();
}

function processResponse() {
    if (!state.pendingRequest) { state.rxBuffer = []; return; }
    if (state.rxBuffer.length < 5) return;

    var fc = state.rxBuffer[1];

    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var excFrame = state.rxBuffer.slice(0, 5);
            var crc = calcCRC(excFrame.slice(0, 3));
            var recv = excFrame[3] | (excFrame[4] << 8);
            if (crc === recv) {
                clearTimer();
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null;
                state.rxBuffer = [];
                cb("Exception: 0x" + toHex(state.rxBuffer[2]), null);
            }
        }
        return;
    }

    var expectedLen = getExpectedLength(fc);
    if (expectedLen === 0 || state.rxBuffer.length < expectedLen) return;

    var frame = state.rxBuffer.slice(0, expectedLen);
    var crc = calcCRC(frame.slice(0, expectedLen - 2));
    var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

    if (crc !== recvCrc) { debug("CRC error"); return; }

    debug("RX: " + bytesToHex(frame));
    clearTimer();

    var responseData = frame.slice(2, expectedLen - 2);
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb(null, responseData);
}

function getExpectedLength(fc) {
    switch (fc) {
        case FC.READ_COILS:
        case FC.READ_DISCRETE_INPUTS:
        case FC.READ_HOLDING_REGISTERS:
        case FC.READ_INPUT_REGISTERS:
            return (state.rxBuffer.length >= 3) ? 3 + state.rxBuffer[2] + 2 : 0;
        case FC.WRITE_SINGLE_COIL:
        case FC.WRITE_SINGLE_REGISTER:
            return 8;
        default:
            return 0;
    }
}

function clearTimer() {
    if (state.responseTimer) { Timer.clear(state.responseTimer); state.responseTimer = null; }
}

/* === MB308V API === */

function readDigitalInputs(callback) {
    var diEnt = entitiesByRtype(0x02);
    sendRequest(FC.READ_DISCRETE_INPUTS, [0x00, diEnt[0].reg.addr, 0x00, diEnt.length], function(err, resp) {
        if (err) { callback(err, null); return; }
        var inputs = [];
        for (var i = 0; i < diEnt.length; i++) {
            var byteIdx = Math.floor(i / 8) + 1;
            var bitIdx = i % 8;
            inputs.push((byteIdx < resp.length) ? (resp[byteIdx] >> bitIdx) & 0x01 : 0);
        }
        callback(null, inputs);
    });
}

function readAnalogInputs(callback) {
    var aiEnt = entitiesByRtype(0x04);
    sendRequest(FC.READ_INPUT_REGISTERS, [0x00, aiEnt[0].reg.addr, 0x00, aiEnt.length], function(err, resp) {
        if (err) { callback(err, null); return; }
        var values = [];
        for (var i = 1; i < resp.length - 1; i += 2) values.push((resp[i] << 8) | resp[i + 1]);
        callback(null, values);
    });
}

function writeDigitalOutput(channel, value, callback) {
    var doEnt = entitiesByRtype(0x01);
    if (channel < 0 || channel >= doEnt.length) {
        if (callback) callback("Invalid channel: " + channel, false);
        return;
    }
    var data = [0x00, doEnt[channel].reg.addr & 0xFF, value ? 0xFF : 0x00, 0x00];
    sendRequest(FC.WRITE_SINGLE_COIL, data, function(err) {
        if (callback) callback(err, !err);
    });
}

function writeAnalogOutput(channel, value, callback) {
    var aoEnt = entitiesByRtype(0x03);
    if (channel < 0 || channel >= aoEnt.length) {
        if (callback) callback("Invalid channel: " + channel, false);
        return;
    }
    if (value < 0) value = 0;
    if (value > AO_MAX_VALUE) value = AO_MAX_VALUE;
    var data = [0x00, aoEnt[channel].reg.addr & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    sendRequest(FC.WRITE_SINGLE_REGISTER, data, function(err) {
        if (callback) callback(err, !err);
    });
}

function aiToMilliamps(raw) { return 4.0 + (raw / AI_MAX_VALUE) * 16.0; }
function aiToVoltage(raw)   { return (raw / AI_MAX_VALUE) * 10.0; }
function milliampsToAo(mA)  { if (mA < 4) mA = 4; if (mA > 20) mA = 20; return Math.round(((mA - 4) / 16.0) * AO_MAX_VALUE); }
function voltageToAo(volts) { if (volts < 0) volts = 0; if (volts > 10) volts = 10; return Math.round((volts / 10.0) * AO_MAX_VALUE); }

/* === RELAY TOGGLE (called from button event handler) === */

function toggleRelay(channel) {
    state.doState[channel] = !state.doState[channel];
    var newState = state.doState[channel];
    debug("Relay " + channel + " -> " + (newState ? "ON" : "OFF"));
    writeDigitalOutput(channel, newState, function(err) {
        if (err) {
            debug("Relay " + channel + " write error: " + err);
            state.doState[channel] = !state.doState[channel];  // revert
        }
    });
}

/* === POLL === */

function pollAllInputs() {
    // --- Read DI 0 and DI 1 (bulk read all 8, publish first 2) ---
    readDigitalInputs(function(err, inputs) {
        if (err) {
            debug("DI Error: " + err);
        } else {
            var diEnt = entitiesByRtype(0x02);
            updateVc(diEnt[0], inputs[0]);   // DI 0 -> number:200
            updateVc(diEnt[1], inputs[1]);   // DI 1 -> number:201
            print("[DI] DI0:" + inputs[0] + " DI1:" + inputs[1]);
        }

        // --- Check AO sliders for user changes, write hardware if changed ---
        Timer.set(100, false, function() {
            for (var i = 0; i < 2; i++) {
                if (!state.vc.ao[i]) continue;
                var sliderVal = state.vc.ao[i].getValue();
                if (sliderVal !== state.lastAo[i]) {
                    state.lastAo[i] = sliderVal;
                    debug("AO " + i + " slider -> " + sliderVal);
                    writeAnalogOutput(i, sliderVal, null);
                }
            }

            // --- Read AI 0 and AI 1 (bulk read all 8, publish first 2) ---
            Timer.set(100, false, function() {
                readAnalogInputs(function(err, values) {
                    if (err) {
                        debug("AI Error: " + err);
                        return;
                    }
                    var aiEnt = entitiesByRtype(0x04);
                    updateVc(aiEnt[0], values[0]);   // AI 0 -> number:204
                    updateVc(aiEnt[1], values[1]);   // AI 1 -> number:205
                    var mA0 = aiToMilliamps(values[0]).toFixed(2);
                    var mA1 = aiToMilliamps(values[1]).toFixed(2);
                    print("[AI] AI0:" + mA0 + "mA  AI1:" + mA1 + "mA");
                });
            });
        });
    });
}

/* === INITIALIZATION === */

function startApp() {
    print("CWT-MB308V MODBUS IO Module + Virtual Components");
    print("=================================================");
    print("  button:200/201  -> relay toggle (DO 0/1)");
    print("  number:200/201  -> DI 0/1 display");
    print("  number:202/203  -> AO 0/1 sliders");
    print("  number:204/205  -> AI 0/1 progress bars");
    print("  group:200       -> MB308V Demo");
    print("");

    // Seed lastAo from current slider values so we don't write 0 on first boot
    if (state.vc.ao[0]) state.lastAo[0] = state.vc.ao[0].getValue();
    if (state.vc.ao[1]) state.lastAo[1] = state.vc.ao[1].getValue();

    // --- Button event handler ---
    // Catches push events from button:200 and button:201 to toggle relays.
    Shelly.addEventHandler(function(event, ud) {
        if (event.name !== "push" && event.name !== "single_push") return;
        debug("Button event: " + event.component + " / " + event.name);
        if (event.component === "button:200") toggleRelay(0);
        else if (event.component === "button:201") toggleRelay(1);
    }, null);

    // --- UART ---
    state.uart = UART.get();
    if (!state.uart) { print("ERROR: UART not available"); return; }
    if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
        print("ERROR: UART configuration failed");
        return;
    }
    state.uart.recv(onReceive);
    state.isReady = true;

    debug("UART: " + CONFIG.BAUD_RATE + " baud, " + CONFIG.MODE);
    debug("Slave ID: " + getSlaveId());
    print("Polling every " + (CONFIG.POLL_INTERVAL / 1000) + "s...");
    print("");

    Timer.set(500, false, pollAllInputs);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollAllInputs);
}

ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
        print('ERROR: Virtual component setup failed');
        return;
    }

    slaveIdHandle = readyVc.handles.slaveId;
    slaveIdHandle.on('change', function() {
        debug('Slave ID changed -> ' + getSlaveId());
    });

    bindVirtualComponents(readyVc);
    startApp();
});
