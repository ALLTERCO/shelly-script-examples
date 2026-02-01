/**
 * BLU Presence Watcher (Gen3)
 * - Uses bthomedevice:ID and bthomesensor:ID
 * - Optional MAC check
 * - Quiet when present; prints periodically while absent
 */

/* === CONFIG === */
var DEV_ID   = 200;         // bthomedevice:<id>
var SENS_ID  = 200;         // bthomesensor:<id> (battery)
var SWITCH_ID = 0;          // local relay to turn OFF
var TURN_OFF_URL = "";      // HTTP URL to call on turn off (leave "" to disable)

var ABSENT_AFTER = 30;      // first "lost contact" after this many seconds
var OFF_AFTER    = 90;      // turn OFF after this many seconds of silence
var TICK         = 1;       // watchdog cadence (sec)
var ABSENT_LOG_EVERY = 5;   // while absent, print at most once / N sec
var GONE_LOG_EVERY   = 30;  // after OFF, print at most once / N sec
var SENSOR_COUNTS_AS_PRESENCE = true;  // battery updates keep presence

/* Optional MAC enforcement (recommended if multiple BLUs exist) */
var KVS_KEY_EXPECTED_ADDR = "blu_expected_addr";  // KVS key for expected MAC address
var EXPECTED_ADDR    = "";      // loaded from KVS at init
var ENFORCE_ADDR     = false;   // true = drop updates that carry a different MAC
var WARN_ON_MISMATCH = true;

/* === STATE === */
var DEVKEY  = "bthomedevice:" + DEV_ID;
var SENSKEY = "bthomesensor:" + SENS_ID;

var lastTime = 0;  // epoch seconds of last presence
var lastPid = -1;
var lastRssi = null;
var lastBatt = null;

var loggedAbsent = false;
var switchedOff  = false;
var lastAbsentLogAt = 0;
var lastGoneLogAt   = 0;

var boundAddrN = "";  // learned from config if available

/* === HELPERS === */
function now() {
  return Math.floor(Date.now() / 1000);
}

function up(s) {
  return ("" + s).toUpperCase();
}

function normMac(s) {
  if (!s) return "";
  var u = up(s);
  var o = "";
  for (var i = 0; i < u.length; i++) {
    var c = u.charAt(i);
    if (c !== ":" && c !== "-") o += c;
  }
  return o;
}

var EXPECTED_N = "";  // normalized MAC, set after KVS load

/**
 * Validates if a string is a valid MAC address.
 * Accepts formats: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, or AABBCCDDEEFF
 */
function isValidMac(s) {
  if (!s || typeof s !== "string") return false;
  var n = normMac(s);
  if (n.length !== 12) return false;
  for (var i = 0; i < n.length; i++) {
    var c = n.charAt(i);
    if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) return false;
  }
  return true;
}

function get(o, a, b, c) {
  var v = o;
  if (v == null) return;
  v = v[a];
  if (b === undefined) return v;
  if (v == null) return;
  v = v[b];
  if (c === undefined) return v;
  if (v == null) return;
  return v[c];
}

function first() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined) return arguments[i];
  }
}

function extractAddr(x) {
  return first(
    x.addr, x.address, x.mac,
    get(x, 'delta', 'addr'), get(x, 'delta', 'address'), get(x, 'delta', 'mac'),
    get(x, 'status', 'addr'), get(x, 'status', 'address'), get(x, 'status', 'mac')
  ) || "";
}

function addrAllowed(addr) {
  if (!ENFORCE_ADDR || !EXPECTED_N) return true;
  var n = normMac(addr);
  if (!n && boundAddrN) n = boundAddrN;
  if (!n) return true;
  return (n === EXPECTED_N);
}

function maybeWarn(addr) {
  if (!WARN_ON_MISMATCH || !EXPECTED_N) return;
  var n = normMac(addr);
  if (n && n !== EXPECTED_N) {
    print("WARN: drop update from " + addr + " (expected " + EXPECTED_ADDR + ")");
  }
}

function battFromSensors(s) {
  if (!s) return null;
  if (s["1"] && s["1"].length) {
    var v = s["1"][0].value;
    if (typeof v === "number") return v;
  }
  for (var k in s) {
    var a = s[k];
    if (a && a.length) {
      var v2 = a[0].value;
      if (typeof v2 === "number") return v2;
    }
  }
  return null;
}

