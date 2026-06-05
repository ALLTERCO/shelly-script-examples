/**
 * @title Shelly Plus Plug S LED power visualization
 * @description Shows current power consumption as clear LED ring states or a
 *   green-to-red gradient on a Shelly Plus Plug S. Useful for visual homelab,
 *   workstation, charger, and appliance power usage feedback without opening
 *   an app.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/plus-plug-s-led-power-states.shelly.js
 */

// Shelly Script example: Shelly Plus Plug S LED power visualization
//
// This script reads Switch.GetStatus.apower and changes the Plug S LED ring to
// show live consumption at a glance:
//   mode "states"   - off, green, warm yellow, orange, red by thresholds
//   mode "gradient" - smooth green -> yellow -> red up to gradientMaxW
//
// RGB values for PLUGS_UI are 0-100 per channel, not 0-255.
// The script updates PLUGS_UI only when the visual state changes.

let CONFIG = {
  mode: "states", // Use "states" or "gradient".
  noConsumptionW: 5,
  greenBelowW: 25,
  yellowBelowW: 60,
  orangeBelowW: 100,
  gradientMaxW: 100,
  pollMs: 2000,
  brightness: 100,
};

let lastState = "";
let updating = false;

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function fixedPowerState(power) {
  if (power < CONFIG.noConsumptionW) {
    return { name: "off", rgb: [0, 0, 0], brightness: 0 };
  }
  if (power < CONFIG.greenBelowW) {
    return { name: "green", rgb: [0, 100, 0], brightness: CONFIG.brightness };
  }
  if (power < CONFIG.yellowBelowW) {
    return { name: "yellow", rgb: [100, 70, 0], brightness: CONFIG.brightness };
  }
  if (power < CONFIG.orangeBelowW) {
    return { name: "orange", rgb: [100, 35, 0], brightness: CONFIG.brightness };
  }
  return { name: "red", rgb: [100, 0, 0], brightness: CONFIG.brightness };
}

function gradientPowerState(power) {
  if (power < CONFIG.noConsumptionW) {
    return { name: "off", rgb: [0, 0, 0], brightness: 0 };
  }

  let ratio = clamp(power / CONFIG.gradientMaxW, 0, 1);
  let red = 0;
  let green = 100;

  if (ratio < 0.5) {
    red = Math.round(ratio * 200);
  } else {
    red = 100;
    green = Math.round(100 - ((ratio - 0.5) * 200));
  }

  return {
    name: "gradient",
    rgb: [red, green, 0],
    brightness: CONFIG.brightness,
  };
}

function powerState(power) {
  if (CONFIG.mode === "gradient") {
    return gradientPowerState(power);
  }

  return fixedPowerState(power);
}

function setLed(state) {
  let stateKey = [
    state.name,
    state.rgb[0],
    state.rgb[1],
    state.rgb[2],
    state.brightness,
  ].join(":");

  if (stateKey === lastState || updating) return;

  let config = {
    leds: {
      mode: "switch",
      colors: {
        "switch:0": {
          on: { rgb: state.rgb, brightness: state.brightness },
          off: { rgb: state.rgb, brightness: state.brightness },
        },
      },
    },
  };

  updating = true;
  Shelly.call(
    "HTTP.GET",
    {
      url:
        "http://localhost/rpc/PLUGS_UI.SetConfig?config=" +
        JSON.stringify(config),
      timeout: 5,
    },
    function (result, errorCode, errorMessage) {
      updating = false;
      if (errorCode === 0) {
        lastState = stateKey;
      } else {
        print("LED update failed:", errorCode, errorMessage);
      }
    }
  );
}

function updateLedFromPower() {
  Shelly.call(
    "Switch.GetStatus",
    { id: 0 },
    function (status, errorCode, errorMessage) {
      if (errorCode !== 0) {
        print("Switch.GetStatus failed:", errorCode, errorMessage);
        return;
      }

      setLed(powerState(status.apower || 0));
    }
  );
}

Timer.set(CONFIG.pollMs, true, updateLedFromPower);
updateLedFromPower();
