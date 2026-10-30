/**
 * @title Midea XYE RS485 control for The Pill
 * @description Controls Midea XYE indoor units over RS485 using The Pill UART add-on, with six Virtual Components for Home Assistant.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/XYE/Midea/midea-xye-pill-rs485-control.shelly.js
 */

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Georgi Germanov and contributors
 *
 * Hardware-tested on 2026-10-24 with MCA4U-18HRFNX(GA), unit address 0.
 * Connection: indoor-unit CN3 X -> RS485 A, Y -> RS485 B, E -> GND.
 * Requires The Pill in js_uart mode, UART 0 at 4800 8N1, half-duplex.
 * Only one script can own UART 0. No other script may use that port.
 *
 * Six Virtual Components (IDs are configurable from BASE=200):
 * - enum:200   AC Mode (off, auto, cool, heat, dry, fan)
 * - enum:201   AC Fan (auto, low, medium, high)
 * - number:202 AC Setpoint (16-30 C)
 * - number:203 AC Room (read-only T1 temperature)
 * - text:204   AC Status (diagnostics)
 * - boolean:205 AC Power (on/off; restores the last running mode)
 *
 * SET commands preserve current mode, fan and setpoint and are verified by
 * readback. AUTO-mode write byte is not yet hardware-confirmed.
 * ALLOW_WRITE defaults to true; disable writes in CFG for monitoring only.
 * Site-wide mutual exclusion of multiple AC units is NOT implemented here.
 *
 * Binary frames must use String.fromCharCode(), not chr(): on this engine,
 * chr(0) creates an empty string and corrupts 16-byte frames.
 */

let CFG = {
  // HARD WRITE LOCK. While false the script is strictly read-only: no SET frame
  // is ever built, and the component change handler is not even registered, so
  // a toggle in Home Assistant or the Shelly app cannot reach the compressor.
  // Site rule 2026-10-25: no more than one air conditioner may be running.
  ALLOW_WRITE: true,
  UNIT: 0,
  BASE: 200,
  POLL_MS: 10000,
  REPLY_MS: 400,
  SET_SETTLE_MS: 1200,
  TMIN: 16,
  TMAX: 30,
  DEBUG: true
};

let MODE_OPTS = ["off", "auto", "cool", "heat", "dry", "fan"];
// auto: 0x80 | 0x10 auto-flag. The value to SEND for auto is the one field
// here not yet confirmed on hardware - the READ side below is confirmed.
let MODE_BYTE = { off: 0x00, auto: 0x90, cool: 0x88, heat: 0x84, dry: 0x82, fan: 0x81 };
let FAN_OPTS = ["auto", "low", "medium", "high"];
// A virtual enum DOES become a select entity on HA 2026.10, but only if its
// meta.ui carries BOTH view:"dropdown" AND a titles map. Without titles the
// integration raises KeyError in ShellyRpcAttributeEntity.__init__ and loses
// EVERY entity of the select and sensor platforms for this device - including
// the device's own native sensors. Verified on HA 2026.10.4, 2026-10-26.
// Both mode and fan are real enums, so both become dropdowns in HA.
let FAN_TITLES = { auto: "Auto", low: "Low", medium: "Medium", high: "High" };
let MODE_TITLES = {
  off: "Off", auto: "Auto", cool: "Cooling",
  heat: "Heating", dry: "Dry", fan: "Fan"
};
let FAN_BYTE = { auto: 0x80, low: 0x04, medium: 0x02, high: 0x01 };

let HEXD = "0123456789ABCDEF";

// String.prototype.at() returns a CHARACTER CODE here, not a character,
// so hex has to be cut with slice().
function hx(n) {
  let hi = (n >> 4) & 15, lo = n & 15;
  return HEXD.slice(hi, hi + 1) + HEXD.slice(lo, lo + 1);
}
function hexs(s) {
  let o = "", i;
  for (i = 0; i < s.length; i++) { o = o + hx(s.charCodeAt(i) & 255) + " "; }
  return o;
}

