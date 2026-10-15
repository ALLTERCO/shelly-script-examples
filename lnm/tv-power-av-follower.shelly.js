/**
 * @title TV Power to AV Outputs over LNM
 * @description Follows a TV's remotely measured power over Local Network Messaging and switches selected local AV outputs using configurable hysteresis and an OFF delay.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lnm/tv-power-av-follower.shelly.js
 */

/**
 * TV Power to AV Outputs over Local Network Messaging
 *
 * Runs on the receiving Shelly device. A separate power-metering Shelly sends
 * the TV's component status through LNM. This script reads the configured
 * power field and controls selected local switch outputs.
 *
 * Firmware requirements: 2.0.0 or newer. LNM is currently a preview feature.
 * Device compatibility: Gen2, Gen3, or Gen4 receiver with Scripts, LNM, and
 * one or more switch outputs. Tested reference setup: Shelly Power Strip Gen4
 * receiving from a Shelly Plug S Gen3 on firmware 2.0.1.
 *
 * Decision logic:
 * - Power above CONFIG.onAboveW switches the targets on.
 * - Power below CONFIG.offBelowW starts the configurable OFF delay.
 * - Power between the thresholds preserves the current automation state.
 * - A reading at or above the OFF threshold cancels a pending OFF action.
 * - Manual changes persist until the automation's next state transition.
 *
 * The sender and receiver must use the same LNM multicast address. Configure
 * TX for the source component on the sender and RX on the receiver before
 * starting this script. See lnm/README.md for installation instructions.
 *
 * @see https://kb.shelly.cloud/knowledge-base/automatic-tv-sound-system-control-with-shelly-plug-power-strip-gen4-and-local-network-messaging-lnm
 * @see https://shelly-api-docs.shelly.cloud/gen2/General/LocalNetworkMessaging/
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  senderId: 'shellyplugsg3-xxxxxxxxxxxx', // Empty string accepts any sender.
  sourceComponent: 'switch:0',
  sourcePowerField: 'apower', // Use 'act_power' for an em1 source.
  targetSwitchIds: [0, 1, 3],
  onAboveW: 42,
  offBelowW: 28,
  offDelayMs: 5000,
  logEnabled: true,
};

// ============================================================================
// STATE
// ============================================================================

let appliedState = null;
let offTimer = null;

// ============================================================================
// HELPERS
// ============================================================================

function logMessage(message) {
  if (CONFIG.logEnabled) {
    print('[lnm-av] ' + message);
  }
}

function clearOffTimer() {
  if (offTimer === null) return;
  Timer.clear(offTimer);
  offTimer = null;
}

function isValidConfig() {
  if (
    typeof CONFIG.sourceComponent !== 'string' ||
    CONFIG.sourceComponent === '' ||
    typeof CONFIG.sourcePowerField !== 'string' ||
    CONFIG.sourcePowerField === ''
  ) {
    print('[lnm-av] Invalid source component or power field');
    return false;
  }

  if (
    typeof CONFIG.onAboveW !== 'number' ||
    typeof CONFIG.offBelowW !== 'number' ||
    CONFIG.onAboveW <= CONFIG.offBelowW
  ) {
    print('[lnm-av] onAboveW must be greater than offBelowW');
    return false;
  }

  if (typeof CONFIG.offDelayMs !== 'number' || CONFIG.offDelayMs < 0) {
    print('[lnm-av] offDelayMs must be zero or greater');
    return false;
  }

  if (
    !Array.isArray(CONFIG.targetSwitchIds) ||
    CONFIG.targetSwitchIds.length === 0
  ) {
    print('[lnm-av] Configure at least one target switch ID');
    return false;
  }

  for (let i = 0; i < CONFIG.targetSwitchIds.length; i++) {
    let id = CONFIG.targetSwitchIds[i];
    if (typeof id !== 'number' || id < 0 || Math.floor(id) !== id) {
      print('[lnm-av] Invalid target switch ID:', id);
      return false;
    }
  }

  return true;
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function setTargets(on) {
  if (appliedState === on) return;

  appliedState = on;
  logMessage(
    (on ? 'ON' : 'OFF') +
      ' -> switches ' +
      JSON.stringify(CONFIG.targetSwitchIds),
  );

  for (let i = 0; i < CONFIG.targetSwitchIds.length; i++) {
    let id = CONFIG.targetSwitchIds[i];
    Shelly.call(
      'Switch.Set',
      { id: id, on: on },
      function (result, errorCode, errorMessage, targetId) {
        if (errorCode !== 0) {
          print(
            '[lnm-av] Switch.Set failed for switch:' + targetId,
            errorCode,
            errorMessage,
          );
        }
      },
      id,
    );
  }
}

function scheduleTargetsOff(power) {
  if (appliedState === false || offTimer !== null) return;

  if (CONFIG.offDelayMs === 0) {
    setTargets(false);
    return;
  }

  logMessage(
    'Power ' +
      power +
      ' W is below ' +
      CONFIG.offBelowW +
      ' W; OFF in ' +
      CONFIG.offDelayMs / 1000 +
      ' s',
  );

  offTimer = Timer.set(CONFIG.offDelayMs, false, function () {
    offTimer = null;
    setTargets(false);
  });
}

function onPower(power) {
  if (power >= CONFIG.offBelowW) {
    clearOffTimer();
  }

  if (power > CONFIG.onAboveW) {
    setTargets(true);
    return;
  }

  if (power < CONFIG.offBelowW) {
    scheduleTargetsOff(power);
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
    event.info.event !== 'rx'
  ) {
    return;
  }

  if (CONFIG.senderId !== '' && event.info.device !== CONFIG.senderId) return;

  let status = event.info.status;
  if (!status || !status[CONFIG.sourceComponent]) return;

  let power = status[CONFIG.sourceComponent][CONFIG.sourcePowerField];
  if (typeof power !== 'number') return;

  onPower(power);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!isValidConfig()) return;

  Shelly.addEventHandler(onLnmEvent);
  logMessage(
    'Started: ON > ' +
      CONFIG.onAboveW +
      ' W, OFF < ' +
      CONFIG.offBelowW +
      ' W for ' +
      CONFIG.offDelayMs / 1000 +
      ' s, following ' +
      CONFIG.sourceComponent +
      '.' +
      CONFIG.sourcePowerField,
  );
}

init();
