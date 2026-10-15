/**
 * @title EcoFlow STREAM Ultra Load Balancing with Virtual Components (static config)
 * @description Polls Shelly EM / Plug S Gen3 devices and controls an EcoFlow
 *   STREAM Ultra via the EcoFlow cloud API. Switches between discharge, charge,
 *   and idle modes based on total load and a configurable night-charging window.
 *   Creates, verifies, repairs, groups, and updates Shelly Virtual Components
 *   for EcoFlow device parameters in the Shelly app dashboard.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/ecoflow/stream-ultra/load_balancing_static_vc.shelly.js
 */

/*
 * Modes:
 *   discharge : sum of all device readings > threshold (day hours)
 *   charge    : night window (configurable hours)
 *   idle      : day + load below threshold — battery neither charges nor discharges
 *
 * Virtual Components (10 total, created/verified on every script start):
 *   Group   : "EcoFlow STREAM Ultra"
 *   Numbers : Battery SOC (%), Battery Power (W), PV Power (W),
 *             Grid Power (W), Load Power (W),
 *             Backup Reserve SOC (%), Meters Total (W)
 *   Booleans: Feed Grid, Night Mode
 *
 * EcoFlow quota fields visualised (from /iot-open/sign/device/quota/all):
 *   cmsBattSoc, powGetBpCms, powGetPvSum, powGetSysGrid, powGetSysLoad,
 *   backupReverseSoc, feedGridMode
 *
 * All configuration is embedded in CONFIG / DEVICES_CFG — no KVS needed.
 * HMAC-SHA256 adapted from ecoflow_api.js reference.
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
// Edit these values before uploading the script to the Shelly device.

var CONFIG = {
    // EcoFlow API credentials
    accessKey  : "YOUR_ACCESS_KEY",
    secretKey  : "YOUR_SECRET_KEY",
    serial     : "YOUR_DEVICE_SERIAL",
    region     : "eu",           // "eu" or "us"

    // EcoFlow command routing (STREAM Ultra defaults — change only if needed)
    cmdId      : 17,
    cmdFunc    : 254,
    dirDest    : 1,
    dirSrc     : 1,
    dest       : 2,

    // Night-charging window (local device hours, 0–23)
    nightStart : 23,             // hour charging begins (inclusive)
    nightEnd   :  6,             // hour charging ends   (exclusive, wraps midnight)
    nightSoc   : 95,             // backup-reserve % during night charging

    // Day operation
    threshold  : 600,            // W — above this the battery discharges
    pollMs     : 5000            // polling interval in milliseconds
};

/* === DEVICES === */
// List of Shelly devices to measure.
//   type    : "em"   — Shelly EM Gen4, reads EM1.GetStatus  -> act_power
//           : "plug" — Shelly Plug S Gen3, reads Switch.GetStatus -> apower
//   host    : IP address or hostname of the Shelly device
//   channel : EM channel index (usually 0 or 1) / Switch id (usually 0)
//   name    : friendly label used in log output only

var DEVICES_CFG = [
    { type: "em",   host: "192.168.1.10", channel: 0, name: "Main EM ch0" },
    { type: "em",   host: "192.168.1.10", channel: 1, name: "Main EM ch1" },
    { type: "plug", host: "192.168.1.20", channel: 0, name: "Plug South"  }
];

/* === VC DEFINITIONS ===
 * Index layout — parallel to vcIds[]:
 *   0  group   "EcoFlow STREAM Ultra"
 *   1  number  Battery SOC          (cmsBattSoc, %)
 *   2  number  Battery Power        (powGetBpCms, W; + = charging, - = discharging)
 *   3  number  PV Power             (powGetPvSum, W)
 *   4  number  Grid Power           (powGetSysGrid, W; + = import)
 *   5  number  Load Power           (powGetSysLoad, W)
 *   6  number  Backup Reserve SOC   (backupReverseSoc, %)
 *   7  number  Meters Total         (sum of polled Shelly devices, W)
 *   8  boolean Feed Grid            (feedGridMode == 1)
 *   9  boolean Night Mode           (derived from nightStart/nightEnd window)
 */

var VC_REFRESH_MS = 30000;  // how often to call EcoFlow API and refresh VC values (ms)

