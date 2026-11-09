/**
 * @title LoRa gateway for a Shelly with no network
 * @description One script, two roles. On a device that still has a network it
 *   mirrors a second, network-less Shelly reached only over LoRa into virtual
 *   components and confirms every command it sends; on the network-less device
 *   it reports its switch and metering and executes those commands, including
 *   one that brings WiFi back. Check README.md before use. (Requires firmware
 *   version: 2.0 or newer and LoRa Add-on hardware installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-gateway/lora-gateway.shelly.js
 */

/**
 * LoRa gateway
 *
 * Put this same file on both devices and change CONFIG.role. Keeping one file
 * means the frame format is defined once and the two halves cannot drift.
 *
 *   role 'node'      WiFi station disabled, LoRa is its only link. Reports
 *                    switch:0 and its metering, executes commands.
 *   role 'gateway'   keeps its network. Mirrors the node into ten virtual
 *                    components and turns a write to one of them into a LoRa
 *                    command going the other way.
 *
 * Nothing on the network can address the node directly, so the gateway's
 * virtual components are its only local face. They are ordinary components:
 * whatever already reads this device - the cloud, MQTT, a local integration -
 * sees the node through them with no extra work.
 *
 * Virtual components created on the gateway, from CONFIG.vcBaseId:
 *   boolean:200  Node Output        the node's switch:0, writable
 *   boolean:201  Node Link          false once the node goes quiet
 *   number:200   Node Power         W
 *   number:201   Node Voltage       V
 *   number:202   Node Current       A
 *   number:203   Node Energy        Wh
 *   number:204   Node Temperature   degrees C
 *   number:205   Node RSSI          dBm, of the last frame received
 *   number:206   Node SNR           dB, of the last frame received
 *   number:207   Node Seq           the node's frame counter, 0..255
 *
 * They are created on first start and left in place afterwards, so stopping
 * the script does not take the readings away. Delete them by hand if you
 * remove the script.
 *
 * Protocol, carried as a SheLr 'user' payload, base64 on the wire:
 *   node -> gateway   S|<on>|<apower>|<voltage>|<current>|<energy_wh>|<tC>|<seq>
 *   gateway -> node   C|<cmd>|<arg>
 *
 * Commands the node accepts:
 *   C|o|0  C|o|1   set switch:0
 *   C|t|           toggle switch:0
 *   C|r|           report now
 *   C|w|           re-enable the WiFi station, then reboot
 *   C|b|           reboot
 *
 * Getting the node back:
 *   C|w| is the remote way, and it is the reason that command exists. A
 *   partial Wifi.SetConfig merges, so the stored SSID and password survive
 *   being disabled and the device rejoins on its own. The device's own access
 *   point is the manual way - Gen4 firmware refuses to enable an AP without a
 *   password, so set one before you disable the station.
 *
 * Things this firmware enforces, learned the hard way:
 * - A script may have only five Shelly.call requests in flight at once. The
 *   sixth throws 'Too many calls in progress', and an uncaught error stops a
 *   Shelly script dead. A mirror update touches ten components, so the gateway
 *   writes them through Virtual.getHandle(...).setValue(), which is an
 *   in-process call with no such cap. The ten Virtual.Add calls that create
 *   the components are chained one per callback for the same reason.
 * - A handle write comes back stamped delta.source 'sys'; a write from outside
 *   arrives as 'rpc'. That is how the gateway tells its own mirror updates
 *   apart from a real command, with no suppression flag and no race.
 * - In a script the receive payload is under event.info, and event.info.sender
 *   is a number, not a hex string.
 * - Timer.set takes milliseconds. Seconds silently never fire.
 * - Shelly.GetComponents paginates; follow offset and total.
 * - Every handler here is wrapped. On the far side of this link is a device
 *   with no other way in.
 *
 * Safety limits:
 * - A SheLr frame is fire and forget - no acknowledgement, no retransmission -
 *   and the radio is half duplex, so a command sent while the node happens to
 *   be transmitting is lost. The node's own report is treated as the
 *   acknowledgement: an unconfirmed command is repeated retries times at
 *   retryMs, and if it still does not land the node's real state is written
 *   back so the mirror stops showing something that never happened.
 * - While a command is unconfirmed the gateway deliberately does not mirror
 *   incoming reports onto the output component. They still carry the old
 *   value, and writing it would bounce the switch back mid-flight.
 * - Air time is the scarce resource. A report frame is about 317 ms at SF9,
 *   and 868.1 MHz sits in a 1% duty cycle sub-band, which allows 36 s of
 *   transmission per hour. The 120 s heartbeat spends about 9.5 s of that; a
 *   60 s one would spend 19 s, over half the budget, leaving little for
 *   commands and retries. Raise the rate only together with a lower spreading
 *   factor, and watch air_time_hr_ms in LoRa.GetStatus.
 * - switch:0 emits a power_measurement event about every second. Only a real
 *   output change earns a frame; everything else rides the heartbeat.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellyLoRaAddon/
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // 'gateway' on the device that keeps its network, 'node' on the other one.
  role: 'gateway',

  // LoRa component id. 100 on every device that has the add-on.
  loraId: 100,

  // The other device's SheLr address, 8 hex characters. Both devices must also
  // share a SheLr key and have 'user' in lora.shelr.accept - see README.md.
  peerAddr: '00010002',

  // --- node role ---------------------------------------------------------
  // Switch to report and to control.
  switchId: 0,
  // Unconditional report interval. Read the air time note above before
  // lowering this.
  heartbeatMs: 120000,
  // Collapse the burst of triggers one command produces into a single frame.
  debounceMs: 800,
  // Never transmit two frames closer together than this.
  minGapMs: 3000,

  // --- gateway role ------------------------------------------------------
  // First id for the virtual components. boolean and number ids are counted
  // separately, so this yields boolean:200..201 and number:200..207.
  vcBaseId: 200,
  // No frame for this long and the link is reported down. Must span more than
  // two of the node's heartbeats, or one missed frame reads as a dead link.
  offlineMs: 320000,
  // How often the link is re-checked.
  watchMs: 15000,
  // Writes to the output component are ignored for this long after start, so
  // values the firmware restores while booting are not taken for commands.
  settleMs: 5000,
  // An unconfirmed command is resent after this long, at most retries times.
  // Keep it above the round trip, a little over 2 s at SF9.
  retryMs: 4000,
  retries: 3,
  // Retry timer granularity, well under retryMs so a resend happens at
  // retryMs rather than at twice it.
  tickMs: 1000,
};

// role -> [type, id offset, name, unit, min, max]. Booleans carry no unit.
const VC_SPECS = [
  ['out', 'boolean', 0, 'Node Output', null, null, null],
  ['link', 'boolean', 1, 'Node Link', null, null, null],
  ['pw', 'number', 0, 'Node Power', 'W', -20000, 20000],
  ['volt', 'number', 1, 'Node Voltage', 'V', 0, 500],
  ['cur', 'number', 2, 'Node Current', 'A', -200, 200],
  ['nrg', 'number', 3, 'Node Energy', 'Wh', 0, 1000000000],
  ['temp', 'number', 4, 'Node Temperature', '°C', -50, 200],
  ['rssi', 'number', 5, 'Node RSSI', 'dBm', -200, 20],
  ['snr', 'number', 6, 'Node SNR', 'dB', -50, 50],
  ['seq', 'number', 7, 'Node Seq', null, 0, 255],
];

// ============================================================================
// STATE
// ============================================================================

let state = {
  // node
  seq: 0,
  lastTxMs: 0,
  pendingTimer: null,

  // gateway
  handles: {},
  outKey: null,
  isPrimed: false,
  isReady: false,
  lastRxMs: 0,
  want: null,
  wantTries: 0,
  wantAtMs: 0,
  lastOut: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function addrToNum(hex) {
  return parseInt(hex, 16);
}

function isGateway() {
  return CONFIG.role === 'gateway';
}

function vcKey(spec) {
  return spec[1] + ':' + (CONFIG.vcBaseId + spec[2]);
}

function formatNumber(value, digits) {
  if (typeof value !== 'number') {
    return '';
  }
  return value.toFixed(digits);
}

function toNumber(str) {
  if (typeof str !== 'string' || str === '') {
    return null;
  }
  const value = JSON.parse(str);
  if (typeof value !== 'number') {
    return null;
  }
  return value;
}

function sendFrame(payload) {
  state.lastTxMs = Shelly.getUptimeMs();
  Shelly.call(
    'LoRa.Send',
    {
      id: CONFIG.loraId,
      lr_addr: CONFIG.peerAddr,
      data: btoa(payload),
    },
    function (_, errCode, errMessage) {
      if (errCode !== 0) {
        console.log('[LoRa] send failed:', errMessage);
      }
    }
  );
}

// ============================================================================
// NODE LOGIC
// ============================================================================

function buildReport() {
  const status = Shelly.getComponentStatus('switch:' + CONFIG.switchId);
  if (!status) {
    return null;
  }

  state.seq = (state.seq + 1) % 256;

  const celsius = status.temperature && typeof status.temperature.tC === 'number'
    ? status.temperature.tC
    : null;
  const wattHours = status.aenergy && typeof status.aenergy.total === 'number'
    ? status.aenergy.total
    : null;

  return 'S|' + (status.output ? '1' : '0') +
    '|' + formatNumber(status.apower, 1) +
    '|' + formatNumber(status.voltage, 1) +
    '|' + formatNumber(status.current, 3) +
    '|' + formatNumber(wattHours, 0) +
    '|' + formatNumber(celsius, 1) +
    '|' + state.seq;
}

function flushReport() {
  try {
    state.pendingTimer = null;
    const payload = buildReport();
    if (payload !== null) {
      sendFrame(payload);
    }
  } catch (err) {
    console.log('[LoRa] flush error:', JSON.stringify(err));
  }
}

// Always transmit from a deferred slot. One command produces two triggers -
// the Switch.Set callback and the output status change - and without this each
// would cost its own frame.
function scheduleReport() {
  try {
    let wait = CONFIG.debounceMs;
    const sinceTx = Shelly.getUptimeMs() - state.lastTxMs;
    if (sinceTx < CONFIG.minGapMs) {
      const needed = CONFIG.minGapMs - sinceTx;
      if (needed > wait) {
        wait = needed;
      }
    }
    if (state.pendingTimer !== null) {
      Timer.clear(state.pendingTimer);
    }
    state.pendingTimer = Timer.set(wait, false, flushReport);
  } catch (err) {
    console.log('[LoRa] schedule error:', JSON.stringify(err));
  }
}

function runCommand(text) {
  const fields = text.split('|');
  if (fields[0] !== 'C') {
    return;
  }
  const cmd = fields[1];
  const arg = fields[2];

  if (cmd === 'o') {
    Shelly.call(
      'Switch.Set',
      { id: CONFIG.switchId, on: arg === '1' },
      function () {
        scheduleReport();
      }
    );
  } else if (cmd === 't') {
    Shelly.call('Switch.Toggle', { id: CONFIG.switchId }, function () {
      scheduleReport();
    });
  } else if (cmd === 'r') {
    scheduleReport();
  } else if (cmd === 'w') {
    Shelly.call('Wifi.SetConfig', { config: { sta: { enable: true } } }, function () {
      Shelly.call('Shelly.Reboot', {});
    });
  } else if (cmd === 'b') {
    Shelly.call('Shelly.Reboot', {});
  } else {
    console.log('[LoRa] unknown command:', text);
  }
}

// ============================================================================
// GATEWAY LOGIC
// ============================================================================

// Virtual.Add accepts a desired id and returns it. Chain the calls one per
// callback: ten at once would hit the five-in-flight cap.
function provisionVcs(index, done) {
  if (index >= VC_SPECS.length) {
    done();
    return;
  }

  const spec = VC_SPECS[index];
  const config = { id: CONFIG.vcBaseId + spec[2], name: spec[3] };

  if (spec[1] === 'number') {
    config.min = spec[5];
    config.max = spec[6];
  }
  config.meta = { ui: { view: spec[0] === 'out' ? 'toggle' : 'label' } };
  if (spec[4] !== null) {
    config.meta.ui.unit = spec[4];
  }

  Shelly.call(
    'Virtual.Add',
    { type: spec[1], config: config },
    function (_, errCode) {
      // An existing component is the normal case on every restart.
      if (errCode !== 0) {
        console.log('[LoRa]', vcKey(spec), 'already present');
      }
      provisionVcs(index + 1, done);
    }
  );
}

function bindHandles() {
  let missing = '';
  for (let i = 0; i < VC_SPECS.length; i++) {
    const spec = VC_SPECS[i];
    const handle = Virtual.getHandle(vcKey(spec));
    if (handle) {
      state.handles[spec[0]] = handle;
    } else {
      missing = missing + ' ' + vcKey(spec);
    }
  }
  if (missing !== '') {
    console.log('[LoRa] missing virtual components:', missing);
    return false;
  }
  return true;
}

function putValue(role, value) {
  const handle = state.handles[role];
  if (!handle || value === null || value === undefined) {
    return;
  }
  // Until the first report has landed, write even an unchanged value so every
  // component starts out with a real one rather than looking untouched.
  if (state.isPrimed && handle.getValue() === value) {
    return;
  }
  handle.setValue(value);
}

function sendCommand(cmd, arg) {
  sendFrame('C|' + cmd + '|' + arg);
}

function commandOutput(value) {
  state.want = value;
  state.wantTries = 0;
  state.wantAtMs = Shelly.getUptimeMs();
  sendCommand('o', value ? '1' : '0');
}

function applyReport(text, rssi, snr) {
  const fields = text.split('|');
  if (fields[0] !== 'S' || fields.length < 8) {
    console.log('[LoRa] unexpected frame:', text);
    return;
  }

  state.lastRxMs = Shelly.getUptimeMs();

  const isOn = fields[1] === '1';
  state.lastOut = isOn;
  if (state.want !== null && isOn === state.want) {
    state.want = null;
  }
  if (state.want === null) {
    putValue('out', isOn);
  }

  putValue('pw', toNumber(fields[2]));
  putValue('volt', toNumber(fields[3]));
  putValue('cur', toNumber(fields[4]));
  putValue('nrg', toNumber(fields[5]));
  putValue('temp', toNumber(fields[6]));
  putValue('seq', toNumber(fields[7]));
  putValue('rssi', rssi);
  putValue('snr', snr);
  putValue('link', true);

  state.isPrimed = true;
}

function checkLink() {
  if (state.lastRxMs === 0) {
    putValue('link', false);
    return;
  }
  putValue('link', Shelly.getUptimeMs() - state.lastRxMs < CONFIG.offlineMs);
}

function checkPendingCommand() {
  if (state.want === null) {
    return;
  }
  if (Shelly.getUptimeMs() - state.wantAtMs < CONFIG.retryMs) {
    return;
  }
  if (state.wantTries >= CONFIG.retries) {
    console.log('[LoRa] command unconfirmed after', state.wantTries, 'retries');
    state.want = null;
    if (state.lastOut !== null) {
      putValue('out', state.lastOut);
    }
    return;
  }
  state.wantTries++;
  state.wantAtMs = Shelly.getUptimeMs();
  sendCommand('o', state.want ? '1' : '0');
  console.log('[LoRa] command retry', state.wantTries);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onLoraEvent(event) {
  if (
    typeof event !== 'object' ||
    event.name !== 'lora' ||
    event.id !== CONFIG.loraId ||
    !event.info ||
    event.info.event !== 'user_rx' ||
    !event.info.data
  ) {
    return;
  }
  if (event.info.sender !== addrToNum(CONFIG.peerAddr)) {
    return;
  }

  const payload = atob(event.info.data);
  if (isGateway()) {
    applyReport(payload, event.info.rssi, event.info.snr);
  } else {
    runCommand(payload);
  }
}

function onStatusChange(status) {
  if (isGateway()) {
    if (!state.isReady || status.component !== state.outKey) {
      return;
    }
    if (!status.delta || status.delta.value === undefined) {
      return;
    }
    // Our own mirror writes are stamped 'sys'; only outside writes are commands.
    if (status.delta.source === 'sys') {
      return;
    }
    commandOutput(status.delta.value);
    return;
  }

  if (status.component !== 'switch:' + CONFIG.switchId || !status.delta) {
    return;
  }
  if (status.delta.output === undefined) {
    return;
  }
  scheduleReport();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function startHandlers() {
  Shelly.addEventHandler(function (event) {
    try {
      onLoraEvent(event);
    } catch (err) {
      console.log('[LoRa] receive handler error:', JSON.stringify(err));
    }
  });

  Shelly.addStatusHandler(function (status) {
    try {
      onStatusChange(status);
    } catch (err) {
      console.log('[LoRa] status handler error:', JSON.stringify(err));
    }
  });
}

function startGateway() {
  provisionVcs(0, function () {
    if (!bindHandles()) {
      return;
    }
    state.outKey = vcKey(VC_SPECS[0]);
    putValue('link', false);
    startHandlers();

    Timer.set(CONFIG.watchMs, true, function () {
      try {
        checkLink();
      } catch (err) {
        console.log('[LoRa] link watchdog error:', JSON.stringify(err));
      }
    });

    Timer.set(CONFIG.tickMs, true, function () {
      try {
        checkPendingCommand();
      } catch (err) {
        console.log('[LoRa] retry error:', JSON.stringify(err));
      }
    });

    Timer.set(CONFIG.settleMs, false, function () {
      state.isReady = true;
    });

    // Ask for a first report rather than waiting out the node's heartbeat.
    Timer.set(3000, false, function () {
      sendCommand('r', '');
    });

    console.log('[LoRa] gateway up, mirroring', CONFIG.peerAddr);
  });
}

function startNode() {
  startHandlers();
  Timer.set(CONFIG.heartbeatMs, true, scheduleReport);
  Timer.set(2000, false, scheduleReport);
  console.log('[LoRa] node up, reporting to', CONFIG.peerAddr);
}

function init() {
  if (isGateway()) {
    startGateway();
  } else {
    startNode();
  }
}

init();