// Returns "" for a byte we do not recognise, so publish() can leave the enum
// alone instead of writing a value that is not in its option list - a rejected
// Enum.Set silently leaves the component showing something stale and wrong.
function modeName(v) {
  if (v === 0x00) { return "off"; }
  if (v === 0x88) { return "cool"; }
  if (v === 0x84) { return "heat"; }
  if (v === 0x82) { return "dry"; }
  if (v === 0x81) { return "fan"; }
  // The auto family. The unit packs a sub-state in alongside the 0x10 auto
  // flag: 0x10 startup, 0x94 idle, 0x91 heating, 0x98 cooling, 0x80/0x90 plain.
  // Observed 0x10 on a real MCA4U cassette, so PROTOCOL.md's claim that the
  // indoor unit never reports AUTO is wrong for this family.
  if (v === 0x80 || v === 0x90 || (v & 0x10) !== 0) { return "auto"; }
  return "";
}

function modeSub(v) {
  if (v === 0x10) { return " (starting)"; }
  if (v === 0x94) { return " (idle)"; }
  if (v === 0x91) { return " (heating)"; }
  if (v === 0x98) { return " (cooling)"; }
  return "";
}
function fanName(v) {
  let sp = v & 0x0F;
  if ((v & 0x80) !== 0) { return "auto"; }
  if (sp === 1) { return "high"; }
  if (sp === 2) { return "medium"; }
  if (sp === 3 || sp === 4) { return "low"; }
  return "auto";
}
// T1/T2A/T2B/T3 are encoded; the SETPOINT byte is raw Celsius. Two different
// encodings in one frame - confirmed against hardware.
function tC(v) {
  if (v === 255) { return null; }
  return (v - 40) / 2;
}

// ---------- frame construction ----------

function frame(cmd, dst, mode, fan, temp, mflags) {
  let b = [0xAA, cmd, dst, 0x00, 0x80, 0x00,
           mode, fan, temp, 0x00, 0x00, mflags, 0x00,
           (0xFF - cmd) & 0xFF, 0x00, 0x55];
  let sum = 0, i;
  for (i = 0; i < 16; i++) { if (i !== 14) { sum = sum + b[i]; } }
  b[14] = (0xFF - (sum & 0xFF)) & 0xFF;
  let o = "";
  for (i = 0; i < 16; i++) { o = o + String.fromCharCode(b[i]); }
  return o;
}
function queryFrame() { return frame(0xC0, CFG.UNIT, 0, 0, 0, 0); }
function setFrame(mode, fan, temp) { return frame(0xC3, CFG.UNIT, mode, fan, temp, 0x00); }

function replyValid(s) {
  if (s.length !== 32) { return false; }
  if ((s.charCodeAt(0) & 255) !== 0xAA) { return false; }
  if ((s.charCodeAt(31) & 255) !== 0x55) { return false; }
  let sum = 0, i;
  for (i = 0; i < 32; i++) { if (i !== 30) { sum = sum + (s.charCodeAt(i) & 255); } }
  if (((0xFF - (sum & 0xFF)) & 0xFF) !== (s.charCodeAt(30) & 255)) { return false; }
  return (s.charCodeAt(4) & 255) === CFG.UNIT;
}

// ---------- live state ----------

let lastOnMode = 0x88;   // what Power=on restores; seeded to cool

let st = {
  have: false, modeB: 0x00, fanB: 0x80, setp: 22,
  t1: null, t2a: null, t3: null, comp: 0,
  err: 0, prot: 0, replies: 0, misses: 0
};

let port = null;
let buf = "";
let pending = 0;       // 0 idle, 1 waiting for a reply
// lastPub holds the value each component currently SHOWS - whether we wrote it
// or Home Assistant did. That makes it both the echo filter and the test for
// skipping a redundant write, and keeps those two from ever disagreeing.
// The earlier suppress window needed the poll timer to clear it, and any
// publish landing in between re-armed it; a window that never expires mutes
// every real command.
let lastPub = {};
let applyBusy = 0;     // only one SET sequence in flight at a time
let verifyWanted = 0;  // compare the next reply against what we asked for
let want = { mode: -1, fan: -1, temp: -1 };
let ready = false;
let vcOk = false;
let noBus = false;   // true when UART 0 is not available - controls live, no machine

