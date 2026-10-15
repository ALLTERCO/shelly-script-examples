/**
 * @title LNM Message Monitor
 * @description Logs Local Network Messaging status updates and events with optional sender and LNM-instance filtering for setup and troubleshooting.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lnm/message-monitor.shelly.js
 */

/**
 * LNM Message Monitor
 *
 * Runs on an LNM receiver and prints incoming status maps and event arrays.
 * Use it to confirm multicast delivery, discover sender IDs, inspect component
 * keys, and identify event names before building an automation.
 *
 * Firmware requirements: 2.0.0 or newer. LNM is currently a preview feature.
 * Device compatibility: Gen2, Gen3, and Gen4 devices with Scripts and LNM.
 * The selected LNM instance must have RX enabled.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/LNM/
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  senderId: '', // Empty string accepts messages from every sender.
  lnmId: 200, // Set to -1 to accept events from every local LNM instance.
  logStatus: true,
  logEvents: true,
};

// ============================================================================
// STATE
// ============================================================================

let receivedMessages = 0;

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

  if (CONFIG.lnmId >= 0 && event.id !== CONFIG.lnmId) return;
  if (CONFIG.senderId !== '' && event.info.device !== CONFIG.senderId) return;

  receivedMessages++;
  print(
    '[lnm-monitor] #' +
      receivedMessages +
      ' from ' +
      event.info.device +
      ' via lnm:' +
      event.id,
  );

  if (CONFIG.logStatus && event.info.status) {
    print('[lnm-monitor] status:', JSON.stringify(event.info.status));
  }

  if (CONFIG.logEvents && event.info.events) {
    print('[lnm-monitor] events:', JSON.stringify(event.info.events));
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  Shelly.addEventHandler(onLnmEvent);
  print(
    '[lnm-monitor] Listening on ' +
      (CONFIG.lnmId < 0 ? 'all LNM instances' : 'lnm:' + CONFIG.lnmId),
  );
}

init();
