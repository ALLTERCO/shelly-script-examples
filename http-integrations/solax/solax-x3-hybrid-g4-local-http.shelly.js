/* @meta {"vc":{"pv":{"type":"number","config":{"name":"PV Power"}},"grid":{"type":"number","config":{"name":"Grid Power"}},"load":{"type":"number","config":{"name":"Load Power"}},"bat":{"type":"number","config":{"name":"Battery Power"}},"soc":{"type":"number","config":{"name":"Battery SoC"}},"totk":{"type":"number","config":{"name":"Total Energy"}},"temp":{"type":"number","config":{"name":"Heatsink Temperature"}},"mode":{"type":"text","config":{"name":"Operating Mode"}},"sn":{"type":"text","config":{"name":"Dongle SN","persisted":true,"default_value":""}},"inv":{"type":"group","config":{"name":"Solax X3 Hybrid G4"},"members":["@pv","@grid","@load","@bat","@soc","@totk","@temp","@mode","@sn"]}}} */
/**
 * @title SolaX X3 Hybrid G4 local HTTP integration
 * @description Local HTTP communication with a SolaX X3 Hybrid G4 dongle, exposing type-14 telemetry through Virtual Components.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/solax/solax-x3-hybrid-g4-local-http.shelly.js
 */

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Georgi Germanov and contributors
 *
 * Working source supplied by the contributor; inverter communication confirmed
 * on 2026-10-29. This script-only contribution is not registered in the
 * production catalog. The supplied polling and decoding logic is retained.
 *
 * Shelly -> local HTTP POST -> dongle -> inverter telemetry.
 * Response: {"sn","ver","type","Data":[...],"Information":[...]}.
 * Data[] indexes follow the supplied X3 Hybrid G4 (type 14) map.
 *
 * Requires firmware with managed Virtual Components and Script.getVcHandle().
 * The supplied @meta members declaration requires group-members support
 * (documented from 2.2.0); runtime Group.Set is also retained from the source.
 * Ten roles: pv, grid, load, bat, soc, totk, temp, mode, sn, inv (group).
 * Keep the complete @meta comment first, on one line, within 1024 characters.
 * Units and ranges are applied by applyUi() to keep the declaration small.
 *
 * Set CFG.ip to the dongle address and enter its serial in the Dongle SN
 * component. Published IP and serial values are placeholders. The serial is
 * read on every poll and changing it triggers an immediate request.
 * This integration reads telemetry. A dashboard can be built on these values.
 */

let CFG = {
  ip: "192.0.2.10",
  period: 15000, // Timer.set() uses milliseconds.
};

let MODE = ["Waiting", "Checking", "Normal", "Fault", "Perm. Fault",
            "Updating", "EPS Check", "EPS Mode", "Self Test", "Idle", "Standby"];

// Role, unit, step, minimum, maximum.
let UI = [
  ["pv",   "W",   1,       0, 30000],
  ["grid", "W",   1,  -30000, 30000],
  ["load", "W",   1,  -30000, 30000],
  ["bat",  "W",   1,  -30000, 30000],
  ["soc",  "%",   1,       0,   100],
  ["totk", "kWh", 0.1,     0, 999999],
  ["temp", "°C",  1,     -40,   120],
];

let H = {};
let ROLES = ["pv", "grid", "load", "bat", "soc", "totk", "temp", "mode", "sn"];

for (let i = 0; i < ROLES.length; i++) {
  H[ROLES[i]] = Script.getVcHandle(ROLES[i]);
}

let INV = Script.getVcHandle("inv");

function isText(role) {
  return role === "mode" || role === "sn";
}

// Group members are "<type>:<id>" keys. Read IDs assigned by the firmware;
// IDs are allocated separately for each component type.
function applyGroup() {
  if (INV === undefined) return;
  let m = [];
  for (let i = 0; i < ROLES.length; i++) {
    let r = ROLES[i];
    m[i] = (isText(r) ? "text:" : "number:") + JSON.stringify(H[r].getConfig().id);
  }
  Shelly.call("Group.Set", { id: INV.getConfig().id, value: m });
  print("solax: group initialized with", m.length, "components");
}

// Configuration is persistent; write units only when missing.
function applyUi() {
  for (let i = 0; i < UI.length; i++) {
    let row = UI[i];
    let h = H[row[0]];
    if (h === undefined) {
      print("solax: missing component", row[0]);
      continue;
    }
    let cfg = h.getConfig();
    if (cfg.meta !== null && cfg.meta.ui !== undefined && cfg.meta.ui.unit === row[1]) {
      continue;
    }
    h.setConfig({
      min: row[3],
      max: row[4],
      meta: { ui: { view: "label", unit: row[1], step: row[2] } },
    });
    print("solax: ui ->", row[0]);
  }

  // The serial is the editable field.
  let sc = H.sn.getConfig();
  if (sc.meta === null || sc.meta.ui === undefined || sc.meta.ui.view !== "field") {
    H.sn.setConfig({ meta: { ui: { view: "field" } } });
    print("solax: ui -> sn (field)");
  }
}

function s16(v) {
  return v > 32767 ? v - 65536 : v;
}

function s32(lo, hi) {
  let v = lo + hi * 65536;
  return v > 2147483647 ? v - 4294967296 : v;
}

function r1(v) {
  return Math.floor(v * 10 + 0.5) / 10;
}

function onData(res, err) {
  if (err !== 0 || res === null || res.code !== 200) {
    H.mode.setValue("connection failed");
    print("solax: HTTP err", err, res === null ? "-" : res.code);
    return;
  }

  let r = JSON.parse(res.body);
  res = null;
  let d = r.Data;

  if (d === undefined || d.length < 110) {
    H.mode.setValue("invalid response");
    return;
  }

  // Incorrect credentials can return {code, message:"failed"} without Data.
  // Keep the original response-serial diagnostic.
  if (r.sn !== undefined && r.sn !== H.sn.getValue()) {
    print("solax: response from dongle", r.sn);
  }

  H.pv.setValue(d[14] + d[15]);                // PV1 + PV2 power.
  H.grid.setValue(s32(d[34], d[35]));          // Supplied convention: + import / - export.
  H.load.setValue(s16(d[47]));                 // House load.
  H.bat.setValue(s16(d[41]));                  // Supplied convention: + charge / - discharge.
  H.soc.setValue(d[103]);                      // Battery state of charge.
  H.totk.setValue(r1(s32(d[68], d[69]) / 10)); // Total generated energy.
  H.temp.setValue(s16(d[54]));                 // Heatsink temperature.
  H.mode.setValue(d[19] < MODE.length ? MODE[d[19]] : "code " + JSON.stringify(d[19]));
}

function poll() {
  let sn = H.sn.getValue();
  if (sn === null || sn === "") {
    H.mode.setValue("missing SN");
    return;
  }
  Shelly.call("HTTP.POST", {
    url: "http://" + CFG.ip + "/",
    body: "optType=ReadRealTimeData&pwd=" + sn,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10,
  }, onData);
}

// A serial change requests data immediately, without waiting for the timer.
H.sn.on("change", function (ev) {
  print("solax: new SN ->", ev.value);
  poll();
});

function init() {
  applyUi();
  applyGroup();
  Timer.set(CFG.period, true, poll);
  poll();
  print("solax dash: started, interval", CFG.period, "ms");
}

init();
