/* @meta {"vc":{"power":{"type":"boolean","access":"wc","config":{"name":"LG Chiller Enable"}},"mode":{"type":"enum","access":"wc","config":{"name":"LG Chiller Mode","options":["Cooling","Heating","Unknown"],"default_value":"Unknown"}},"cool":{"type":"number","access":"wc","config":{"name":"LG Cooling Setpoint","min":4,"max":25,"default_value":7}},"heat":{"type":"number","access":"wc","config":{"name":"LG Heating Setpoint","min":30,"max":60,"default_value":35}},"ewt":{"type":"number","access":"rc","config":{"name":"LG Entering Water"}},"lwt":{"type":"number","access":"rc","config":{"name":"LG Leaving Water"}},"address":{"type":"number","access":"wc","config":{"name":"LG Modbus Address","min":1,"max":247,"default_value":1,"persisted":true}},"fault":{"type":"number","access":"rc","config":{"name":"LG Fault Code"}},"link":{"type":"text","access":"rc","config":{"name":"LG Communication","default_value":"UNSYNCED","max_len":160}}}} */
/**
 * @title LG KCHH020LDGC chiller with nine managed Virtual Components
 * @description Local RS485/Modbus RTU chiller bridge with FC05 enable, FC06
 *   setpoints/mode, verified readback, and a persisted selectable Modbus address.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LG/lg-kchh020ldgc-pro-rs485-vc.shelly.js
 */

/**
 SPDX-License-Identifier: Apache-2.0
 Copyright 2026 Georgi Germanov and contributors

 LG KCHH020LDGC / one selected chiller per Shelly / v1.1.0.
 Host: compatible Shelly Pro + Pro RS485 Add-on; managed VC and jsuart APIs.
 Pro EM-50 supports Modbus control; Pro 3EM additionally meters all three phases.
 Exact host/firmware must expose serial:100 with jsuart and UART.get(100).
 Requires Script.getVcHandle(), Script.storage, UART.get(SERIAL_ID).
 Hardware/firmware availability is checked at startup, not assumed tested.

 INSTALL
 1. Enable the Pro RS485 add-on in the Shelly device settings. Stop the old
    bridge and other masters on this physical bus before starting this one.
 2. Shelly A/B -> LG external Modbus CH4 A+/B-. HMI remains on CH3.
    Follow LG installation wiring/isolation/termination instructions.
 3. Keep the complete @meta declaration on one physical line, <=1024 chars.
    Nine roles: power, mode, cool, heat, ewt, lwt, address, fault, link.
    Firmware owns the roles; UI details are configured sequentially at startup.
    Paste this entire file into the SAME script slot, Save, then Run. Keep @meta
    first. Firmware owns/reuses its nine roles; no fixed VC IDs are assumed.
    The old outdoor-temperature role is replaced by LG Modbus Address.
    Select the actual external LG address (1..247) in that persistent tile.
    It selects the server queried by Shelly; it does NOT reprogram the LG
    controller's address. On selection, queued commands are discarded and
    actual values are re-read before commands can run. Selection is local
    configuration, so it also works with ENABLE_WRITES:false.
 4. With ENABLE_WRITES:false compare raw console data and all values to HMI.
    SETPOINT_SCALE and SENSOR_SCALE are independent. 0.1 is the candidate
    scale from the supplied YAML, NOT established by the LG register table.
 5. Only after confirming the map/scales, real Shelly/firmware and LG remote
    Modbus settings, set ENABLE_WRITES:true and restart. Initial values are
    read from LG before commands are accepted. Nothing is written on boot.

 MAP / EVIDENCE
 LG KCHH manual MFL67262630 Rev.00_011025 pp.51-52,127,161,163,167:
 coil 00001 -> offset0, FC01/05, chiller enable REQUEST (not compressor run);
 holding40002/3/4 -> offsets1/2/3, FC03/06, mode/cooling/heating;
 input30004/5 -> offsets3/4, FC04, leaving/entering water;
 input30010 -> offset9, FC04, fault code. 9600 baud, 8N1, RS485 RTU.
 Heating=4 is from supplied YAML; that manual table only names Cooling=0.
 Cooling 4..25 C; heating 30..60 C. Demand Limit40001 is not used.
 Control/remote registers40005/6 are read for diagnosis, never changed.

 https://cms.intermetal.bg/storage/uploads/2025/06/25/685bc65a31f95MFL67262630_00_250120_06_WEB_English-2_compressed.pdf
 https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/UART/
 https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/
 https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Serial/
 https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellyRs485Addon/

 BEHAVIOUR
 One outstanding request; FC05/06 writes only to the allowlist below.
 One read retry; writes are NEVER blindly retried. Every attempted write
 is followed by a fresh snapshot, including when its acknowledgement is
 lost. Mismatch/exception is reported, not silently called a success.
 Last confirmed values stay visible if offline; the ninth tile explicitly
 marks them STALE with the last good uptime. Reconnect clears old commands.
 Local polling works without cloud. Smart Control requires the normal
 Shelly Cloud connection and verification in the actual device/app account.
 Its exact card layout/history/scenes have not been verified by this file.

 ROLLBACK
 Set ENABLE_WRITES:false, disable this script's autostart, then stop it.
 Original serial config is saved once per port in Script.storage under
 lgser100 (or lgser<id>), and printed on first change. Restore it only when
 no other script uses the port. Stop, rather than delete, to retain tiles
 and the serial backup: firmware removes managed VCs/storage on deletion.
 LG protections, remote/local modes and other Shelly components are not
 modified. This file never switches the chiller's mains supply.

 Validation: real-configuration-tested as reported by the contributor on
 2026-10-19. Exact Shelly firmware and per-function physical coverage were not
 recorded; this is not independent hardware verification. Publication-format
 changes and RTU/UI fault cases were statically checked and simulator-checked.
 Available script heap, UART direction/echo behaviour, controller firmware,
 scaling and cloud UI still
 must be verified for every different installation. One repeating timer,
 five VC change listeners, one startup RPC at a time; buffers/queues bounded.
*/

