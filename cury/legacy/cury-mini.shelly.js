/**
 * @title Cury Mini Legacy
 * @description Compact legacy Cury light-language implementation with built-in state logic, timing patterns, and periodic hardware checks.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/cury/legacy/cury-mini.shelly.js
 */

var CFG = {
  ui: 0,
  ambient: 1,
  kvsKey: 'cury:state',
  pK: 1500,
  pollHw: 5000,
  lowLevelThreshold: 15
};

var CL = {
  white: [255, 255, 255],
  warm: [255, 180, 100],
  neutral: [255, 220, 180],
  cool: [200, 220, 255],
  blue: [100, 150, 255],
  amber: [255, 160, 30],
  red: [255, 20, 20]
};

var TM = {
  bootStep: 200,
  breatheIn: 2500,
  breatheOut: 2500,
  touchBlink: 100,
  morse: { dot: 120, dash: 360, gap: 120, pause: 5000 },
  dr: 45000,
  lowWarn: 10000,
  errorPause: 2000,
  nightCycle: 7000,
  fadeOut: 3000,
  doubleTapWindow: 600
};

var TC = ['ready', 'active', 'night', 'low_liquid', 'error', 'pairing'];

var state = null;
var TR = [];
var tCI = 0;
var hE = false;
var hL = false;
var lTT = 0;
var dTP = null;

function cA() {
  for (var i = 0; i < TR.length; i++) {
    Timer.clear(TR[i]);
  }
  TR = [];
}

function lt(ms, fn, repeat) {
  var t = Timer.set(ms, repeat || false, fn);
  TR.push(t);
  return t;
}

function light(id, on, bri, rgb, trans) {
  var p = { id: id, on: on };

  if (bri !== undefined) {
    p.brightness = Math.max(0, Math.min(100, bri));
  }
  if (rgb) {
    p.rgb = rgb;
  }
  if (trans) {
    p.transition = trans / 1000;
  }

  Shelly.call('Light.Set', p);
}

function ui(bri, rgb, trans) {
  light(CFG.ui, bri > 0, bri, rgb, trans);
}

function amb(bri, rgb, trans) {
  light(CFG.ambient, bri > 0, bri, rgb, trans);
}

function boot() {
  var sweep = [8, 25, 60, 100, 60, 25, 8];
  var step = TM.bootStep;
  var idx = 0;

  amb(0, CL.warm, 0);

  function nS() {
    if (idx < sweep.length) {
      ui(sweep[idx], CL.white, step * 0.8);

      if (idx === 2) {
        amb(30, CL.warm, step * 4);
      }

      idx++;
      lt(step, nS);
      return;
    }

    lt(500, function() {
      sS('ready');
    });
  }

  nS();
}

function ready() {
  amb(20, CL.warm, 400);

  function br() {
    ui(12, CL.white, TM.breatheIn);
    lt(TM.breatheIn, function() {
      ui(0, CL.white, TM.breatheOut);
    });
  }

  br();
  lt(TM.breatheIn + TM.breatheOut, br, true);
}

function touch() {
  var t = TM.touchBlink;

  ui(20, CL.white, 0);
  lt(t, function() {
    ui(0, CL.white, 0);
    lt(t, function() {
      ui(20, CL.white, 0);
      lt(t, function() {
        ui(0, CL.white, 0);
        amb(30, CL.warm, 50);
        lt(t, function() {
          amb(20, CL.warm, 200);
          lt(t, function() {
            sS('ready');
          });
        });
      });
    });
  });
}

function pairing() {
  var m = TM.morse;
  var seq = [
    m.dot
    m.gap,
    m.dot,
    m.gap,
    m.dot,
    m.gap * 2,
    m.dash,
    m.gap,
    m.dash,
    m.gap,
    m.dash,
    m.gap * 2,
    m.dot,
    m.gap,
    m.dot,
    m.gap,
    m.dot,
  ];

  amb(18, CL.cool, 300);

  function sos() {
    var i = 0;
    var on = true;

    function next() {
      if (i >= seq.length) {
        return;
      }

      var dur = seq[i];
      var isOn = on;

      ui(isOn ? 15 : 0, CL.white, 0);
      if (isOn) {
        amb(25, CL.blue, 50);
      } else {
        amb(18, CL.cool, 100);
      }

      i++;
      on = !on;
      lt(dur, next);
    }

    next();
  }

  sos();
  lt(m.pause, sos, true);
}

function active() {
  ui(8, CL.white, 300);

  function dr() {
    amb(30, CL.warm, TM.dr);
    lt(TM.dr, function() {
      amb(28, CL.neutral, TM.dr);
    });
  }

  dr();
  lt(TM.dr * 2, dr, true);
}

function lowLiquid() {
  amb(20, CL.warm, 200);

  function wn() {
    amb(12, CL.warm, 100);

    function blink(i) {
      if (i >= 3) {
        lt(150, function() {
          amb(20, CL.warm, 300);
        });
        return;
      }

      ui(25, CL.amber, 0);
      lt(150, function() {
        ui(0, CL.amber, 0);
        lt(150, function() {
          blink(i + 1);
        });
      });
    }

    blink(0);
  }

  wn();
  lt(TM.lowWarn, wn, true);
}