var VC_SPECS = [
    ["group",   "EcoFlow STREAM Ultra", null, null,   null  ],
    ["number",  "Battery SOC",          "%",   0,     100   ],
    ["number",  "Battery Power",        "W",  -5000,  5000  ],
    ["number",  "PV Power",             "W",   0,     10000 ],
    ["number",  "Grid Power",           "W",  -10000, 10000 ],
    ["number",  "Load Power",           "W",   0,     10000 ],
    ["number",  "Backup Reserve SOC",   "%",   0,     100   ],
    ["number",  "Meters Total",         "W",  -10000, 10000 ],
    ["boolean", "Feed Grid",            null,  null,  null  ],
    ["boolean", "Night Mode",           null,  null,  null  ]
];

/* === STATE === */

var CFG        = null;
var DEVICES    = [];
var lastMode   = "";
var busy       = false;
var LOG_METERS = false;
var lastSoc    = 50;    // cached from last refreshEco
var lastMinDsg = 30;
var lastTotalW = 0;
var vcIds      = [];    // numeric VC ids, parallel to VC_SPECS; undefined until created
var vcReady    = false;
var vcQueue    = [];    // index-based Number.Set / Boolean.Set call queue
var vcQueueIdx = 0;
var vcQueueRun = false;

/* === SHA-256 === */

var SHA256_W = [];  // scratch buffer reused across sha256bytes calls — avoids per-call allocation

var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function strToBytes(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c < 0x80) {
            b.push(c);
        } else if (c < 0x800) {
            b.push(0xC0 | (c >> 6));
            b.push(0x80 | (c & 0x3F));
        } else {
            b.push(0xE0 | (c >> 12));
            b.push(0x80 | ((c >> 6) & 0x3F));
            b.push(0x80 | (c & 0x3F));
        }
    }
    return b;
}

function hexByte(hex, i) {
    var hi = hex.charCodeAt(i);
    var lo = hex.charCodeAt(i + 1);
    hi = hi <= 57 ? hi - 48 : hi - 87;
    lo = lo <= 57 ? lo - 48 : lo - 87;
    return (hi << 4) | lo;
}

function sha256bytes(b) {
    var msgLen = b.length;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0x00);
    var bitLen = msgLen * 8;
    b.push(0); b.push(0); b.push(0); b.push(0);
    b.push((bitLen >>> 24) & 0xFF);
    b.push((bitLen >>> 16) & 0xFF);
    b.push((bitLen >>> 8)  & 0xFF);
    b.push( bitLen         & 0xFF);
    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = SHA256_W;
    var x, s0, s1, tmp1, tmp2, a, bb, c, d, e, f, g, h, ch, maj, S0, S1;
    for (var blk = 0; blk < b.length; blk += 64) {
        for (var t = 0; t < 16; t++) {
            W[t] = ((b[blk + t*4] << 24) | (b[blk + t*4 + 1] << 16) | (b[blk + t*4 + 2] << 8) | b[blk + t*4 + 3]) >>> 0;
        }
        for (var t = 16; t < 64; t++) {
            x = W[t - 15]; s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
            x = W[t - 2];  s1 = (((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10)) >>> 0;
            W[t] = ((W[t - 16] + s0 + W[t - 7] + s1) | 0) >>> 0;
        }
        a = H0; bb = H1; c = H2; d = H3; e = H4; f = H5; g = H6; h = H7;
        for (var t = 0; t < 64; t++) {
            S1   = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
            ch   = ((e & f) ^ (~e & g)) >>> 0;
            tmp1 = ((h + S1 + ch + K256[t] + W[t]) | 0) >>> 0;
            S0   = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
            maj  = ((a & bb) ^ (a & c) ^ (bb & c)) >>> 0;
            tmp2 = ((S0 + maj) | 0) >>> 0;
            h = g; g = f; f = e;
            e = ((d + tmp1) | 0) >>> 0;
            d = c; c = bb; bb = a;
            a = ((tmp1 + tmp2) | 0) >>> 0;
        }
        H0 = ((H0 + a)  | 0) >>> 0;  H1 = ((H1 + bb) | 0) >>> 0;
        H2 = ((H2 + c)  | 0) >>> 0;  H3 = ((H3 + d)  | 0) >>> 0;
        H4 = ((H4 + e)  | 0) >>> 0;  H5 = ((H5 + f)  | 0) >>> 0;
        H6 = ((H6 + g)  | 0) >>> 0;  H7 = ((H7 + h)  | 0) >>> 0;
    }
    var hx  = "0123456789abcdef";
    var hex = "";
    var arr = [H0, H1, H2, H3, H4, H5, H6, H7];
    for (var i = 0; i < 8; i++) {
        var v = arr[i];
        for (var s = 28; s >= 0; s -= 4) hex += hx[(v >>> s) & 0xF];
    }
    return hex;
}