function parse(s) {
  let b = [], i;
  for (i = 0; i < 32; i++) { b.push(s.charCodeAt(i) & 255); }
  st.modeB = b[8];
  if (b[8] !== 0x00) { lastOnMode = b[8]; }
  st.fanB = b[9];
  st.setp = b[10] & 0xBF;
  st.t1 = tC(b[11]);
  st.t2a = tC(b[12]);
  st.t3 = tC(b[14]);
  st.comp = b[19];
  st.err = (b[23] * 256) + b[22];
  st.prot = (b[25] * 256) + b[24];
  st.have = true;
  st.replies = st.replies + 1;
}

function statusLine() {
  if (!st.have) { return "no data"; }
  let t = (st.t1 === null) ? "?" : JSON.stringify(st.t1);
  let mn = modeName(st.modeB);
  if (mn === "") { mn = "mode?0x" + hx(st.modeB); } else { mn = mn + modeSub(st.modeB); }
  let s = mn + " / " + fanName(st.fanB) +
          " / set " + JSON.stringify(st.setp) + "C" +
          " / room " + t + "C" +
          (st.comp === 1 ? " / compressor on" : " / compressor off");
  if (st.err !== 0 || st.prot !== 0) {
    s = s + " / ERR 0x" + hx(st.err & 255) + " PROT 0x" + hx(st.prot & 255);
  }
  return s;
}

// ---------- virtual components ----------

// Shelly scripts cap concurrent Shelly.call() at five. Firing six component
// writes at once silently drops the sixth, so they go out one at a time.
let pubQ = [], pubI = 0, pubBusy = false;

function pubDrain() {
  if (pubBusy) { return; }
  if (pubI >= pubQ.length) {
    pubQ = []; pubI = 0;
    return;
  }
  let it = pubQ[pubI];
  pubI = pubI + 1;
  pubBusy = true;
  Shelly.call(it.m, { id: it.id, value: it.v }, function (r, ec, em) {
    pubBusy = false;
    if (ec !== 0 && CFG.DEBUG) {
      print("vc set failed " + it.m + " id " + JSON.stringify(it.id) + " -> " + em);
    }
    pubDrain();
  });
}

function vcSet(method, idx, value) {
  if (!vcOk) { return; }
  if (lastPub[JSON.stringify(idx)] === value) { return; }   // already shows this
  lastPub[JSON.stringify(idx)] = value;
  pubQ.push({ m: method + ".Set", id: CFG.BASE + idx, v: value });
  pubDrain();
}

// True when the event is the echo of our own write. Otherwise the component
// was changed from outside, so record what it now shows and let the caller act.
function seen(idx, v) {
  if (lastPub[JSON.stringify(idx)] === v) { return true; }
  lastPub[JSON.stringify(idx)] = v;
  return false;
}

function publish() {
  let mn0 = modeName(st.modeB);
  if (mn0 !== "") { vcSet("Enum", 0, mn0); }
  vcSet("Enum", 1, fanName(st.fanB));
  vcSet("Number", 2, st.setp);
  if (st.t1 !== null) { vcSet("Number", 3, st.t1); }
  vcSet("Text", 4, statusLine());
  vcSet("Boolean", 5, st.modeB !== 0x00);
}

// ---------- polling and commands ----------

function send(fr, tag) {
  if (port === null) { print("no bus, not sending " + tag); return false; }
  let n = port.send(fr), guard = 0;
  while (n !== 16 && guard < 8) { guard = guard + 1; n = port.send(fr); }
  if (n !== 16) {
    print("TX FAILED (" + tag + ") send() returned " + JSON.stringify(n));
    return false;
  }
  if (CFG.DEBUG) { print("TX " + tag + " " + hexs(fr)); }
  return true;
}