function fieldsFromDev(x) {
  var ts   = first(x.last_updated_ts, get(x, 'delta', 'last_updated_ts'), get(x, 'status', 'last_updated_ts'));
  var pid  = first(x.packet_id, get(x, 'delta', 'packet_id'), get(x, 'status', 'packet_id'));
  var rssi = first(x.rssi, get(x, 'delta', 'rssi'), get(x, 'status', 'rssi'));
  var batt = first(x.battery, get(x, 'delta', 'battery'), get(x, 'status', 'battery'));
  if (typeof batt !== "number") {
    batt = battFromSensors(first(x.sensors, get(x, 'delta', 'sensors'), get(x, 'status', 'sensors')));
  }
  var addr = extractAddr(x);
  return {
    ts: (typeof ts === "number" ? Math.floor(ts) : undefined),
    pid: pid,
    rssi: rssi,
    batt: batt,
    addr: addr
  };
}

/* === TURN OFF ACTION === */
/**
 * Called when the BLU device has been out of range for OFF_AFTER seconds.
 * Put your custom turn-off logic here (switch, HTTP call, IR command, etc.)
 */
function turnOff() {
  // Check if switch component exists on this device
  var switchStatus = Shelly.getComponentStatus("switch", SWITCH_ID);
  if (switchStatus === null) {
    print("TURN OFF: Switch " + SWITCH_ID + " not available on this device.");
  } else {
    Shelly.call("Switch.Set", { id: SWITCH_ID, on: false }, function(r, e, em) {
      if (e) print("Switch.Set error:", e, em || "");
    });
    print("TURN OFF called for switch " + SWITCH_ID);
  }

  // Call HTTP URL if configured
  if (TURN_OFF_URL !== "") {
    Shelly.call("HTTP.GET", { url: TURN_OFF_URL }, function(r, e, em) {
      if (e) {
        print("HTTP.GET error:", e, em || "");
      } else {
        print("HTTP.GET called: " + TURN_OFF_URL);
      }
    });
  }
}

/* === BLU BUTTON EVENT HANDLER === */
/**
 * Handles BLU button press events.
 * Events: single_push, double_push, triple_push, long_push
 */
function onBluButtonEvent(ev) {
  if (!ev || ev.component !== DEVKEY) return;
  if (!ev.info || !ev.info.event) return;

  var eventType = ev.info.event;
  print("BLU Button Event: " + eventType);

  if (eventType === "single_push") {
    // Handle single push
  } else if (eventType === "double_push") {
    // Handle double push
  } else if (eventType === "triple_push") {
    // Handle triple push
  } else if (eventType === "long_push") {
    // Handle long push
  }
}

/* === PRESENCE CORE === */
function seen(reason, pid, rssi, batt) {
  var wasAway = (lastTime === 0) || loggedAbsent || switchedOff;
  lastTime = now();
  if (typeof pid === "number") lastPid = pid;
  if (typeof rssi === "number") lastRssi = rssi;
  if (typeof batt === "number") lastBatt = batt;

  if (wasAway) {
    var msg = "Back in range via " + reason;
    if (lastPid >= 0) msg += " pid=" + lastPid;
    if (lastRssi !== null) msg += " rssi=" + lastRssi;
    if (lastBatt !== null) msg += " batt=" + lastBatt + "%";
    print(msg + ". Timers reset.");

    // Example: Time-based turn ON when device returns
    // var time = new Date();
    // var hour = time.getHours();
    // if (hour >= 18 || hour < 6) {
    //   Shelly.call("Switch.Set", { id: SWITCH_ID, on: true });
    // }
  }

  loggedAbsent = false;
  switchedOff = false;
  lastAbsentLogAt = 0;
  lastGoneLogAt = 0;
}

/* === EVENT HANDLERS === */
function onDevStatus(ev) {
  if (!ev || ev.component !== DEVKEY) return;
  var f = fieldsFromDev(ev);
  if (!addrAllowed(f.addr)) {
    maybeWarn(f.addr);
    return;
  }
  seen("dev:status", f.pid, f.rssi, f.batt);
}

function onDevEvent(ev) {
  if (!ev || ev.component !== DEVKEY) return;
  if (!ev.event) return;
  var a = extractAddr(ev);
  if (!addrAllowed(a)) {
    maybeWarn(a);
    return;
  }
  seen("dev:event:" + ev.event, undefined, undefined, undefined);
}

function onSensorStatus(ev) {
  if (!ev || ev.component !== SENSKEY) return;
  var a = extractAddr(ev);
  if (!addrAllowed(a)) {
    maybeWarn(a);
    return;
  }
  var batt = first(ev.value, get(ev, 'delta', 'value'), get(ev, 'status', 'value'));
  if (typeof batt === "number") lastBatt = batt;
  if (SENSOR_COUNTS_AS_PRESENCE) seen("sensor", undefined, undefined, lastBatt);
}