function error() {
  amb(0, null, 200);

  function al() {
    function blink(i) {
      if (i >= 3) {
        return;
      }

      ui(30, CL.red, 0);
      lt(120, function() {
        ui(0, CL.red, 0);
        lt(120, function() {
          blink(i + 1);
        });
      });
    }

    blink(0);
  }

  al();
  lt(TM.errorPause, al, true);
}

function night() {
  var half = TM.nightCycle / 2;

  amb(5, CL.warm, 500);

  function br() {
    ui(3, CL.white, half);
    lt(half, function() {
      ui(0, CL.white, half);
    });
  }

  br();
  lt(TM.nightCycle, br, true);
}

function goodbye() {
  ui(0, CL.white, TM.fadeOut);
  amb(0, CL.warm, TM.fadeOut * 0.7);
}

var PT = {
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

function sS(newState) {
  if (!newState || newState === state) {
    return;
  }
  if (!PT[newState]) {
    print('[Cury]Unknown state:' + newState);
    return;
  }

  cA();
  state = newState;

  Shelly.call('KVS.Set', { key: CFG.kvsKey, value: newState });
  print('[Cury]->' + newState);
  PT[newState]();
}

function onTap() {
  if (hE || hL) {
    print('[Cury]Tap:acknowledged alert -> ready');
    hE = false;
    hL = false;
    tCI = 0;
    sS('ready');
    return;
  }

  var next = TC[tCI % TC.length];
  tCI++;
  print('[Cury]Tap:cycle -> ' + next);
  sS(next);
}

function oDT() {
  print('[Cury]Double tap -> pairing');
  tCI = 0;
  hE = false;
  hL = false;
  sS('pairing');
}

Shelly.addEventHandler(function(ev) {
  if (!ev || !ev.info) {
    return;
  }

  var name = ev.name;
  var event = ev.info.event;
  var iA = name === 'accel' || name === 'vibration' || name === 'accelerometer';

  if (!iA) {
    return;
  }

  print('[Cury]Accel event:' + event);

  if (event === 'double_push' || event === 'double_tap') {
    if (dTP !== null) {
      Timer.clear(dTP);
      dTP = null;
    }
    oDT();
    return;
  }

  if (event === 'single_push' || event === 'tap' || event === 'single_tap') {
    var now = Date.now ? Date.now() : 0;

    if (now > 0 && now - lTT < TM.doubleTapWindow) {
      if (dTP !== null) {
        Timer.clear(dTP);
        dTP = null;
      }
      lTT = 0;
      oDT();
      return;
    }

    lTT = now;
    dTP = Timer.set(TM.doubleTapWindow, false, function() {
      dTP = null;
      onTap();
    });
  }
});

function cS(slot, slotData) {
  if (!slotData) {
    return false;
  }

  if (slotData.vial && slotData.vial.vial_fault) {
    print('[Cury]HW:vial fault on ' + slot + ':' + slotData.vial.vial_fault);
    return 'error';
  }

  if (
    slotData.vial &&
    slotData.vial.level >= 0 &&
    slotData.vial.level <= CFG.lowLevelThreshold
  ) {
    print('[Cury]HW:low liquid on ' + slot + ':' + slotData.vial.level + '%');
    return 'low';
  }

  return false;
}

function pH() {
  Shelly.call('Cury.GetStatus', { id: 0 }, function(r, e) {
    if (e || !r) {
      return;
    }

    var hErr = [];

    if (r.errors && r.errors.length > 0) {
      for (var i = 0; i < r.errors.length; i++) {
        if (r.errors[i] !== 'acc_bus') {
          hErr.push(r.errors[i]);
        }
      }
    }

    if (hErr.length > 0) {
      if (!hE) {
        hE = true;
        hL = false;
        print('[Cury]HW error:' + hErr[0]);
        sS('error');
      }
      return;
    }

    var lR = r.slots ? cS('left', r.slots.left) : false;
    var rR = r.slots ? cS('right', r.slots.right) : false;

    if (lR === 'error' || rR === 'error') {
      if (!hE) {
        hE = true;
        hL = false;
        sS('error');
      }
      return;
    }

    if (lR === 'low' || rR === 'low') {
      if (!hL && !hE) {
        hL = true;
        sS('low_liquid');
      }
      return;
    }

    if (hE || hL) {
      print('[Cury]HW:all clear -> ready');
      hE = false;
      hL = false;
      sS('ready');
    }
  });
}

function pK() {
  if (hE || hL) {
    return;
  }

  Shelly.call('KVS.Get', { key: CFG.kvsKey }, function(r, e) {
    if (!e && r && r.value && r.value !== state) {
      sS(r.value);
    }
  });
}

Shelly.call('KVS.Get', { key: CFG.kvsKey }, function(r, e) {
  sS(!e && r && r.value ? r.value : 'boot');
});

lt(CFG.pK, pK, true);
lt(CFG.pollHw, pH, true);