function hmacSha256(key, message) {
    var keyBytes = strToBytes(key);
    if (keyBytes.length > 64) {
        var kh = sha256bytes(keyBytes);
        keyBytes = [];
        for (var i = 0; i < 64; i += 2) keyBytes.push(hexByte(kh, i));
    }
    while (keyBytes.length < 64) keyBytes.push(0x00);
    var opad = [], ipad = [];
    for (var i = 0; i < 64; i++) {
        opad.push(keyBytes[i] ^ 0x5C);
        ipad.push(keyBytes[i] ^ 0x36);
    }
    var msgBytes = strToBytes(message);
    for (var i = 0; i < msgBytes.length; i++) ipad.push(msgBytes[i]);
    var innerHex = sha256bytes(ipad);
    for (var i = 0; i < 64; i += 2) opad.push(hexByte(innerHex, i));
    return sha256bytes(opad);
}

/* === ECOFLOW SIGNING === */

function addSignParts(obj, prefix, out) {
    prefix = prefix || "";
    for (var k in obj) {
        var fk = prefix ? (prefix + "." + k) : k;
        var v = obj[k];
        if (typeof v === "boolean") {
            out.push(fk + "=" + (v ? "true" : "false"));
        } else if (typeof v === "object" && v !== null) {
            addSignParts(v, fk, out);
        } else {
            out.push(fk + "=" + String(v));
        }
    }
}

function sortStrings(arr) {
    var n = arr.length;
    for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
            if (arr[i] > arr[j]) { var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
        }
    }
    return arr;
}

function buildAuth(paramsToSign) {
    var nonce = String(Math.floor(100000 + Math.random() * 900000));
    var ts    = String(Math.floor(Date.now()));
    var parts = [];
    addSignParts(paramsToSign, "", parts);
    sortStrings(parts);
    parts.push("accessKey=" + CFG.accessKey);
    parts.push("nonce=" + nonce);
    parts.push("timestamp=" + ts);
    return { sign: hmacSha256(CFG.secretKey, parts.join("&")), nonce: nonce, ts: ts };
}

function makeHeaders(paramsToSign, includeContentType) {
    var auth = buildAuth(paramsToSign);
    var headers = {
        "accessKey" : CFG.accessKey,
        "nonce"     : auth.nonce,
        "timestamp" : auth.ts,
        "sign"      : auth.sign
    };
    if (includeContentType) headers["Content-Type"] = "application/json;charset=UTF-8";
    return headers;
}

/* === ECOFLOW API === */

var ECO_HOSTS = { eu: "https://api-e.ecoflow.com", us: "https://api-a.ecoflow.com" };

function ecoHost() { return ECO_HOSTS[CFG.region] || ECO_HOSTS.eu; }

function ecoGetAll(cb) {
    Timer.set(0, false, function() {
        var signParams = { sn: CFG.serial };
        Shelly.call("HTTP.Request", {
            method  : "GET",
            url     : ecoHost() + "/iot-open/sign/device/quota/all?sn=" + CFG.serial,
            timeout : 10,
            headers : makeHeaders(signParams, false)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoGetAll HTTP error " + String(ec));
                cb("http_error", null); return;
            }
            var body = JSON.parse(res.body);
            if (!body || body.code !== "0") {
                print("[EcoFlow] ecoGetAll API error: " + (body ? body.message : "?"));
                cb("api_error", null); return;
            }
            // Extract only the fields we need; drops the large body object from scope
            var d = body.data;
            cb(null, {
                cmsBattSoc:       d.cmsBattSoc,
                powGetBpCms:      d.powGetBpCms,
                powGetPvSum:      d.powGetPvSum,
                powGetSysGrid:    d.powGetSysGrid,
                powGetSysLoad:    d.powGetSysLoad,
                backupReverseSoc: d.backupReverseSoc,
                feedGridMode:     d.feedGridMode,
                cmsMinDsgSoc:     d.cmsMinDsgSoc
            });
        });
    });
}

