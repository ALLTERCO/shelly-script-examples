/**
 * @title Pro 4PM Load Shedding (Single Device, 16 A)
 * @description Monitors the combined current of all four switch channels on a
 *   Shelly Pro 4PM and sheds loads in reverse-priority order (switch 3 first,
 *   switch 0 last) to stay below 16 A. Shed switches are restored
 *   highest-priority first once current drops below the re-enable threshold.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/pro4pm-load-shedding.shelly.js
 */

/**
 * Load Shedding for a Single Shelly Pro 4PM (16 A Limit)
 *
 * All four loads are on the same device, so no HTTP calls to remote hosts are
 * needed. The script sums the current reported by each switch channel and
 * enforces the limit by directly calling Switch.Set on the local device.
 *
 * Priority order (highest → lowest, first to restore / last to shed):
 *   switch:0 – Kitchen boiler
 *   switch:1 – Guest 1 boiler
 *   switch:2 – Guest 2 boiler
 *   switch:3 – Outdoor plug   (first to shed)
 *
 * Shedding rules:
 *   - When total current > CONFIG.maxAmps: turn off the lowest-priority
 *     switch that is ON and not already shed by this script.
 *   - When total current < CONFIG.reenableAmps and the post-shed cooldown
 *     has elapsed: restore the highest-priority switch that this script shed.
 *   - Only one switch is acted on per decision cycle. Consecutive sheds are
 *     spaced by CONFIG.minShedMs; consecutive restores by CONFIG.minRestoreMs.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  maxAmps: 16.0,        // Shed when total current exceeds this value
  reenableAmps: 14.0,   // Restore only when total current drops below this
  minShedMs: 2000,      // Min ms between consecutive shed actions
  cooldownMs: 30000,    // Ms after last shed before any restore is attempted
  minRestoreMs: 10000,  // Min ms between consecutive restore actions
  labels: ['Kitchen boiler', 'Guest 1 boiler', 'Guest 2 boiler', 'Outdoor plug'],
};

// Set per-channel simulated current (A) to test without real loads; 0 = use hardware readings
let simulation_current = [0, 0, 0, 0];

// ============================================================================
// STATE
// ============================================================================

let channelCurrent = [0.0, 0.0, 0.0, 0.0]; // Last reported current per channel (A)
let channelOutput = [false, false, false, false]; // Last known output state per channel
let shedByUs = [false, false, false, false];  // true = this script turned this switch off
let lastShedMs = 0;
let lastRestoreMs = 0;

// ============================================================================
// HELPERS
// ============================================================================

function totalCurrent() {
  let t = 0;
  for (let i = 0; i < 4; i++) {
    t += (simulation_current[i] > 0 ? simulation_current[i] : channelCurrent[i]);
  }
  return t;
}

function fmtA(a) {
  return (Math.round(a * 10) / 10) + 'A';
}

function setSwitchOutput(id, on) {
  Shelly.call('Switch.Set', { id: id, on: on }, function(r, err) {
    if (err !== 0) print('Switch.Set error id=' + id + ' err=' + err);
  });
}

// ============================================================================
// LOAD SHEDDING LOGIC
// ============================================================================

function decide() {
  let total = totalCurrent();
  let now = Date.now();

  if (total > CONFIG.maxAmps) {
    if (now - lastShedMs < CONFIG.minShedMs) return;
    // Shed the lowest-priority switch that is ON and not already shed by us
    for (let i = 3; i >= 0; i--) {
      if (channelOutput[i] && !shedByUs[i]) {
        print('SHED sw' + i + ' (' + CONFIG.labels[i] + ') total=' + fmtA(total));
        shedByUs[i] = true;
        channelCurrent[i] = 0.0;
        channelOutput[i] = false;
        lastShedMs = now;
        setSwitchOutput(i, false);
        return;
      }
    }
    print('WARNING: total=' + fmtA(total) + ' but no switch left to shed');
    return;
  }

  if (total < CONFIG.reenableAmps) {
    if (now - lastShedMs < CONFIG.cooldownMs) return;
    if (now - lastRestoreMs < CONFIG.minRestoreMs) return;
    // Restore the highest-priority switch that we shed
    for (let i = 0; i < 4; i++) {
      if (shedByUs[i]) {
        print('RESTORE sw' + i + ' (' + CONFIG.labels[i] + ') total=' + fmtA(total));
        shedByUs[i] = false;
        lastRestoreMs = now;
        setSwitchOutput(i, true);
        return;
      }
    }
  }
}

// ============================================================================
// STATUS HANDLER
// ============================================================================

Shelly.addStatusHandler(function(msg) {
  if (!msg || !msg.delta) return;
  // Only handle switch:0 – switch:3
  if (typeof msg.component !== 'string' || msg.component.slice(0, 7) !== 'switch:') return;
  let id = msg.id;
  if (typeof id !== 'number' || id < 0 || id > 3) return;

  if (typeof msg.delta.output === 'boolean') {
    channelOutput[id] = msg.delta.output;
    if (!msg.delta.output) channelCurrent[id] = 0.0;
  }
  if (typeof msg.delta.current === 'number') {
    channelCurrent[id] = msg.delta.current;
  }

  decide();
});

// ============================================================================
// INITIALIZATION
// ============================================================================

function initChannel(idx) {
  if (idx >= 4) {
    // Treat every switch as shed on startup so the restore logic re-enables
    // them one by one (minRestoreMs apart), respecting the 16A fuse limit
    for (let i = 0; i < 4; i++) {
      shedByUs[i] = true;
      if (channelOutput[i]) {
        channelOutput[i] = false;
        channelCurrent[i] = 0.0;
        setSwitchOutput(i, false);
      }
    }
    lastRestoreMs = Date.now();
    print('Pro 4PM load shedding ready – restoring outputs in sequence');
    return;
  }
  Shelly.call('Switch.GetStatus', { id: idx }, function(res, err) {
    if (err === 0 && res) {
      if (typeof res.current === 'number') channelCurrent[idx] = res.current;
      if (typeof res.output === 'boolean') channelOutput[idx] = res.output;
    }
    initChannel(idx + 1);
  });
}

// Drive decide() on a 2 s tick only while simulation is active
Timer.set(2000, true, function() {
  for (let i = 0; i < 4; i++) {
    if (simulation_current[i] > 0) {
      decide();
      return;
    }
  }
});

initChannel(0);