var VC_CONFIG = {
  power: {
    name: 'LG Chiller Enable',
    persisted: false,
    default_value: false,
    meta: {
      ui: {
        view: 'toggle',
      },
    },
  },
  mode: {
    name: 'LG Chiller Mode',
    persisted: false,
    options: ['Cooling', 'Heating', 'Unknown'],
    default_value: 'Unknown',
  },
  cool: {
    name: 'LG Cooling Setpoint',
    persisted: false,
    default_value: 7,
    min: 4,
    max: 25,
    meta: {
      ui: {
        view: 'field',
        unit: 'C',
        step: 1,
      },
    },
  },
  heat: {
    name: 'LG Heating Setpoint',
    persisted: false,
    default_value: 35,
    min: 30,
    max: 60,
    meta: {
      ui: {
        view: 'field',
        unit: 'C',
        step: 1,
      },
    },
  },
  ewt: {
    name: 'LG Entering Water',
    persisted: false,
    default_value: 0,
    min: -30,
    max: 100,
    meta: {
      ui: {
        view: 'label',
        unit: 'C',
        step: 0.1,
      },
    },
  },
  lwt: {
    name: 'LG Leaving Water',
    persisted: false,
    default_value: 0,
    min: -30,
    max: 100,
    meta: {
      ui: {
        view: 'label',
        unit: 'C',
        step: 0.1,
      },
    },
  },
  address: {
    name: 'LG Modbus Address',
    persisted: true,
    default_value: 1,
    min: 1,
    max: 247,
    meta: {
      ui: {
        view: 'field',
        step: 1,
      },
    },
  },
  fault: {
    name: 'LG Fault Code',
    persisted: false,
    default_value: 0,
    min: 0,
    max: 65535,
    meta: {
      ui: {
        view: 'label',
        step: 1,
      },
    },
  },
  link: {
    name: 'LG Communication',
    persisted: false,
    default_value: 'UNSYNCED',
    max_len: 160,
    meta: {
      ui: {
        view: 'label',
      },
    },
  },
};