function ecoSet(params, cb) {
    Timer.set(0, false, function() {
        var body = {
            sn      : CFG.serial,
            cmdId   : CFG.cmdId,
            cmdFunc : CFG.cmdFunc,
            dirDest : CFG.dirDest,
            dirSrc  : CFG.dirSrc,
            dest    : CFG.dest,
            needAck : true,
            params  : params
        };
        Shelly.call("HTTP.Request", {
            method  : "PUT",
            url     : ecoHost() + "/iot-open/sign/device/quota",
            timeout : 10,
            headers : makeHeaders(body, true),
            body    : JSON.stringify(body)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoSet HTTP error " + String(ec));
                if (cb) cb("http_error"); return;
            }
            var resp = JSON.parse(res.body);
            if (!resp || resp.code !== "0") {
                var code = resp ? String(resp.code) : "?";
                print("[EcoFlow] ecoSet API error " + code + ": " + (resp ? resp.message : "?"));
                if (cb) cb(code); return;
            }
            if (cb) cb(null);
        });
    });
}

/* === ECOFLOW COMMANDS === */

function requestIdle(soc, minDsg, cb) {
    var hold = (soc > (minDsg + 1)) ? soc : (minDsg + 1);
    print("[Logic] requestIdle holdSoc=" + String(hold));
    ecoSet({ cfgBackupReverseSoc: hold, cfgFeedGridMode: 0 }, cb);
}

function requestDischarge(cb) {
    print("[Logic] requestDischarge");
    ecoSet({ cfgFeedGridMode: 1, cfgBackupReverseSoc: 35 }, function(err) {
        if (err) { if (cb) cb(err); return; }
        Timer.set(200, false, function() {
            ecoSet(
                {
                    cfgEnergyStrategyOperateMode: {
                        operateSelfPoweredOpen: true,
                        operateIntelligentScheduleModeOpen: false
                    }
                },
                cb
            );
        });
    });
}

function requestCharge(cb) {
    print("[Logic] requestCharge");
    ecoSet(
        {
            cfgFeedGridMode     : 1,
            cfgBackupReverseSoc : CFG.nightSoc
        },
        function(err) {
            if (err) { if (cb) cb(err); return; }
            Timer.set(200, false, function() {
                ecoSet(
                    {
                        cfgEnergyStrategyOperateMode: {
                            operateSelfPoweredOpen: true,
                            operateIntelligentScheduleModeOpen: false
                        }
                    },
                    cb
                );
            });
        }
    );
}

/* === DEVICE POLLING === */

function pollDevice(dev, cb) {
    var path = (dev.type === "em")
        ? "/rpc/EM1.GetStatus?id="    + String(dev.channel)
        : "/rpc/Switch.GetStatus?id=" + String(dev.channel);
    Shelly.call("HTTP.Request", {
        method  : "GET",
        url     : "http://" + dev.host + path,
        timeout : 5
    }, function(res, ec) {
        if (ec !== 0 || !res || res.code !== 200) {
            print("[Shelly] " + dev.name + " unreachable (ec=" + String(ec) + "), using 0 W");
            cb(0); return;
        }
        var data  = JSON.parse(res.body);
        var watts = (dev.type === "em") ? (data.act_power || 0) : (data.apower || 0);
        if (LOG_METERS) print("[Shelly] " + dev.name + ": " + String(Math.round(watts)) + " W");
        cb(watts);
    });
}

function pollAll(idx, totalW, cb) {
    if (idx >= DEVICES.length) { cb(totalW); return; }
    pollDevice(DEVICES[idx], function(w) {
        Timer.set(75, false, function() { pollAll(idx + 1, totalW + w, cb); });
    });
}

/* === NIGHT WINDOW === */