function poll() {
  if (!ready || pending === 1) { return; }
  buf = "";
  pending = 1;
  if (!send(queryFrame(), "C0")) { pending = 0; return; }
  Timer.set(CFG.REPLY_MS, false, function () {
    if (pending === 1) {
      pending = 0;
      st.misses = st.misses + 1;
      if (CFG.DEBUG) { print("no reply, misses=" + JSON.stringify(st.misses)); }
      vcSet("Text", 4, "offline, misses " + JSON.stringify(st.misses));
    }
  });
}

// Apply a change. Unspecified fields keep their last known value, because a
// SET frame always carries all three.
function apply(modeB, fanB, temp) {
  if (applyBusy) { print("a SET is already in flight, ignoring"); return; }
  if (!CFG.ALLOW_WRITE) {
    print("WRITE LOCKED - ignoring a command. Set CFG.ALLOW_WRITE to enable.");
    return;
  }
  if (noBus) {
    // No machine to ask, so the controls simply hold what they were set to.
    if (modeB >= 0) { st.modeB = modeB; }
    if (fanB >= 0) { st.fanB = fanB; }
    if (temp >= 0) { st.setp = temp; }
    publish();
    return;
  }
  if (!st.have) { print("refusing to SET before a first successful read"); return; }
  let m = (modeB < 0) ? st.modeB : modeB;
  let f = (fanB < 0) ? st.fanB : fanB;
  // The reply packs the CURRENT running speed into the low nibble alongside the
  // auto flag (0x84 = auto, running low). Echoing that straight back in a SET
  // can be read as "fixed low". Normalise auto to a clean 0x80.
  if ((f & 0x80) !== 0) { f = 0x80; }
  let t = (temp < 0) ? st.setp : temp;
  if (t < CFG.TMIN) { t = CFG.TMIN; }
  if (t > CFG.TMAX) { t = CFG.TMAX; }
  want.mode = m; want.fan = f; want.temp = t;
  print("SET -> mode " + modeName(m) + " fan " + fanName(f) + " setpoint " + JSON.stringify(t) + "C");
  buf = "";
  pending = 1;
  applyBusy = 1;
  if (!send(setFrame(m, f, t), "C3")) { pending = 0; applyBusy = 0; return; }
  // One timer, not two nested ones. The verify is done against whatever the
  // regular polling loop has read by then, so no extra timer is needed.
  Timer.set(CFG.SET_SETTLE_MS, false, function () {
    pending = 0;
    applyBusy = 0;
    verifyWanted = 1;
    poll();
  });
}

// Console helpers
function setMode(name) {
  if (MODE_BYTE[name] === undefined) { print("mode must be one of off cool heat dry fan"); return; }
  apply(MODE_BYTE[name], -1, -1);
}
function setFan(name) {
  if (FAN_BYTE[name] === undefined) { print("fan must be one of auto low medium high"); return; }
  apply(-1, FAN_BYTE[name], -1);
}
function setTemp(c) { apply(-1, -1, c); }
// One switch for the common case. Off writes mode 0x00; on restores whatever
// mode the unit was last seen running in, so turning it back on does not
// silently change heat into cool.
function setPower(on) {
  if (on) { apply(lastOnMode, -1, -1); } else { apply(0x00, -1, -1); }
}
function resend() { apply(-1, -1, -1); }   // rewrite current values unchanged
function status() { print(statusLine()); }

// ---------- receive ----------

function onData(d) {
  if (d === null) { return; }
  buf = buf + d;
  while (buf.length >= 32) {
    let a = buf.indexOf("\xaa");
    if (a < 0) { buf = ""; return; }
    if (buf.length - a < 32) { buf = buf.slice(a); return; }
    let fr = buf.slice(a, a + 32);
    if (replyValid(fr)) {
      buf = buf.slice(a + 32);
      pending = 0;
      parse(fr);
      if (CFG.DEBUG) { print("RX " + statusLine()); }
      if (verifyWanted === 1) {
        verifyWanted = 0;
        print("VERIFY mode " + (st.modeB === want.mode ? "ok" : "MISMATCH " + modeName(st.modeB)) +
              " | setpoint " + (st.setp === want.temp ? "ok" : "MISMATCH " + JSON.stringify(st.setp)));
      }
      publish();
    } else {
      buf = buf.slice(a + 1);
    }
  }
}