var CFG = {
  SERIAL_ID: 100, // Pro RS485 Add-on. Do not copy to other hardware.
  SLAVE_ID: 1, // Fallback only; persistent address tile takes priority.
  CONFIGURE_SERIAL: true, // Back up then set jsuart / 9600 / 8N1 locally.
  ENABLE_WRITES: false, // Commissioning gate. Read comments above first.
  SETPOINT_SCALE: 0.1, // Celsius = signed raw * scale; confirm with HMI.
  SENSOR_SCALE: 0.1, // Independently confirm input-register scaling.
  HEATING_MODE: 4, // Candidate from user's working HA YAML.
  POLL_MS: 5000,
  GAP_MS: 150,
  TIMEOUT_MS: 1500,
  SETTLE_MS: 1000,
  STALE_MS: 15000,
  COMMAND_TTL_MS: 6000,
  MAX_QUEUE: 4,
  BACKOFF_MAX_MS: 30000,
};

var VC_ROLES = [
  'power',
  'mode',
  'cool',
  'heat',
  'ewt',
  'lwt',
  'address',
  'fault',
  'link',
];
var READ_REQUESTS = [
  { fc: 1, a: 0, n: 1 },
  { fc: 3, a: 1, n: 5 },
  { fc: 4, a: 3, n: 2 },
  { fc: 4, a: 9, n: 1 },
];
var vc = {},
  actual = null,
  commandQueue = [],
  rawSnapshot = [],
  uart = null;
var synchronized = false,
  stopped = false,
  transaction = null,
  completed = null,
  rxBuffer = '';
var phase = 'poll',
  readIndex = 0,
  readRetry = 0,
  failureCount = 0;
var dueAt = 0,
  nextBusAt = 0,
  quietUntil = 0,
  lastSuccessAt = -1,
  lastRawLogAt = -60000;
var lastRxAt = -10000,
  activeCommand = null,
  notice = '',
  lastLink = '';
var selfSource = '',
  pageOffset = 0,
  serialPort = null,
  portMatches = 0;
var clockTimer = null;