function getLocalHour() {
    var sys = Shelly.getComponentStatus("sys");
    if (sys) {
        if (sys.unixtime !== undefined && sys.utc_offset !== undefined) {
            var local = sys.unixtime + sys.utc_offset;
            var hour  = Math.floor((local % 86400) / 3600);
            if (hour >= 0 && hour <= 23) return hour;
        }
        if (sys.time && sys.time.length >= 2) {
            return (sys.time.charCodeAt(0) - 48) * 10 + (sys.time.charCodeAt(1) - 48);
        }
    }
    return Math.floor((Date.now() / 3600000) % 24);
}

function isNight() {
    var h = getLocalHour();
    var s = CFG.nightStart;
    var e = CFG.nightEnd;
    if (s === e) return true;
    if (s < e)   return h >= s && h < e;
    return h >= s || h < e;  // wraps midnight: e.g. 23–06
}

/* === VIRTUAL COMPONENTS === */


function buildVirtualComponentsManifest() {
    var manifest = { components: [], groups: [] };
    var members = [];
    var i;
    var spec;
    var cfg;
    var key;

    for (i = 1; i < VC_SPECS.length; i++) {
        spec = VC_SPECS[i];
        key = "vc" + String(i);
        cfg = { name: spec[1] };
        if (spec[0] === "number") {
            cfg.default_value = 0;
            cfg.min = spec[3];
            cfg.max = spec[4];
            cfg.meta = { ui: { view: "label", unit: spec[2], step: 1 }, cloud: ["measurement"] };
        } else if (spec[0] === "boolean") {
            cfg.default_value = false;
            cfg.meta = { ui: { view: "label", titles: { "false": "off", "true": "on" } }, cloud: ["log"] };
        }
        manifest.components.push({ key: key, type: spec[0], config: cfg });
        members.push(key);
    }

    manifest.groups = [
        { id: 200, name: VC_SPECS[0][1], components: members }
    ];

    return manifest;
}

function bindVirtualComponents(readyVc) {
    var i;
    vcIds[0] = readyVc.ids.group;
    for (i = 1; i < VC_SPECS.length; i++) {
        vcIds[i] = readyVc.ids["vc" + String(i)];
    }
}

function drainVcQueue() {
    if (vcQueueIdx >= vcQueue.length) {
        vcQueue = []; vcQueueIdx = 0; vcQueueRun = false; return;
    }
    vcQueueRun = true;
    var item = vcQueue[vcQueueIdx];
    vcQueueIdx = vcQueueIdx + 1;
    if (VC_SPECS[item[0]][0] === "number") {
        Shelly.call("Number.Set",  { id: vcIds[item[0]], value: item[1] }, function() { drainVcQueue(); });
    } else {
        Shelly.call("Boolean.Set", { id: vcIds[item[0]], value: item[1] }, function() { drainVcQueue(); });
    }
}

function setVc(idx, val) {
    if (vcIds[idx] === null || vcIds[idx] === undefined) return;
    var type = VC_SPECS[idx][0];
    if (type !== "number" && type !== "boolean") return;
    vcQueue.push([idx, val]);
    if (!vcQueueRun) drainVcQueue();
}

function updateVCs(totalW, data) {
    if (!vcReady) { print("[VC] updateVCs skipped — not ready"); return; }
    var battSoc   = data ? (parseFloat(data.cmsBattSoc)       || 0) : 0;
    var batPower  = data ? (parseFloat(data.powGetBpCms)      || 0) : 0;
    var pvPower   = data ? (parseFloat(data.powGetPvSum)      || 0) : 0;
    var gridPower = data ? (parseFloat(data.powGetSysGrid)    || 0) : 0;
    var loadPower = data ? (parseFloat(data.powGetSysLoad)    || 0) : 0;
    var backupSoc = data ? (parseInt(data.backupReverseSoc)   || 0) : 0;
    var feedGrid  = data ? (parseInt(data.feedGridMode) === 1)      : false;

    setVc(1, Math.round(battSoc));
    setVc(2, Math.round(batPower));
    setVc(3, Math.round(pvPower));
    setVc(4, Math.round(gridPower));
    setVc(5, Math.round(loadPower));
    setVc(6, backupSoc);
    setVc(7, Math.round(totalW));
    setVc(8, feedGrid);
    setVc(9, isNight());
}

/* === VC REFRESH (separate timer — keeps ecoGetAll out of the 5 s hot loop) === */

