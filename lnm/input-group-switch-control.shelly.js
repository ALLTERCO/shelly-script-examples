/**
 * @title LNM Input to Group Switch Control
 * @description Sends multicast switch commands with LNM.Call when a local input receives single, double, or long push gestures.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lnm/input-group-switch-control.shelly.js
 */

/**
 * LNM Input to Group Switch Control
 *
 * Runs on the Shelly device with the physical input and sends one group RPC:
 * - single_push: toggle switch output on every RPC-enabled group member
 * - double_push: switch every matching output on
 * - long_push: switch every matching output off
 *
 * LNM.Call is fire-and-forget. RPC must be enabled on the selected LNM
 * instance on this sender and on every receiver. TX and RX are not required
 * for group RPC commands.
 *
 * Firmware requirements: 2.0.0 or newer. LNM is currently a preview feature.
 * Device compatibility: Gen2, Gen3, and Gen4 devices with Scripts, LNM, and a
 * local input component.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/LNM/#lnmcall
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  lnmId: 200,
  sourceInputId: 0,
  targetSwitchId: 0,
  logEnabled: true,
};

// ============================================================================
// HELPERS
// ============================================================================

function logMessage(message) {
  if (CONFIG.logEnabled) {
    print('[lnm-group] ' + message);
  }
}

function isNonNegativeInteger(value) {
  return typeof value === 'number' && value >= 0 && Math.floor(value) === value;
}

function sendGroupCall(method, params, gesture) {
  Shelly.call(
    'LNM.Call',
    { id: CONFIG.lnmId, method: method, params: params },
    function (result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        print('[lnm-group] LNM.Call failed:', errorCode, errorMessage);
        return;
      }
      logMessage(gesture + ' -> ' + method + ' accepted');
    },
  );
}

function applyGesture(gesture) {
  if (gesture === 'single_push') {
    sendGroupCall(
      'Switch.Toggle',
      { id: CONFIG.targetSwitchId },
      gesture,
    );
  } else if (gesture === 'double_push') {
    sendGroupCall(
      'Switch.Set',
      { id: CONFIG.targetSwitchId, on: true },
      gesture,
    );
  } else if (gesture === 'long_push') {
    sendGroupCall(
      'Switch.Set',
      { id: CONFIG.targetSwitchId, on: false },
      gesture,
    );
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onInputEvent(event) {
  if (
    !event ||
    event.component !== 'input:' + CONFIG.sourceInputId ||
    !event.info ||
    typeof event.info.event !== 'string'
  ) {
    return;
  }

  applyGesture(event.info.event);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (
    !isNonNegativeInteger(CONFIG.lnmId) ||
    CONFIG.lnmId < 200 ||
    CONFIG.lnmId > 299 ||
    !isNonNegativeInteger(CONFIG.sourceInputId) ||
    !isNonNegativeInteger(CONFIG.targetSwitchId)
  ) {
    print('[lnm-group] Invalid LNM, input, or target switch ID');
    return;
  }

  Shelly.addEventHandler(onInputEvent);
  logMessage(
    'Input:' +
      CONFIG.sourceInputId +
      ' controls group switch:' +
      CONFIG.targetSwitchId +
      ' through lnm:' +
      CONFIG.lnmId,
  );
}

init();