// ---------- component change handler ----------

function onStatus(e) {
  if (!ready) { return; }
  if (e === undefined || e.component === undefined || e.delta === undefined) { return; }
  if (e.delta.value === undefined) { return; }
  let c = e.component, v = e.delta.value;
  if (c === "enum:" + JSON.stringify(CFG.BASE)) {
    if (seen(0, v)) { return; }
    setMode(v);
    return;
  }
  if (c === "enum:" + JSON.stringify(CFG.BASE + 1)) {
    if (seen(1, v)) { return; }
    setFan(v);
    return;
  }
  if (c === "number:" + JSON.stringify(CFG.BASE + 2)) {
    if (seen(2, v)) { return; }
    setTemp(v); return;
  }
  if (c === "boolean:" + JSON.stringify(CFG.BASE + 5)) {
    if (seen(5, v)) { return; }
    setPower(v); return;
  }
}

// ---------- startup ----------

// meta.ui.view decides which Home Assistant platform picks the component up.
// From homeassistant/components/shelly/const.py, VIRTUAL_COMPONENTS_MAP:
//   boolean toggle -> switch   | boolean label -> binary_sensor
//   enum    dropdown -> select | enum    label -> sensor
//   number  field|slider -> number       | number label -> sensor
//   text    field -> text               | text   label -> sensor
// A component created WITHOUT meta - or with a meta.ui that has no "view" -
// is worse than skipped: is_view_for_platform() in the integration indexes it
// unguarded and the TypeError takes down every entity of that platform.
// An enum additionally needs meta.ui.titles. Both rules verified on hardware.
let VCS = [
  { kind: "enum",    set: "Enum",    idx: 0, cfg: { name: "AC Mode", options: MODE_OPTS, default_value: "off", persisted: false, meta: { ui: { view: "dropdown", titles: MODE_TITLES } } } },
  { kind: "enum",    set: "Enum",    idx: 1, cfg: { name: "AC Fan", options: FAN_OPTS, default_value: "auto", persisted: false, meta: { ui: { view: "dropdown", titles: FAN_TITLES } } } },
  { kind: "number",  set: "Number",  idx: 2, cfg: { name: "AC Setpoint", min: 16, max: 30, step: 1, meta: { ui: { view: "slider", unit: "°C" } }, default_value: 22, persisted: false } },
  { kind: "number",  set: "Number",  idx: 3, cfg: { name: "AC Room", min: -20, max: 60, step: 0.5, meta: { ui: { view: "label", unit: "°C" } }, default_value: 0, persisted: false } },
  { kind: "text",    set: "Text",    idx: 4, cfg: { name: "AC Status", max_len: 255, default_value: "starting", persisted: false, meta: { ui: { view: "field" } } } },
  { kind: "boolean", set: "Boolean", idx: 5, cfg: { name: "AC Power", default_value: false, persisted: false, meta: { ui: { view: "toggle" } } } }
];

// AC Heat and AC Cool existed only so a generic_thermostat had a switch to
// write to. No thermostats, no reason - and dropping them frees two of the ten
// virtual component slots the firmware allows.
let RETIRED = ["boolean:206", "boolean:207"];

function keyType(k) { let p = k.indexOf(":"); return p < 0 ? "" : k.slice(0, p); }
function keyId(k)   { let p = k.indexOf(":"); return p < 0 ? "" : k.slice(p + 1); }

function isRetired(k) {
  let i;
  for (i = 0; i < RETIRED.length; i++) { if (RETIRED[i] === k) { return true; } }
  return false;
}

