/**
 * @title Shelly Plus Plug S LED Power Visualization
 * @description Shows current power consumption as fixed LED ring states or a green-to-red gradient on a Shelly Plus Plug S.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/plus-plug-s-led-power-states.shelly.js
 */

/**
 * Shelly Plus Plug S LED Power Visualization
 *
 * Reads active power from switch:0 and displays consumption on the LED ring:
 * - states: off, green, yellow, orange, or red based on configured thresholds
 * - gradient: a smooth green-to-yellow-to-red transition up to gradientMaxW
 *
 * Firmware requirements: Shelly firmware 1.7.5 or newer.
 * Device compatibility: Shelly Plus Plug S.
 *
 * RGB channel values for PLUGS_UI range from 0 to 100. The script updates the
 * LED configuration only when the visual state changes.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  mode: 'states', // Use 'states' or 'gradient'.
  noConsumptionW: 5,
  greenBelowW: 25,
  yellowBelowW: 60,
  orangeBelowW: 100,
  gradientMaxW: 100,
  pollMs: 2000,
  brightness: 100,
};

// ============================================================================
// STATE
// ============================================================================

let lastState = '';
let isUpdating = false;

// ============================================================================
// HELPERS
// ============================================================================

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getFixedPowerState(power) {
  if (power < CONFIG.noConsumptionW) {
    return { name: 'off', rgb: [0, 0, 0], brightness: 0 };
  }
  if (power < CONFIG.greenBelowW) {
    return { name: 'green', rgb: [0, 100, 0], brightness: CONFIG.brightness };
  }
  if (power < CONFIG.yellowBelowW) {
    return { name: 'yellow', rgb: [100, 70, 0], brightness: CONFIG.brightness };
  }
  if (power < CONFIG.orangeBelowW) {
    return { name: 'orange', rgb: [100, 35, 0], brightness: CONFIG.brightness };
  }
  return { name: 'red', rgb: [100, 0, 0], brightness: CONFIG.brightness };
}

function getGradientPowerState(power) {
  if (power < CONFIG.noConsumptionW) {
    return { name: 'off', rgb: [0, 0, 0], brightness: 0 };
  }

  let ratio = clamp(power / CONFIG.gradientMaxW, 0, 1);
  let red = 0;
  let green = 100;

  if (ratio < 0.5) {
    red = Math.round(ratio * 200);
  } else {
    red = 100;
    green = Math.round(100 - (ratio - 0.5) * 200);
  }

  return {
    name: 'gradient',
    rgb: [red, green, 0],
    brightness: CONFIG.brightness,
  };
}

function getPowerState(power) {
  if (CONFIG.mode === 'gradient') {
    return getGradientPowerState(power);
  }
  return getFixedPowerState(power);
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function setLed(state) {
  let stateKey = [
    state.name,
    state.rgb[0],
    state.rgb[1],
    state.rgb[2],
    state.brightness,
  ].join(':');

  if (stateKey === lastState || isUpdating) return;

  let config = {
    leds: {
      mode: 'switch',
      colors: {
        'switch:0': {
          on: { rgb: state.rgb, brightness: state.brightness },
          off: { rgb: state.rgb, brightness: state.brightness },
        },
      },
    },
  };

  isUpdating = true;
  Shelly.call(
    'HTTP.GET',
    {
      url:
        'http://localhost/rpc/PLUGS_UI.SetConfig?config=' +
        JSON.stringify(config),
      timeout: 5,
    },
    function (result, errorCode, errorMessage) {
      isUpdating = false;
      if (errorCode === 0 && result && result.code === 200) {
        lastState = stateKey;
        return;
      }
      print(
        'LED update failed:',
        errorCode,
        errorMessage,
        result ? result.code : '',
      );
    },
  );
}

function updateLedFromPower() {
  Shelly.call(
    'Switch.GetStatus',
    { id: 0 },
    function (status, errorCode, errorMessage) {
      if (errorCode !== 0) {
        print('Switch.GetStatus failed:', errorCode, errorMessage);
        return;
      }
      setLed(getPowerState(status.apower || 0));
    },
  );
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  Timer.set(CONFIG.pollMs, true, updateLedFromPower);
  updateLedFromPower();
}

init();
