/**
 * @title Virtual Components standard helper
 * @description Copy this helper into scripts that need Virtual Components. A
 *   single call to ensureVirtualComponents() finds existing components, repairs
 *   mismatched fixed-ID components, creates missing components, optionally
 *   creates groups, and returns handles by logical name.
 * @status draft
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
