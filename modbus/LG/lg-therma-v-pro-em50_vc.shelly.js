/* @meta {"vc":{"power":{"type":"boolean","config":{"name":"Power","meta":{"ui":{"view":"toggle"}}}},"dhw":{"type":"boolean","config":{"name":"DHW","meta":{"ui":{"view":"toggle"}}}},"silent":{"type":"boolean","config":{"name":"Silent","meta":{"ui":{"view":"toggle"}}}},"heatTarget":{"type":"number","config":{"name":"Heat Target","default_value":35,"min":10,"max":65,"meta":{"ui":{"view":"field","unit":"C"}}}},"dhwTarget":{"type":"number","config":{"name":"DHW Target","default_value":50,"min":25,"max":70,"meta":{"ui":{"view":"field","unit":"C"}}}},"inlet":{"type":"number","config":{"name":"Inlet Temp","min":-50,"max":100,"meta":{"ui":{"view":"label","unit":"C"}}}},"outlet":{"type":"number","config":{"name":"Outlet Temp","min":-50,"max":100,"meta":{"ui":{"view":"label","unit":"C"}}}},"dhwTemp":{"type":"number","config":{"name":"DHW Temp","min":-50,"max":100,"meta":{"ui":{"view":"label","unit":"C"}}}},"error":{"type":"number","config":{"name":"Error Code","min":0,"max":65535,"meta":{"ui":{"view":"label"}}}}}} */

/**
 * @title LG THERMA V Modbus bridge for Shelly Pro EM-50 with managed Virtual Components
 * @description Self-contained RS-485/Modbus RTU bridge for compatible LG THERMA V
 *   heat pumps using Shelly Pro EM-50 plus Shelly Pro Modbus Add-on, using a
 *   firmware-managed 9-component Virtual Component set.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LG/lg-therma-v-pro-em50_vc.shelly.js
 */