function refreshEco() {
    if (!vcReady) return;
    ecoGetAll(function(err, data) {
        if (err) return;
        lastSoc    = parseInt(data.cmsBattSoc)   || 50;
        lastMinDsg = parseInt(data.cmsMinDsgSoc) || 30;
        updateVCs(lastTotalW, data);
    });
}

/* === CONTROL LOOP === */

function runOnce() {
    if (!CFG || busy) return;
    busy = true;
    pollAll(0, 0, function(totalW) {
        lastTotalW = totalW;
        var night  = isNight();

        print("[Logic] total=" + String(Math.round(totalW)) + "W  threshold=" +
              String(CFG.threshold) + "W  night=" + String(night) +
              "  soc=" + String(lastSoc) + "%  lastMode=" + lastMode);

        if (night) {
            if (lastMode !== "charge") {
                requestCharge(function(e) {
                    if (!e) lastMode = "charge";
                    busy = false;
                });
            } else {
                busy = false;
            }
        } else if (totalW > CFG.threshold) {
            if (lastMode !== "discharge") {
                print("[Logic] " + String(Math.round(totalW)) + " W > " +
                      String(CFG.threshold) + " W → discharge");
                requestDischarge(function(e) {
                    if (!e) lastMode = "discharge";
                    busy = false;
                });
            } else {
                busy = false;
            }
        } else {
            var needStop = (lastMode === "discharge" || lastMode === "charge" || lastMode === "");
            if (needStop) {
                print("[Logic] " + String(Math.round(totalW)) + " W <= " +
                      String(CFG.threshold) + " W → idle");
                requestIdle(lastSoc, lastMinDsg, function(e) {
                    if (!e) lastMode = "idle";
                    busy = false;
                });
            } else {
                busy = false;
            }
        }
    });
}

/* === INIT === */
// Config is read from the embedded CONFIG and DEVICES_CFG objects above.
// VCs are created, verified, grouped, and reused by the shared VC helper.

function init() {
    if (!CONFIG.accessKey || !CONFIG.secretKey || !CONFIG.serial) {
        print("[Init] ERROR: Fill in CONFIG.accessKey, CONFIG.secretKey and CONFIG.serial before running.");
        return;
    }

    CFG = {
        accessKey  : CONFIG.accessKey,
        secretKey  : CONFIG.secretKey,
        serial     : CONFIG.serial,
        region     : CONFIG.region    || "eu",
        cmdId      : CONFIG.cmdId     || 17,
        cmdFunc    : CONFIG.cmdFunc   || 254,
        dirDest    : CONFIG.dirDest   || 1,
        dirSrc     : CONFIG.dirSrc    || 1,
        dest       : CONFIG.dest      || 2,
        nightStart : CONFIG.nightStart !== undefined ? CONFIG.nightStart : 23,
        nightEnd   : CONFIG.nightEnd   !== undefined ? CONFIG.nightEnd   :  6,
        nightSoc   : CONFIG.nightSoc   || 95,
        pollMs     : CONFIG.pollMs     || 5000,
        threshold  : CONFIG.threshold  || 600
    };

    DEVICES = DEVICES_CFG;

    if (DEVICES.length === 0) {
        print("[Init] WARNING: DEVICES_CFG is empty — no meters to poll.");
    }

    print("[Init] " + String(DEVICES.length) + " device(s), " +
          "threshold=" + String(CFG.threshold) + " W, " +
          "poll=" + String(CFG.pollMs) + " ms, " +
          "night=" + String(CFG.nightStart) + ":00-" + String(CFG.nightEnd) + ":00");

    ensureVirtualComponents(buildVirtualComponentsManifest(), function(ok, readyVc) {
        if (!ok) {
            print("[Init] ERROR: Virtual component setup failed");
            return;
        }

        bindVirtualComponents(readyVc);
        vcReady = true;
        print("[Init] VCs ready (" + String(VC_SPECS.length - 1) + " + 1 group)");
        refreshEco();                               // initial VC population
        runOnce();
        Timer.set(CFG.pollMs,    true, runOnce);   // mode control every pollMs
        Timer.set(VC_REFRESH_MS, true, refreshEco); // VC + soc refresh every 30 s
    });
}

init();
