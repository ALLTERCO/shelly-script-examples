/**
 * @title LNM Received Button Switch Control
 * @description Converts remote input gestures received through Local Network Messaging into local switch toggle, on, and off actions.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lnm/received-button-switch-control.shelly.js
 */

/**
 * LNM Received Button Switch Control
 *
 * Runs on an LNM receiver. A remote Shelly input is included in the sender's
 * LNM TX component list. This script maps its gestures to a local switch:
 * - single_push: toggle
 * - double_push: on
 * - long_push: off
 *
 * Lower-level btn_down/btn_up events and unconfigured inputs are ignored.
 *
 * Firmware requirements: 2.0.0 or newer. LNM is currently a preview feature.
 * Device compatibility: Gen2, Gen3, and Gen4 devices with Scripts, LNM, and a
 * local switch output. RX must be enabled on the receiving LNM instance.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/LNM/
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  senderId: 'shellyi4g3-xxxxxxxxxxxx', // Empty string accepts any sender.
  sourceInputId: 0,
  targetSwitchId: 0,
  logEnabled: true,
};

// ============================================================================
// HELPERS
// ============================================================================

function logMessage(message) {
  if (CONFIG.logEnabled) {
    print('[lnm-button-rx] ' + message);
  }
}

function isNonNegativeInteger(value) {
  return typeof value === 'number' && value >= 0 && Math.floor(value) === value;
}

function callLocalSwitch(method, params, gesture) {
  Shelly.call(method, params, function (result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      print('[lnm-button-rx] ' + method + ' failed:', errorCode, errorMessage);
      return;
    }
    logMessage(gesture + ' -> ' + method);
  });
}

function applyGesture(gesture) {
  if (gesture === 'single_push') {
    callLocalSwitch(
      'Switch.Toggle',
      { id: CONFIG.targetSwitchId },
      gesture,
    );
  } else if (gesture === 'double_push') {
    callLocalSwitch(
      'Switch.Set',
      { id: CONFIG.targetSwitchId, on: true },
      gesture,
    );
  } else if (gesture === 'long_push') {
    callLocalSwitch(
      'Switch.Set',
      { id: CONFIG.targetSwitchId, on: false },
      gesture,
    );
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onLnmEvent(event) {
  if (
    !event ||
    event.name !== 'lnm' ||
    !event.info ||
    event.info.event !== 'rx' ||
    !event.info.events
  ) {
    return;
  }

  if (CONFIG.senderId !== '' && event.info.device !== CONFIG.senderId) return;

  let sourceComponent = 'input:' + CONFIG.sourceInputId;
  for (let i = 0; i < event.info.events.length; i++) {
    let remoteEvent = event.info.events[i];
    if (!remoteEvent || remoteEvent.component !== sourceComponent) continue;
    applyGesture(remoteEvent.event);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (
    !isNonNegativeInteger(CONFIG.sourceInputId) ||
    !isNonNegativeInteger(CONFIG.targetSwitchId)
  ) {
    print('[lnm-button-rx] Input and switch IDs must be non-negative integers');
    return;
  }

  Shelly.addEventHandler(onLnmEvent);
  logMessage(
    'Following input:' +
      CONFIG.sourceInputId +
      ' onto switch:' +
      CONFIG.targetSwitchId,
  );
}

init();
