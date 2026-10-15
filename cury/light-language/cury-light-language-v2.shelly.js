/**
 * @title Cury Intensity Crossfade and Ambient Fade
 * @description Runs a 6-step Cury animation loop with crossfading UI intensity and ambient color flash/fade transitions.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/cury/light-language/cury-light-language-v2.shelly.js
 */

/**
 * Detailed Documentation
 *
 * 6-step loop:
 * - step 0: right=100 left=25, ambient fades 30%
 * - step 1: right=75 left=50, ambient fades 20%
 * - step 2: right=50 left=75, ambient fades 12%
 * - step 3: right=25 left=100, ambient fades 7%
 * - step 4: both slots off, ambient flashes new color at 60%
 * - step 5: ambient drops to 30%, UI remains off until loop restart
 *
 * Each step waits for all RPC calls to complete before moving forward.
 * nextColor() can be called via Script.Eval from the button listener script.
 */

// ============================================================================
// CONFIG
// ============================================================================

var TICK_MS = 220;

var COLORS = [
  [255,  50,  50],   // red
  [ 50, 100, 255],   // blue
  [255, 180,  20],   // amber
  [ 50, 220,  80],   // green
  [255, 100, 200],   // pink
  [255, 200, 120],   // warm white
];

// [right_intensity, left_intensity] for steps 0-3 (min=25 keeps 1 LED lit, no red)
var SWEEP = [
  [100,  25],
  [ 75,  50],
  [ 50,  75],
  [ 25, 100]
];

// Ambient brightness during each intensity step (decays after flash)
var FADE_BRI = [30, 20, 12, 7];

// ============================================================================
// CALL SERIALISER
// ============================================================================

var pending = 0;
var busy    = false;

function fire(method, args) {
  pending++;
  Shelly.call(method, args, function() {
    pending--;
    if (pending === 0) busy = false;
  });
}

// ============================================================================
// STATE
// ============================================================================

var step         = 5;
var colorIdx     = COLORS.length - 1;
var currentColor = COLORS[0];

// Called by button listener via Script.Eval
function nextColor() {
  colorIdx     = (colorIdx + 1) % COLORS.length;
  currentColor = COLORS[colorIdx];
  print("[Cury] next color: " + colorIdx);
}

// ============================================================================
// ANIMATION
// ============================================================================

function animStep() {
  if (busy) return;
  busy = true;

  step = (step + 1) % 6;

  if (step === 4) {
    colorIdx     = (colorIdx + 1) % COLORS.length;
    currentColor = COLORS[colorIdx];
  }

  if (step <= 3) {
    // Intensity crossfade + ambient glow fading (both slots always on, min=25)
    fire("Cury.Set", { id: 0, slot: "right", on: true, intensity: SWEEP[step][0] });
    fire("Cury.Set", { id: 0, slot: "left",  on: true, intensity: SWEEP[step][1] });
    fire("Cury.SetConfig", {
      id: 0,
      config: {
        ambient: { enable: true, use_vial_color: false, brightness: FADE_BRI[step], color: currentColor },
        ui:      { mode: "intensity", brightness: 100 }
      }
    });

  } else if (step === 4) {
    // Ambient flash — slots off, ambient bursts at full brightness
    fire("Cury.Set", { id: 0, slot: "right", on: false });
    fire("Cury.Set", { id: 0, slot: "left",  on: false });
    fire("Cury.SetConfig", {
      id: 0,
      config: {
        ambient: { enable: true, use_vial_color: false, brightness: 60, color: currentColor },
        ui:      { mode: "off", brightness: 0 }
      }
    });

  } else {
    // step 5: ambient glow resets, UI stays off (slots still off → avoids red)
    // mode switches back to "intensity" in step 0 when slots turn on
    fire("Cury.SetConfig", {
      id: 0,
      config: {
        ambient: { enable: true, use_vial_color: false, brightness: FADE_BRI[0], color: currentColor },
        ui:      { mode: "off", brightness: 0 }
      }
    });
  }
}

// ============================================================================
// INIT — set intensity mode; block first tick until done
// ============================================================================

busy = true;
fire("Cury.SetConfig", {
  id: 0,
  config: {
    ambient: { enable: false, brightness: 0 },
    ui:      { mode: "off", brightness: 0 }
  }
});

Timer.set(TICK_MS, true, animStep);