/* === WATCHDOG UPDATE === */
function update() {
  var timeNow = now();

  if (lastTime === 0) {
    if (timeNow - lastAbsentLogAt >= ABSENT_LOG_EVERY) {
      print("Waiting for first beacon/event...");
      lastAbsentLogAt = timeNow;
    }
    return;
  }

  var silent = timeNow - lastTime;

  if (silent >= OFF_AFTER) {
    if (!switchedOff) {
      switchedOff = true;
      loggedAbsent = true;
      print("Out of range for " + silent + "s (>=" + OFF_AFTER + "s). Turning OFF switch " + SWITCH_ID + "...");
      turnOff();
      lastGoneLogAt = timeNow;
    } else if (timeNow - lastGoneLogAt >= GONE_LOG_EVERY) {
      print("Still out of range (" + silent + "s); switch " + SWITCH_ID + " is OFF.");
      lastGoneLogAt = timeNow;
    }
    return;
  }

  if (silent >= ABSENT_AFTER) {
    var left = OFF_AFTER - silent;
    if (!loggedAbsent) {
      loggedAbsent = true;
      print("Lost contact " + silent + "s ago; OFF in " + left + "s.");
      lastAbsentLogAt = timeNow;
    } else if (timeNow - lastAbsentLogAt >= ABSENT_LOG_EVERY) {
      print("Not seen for " + silent + "s; OFF in " + left + "s.");
      lastAbsentLogAt = timeNow;
    }
  }
}

/* === INITIALIZATION === */
function startWatcher() {
  // Register handlers
  Shelly.addStatusHandler(onDevStatus);
  Shelly.addEventHandler(onDevEvent);
  Shelly.addEventHandler(onBluButtonEvent);
  Shelly.addStatusHandler(onSensorStatus);

  // Learn bound MAC from config if available
  var cfg = Shelly.getComponentConfig("bthomedevice", DEV_ID);
  if (cfg) {
    var ca = cfg.addr || cfg.address || cfg.mac;
    if (ca) {
      boundAddrN = normMac(ca);
      print("Bound MAC: " + ca);
    }
  }

  // Seed from current status so we start "present" if seen recently
  var st = Shelly.getComponentStatus("bthomedevice", DEV_ID);
  if (st) {
    var f = fieldsFromDev(st);
    lastTime = now();
    if (typeof f.pid === "number") lastPid = f.pid;
    if (typeof f.rssi === "number") lastRssi = f.rssi;
    if (typeof f.batt === "number") lastBatt = f.batt;
  }

  var ss = Shelly.getComponentStatus("bthomesensor", SENS_ID);
  if (ss) {
    var b = first(ss.value, get(ss, 'delta', 'value'), get(ss, 'status', 'value'));
    if (typeof b === "number") lastBatt = b;
    if (SENSOR_COUNTS_AS_PRESENCE) seen("sensor:init", undefined, undefined, lastBatt);
  }

  print("Watching " + DEVKEY + " & " + SENSKEY + "; OFF after " + OFF_AFTER + "s."
    + (EXPECTED_N ? (" Expect " + EXPECTED_ADDR + ".") : "")
    + (boundAddrN ? (" Bound " + boundAddrN + ".") : ""));

  // Start watchdog timer
  Timer.set(TICK * 1000, true, update);
}

function init() {
  // Load expected MAC address from KVS
  Shelly.call("KVS.Get", { key: KVS_KEY_EXPECTED_ADDR }, function(result, error_code, error_message) {
    if (error_code !== 0 || !result || result.value === undefined) {
      print("ERROR: KVS key '" + KVS_KEY_EXPECTED_ADDR + "' not found.");
      print("Please set expected MAC address using:");
      print("  Shelly.call('KVS.Set', {key: '" + KVS_KEY_EXPECTED_ADDR + "', value: 'AA:BB:CC:DD:EE:FF'})");
      return;
    }

    var macValue = result.value;
    if (!isValidMac(macValue)) {
      print("ERROR: Invalid MAC address in KVS key '" + KVS_KEY_EXPECTED_ADDR + "': " + macValue);
      print("MAC address must be in format: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, or AABBCCDDEEFF");
      return;
    }

    EXPECTED_ADDR = macValue;
    EXPECTED_N = normMac(EXPECTED_ADDR);
    print("Loaded expected MAC from KVS: " + EXPECTED_ADDR);

    // Continue with watcher initialization
    startWatcher();
  });
}

init();
