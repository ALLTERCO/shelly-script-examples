/**
 * @title Cury Light Language v2
 * @description Expressive light patterns for Shelly Cury UI and ambient LEDs with 9 communication states.
 */

// States: boot, ready, touch, pairing, active, low_liquid, error, night, goodbye
// Control via KVS key "cury:state" or call setState() directly.

// ============================================================================
// CONFIG
// ============================================================================

var CFG = {
  ui: 0,
  ambient: 1,
  kvsKey: "cury:state",
  poll: 1500
};

var COLOR = {
  white: [255, 255, 255],
  warm: [255, 180, 100],
  neutral: [255, 220, 180],
  cool: [200, 220, 255],
  blue: [100, 150, 255],
  amber: [255, 160, 30],
  red: [255, 20, 20]
};

var TIMING = {
  bootStep: 200,
  breatheIn: 2500,
  breatheOut: 2500,
  touchBlink: 100,
  morse: { dot: 120, dash: 360, gap: 120, pause: 5000 },
  drift: 45000,
  lowWarn: 10000,
  errorPause: 2000,
  nightCycle: 7000,
  fadeOut: 3000
};

// ============================================================================
// STATE
// ============================================================================

var state = null;
var timers = [];

function clearAll() {
  for (var i = 0; i < timers.length; i++) {
    Timer.clear(timers[i]);
  }
  timers = [];
}

function later(ms, fn, repeat) {
  var t = Timer.set(ms, repeat || false, fn);
  timers.push(t);
  return t;
}

// ============================================================================
// LIGHT CONTROL
// ============================================================================

function light(id, on, bri, rgb, trans) {
  var p = { id: id, on: on };
  if (bri !== undefined) p.brightness = Math.max(0, Math.min(100, bri));
  if (rgb) p.rgb = rgb;
  if (trans) p.transition = trans / 1000;
  Shelly.call("Light.Set", p);
}

function ui(bri, rgb, trans) {
  light(CFG.ui, bri > 0, bri, rgb, trans);
}

function amb(bri, rgb, trans) {
  light(CFG.ambient, bri > 0, bri, rgb, trans);
}

// ============================================================================
// PATTERNS
// ============================================================================

function boot() {
  // Knight Rider sweep: left -> center -> right -> center
  var sweep = [8, 25, 60, 100, 60, 25, 8];
  var step = TIMING.bootStep;

  amb(0, COLOR.warm, 0);

  for (var i = 0; i < sweep.length; i++) {
    (function(b, delay) {
      later(delay, function() { ui(b, COLOR.white, step * 0.8); });
    })(sweep[i], i * step);
  }

  // Ambient fade in during sweep
  later(step * 2, function() { amb(30, COLOR.warm, step * 4); });

  // Transition to ready
  later(sweep.length * step + 500, function() {
    setState("ready");
  });
}

function ready() {
  amb(20, COLOR.warm, 400);

  // Apple-style breathing
  function breathe() {
    ui(12, COLOR.white, TIMING.breatheIn);
    later(TIMING.breatheIn, function() {
      ui(0, COLOR.white, TIMING.breatheOut);
    });
  }

  breathe();
  later(TIMING.breatheIn + TIMING.breatheOut, breathe, true);
}

function touch() {
  var t = TIMING.touchBlink;

  // Quick double blink
  ui(20, COLOR.white, 0);
  later(t, function() { ui(0, COLOR.white, 0); });
  later(t * 2, function() { ui(20, COLOR.white, 0); });
  later(t * 3, function() { ui(0, COLOR.white, 0); });

  // Ambient bump
  amb(30, COLOR.warm, 50);
  later(t * 4, function() { amb(20, COLOR.warm, 200); });

  // Return to ready
  later(t * 5, function() { setState("ready"); });
}

function pairing() {
  var m = TIMING.morse;
  amb(18, COLOR.cool, 300);

  function sos() {
    // S: ...
    // O: ---
    // S: ...
    var seq = [
      m.dot, m.gap, m.dot, m.gap, m.dot, m.gap * 2,
      m.dash, m.gap, m.dash, m.gap, m.dash, m.gap * 2,
      m.dot, m.gap, m.dot, m.gap, m.dot
    ];

    var t = 0;
    var on = true;
    for (var i = 0; i < seq.length; i++) {
      (function(delay, isOn) {
        later(delay, function() {
          ui(isOn ? 15 : 0, COLOR.white, 0);
          if (isOn) amb(25, COLOR.blue, 50);
          else amb(18, COLOR.cool, 100);
        });
      })(t, on);
      t += seq[i];
      on = !on;
    }
  }

  sos();
  later(m.pause, sos, true);
}

function active() {
  ui(8, COLOR.white, 300);

  // Living ambient: slow drift between warm and neutral
  function drift() {
    amb(30, COLOR.warm, TIMING.drift);
    later(TIMING.drift, function() {
      amb(28, COLOR.neutral, TIMING.drift);
    });
  }

  drift();
  later(TIMING.drift * 2, drift, true);
}

function lowLiquid() {
  amb(20, COLOR.warm, 200);

  function warn() {
    // Triple amber blink
    for (var i = 0; i < 3; i++) {
      (function(idx) {
        later(idx * 300, function() { ui(25, COLOR.amber, 0); });
        later(idx * 300 + 150, function() { ui(0, COLOR.amber, 0); });
      })(i);
    }
    // Dim ambient briefly
    later(0, function() { amb(12, COLOR.warm, 100); });
    later(900, function() { amb(20, COLOR.warm, 300); });
  }

  warn();
  later(TIMING.lowWarn, warn, true);
}

function error() {
  amb(0, null, 200);

  function alarm() {
    for (var i = 0; i < 3; i++) {
      (function(idx) {
        later(idx * 240, function() { ui(30, COLOR.red, 0); });
        later(idx * 240 + 120, function() { ui(0, COLOR.red, 0); });
      })(i);
    }
  }

  alarm();
  later(TIMING.errorPause, alarm, true);
}

function night() {
  amb(5, COLOR.warm, 500);

  // Ultra-slow breathing
  var half = TIMING.nightCycle / 2;
  function breathe() {
    ui(3, COLOR.white, half);
    later(half, function() { ui(0, COLOR.white, half); });
  }

  breathe();
  later(TIMING.nightCycle, breathe, true);
}

function goodbye() {
  ui(0, COLOR.white, TIMING.fadeOut);
  amb(0, COLOR.warm, TIMING.fadeOut * 0.7);
}

// ============================================================================
// STATE MACHINE
// ============================================================================

var patterns = {
  boot: boot,
  ready: ready,
  touch: touch,
  pairing: pairing,
  active: active,
  low_liquid: lowLiquid,
  error: error,
  night: night,
  goodbye: goodbye
};

function setState(newState) {
  if (!newState || newState === state) return;
  if (!patterns[newState]) {
    print("[Cury] Unknown state: " + newState);
    return;
  }

  clearAll();
  state = newState;
  Shelly.call("KVS.Set", { key: CFG.kvsKey, value: newState });
  print("[Cury] -> " + newState);
  patterns[newState]();
}

function poll() {
  Shelly.call("KVS.Get", { key: CFG.kvsKey }, function(r, e) {
    if (!e && r && r.value && r.value !== state) {
      setState(r.value);
    }
  });
}

// ============================================================================
// INIT
// ============================================================================

Shelly.call("KVS.Get", { key: CFG.kvsKey }, function(r, e) {
  setState((!e && r && r.value) ? r.value : "boot");
});

later(CFG.poll, poll, true);