/**
 * Hardware / protocol:
 * - Shelly Pro EM-50 with Shelly Pro Modbus Add-on.
 * - Compatible LG THERMA V with documented Modbus RTU support.
 * - Tested settings: 9600 baud, 8N1, slave ID 2, Shelly serial/client ID 100.
 *
 * Safety / scope:
 * - Verify the exact LG model service documentation before writing values.
 * - Connector names and register maps differ by THERMA V generation/PCB.
 * - The script preserves a first-read-before-write gate and confirms writes by
 *   reading the physical device back. It does not bypass LG safety logic.
 *
 * Managed Virtual Component roles:
 * - power, dhw, silent: on/off toggles
 * - heatTarget, dhwTarget: writable setpoints, C
 * - inlet, outlet, dhwTemp: read-only temperatures, C
 * - error: read-only LG error code
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Per-role
 * default_value/step metadata is intentionally trimmed to stay inside that
 * budget; the 0.5 C step validation still happens in code (controlNext),
 * not just as a UI hint.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. This
 * script does not run on that firmware; there is no non-managed fallback.
 *
 * The firmware creates and reconciles all components before the script
 * starts. Component numeric IDs are resolved once via Script.getVcHandle(
 * role).getConfig().id and cached in C[i][1] - the rest of the bridge state
 * machine below is unchanged from the classical version, since it already
 * operated on resolved numeric IDs (Shelly.getComponentStatus / Type.Set)
 * rather than Virtual Component handle objects.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

var CFG = {
  serialId: 100,
  slaveId: 2,
  baud: 9600,
  format: '8N1',
  pollMs: 10000,
  retryMs: 10000,
  gapMs: 100,
  settleMs: 700
};

var MANAGED_ROLES = ['power', 'dhw', 'silent', 'heatTarget', 'dhwTarget', 'inlet', 'outlet', 'dhwTemp', 'error'];
var vc = {};

var C = [
  ['Boolean', null, 'Power', 0, null, null, 'power'],
  ['Boolean', null, 'DHW', 1, null, null, 'dhw'],
  ['Boolean', null, 'Silent', 2, null, null, 'silent'],
  ['Number', null, 'Heating target', 2, 10, 65, 'heatTarget'],
  ['Number', null, 'DHW target', 8, 25, 70, 'dhwTarget'],
  ['Number', null, 'Inlet', 2, -50, 100, 'inlet'],
  ['Number', null, 'Outlet', 3, -50, 100, 'outlet'],
  ['Number', null, 'DHW temperature', 5, -50, 100, 'dhwTemp'],
  ['Number', null, 'Error code', 0, 0, 65535, 'error']
];
var READS = [
  ['ReadCoils', 0, 3],
  ['ReadHoldingRegisters', 2, 1],
  ['ReadHoldingRegisters', 8, 1],
  ['ReadInputRegisters', 0, 6]
];
var ready = false;
var baseline = [];
var observed = [];
var actual = [];
var readIndex = 0;
var controlIndex = 0;
var publishIndex = 0;
var lastFault = '';
var lastErrorCode = null;

function later(fn, ms) { Timer.set(typeof ms === 'number' ? ms : CFG.gapMs, false, fn); }
function equal(a, b) {
  if (typeof a !== typeof b) return false;
  if (typeof a === 'boolean') return a === b;
  return typeof a === 'number' && Math.abs(a - b) < 0.001;
}
function word(v) { return typeof v === 'number' && v >= 0 && v <= 65535 && v === Math.floor(v); }
function signed(v) { return v > 32767 ? v - 65536 : v; }
function valid(i, v) {
  if (i < 3) return typeof v === 'boolean';
  return typeof v === 'number' && v >= C[i][4] && v <= C[i][5];
}
function uiValue(i) {
  var s = Shelly.getComponentStatus(C[i][0].toLowerCase(), C[i][1]);
  return s ? s.value : undefined;
}
function fault(message) {
  ready = false; baseline = [];
  if (message !== lastFault) print('[LG] PAUSED: ' + message + '. Writes blocked; retrying.');
  lastFault = message; later(begin, CFG.retryMs);
}
function call(method, params, done) {
  Shelly.call(method, params, function(r, e, m) { later(function() { done(r, e, m); }, 1); });
}
function mb(method, addr, qty, done) {
  call('MbRtuClient.' + method, { id: CFG.serialId, sid: CFG.slaveId, addr: addr, qty: qty }, done);
}
function begin() {
  var i;
  for (i = 0; i < C.length; i++) {
    if (!valid(i, uiValue(i))) { fault('Missing/invalid ' + C[i][0] + ':' + C[i][1]); return; }
  }
  call('Serial.GetConfig', { id: CFG.serialId }, function(r, e, m) {
    if (e !== 0 || !r) { fault('Serial configuration: ' + m); return; }
    if (r.mode === 'mb_client' && r.serial && r.serial.baud === CFG.baud && r.serial.format === CFG.format) { startRead(); return; }
    ready = false;
    call('Serial.SetConfig', { id: CFG.serialId, config: { mode: 'mb_client', serial: { baud: CFG.baud, format: CFG.format } } }, function(r2, e2, m2) {
      if (e2 !== 0) { fault('Serial setup: ' + m2); return; }
      if (r2 && r2.restart_required) { fault('Shelly reboot required'); return; }
      later(startRead, 500);
    });
  });
}
function startRead() { actual = []; readIndex = 0; later(readNext); }
function readNext() {
  var i, j, q, v;
  if (readIndex === READS.length) {
    for (i = 0; i < C.length; i++) {
      if (!valid(i, actual[i])) { fault('LG value outside configured range: ' + C[i][2]); return; }
    }
    observed = [];
    for (j = 0; j < 5; j++) {
      observed[j] = uiValue(j);
      if (!valid(j, observed[j])) { fault('Invalid control: ' + C[j][2]); return; }
    }
    controlIndex = 0; publishIndex = 0; later(ready ? controlNext : publishNext); return;
  }
  q = READS[readIndex];
  mb(q[0], q[1], q[2], function(r, e, m) {
    if (e !== 0 || !r || !r.values || r.values.length !== q[2]) { fault(q[0] + ' @' + q[1] + ': ' + m); return; }
    v = r.values;
    for (i = 0; i < v.length; i++) {
      if (readIndex === 0 ? typeof v[i] !== 'boolean' : !word(v[i])) { fault('Malformed ' + q[0] + ' response'); return; }
    }
    if (readIndex === 0) { actual[0] = v[0]; actual[1] = v[1]; actual[2] = v[2]; }
    if (readIndex === 1) actual[3] = signed(v[0]) / 10;
    if (readIndex === 2) actual[4] = signed(v[0]) / 10;
    if (readIndex === 3) {
      actual[5] = signed(v[2]) / 10; actual[6] = signed(v[3]) / 10;
      actual[7] = signed(v[5]) / 10; actual[8] = v[0];
    }
    readIndex += 1; later(readNext);
  });
}
function controlNext() {
  var i, requested, changed, params, method;
  if (controlIndex === 5) { later(publishNext); return; }
  i = controlIndex++; requested = uiValue(i);
  if (!valid(i, requested)) { fault('Invalid command: ' + C[i][2]); return; }
  observed[i] = requested; changed = !equal(requested, baseline[i]); baseline[i] = requested;
  if (!changed || equal(requested, actual[i])) { later(controlNext); return; }
  if (i >= 3 && Math.abs(requested * 2 - Math.round(requested * 2)) > 0.001) {
    print('[LG] REJECTED ' + C[i][2] + ': use 0.5 C steps.'); later(controlNext); return;
  }
  params = { id: CFG.serialId, sid: CFG.slaveId, addr: C[i][3] };
  method = 'MbRtuClient.WriteSingleRegister';
  if (i < 3) { method = 'MbRtuClient.WriteCoils'; params.values = [requested]; }
  else params.value = Math.round(requested * 10);
  call(method, params, function(r, e, m) {
    if (e !== 0) { fault('Unconfirmed ' + C[i][2] + ': ' + m); return; }
    later(function() {
      mb(i < 3 ? 'ReadCoils' : 'ReadHoldingRegisters', C[i][3], 1, function(rr, ee, mm) {
        var raw, value;
        if (ee !== 0 || !rr || !rr.values || rr.values.length !== 1) { fault('Readback ' + C[i][2] + ': ' + mm); return; }
        raw = rr.values[0];
        if (i < 3 ? typeof raw !== 'boolean' : !word(raw)) { fault('Malformed readback: ' + C[i][2]); return; }
        value = i < 3 ? raw : signed(raw) / 10;
        if (!valid(i, value)) { fault('Invalid readback: ' + C[i][2]); return; }
        actual[i] = value;
        if (equal(value, requested)) print('[LG] CONFIRMED ' + C[i][2] + ' = ' + value);
        else print('[LG] NOT CONFIRMED ' + C[i][2] + ': requested ' + requested + ', LG reports ' + value);
        later(controlNext);
      });
    }, CFG.settleMs);
  });
}
function publishNext() {
  var i, current, j;
  if (publishIndex === C.length) {
    if (!ready) {
      for (j = 0; j < 5; j++) {
        if (!equal(uiValue(j), actual[j])) { fault('UI changed during synchronization'); return; }
      }
      ready = true; print('[LG] READY: 9/9 synchronized. Commands enabled.');
    }
    lastFault = '';
    if (lastErrorCode !== actual[8]) { lastErrorCode = actual[8]; print('[LG] error code = ' + lastErrorCode); }
    later(begin, CFG.pollMs); return;
  }
  i = publishIndex++; current = uiValue(i);
  if (!valid(i, current)) { fault('Component unavailable: ' + C[i][2]); return; }
  if (ready && i < 5 && !equal(current, observed[i])) { later(publishNext, 1); return; }
  if (equal(current, actual[i])) {
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1); return;
  }
  call(C[i][0] + '.Set', { id: C[i][1], value: actual[i] }, function(r, e, m) {
    if (e !== 0) { fault('UI update ' + C[i][2] + ': ' + m); return; }
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1);
  });
}
function startBridge() {
  print('[LG] managed-VC bridge: 9 components; RTU ' + CFG.baud + ' ' + CFG.format + '; slave ' + CFG.slaveId);
  later(begin, 1);
}

function bindManagedComponents() {
  var i;

  for (i = 0; i < MANAGED_ROLES.length; i++) {
    vc[MANAGED_ROLES[i]] = Script.getVcHandle(MANAGED_ROLES[i]);
    if (!vc[MANAGED_ROLES[i]]) {
      print('[LG] ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
      return false;
    }
  }

  return true;
}

function resolveComponentIds() {
  var i;
  var config;

  for (i = 0; i < C.length; i++) {
    config = vc[C[i][6]].getConfig();
    if (!config || config.id === undefined) {
      print('[LG] ERROR: managed component has no id: ' + C[i][6]);
      return false;
    }
    C[i][1] = config.id;
  }

  return true;
}

function init() {
  if (!bindManagedComponents()) {
    print('[LG] Check firmware support and the script @meta declaration');
    return;
  }

  if (!resolveComponentIds()) return;

  startBridge();
}

init();
