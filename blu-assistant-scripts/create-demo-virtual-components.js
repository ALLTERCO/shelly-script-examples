// =============================================================================
// Shelly Virtual Components & Groups Auto-Setup Script (Manifest-based)
// =============================================================================
// This script runs on boot to ensure that virtual components match the desired
// configuration as defined in a manifest. It creates both the individual
// virtual components (e.g. text, button) and groups (which collect component keys)
// using RPC calls executed sequentially.
// =============================================================================

// -----------------------------------------------------------------------------
// MANIFEST DEFINITION (Wi-Fi, Full-Config, MQTT only)
// -----------------------------------------------------------------------------
var manifest = {
  type: "example-device",
  meta: {
    ui: {
      actions: [],
      conditions: {}
    }
  },
  vc: {
    // Text components
    "BLE_ID": {
      type: "text",
      access: "cw",
      config: {
        name: "BLE ID",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 6 }, cloud: ["log"] }
      }
    },
    "SSID": {
      type: "text",
      access: "cw",
      config: {
        name: "SSID",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 255 }, cloud: ["log"] }
      }
    },
    "Pass": {
      type: "text",
      access: "cw",
      config: {
        name: "Pass",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 255 }, cloud: ["log"] }
      }
    },
    "DEVICE_NAME": {
      type: "text",
      access: "cw",
      config: {
        name: "Device Name",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 64 }, cloud: ["log"] }
      }
    },
    "LOCATION_TZ": {
      type: "text",
      access: "cw",
      config: {
        name: "Location TZ",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 64 }, cloud: ["log"] }
      }
    },
    "MQTT_SERVER": {
      type: "text",
      access: "cw",
      config: {
        name: "MQTT Server",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 255 }, cloud: ["log"] }
      }
    },
    "MQTT_CLIENT_ID": {
      type: "text",
      access: "cw",
      config: {
        name: "MQTT Client ID",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 255 }, cloud: ["log"] }
      }
    },
    "MQTT_PREFIX": {
      type: "text",
      access: "cw",
      config: {
        name: "MQTT Prefix",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 128 }, cloud: ["log"] }
      }
    },
    "URL_CA_BUNDLE": {
      type: "text",
      access: "cw",
      config: {
        name: "CA Bundle URL",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 512 }, cloud: [] }
      }
    },
    "URL_CLIENT_CERT": {
      type: "text",
      access: "cw",
      config: {
        name: "Client Cert URL",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 512 }, cloud: [] }
      }
    },
    "URL_CLIENT_KEY": {
      type: "text",
      access: "cw",
      config: {
        name: "Client Key URL",
        default_value: "",
        persisted: true,
        meta: { ui: { view: "field", maxLength: 512 }, cloud: [] }
      }
    },
    "LOG": {
      type: "text",
      access: "cr",
      config: {
        name: "LOG",
        default_value: "",
        persisted: false,
        meta: { ui: { view: "label", maxLength: 255 }, cloud: ["log"] }
      }
    },

    // Button components (3 scripts)
    "Connect WiFi": {
      type: "button",
      access: "cw",
      config: { name: "Connect WiFi", meta: { ui: { view: "button" }, cloud: [] } }
    },
    "Config Device": {
      type: "button",
      access: "cw",
      config: { name: "Config Device", meta: { ui: { view: "button" }, cloud: [] } }
    },
    "MQTT Config": {
      type: "button",
      access: "cw",
      config: { name: "MQTT Config", meta: { ui: { view: "button" }, cloud: [] } }
    }
  },

  groups: [
    {
      groupName: "Network Setup",
      groupId: 200,
      components: ["BLE_ID", "SSID", "Pass", "Connect WiFi", "LOG"]
    },
    {
      groupName: "Device Configuration",
      groupId: 201,
      components: ["BLE_ID", "SSID", "Pass", "DEVICE_NAME", "LOCATION_TZ", "Config Device", "LOG"]
    },
    {
      groupName: "MQTT Configuration",
      groupId: 202,
      components: [
        "BLE_ID","MQTT_SERVER", "MQTT_CLIENT_ID",
        "MQTT_PREFIX", "URL_CA_BUNDLE", "URL_CLIENT_CERT", 
        "URL_CLIENT_KEY", "MQTT Config", "LOG"
      ]
    }
  ]
};