// True for a component sitting on one of OUR ids with the WRONG type - the one
// case Virtual.Add can never fix, because it does nothing to an existing id.
function wrongTypeOnOurId(k) {
  let i, t = keyType(k), id = keyId(k);
  for (i = 0; i < VCS.length; i++) {
    if (JSON.stringify(CFG.BASE + VCS[i].idx) === id) { return VCS[i].kind !== t; }
  }
  return false;
}

function killNext(list, i, cb) {
  if (i >= list.length) { cb(); return; }
  print("migrate: deleting " + list[i]);
  Shelly.call("Virtual.Delete", { key: list[i] }, function () { killNext(list, i + 1, cb); });
}

// Delete exactly two kinds of leftovers: a retired component, and a component
// of the wrong type on one of our ids. Nothing else on the device is touched.
function migrate(cb) {
  Shelly.call("Shelly.GetComponents", { dynamic_only: true }, function (r, ec, em) {
    if (ec !== 0 || r === null || r === undefined) {
      print("migrate: cannot list components -> " + em);
      cb();
      return;
    }
    let kill = [], i, k;
    for (i = 0; i < r.components.length; i++) {
      k = r.components[i].key;
      if (isRetired(k) || wrongTypeOnOurId(k)) { kill.push(k); }
    }
    if (kill.length === 0) { print("migrate: nothing to clean"); }
    killNext(kill, 0, cb);
  });
}

function makeVCs(i) {
  if (i >= VCS.length) {
    vcOk = true;
    print("virtual components ready at " + JSON.stringify(CFG.BASE) + "..." +
          JSON.stringify(CFG.BASE + VCS.length - 1));
    startUart();
    return;
  }
  let v = VCS[i];
  Shelly.call("Virtual.Add", { type: v.kind, id: CFG.BASE + v.idx, config: v.cfg }, function (r, ec, em) {
    if (ec !== 0 && CFG.DEBUG) { print("Virtual.Add " + v.kind + ":" + JSON.stringify(CFG.BASE + v.idx) + " -> " + em); }
    // Add does nothing to a component that already exists, so a unit flashed by
    // an older version would keep its old name, view, titles and options. Force
    // them every start.
    Shelly.call(v.set + ".SetConfig", { id: CFG.BASE + v.idx, config: v.cfg }, function (r2, ec2, em2) {
      if (ec2 !== 0) {
        print("SetConfig FAILED on " + v.kind + ":" + JSON.stringify(CFG.BASE + v.idx) + " -> " + em2);
      }
      makeVCs(i + 1);
    });
  });
}

function startUart() {
  // On a device without UART support - and on a Pill whose mode is NOT
  // js_uart - the UART object does not merely return null, the symbol does not
  // exist at all, and touching it throws ReferenceError and kills the script.
  // Verified on fw 2.1.0: typeof UART === "undefined" is true there.
  if (typeof UART === "undefined") {
    print("NO BUS: no UART on this device. A Pill must be in js_uart mode.");
    noBus = true;
  } else if ((port = UART.get(0)) === null) {
    // Bench mode. The controls are still created and still writable, there is
    // simply no machine behind them. This is what makes the same script
    // testable on any Shelly, not only on a Pill with the add-on.
    print("NO BUS: UART 0 unavailable (another script may be holding it).");
    noBus = true;
  } else {
    port.configure({ baud: 4800, format: "8N1" });
    port.recv(onData);
  }
  ready = true;
  if (CFG.ALLOW_WRITE) {
    Shelly.addStatusHandler(onStatus);
  } else {
    print("read-only: component change handler NOT registered");
  }
  print("XYE control up. unit=" + JSON.stringify(CFG.UNIT) + " 4800 8N1");
  print("console: setPower(true) setMode('cool') setFan('auto') setTemp(22) resend() status()");
  if (noBus) { publish(); return; }
  Timer.set(800, false, poll);
  Timer.set(CFG.POLL_MS, true, poll);
}

migrate(function () { makeVCs(0); });
