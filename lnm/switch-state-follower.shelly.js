/**
 * @title LNM Switch State Follower
 * @description Mirrors a remote switch output received through Local Network Messaging onto a configurable local switch output.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lnm/switch-state-follower.shelly.js
 */

/**
 * LNM Switch State Follower
 *
 * Runs on the receiving Shelly device. The sender broadcasts a switch status
 * through LNM, and this script keeps one local switch output synchronized with
 * the received output state. Optional inversion supports opposite-state loads.
 *
 * Firmware requirements: 2.0.0 or newer. LNM is currently a preview feature.
 * Device compatibility: Gen2, Gen3, and Gen4 devices with Scripts, LNM, and a
 * local switch output. RX must be enabled on the receiving LNM instance.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/General/LocalNetworkMessaging/
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  senderId: 'shellyplus1pm-xxxxxxxxxxxx', // Empty string accepts any sender.
  sourceComponent: 'switch:0',
  targetSwitchId: 0,
  invert: false,
  logEnabled: true,
};

// ============================================================================
// HELPERS
// ============================================================================

function logMessage(message) {
  if (CONFIG.logEnabled) {
    print('[lnm-follow] ' + message);
  }
}

function isValidConfig() {
  if (typeof CONFIG.sourceComponent !== 'string' || CONFIG.sourceComponent === '') {
    print('[lnm-follow] sourceComponent must not be empty');
    return false;
  }

  if (
    typeof CONFIG.targetSwitchId !== 'number' ||
    CONFIG.targetSwitchId < 0 ||
    Math.floor(CONFIG.targetSwitchId) !== CONFIG.targetSwitchId
  ) {
    print('[lnm-follow] targetSwitchId must be a non-negative integer');
    return false;
  }

  return true;
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function setLocalOutput(on) {
  let status = Shelly.getComponentStatus('switch', CONFIG.targetSwitchId);
  if (status && status.output === on) return;

  Shelly.call(
    'Switch.Set',
    { id: CONFIG.targetSwitchId, on: on },
    function (result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        print('[lnm-follow] Switch.Set failed:', errorCode, errorMessage);
        return;
      }
      logMessage('Local switch:' + CONFIG.targetSwitchId + ' -> ' + on);
    },
  );
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

  let statuses = event.info.status;
  if (!statuses || !statuses[CONFIG.sourceComponent]) return;

  let output = statuses[CONFIG.sourceComponent].output;
  if (typeof output !== 'boolean') return;

  setLocalOutput(CONFIG.invert ? !output : output);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!isValidConfig()) return;

  Shelly.addEventHandler(onLnmEvent);
  logMessage(
    'Following ' +
      CONFIG.sourceComponent +
      ' onto switch:' +
      CONFIG.targetSwitchId,
  );
}

init();