print("Starting Virtual Components and Groups creation script.");

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Returns a unique key for a component.
 */
function getComponentKey(comp) {
  return comp.type + ":" + comp.id;
}

/**
 * Performs a selective equality check for two configuration objects.
 */
function configsMatch(desired, current, type) {
  if (type === "text") {
    if (desired.name !== current.name) return false;
    if (desired.default_value !== current.default_value) return false;
    if (desired.persisted !== current.persisted) return false;
    if (!current.meta || !current.meta.ui) return false;
    if (desired.meta.ui.view !== current.meta.ui.view) return false;
    if (desired.meta.ui.maxLength !== current.meta.ui.maxLength) return false;
    return true;
  } else if (type === "button") {
    if (desired.name !== current.name) return false;
    if (!current.meta || !current.meta.ui) return false;
    if (desired.meta.ui.view !== current.meta.ui.view) return false;
    return true;
  }
  return JSON.stringify(desired) === JSON.stringify(current);
}

/**
 * Wrapper for Shelly.call that logs errors.
 */
function callRpc(method, params) {
  var res = Shelly.call(method, params);
  if (res && res.error) print("Error calling " + method + ": " + res.error);
  return res;
}

// -----------------------------------------------------------------------------
// RPC QUEUE MECHANISM
// -----------------------------------------------------------------------------

// Keep track of this script's ID so we can stop it when done
var SCRIPT_ID = Shelly.getCurrentScriptId();
var rpcQueue = [];

function enqueueRpcCall(task) { rpcQueue.push(task); }

function processQueue() {
  if (rpcQueue.length > 0) {
    var task = rpcQueue.splice(0,1)[0];
    task();
    Timer.set(150, false, processQueue);
  } else {
    print("All components and groups created successfully.");
    print("This script ID is: " + SCRIPT_ID);
    print("Stopping script now...");
    // Directly stop this script by ID
    Shelly.call("Script.Stop", { id: SCRIPT_ID });
  }
}

// -----------------------------------------------------------------------------
// TASK CREATORS
// -----------------------------------------------------------------------------

function makeComponentRpcTask(comp) {
  return function() {
    var key = getComponentKey(comp);
    var existing = Shelly.getComponentConfig(comp.type, comp.id);
    if (existing) {
      if (!configsMatch(comp.config, existing, comp.type)) {
        print("Updating component " + key);
        callRpc("Virtual.Delete", { key: key });
        callRpc("Virtual.Add",    { type: comp.type, config: comp.config, id: comp.id });
        print("Component " + key + " re-created");
      }
    } else {
      callRpc("Virtual.Add", { type: comp.type, config: comp.config, id: comp.id });
      print("Component " + key + " created");
    }
  };
}

function createGroupConfig(name) {
  return { name: name, meta: { ui: { view: "group" } } };
}

function makeGroupRpcTask(group) {
  return function() {
    print("Creating group " + group.groupName + " (ID " + group.groupId + ")");
    callRpc("Virtual.Add", { type: "group", config: createGroupConfig(group.groupName), id: group.groupId });
    var childKeys = group.components.map(function(k) { return getComponentKey(manifest.vc[k]); });
    callRpc("Group.Set", { id: group.groupId, value: childKeys });
    print("Group " + group.groupName + " created with " + childKeys.length + " components");
  };
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION
// -----------------------------------------------------------------------------

function init() {
  print("Initializing setup...");
  var list = [];
  var counters = {};
  Object.keys(manifest.vc).forEach(function(k) {
    var c = manifest.vc[k];
    if (c.id === undefined) {
      counters[c.type] = (counters[c.type] || 200) + 1;
      c.id = counters[c.type] - 1;
    }
    list.push(c);
  });
  list.forEach(function(c) { enqueueRpcCall(makeComponentRpcTask(c)); });
  manifest.groups.forEach(function(g) { enqueueRpcCall(makeGroupRpcTask(g)); });
  processQueue();
}

init();