function now() {
  return Shelly.getUptimeMs();
}
function log(s) {
  print('[LG KCHH] ' + s);
}
function finite(v) {
  return typeof v === 'number' && isFinite(v);
}
function integer(v) {
  return finite(v) && Math.floor(v) === v;
}
function signed(v) {
  return v > 32767 ? v - 65536 : v;
}
function near(a, b) {
  return typeof a === 'number' && typeof b === 'number'
    ? Math.abs(a - b) < 0.001
    : a === b;
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
function inRange(v, a, b) {
  return finite(v) && v >= a && v <= b;
}

function put(role, v) {
  if (vc[role] && !near(vc[role].getValue(), v)) vc[role].setValue(v);
}
function link(s) {
  s = String(s).slice(0, 160);
  if (s !== lastLink) {
    lastLink = s;
    put('link', s);
    log(s);
  }
}
function lastStamp() {
  return lastSuccessAt < 0
    ? 'never'
    : String(Math.floor(lastSuccessAt / 1000)) + 's uptime';
}
function stop(s) {
  stopped = true;
  synchronized = false;
  commandQueue = [];
  if (clockTimer !== null) {
    Timer.clear(clockTimer);
    clockTimer = null;
  }
  link('STOP: ' + s);
}
function mirror() {
  if (!actual) return;
  for (var i = 0; i < 8; i++) put(VC_ROLES[i], actual[VC_ROLES[i]]);
}
function status() {
  var s = synchronized
    ? CFG.ENABLE_WRITES
      ? 'ONLINE'
      : 'READ ONLY - verify map/scales'
    : 'STALE';
  if (activeCommand) s += ' | pending ' + activeCommand.role;
  if (notice) s += ' | ' + notice;
  link(s + ' | last=' + lastStamp());
}

function crc(s) {
  var c = 65535;
  for (var i = 0; i < s.length; i++) {
    c = c ^ s.charCodeAt(i);
    for (var j = 0; j < 8; j++) c = c & 1 ? (c >> 1) ^ 40961 : c >> 1;
  }
  return c & 65535;
}
function byte(n) {
  return String.fromCharCode(n & 255);
}
function frame(fc, a, n) {
  var s =
    byte(CFG.SLAVE_ID) +
    byte(fc) +
    byte(a >> 8) +
    byte(a) +
    byte(n >> 8) +
    byte(n);
  var c = crc(s);
  return s + byte(c) + byte(c >> 8);
}
function allowed(fc, a, n) {
  if (fc === 1) return a === 0 && n === 1;
  if (fc === 3) return a === 1 && n === 5;
  if (fc === 4) return (a === 3 && n === 2) || (a === 9 && n === 1);
  if (!CFG.ENABLE_WRITES || !synchronized) return false;
  if (fc === 5) return a === 0 && (n === 0 || n === 65280);
  if (fc !== 6 || !integer(n) || n < 0 || n > 65535) return false;
  if (a === 1) return n === 0 || n === CFG.HEATING_MODE;
  if (a === 2) return inRange(signed(n) * CFG.SETPOINT_SCALE, 4, 25);
  if (a === 3) return inRange(signed(n) * CFG.SETPOINT_SCALE, 30, 60);
  return false;
}
function finish(values, error) {
  if (!transaction) return;
  completed = { cb: transaction.cb, values: values, error: error };
  transaction = null;
  rxBuffer = '';
  nextBusAt = now() + CFG.GAP_MS;
}
function send(fc, a, n, cb) {
  if (transaction || completed || !allowed(fc, a, n)) {
    stop('Internal bus/allowlist violation');
    return;
  }
  var s = frame(fc, a, n);
  transaction = {
    sid: CFG.SLAVE_ID,
    fc: fc,
    a: a,
    n: n,
    cb: cb,
    until: now() + CFG.TIMEOUT_MS,
    request: s,
  };
  rxBuffer = '';
  try {
    if (uart.send(s) !== s.length) finish(null, 'short UART send');
  } catch (e) {
    finish(null, 'UART send failed');
  }
}
function receive(data) {
  lastRxAt = now();
  if (!transaction || typeof data !== 'string') {
    rxBuffer = '';
    return;
  }
  rxBuffer += data;
  if (rxBuffer.length > 256) {
    finish(null, 'RX overflow');
    quietUntil = now() + CFG.TIMEOUT_MS;
    return;
  }
  var scans = 0;
  while (transaction && rxBuffer.length >= 5 && scans < 256) {
    scans++;
    var fc = rxBuffer.charCodeAt(1),
      len = 0,
      expected = transaction.fc;
    if (
      rxBuffer.charCodeAt(0) !== transaction.sid ||
      (fc !== expected && fc !== (expected | 128))
    ) {
      rxBuffer = rxBuffer.slice(1);
      continue;
    }
    if (fc & 128) len = 5;
    else if (expected === 5 || expected === 6) len = 8;
    else {
      var count = expected === 1 ? 1 : transaction.n * 2;
      if (rxBuffer.charCodeAt(2) !== count) {
        rxBuffer = rxBuffer.slice(1);
        continue;
      }
      len = 5 + count;
    }
    if (rxBuffer.length < len) return;
    var s = rxBuffer.slice(0, len),
      c = crc(s.slice(0, len - 2));
    if (
      (c & 255) !== s.charCodeAt(len - 2) ||
      c >> 8 !== s.charCodeAt(len - 1)
    ) {
      rxBuffer = rxBuffer.slice(1);
      continue;
    }
    if (fc & 128) {
      finish(null, 'Modbus exception ' + s.charCodeAt(2));
      return;
    }
    if (expected === 5 || expected === 6) {
      if (s !== transaction.request) {
        rxBuffer = rxBuffer.slice(len);
        continue;
      }
      finish([], null);
      return; // An echo is NOT proof; mandatory readback follows.
    }
    var values = [];
    if (expected === 1) values = [(s.charCodeAt(3) & 1) !== 0];
    else
      for (var i = 0; i < transaction.n; i++)
        values.push((s.charCodeAt(3 + i * 2) << 8) | s.charCodeAt(4 + i * 2));
    finish(values, null);
    return;
  }
}

function reject(role, why) {
  if (actual) put(role, actual[role]);
  notice = 'BLOCKED ' + role + ': ' + why;
  status();
}
function validCommand(role, v) {
  if (role === 'power') return typeof v === 'boolean';
  if (role === 'mode') return v === 'Cooling' || v === 'Heating';
  if (role === 'cool') return inRange(v, 4, 25) && integer(v);
  if (role === 'heat') return inRange(v, 30, 60) && integer(v);
  return false;
}
function command(role, e) {
  if (!e || !e.source || e.source === selfSource || e.source === 'sys') return;
  var v = e.value,
    i;
  if (!synchronized || !actual || now() - lastSuccessAt > CFG.STALE_MS) {
    reject(role, 'not synchronized');
    return;
  }
  if (!CFG.ENABLE_WRITES) {
    reject(role, 'commissioning read-only');
    return;
  }
  if (!validCommand(role, v)) {
    reject(role, 'value/range');
    return;
  }
  if (role === 'power' && v && actual.fault !== 0) {
    reject(role, 'LG fault active');
    return;
  }
  for (i = 0; i < commandQueue.length; i++) {
    if (commandQueue[i].role === role) {
      commandQueue[i] = { role: role, value: v, born: now() };
      put(role, actual[role]);
      if (phase === 'idle') dueAt = now();
      return;
    }
  }
  if (
    near(v, actual[role]) &&
    (!activeCommand || activeCommand.role !== role)
  ) {
    put(role, actual[role]);
    return;
  }
  if (commandQueue.length >= CFG.MAX_QUEUE) {
    reject(role, 'queue full');
    return;
  }
  commandQueue.push({ role: role, value: v, born: now() });
  if (phase === 'idle') dueAt = now();
  put(role, actual[role]);
  notice = 'queued ' + role;
  status();
}
function onPowerChanged(e) {
  command('power', e);
}
function onModeChanged(e) {
  command('mode', e);
}
function onCoolingChanged(e) {
  command('cool', e);
}
function onHeatingChanged(e) {
  command('heat', e);
}

function onAddressChanged(e) {
  if (
    stopped ||
    !e ||
    !e.source ||
    e.source === selfSource ||
    e.source === 'sys'
  )
    return;
  var addr = e.value;
  if (!integer(addr) || !inRange(addr, 1, 247)) {
    put('address', CFG.SLAVE_ID);
    notice = 'BLOCKED address: use integer 1..247';
    status();
    return;
  }
  if (addr === CFG.SLAVE_ID) return;
  var unconfirmed = activeCommand !== null;
  // Quarantine the old request, including rapid A -> B -> A selections.
  quietUntil = Math.max(
    quietUntil,
    now() + CFG.TIMEOUT_MS + (transaction ? CFG.TIMEOUT_MS : 0)
  );
  CFG.SLAVE_ID = addr;
  transaction = null;
  completed = null;
  rxBuffer = '';
  activeCommand = null;
  commandQueue = [];
  actual = null;
  synchronized = false;
  lastSuccessAt = -1;
  lastRawLogAt = -60000;
  failureCount = 0;
  rawSnapshot = [];
  readIndex = 0;
  readRetry = 0;
  phase = 'poll';
  dueAt = quietUntil;
  notice = '';
  put('address', addr);
  link(
    'UNSYNCED - selected Modbus address ' +
      addr +
      (unconfirmed ? ' | previous command unconfirmed' : '')
  );
}

function fault(reason) {
  synchronized = false;
  commandQueue = [];
  rawSnapshot = [];
  readIndex = 0;
  readRetry = 0;
  if (transaction || completed) {
    transaction = null;
    completed = null;
    rxBuffer = '';
    quietUntil = now() + CFG.TIMEOUT_MS;
  }
  if (activeCommand) {
    reason = activeCommand.role + ' unconfirmed: ' + reason;
    activeCommand = null;
  }
  failureCount = Math.min(failureCount + 1, 5);
  dueAt =
    now() + Math.min(CFG.BACKOFF_MAX_MS, 1000 * Math.pow(2, failureCount));
  phase = 'idle';
  notice = '';
  mirror();
  link('STALE: ' + reason + ' | last=' + lastStamp());
}
function readResult(values, error) {
  if (error) {
    synchronized = false;
    commandQueue = [];
    mirror();
    link('STALE: ' + error + ' | last=' + lastStamp());
    if (readRetry < 1 && error.indexOf('Modbus exception') < 0) {
      readRetry++;
      readIndex = 0;
      rawSnapshot = [];
      dueAt = now() + 250;
      return;
    }
    fault(error);
    return;
  }
  rawSnapshot[readIndex] = values;
  readIndex++;
}
function snapshot() {
  var h = rawSnapshot[1],
    t = rawSnapshot[2],
    s = {};
  s.power = rawSnapshot[0][0];
  s.mode =
    h[0] === 0 ? 'Cooling' : h[0] === CFG.HEATING_MODE ? 'Heating' : 'Unknown';
  s.cool = round1(signed(h[1]) * CFG.SETPOINT_SCALE);
  s.heat = round1(signed(h[2]) * CFG.SETPOINT_SCALE);
  s.address = CFG.SLAVE_ID;
  s.lwt = round1(signed(t[0]) * CFG.SENSOR_SCALE);
  s.ewt = round1(signed(t[1]) * CFG.SENSOR_SCALE);
  s.fault = rawSnapshot[3][0];
  if (now() - lastRawLogAt >= 30000 || !synchronized) {
    log(
      'SID=' +
        CFG.SLAVE_ID +
        ' RAW holding40002..6=' +
        JSON.stringify(h) +
        ' input30004..5=' +
        JSON.stringify(t) +
        ' fault=' +
        s.fault
    );
    lastRawLogAt = now();
  }
  if (
    s.mode === 'Unknown' ||
    !inRange(s.cool, 4, 25) ||
    !inRange(s.heat, 30, 60) ||
    !inRange(s.lwt, -30, 100) ||
    !inRange(s.ewt, -30, 100)
  ) {
    fault('MAP/SCALE CHECK - compare RAW with HMI');
    return;
  }
  actual = s;
  lastSuccessAt = now();
  synchronized = true;
  failureCount = 0;
  mirror();
  if (activeCommand) {
    if (
      near(s[activeCommand.role], activeCommand.value) &&
      (!activeCommand.error ||
        activeCommand.error.indexOf('Modbus exception') < 0)
    ) {
      notice = 'CONFIRMED ' + activeCommand.role + '=' + activeCommand.value;
    } else {
      notice =
        'MISMATCH ' + activeCommand.role + ' actual=' + s[activeCommand.role];
      commandQueue = [];
      if (activeCommand.error) notice += ' (' + activeCommand.error + ')';
    }
    activeCommand = null;
  }
  rawSnapshot = [];
  readIndex = 0;
  phase = 'idle';
  dueAt = commandQueue.length ? now() : now() + CFG.POLL_MS;
  status();
}
function writeResult(values, error) {
  if (error) {
    synchronized = false;
    commandQueue = [];
    mirror();
    link(
      'STALE: write acknowledgement uncertain/rejected | last=' + lastStamp()
    );
  }
  activeCommand.error = error;
  phase = 'settle';
  dueAt = now() + CFG.SETTLE_MS;
  // Even lost response is resolved by reading; never resend this write.
}
function beginCommand() {
  while (commandQueue.length) {
    var c = commandQueue.shift();
    if (now() - c.born > CFG.COMMAND_TTL_MS) {
      notice = 'EXPIRED ' + c.role;
      status();
      continue;
    }
    if (!synchronized || !CFG.ENABLE_WRITES || !validCommand(c.role, c.value))
      continue;
    if (near(actual[c.role], c.value)) continue;
    if (c.role === 'power' && c.value && actual.fault !== 0) {
      reject(c.role, 'LG fault active');
      continue;
    }
    activeCommand = c;
    notice = '';
    status();
    if (c.role === 'power') send(5, 0, c.value ? 65280 : 0, writeResult);
    else if (c.role === 'mode')
      send(6, 1, c.value === 'Heating' ? CFG.HEATING_MODE : 0, writeResult);
    else {
      var raw = c.value / CFG.SETPOINT_SCALE;
      if (!integer(raw)) {
        activeCommand = null;
        reject(c.role, 'non-representable raw value');
        return;
      }
      send(6, c.role === 'cool' ? 2 : 3, raw, writeResult);
    }
    return;
  }
}
function tick() {
  if (stopped) return;
  var t = now();
  if (transaction && t >= transaction.until) {
    quietUntil = t + CFG.TIMEOUT_MS;
    finish(null, 'timeout/CRC/no matching frame');
  }
  if (completed) {
    var d = completed;
    completed = null;
    d.cb(d.values, d.error);
  }
  if (synchronized && t - lastSuccessAt > CFG.STALE_MS) {
    fault('poll freshness timeout');
  }
  if (
    transaction ||
    completed ||
    t < nextBusAt ||
    t < quietUntil ||
    t - lastRxAt < 20 ||
    t < dueAt
  )
    return;
  if (phase === 'settle') {
    phase = 'poll';
    readIndex = 0;
    rawSnapshot = [];
    readRetry = 0;
  }
  if (phase === 'idle') {
    if (synchronized && commandQueue.length) {
      beginCommand();
      if (transaction) return;
    }
    phase = 'poll';
    readIndex = 0;
    rawSnapshot = [];
    readRetry = 0;
  }
  if (phase === 'poll') {
    if (readIndex === READ_REQUESTS.length) {
      snapshot();
      return;
    }
    var r = READ_REQUESTS[readIndex];
    send(r.fc, r.a, r.n, readResult);
  }
}

function attachUart() {
  try {
    uart = UART.get(CFG.SERIAL_ID);
    if (!uart) {
      stop('UART ' + CFG.SERIAL_ID + ' unavailable/occupied');
      return;
    }
    uart.configure({ baud: 9600, format: '8N1' });
    uart.recv(receive);
    vc.power.on('change', onPowerChanged);
    vc.mode.on('change', onModeChanged);
    vc.cool.on('change', onCoolingChanged);
    vc.heat.on('change', onHeatingChanged);
    vc.address.on('change', onAddressChanged);
    var selected = vc.address.getValue();
    if (integer(selected) && inRange(selected, 1, 247)) CFG.SLAVE_ID = selected;
    else put('address', CFG.SLAVE_ID);
    dueAt = now() + 500;
    clockTimer = Timer.set(100, true, tick);
    link('UNSYNCED - reading LG first');
  } catch (e) {
    stop('UART/jsuart API unavailable: ' + String(e));
  }
}
function serialWritten(r, e, m) {
  if (e) {
    stop('Serial.SetConfig ' + e + ' ' + m);
    return;
  }
  if (r && r.restart_required) {
    stop('Serial config requires Shelly restart');
    return;
  }
  attachUart();
}
function serialRead(r, e, m) {
  if (e || !r || !r.serial) {
    stop('Serial.GetConfig ' + CFG.SERIAL_ID + ': ' + m);
    return;
  }
  if (
    r.mode === 'jsuart' &&
    r.serial.baud === 9600 &&
    r.serial.format === '8N1'
  ) {
    attachUart();
    return;
  }
  if (!CFG.CONFIGURE_SERIAL) {
    stop('Set selected serial port to jsuart / 9600 / 8N1');
    return;
  }
  try {
    var key = 'lgser' + CFG.SERIAL_ID;
    if (Script.storage.getItem(key) === null) {
      Script.storage.setItem(key, JSON.stringify(r));
      log('Serial rollback config=' + JSON.stringify(r));
    }
  } catch (x) {
    stop('Cannot preserve original serial config');
    return;
  }
  Shelly.call(
    'Serial.SetConfig',
    {
      id: CFG.SERIAL_ID,
      config: { mode: 'jsuart', serial: { baud: 9600, format: '8N1' } },
    },
    serialWritten
  );
}
function scanPage(r, e, m) {
  if (e || !r || !r.components || !integer(r.offset) || !integer(r.total)) {
    stop('GetComponents: ' + m);
    return;
  }
  for (var i = 0; i < r.components.length; i++) {
    var c = r.components[i];
    if (c.key === 'serial:' + CFG.SERIAL_ID) {
      serialPort = c;
      portMatches++;
    }
  }
  var end = r.offset + r.components.length;
  if (end < r.total) {
    if (end <= pageOffset) {
      stop('Non-progressing component pagination');
      return;
    }
    pageOffset = end;
    Shelly.call(
      'Shelly.GetComponents',
      { offset: pageOffset, include: ['config'] },
      scanPage
    );
    return;
  }
  if (
    portMatches !== 1 ||
    !serialPort.attrs ||
    !serialPort.attrs.modes ||
    serialPort.attrs.modes.indexOf('jsuart') < 0
  ) {
    stop(
      'serial:' +
        CFG.SERIAL_ID +
        ' does not advertise jsuart; verify device/add-on/firmware'
    );
    return;
  }
  Shelly.call('Serial.GetConfig', { id: CFG.SERIAL_ID }, serialRead);
}
function configureVirtualComponents(index) {
  if (index >= VC_ROLES.length) {
    link('UNSYNCED - checking serial capabilities');
    Shelly.call(
      'Shelly.GetComponents',
      { offset: 0, include: ['config'] },
      scanPage
    );
    return;
  }
  var role = VC_ROLES[index],
    current = vc[role].getConfig();
  if (!current || !integer(current.id)) {
    stop('Missing managed config for ' + role);
    return;
  }
  var type =
    role === 'power'
      ? 'Boolean'
      : role === 'mode'
        ? 'Enum'
        : role === 'link'
          ? 'Text'
          : 'Number';
  Shelly.call(
    type + '.SetConfig',
    { id: current.id, config: VC_CONFIG[role] },
    virtualConfigWritten,
    index
  );
}
function virtualConfigWritten(result, error, message, index) {
  if (error) {
    stop('Managed VC configuration: ' + VC_ROLES[index] + ' ' + message);
    return;
  }
  configureVirtualComponents(index + 1);
}

function init() {
  if (
    typeof Script === 'undefined' ||
    typeof Script.getVcHandle !== 'function' ||
    typeof UART === 'undefined'
  ) {
    log('STOP: working managed VC and UART APIs required');
    return;
  }
  if (
    !integer(CFG.SLAVE_ID) ||
    CFG.SLAVE_ID < 1 ||
    CFG.SLAVE_ID > 247 ||
    !integer(CFG.SERIAL_ID) ||
    CFG.SERIAL_ID < 0 ||
    (CFG.SETPOINT_SCALE !== 0.1 && CFG.SETPOINT_SCALE !== 1) ||
    (CFG.SENSOR_SCALE !== 0.1 && CFG.SENSOR_SCALE !== 1) ||
    CFG.HEATING_MODE !== 4 ||
    !integer(CFG.MAX_QUEUE) ||
    !inRange(CFG.MAX_QUEUE, 1, 4) ||
    !integer(CFG.POLL_MS) ||
    !inRange(CFG.POLL_MS, 1000, 60000) ||
    !integer(CFG.COMMAND_TTL_MS) ||
    !inRange(CFG.COMMAND_TTL_MS, 1000, 60000) ||
    !integer(CFG.GAP_MS) ||
    !inRange(CFG.GAP_MS, 100, 5000) ||
    !integer(CFG.TIMEOUT_MS) ||
    !inRange(CFG.TIMEOUT_MS, 500, 5000) ||
    !integer(CFG.SETTLE_MS) ||
    !inRange(CFG.SETTLE_MS, 500, 10000) ||
    !integer(CFG.STALE_MS) ||
    !inRange(CFG.STALE_MS, CFG.POLL_MS * 2, 180000) ||
    !integer(CFG.BACKOFF_MAX_MS) ||
    !inRange(CFG.BACKOFF_MAX_MS, 1000, 60000) ||
    typeof CFG.CONFIGURE_SERIAL !== 'boolean' ||
    typeof CFG.ENABLE_WRITES !== 'boolean'
  ) {
    log('STOP: invalid configuration');
    return;
  }
  selfSource = 'script:' + Script.id;
  for (var i = 0; i < VC_ROLES.length; i++) {
    vc[VC_ROLES[i]] = Script.getVcHandle(VC_ROLES[i]);
    if (!vc[VC_ROLES[i]]) {
      stop('Missing managed VC role ' + VC_ROLES[i]);
      return;
    }
  }
  var info = Shelly.getDeviceInfo();
  log(
    'v1.1.0 | device=' +
      info.model +
      ' firmware=' +
      info.ver +
      ' | writes=' +
      CFG.ENABLE_WRITES
  );
  configureVirtualComponents(0);
}

init();
