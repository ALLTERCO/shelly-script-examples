/**
 * @title INNOVA AirLeaf B32 Modbus RTU
 * @description Read-only by default; nine self-provisioned VCs for documented N273025C controllers.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/innova-airleaf-b32.shelly.js
 */
/**
 * SPDX-License-Identifier: Apache-2.0
 * Hardware: The Pill + Modbus RS485 add-on; 9600 8N1 expected, verify on controller.
 * Modbus FC03/FC06, zero-based address notation, slave ID configurable below.
 * Nine fixed-ID VCs are created/reused with Virtual.Add; Virtual.getHandle binds them.
 * Nine roles (IDs VC_BASE..VC_BASE+8): power, room, target, mode, fan, aux, motor, alarm, online.
 * power/target/mode/fan are commands ONLY when ENABLE_WRITES=true after commissioning.
 * Safety: read-only by default; no serial auto-configuration; no output on boot.
 * Auxiliary readings vary with controller profile, see README.
 */
var SLAVE_ID = 1;
var CLIENT_ID = 0;
var ENABLE_WRITES = false;
var POLL_MS = 3500;
var EXPECTED_BAUD = 9600;
var PROFILE = 'b32';
var VC = {};
var REG = { room:0, water:1, actual:8, motor:15, alarm:105, program:201, target:231, mode:233 };
var scan = PROFILE === 'b32' ? [201,231,233,0,1,15,105] : [201,231,233,0,8,105];
var i = 0, busy = false, active = false, online = false, initial = true;
var reg = {}, desired = {}, failCount = 0, lastSuccess = 0;

function log(s) { print('[INNOVA ' + PROFILE + '] ' + s); }
function put(role, val) {
  if (!VC[role] || val === undefined || val === null) return;
  desired[role] = val;
  if (VC[role].getValue() !== val) VC[role].setValue(val);
}
function fault(msg) { put('alarm', msg); }
function valueToMode(v) { return v === 3 ? 'heating' : v === 5 ? 'cooling' : v === 0 ? 'auto' : 'unknown'; }
function valueToFan(v) {
  v &= 7;
  return v === 0 ? 'auto' : v === 1 ? 'silent' : v === 2 ? 'night' : v === 3 ? 'maximum' : 'unknown';
}
function publishRegister(addr, n) {
  if (typeof n !== 'number' || n < 0 || n > 65535) return;
  reg[addr] = n;
  if (addr === 201) { put('power', (n & 128) === 0); put('fan', valueToFan(n)); }
  if (addr === 231) put('target', n / 10);
  if (addr === 233) put('mode', valueToMode(n));
  if (addr === 0 && n <= 1000) put('room', n / 10);
  if (addr === 1 && n <= 1000 && PROFILE === 'b32') put('aux', n / 10);
  if (addr === 8 && PROFILE !== 'b32' && n <= 1000) put('aux', n / 10);
  if (addr === 15 && PROFILE === 'b32') put('motor', n);
  if (addr === 105) { put('alarm', n === 0 ? 'No alarms' : 'Alarm flags: ' + String(n)); }
  if (addr === 201 && PROFILE !== 'b32') put('motor', n);
}
function readNext() {
  if (!active || busy) return;
  busy = true;
  var addr = scan[i];
  Shelly.call('MbRtuClient.ReadHoldingRegisters', { id:CLIENT_ID, sid:SLAVE_ID, addr:addr, qty:1 }, function(res, code) {
    busy = false;
    if (code === 0 && res && res.values && res.values.length === 1) {
      failCount = 0;
      lastSuccess = Shelly.getUptimeMs();
      put('online', true);
      online = true;
      publishRegister(addr, res.values[0]);
    } else {
      failCount++;
      if (failCount >= 3) {
        if (online) log('Modbus offline');
        online = false;
        put('online', false);
        fault('Modbus communication error');
      }
    }
    i = (i + 1) % scan.length;
  });
}
function verifiedCommand(role, val) {
  if (initial || !ENABLE_WRITES || !online || busy) { if (desired[role] !== undefined) put(role, desired[role]); return; }
  if (reg[201] === undefined || reg[231] === undefined || reg[233] === undefined) return;
  var addr = 0, data = 0;
  if (role === 'target') {
    if (typeof val !== 'number' || val < 16 || val > 30 || Math.round(val*10) !== val*10) return;
    addr = 231; data = Math.round(val * 10);
  } else if (role === 'mode') {
    if (val !== 'heating' && val !== 'cooling') return;
    addr = 233; data = val === 'heating' ? 3 : 5;
  } else if (role === 'power') {
    if (typeof val !== 'boolean') return;
    addr = 201; data = val ? (reg[201] & (65535 ^ 128)) : (reg[201] | 128);
  } else if (role === 'fan') {
    if (val !== 'auto' && val !== 'silent' && val !== 'night' && val !== 'maximum') return;
    var mode = val === 'auto' ? 0 : val === 'silent' ? 1 : val === 'night' ? 2 : 3;
    addr = 201; data = (reg[201] & (65535 ^ 7)) | mode;
  } else return;
  busy = true;
  Shelly.call('MbRtuClient.WriteSingleRegister', {id:CLIENT_ID, sid:SLAVE_ID, addr:addr, value:data}, function(res, code) {
    busy = false;
    if (code !== 0) { log('Write failed at ' + addr + ': ' + code); fault('Write failure'); }
    // Never declare success until a fresh read confirms the device's state.
    i = 0;
  });
}
function listen(role) {
  VC[role].on('change', function(ev) {
    if (ev.source && String(ev.source).indexOf('script:') === 0) return;
    if (desired[role] === ev.value) return;
    verifiedCommand(role, ev.value);
  });
}

var VC_BASE = 220; // Nine fixed IDs: 220..228.
var POINTS = [
  ['boolean', 'power', 'Power'],
  ['number', 'room', 'Room temperature'],
  ['number', 'target', 'Target temperature'],
  ['enum', 'mode', 'Operating mode'],
  ['enum', 'fan', 'Fan mode'],
  ['number', 'aux', 'Auxiliary temperature / setpoint'],
  ['number', 'motor', 'Motor command / PRG flags'],
  ['text', 'alarm', 'Modbus diagnostics'],
  ['boolean', 'online', 'Modbus online']
];
var existingComponents = [];

function pointId(n) { return VC_BASE + n; }
function pointKey(n) { return POINTS[n][0] + ':' + pointId(n); }
function pointName(n) { return 'INNOVA ' + PROFILE.toUpperCase() + ' ' + POINTS[n][2]; }

function componentConfig(n) {
  var type = POINTS[n][0];
  var cfg = { name: pointName(n), persisted: false, meta: { ui: { view: 'label' } } };
  if (type === 'boolean') {
    cfg.default_value = false;
    if (n === 0 && ENABLE_WRITES) cfg.meta.ui.view = 'toggle';
  } else if (type === 'enum') {
    cfg.options = n === 3 ? ['auto', 'heating', 'cooling', 'unknown'] :
      ['auto', 'silent', 'night', 'maximum', 'unknown'];
    cfg.default_value = 'unknown';
    if (ENABLE_WRITES) cfg.meta.ui.view = 'dropdown';
  } else if (type === 'number') {
    cfg.default_value = n === 2 ? 20 : 0;
    cfg.min = 0;
    cfg.max = n === 6 ? 65535 : 100;
    if (n === 2) { cfg.min = 5; cfg.max = 40; }
    if (n !== 6) cfg.meta.ui.unit = 'C';
    if (n === 2 && ENABLE_WRITES) {
      cfg.meta.ui.view = 'field';
      cfg.meta.ui.step = 0.1;
    }
  } else if (type === 'text') {
    cfg.default_value = 'Starting';
    cfg.max_len = 255;
  }
  return cfg;
}

function provisionNext(n) {
  var type, cfg, old;
  if (n === POINTS.length) {
    Timer.set(100, false, startBridge);
    return;
  }
  type = POINTS[n][0];
  cfg = componentConfig(n);
  old = Shelly.getComponentConfig(type, pointId(n));
  if (old && old.name !== cfg.name) {
    log('STOPPED: component ID conflict at ' + pointKey(n) + '. Change VC_BASE.');
    return;
  }
  Shelly.call(old ? type[0].toUpperCase() + type.slice(1) + '.SetConfig' : 'Virtual.Add',
    old ? { id: pointId(n), config: cfg } :
      { type: type, id: pointId(n), config: cfg },
    function(result, code, message) {
      if (code !== 0) {
        log('STOPPED: VC setup failed for ' + pointKey(n) + ': ' + String(message));
        return;
      }
      Timer.set(100, false, function() { provisionNext(n + 1); });
    });
}

function inspectComponents(offset) {
  Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset },
    function(res, code, message) {
      var list, total, i, key, kind, owned, used, cfg, next;
      if (code !== 0 || !res || !res.components) {
        log('STOPPED: cannot inspect existing virtual components: ' + String(message));
        return;
      }
      list = res.components;
      for (i = 0; i < list.length; i++) existingComponents.push(list[i]);
      total = typeof res.total === 'number' ? res.total : existingComponents.length;
      next = offset + list.length;
      if (next < total && list.length > 0) {
        Timer.set(100, false, function() { inspectComponents(next); });
        return;
      }
      used = 0;
      for (i = 0; i < existingComponents.length; i++) {
        key = existingComponents[i].key || '';
        kind = key.split(':')[0];
        if (kind === 'boolean' || kind === 'number' || kind === 'enum' ||
            kind === 'text' || kind === 'button' || kind === 'group') used++;
      }
      owned = 0;
      for (i = 0; i < POINTS.length; i++) {
        cfg = Shelly.getComponentConfig(POINTS[i][0], pointId(i));
        if (cfg && cfg.name !== pointName(i)) {
          log('STOPPED: ' + pointKey(i) + ' is owned by another script.');
          return;
        }
        if (cfg) owned++;
      }
      if (used + POINTS.length - owned > 10) {
        log('STOPPED: ' + (POINTS.length - owned) +
          ' additional VC slots needed; device limit is 10. Nothing was deleted.');
        return;
      }
      existingComponents = [];
      provisionNext(0);
    });
}

function startBridge() {
  var j, handle;
  for (j = 0; j < POINTS.length; j++) {
    handle = Virtual.getHandle(pointKey(j));
    if (!handle) { log('STOPPED: VC handle missing: ' + pointKey(j)); return; }
    VC[POINTS[j][1]] = handle;
  }
  put('online', false);
  fault('Waiting for Modbus');
  Shelly.call('Serial.GetConfig', {id:CLIENT_ID}, function(cfg, err) {
    if (err !== 0 || !cfg || cfg.mode !== 'mb_client' || !cfg.serial ||
        cfg.serial.baud !== EXPECTED_BAUD || cfg.serial.format !== '8N1') {
      log('Serial must be mb_client, ' + EXPECTED_BAUD + ' 8N1; configuration NOT changed');
      fault('Serial configuration mismatch');
      return;
    }
    initial = false;
    listen('power'); listen('target'); listen('mode'); listen('fan');
    active = true;
    log('Started READ-ONLY=' + String(!ENABLE_WRITES) + ', slave=' + SLAVE_ID);
    Timer.set(POLL_MS, true, readNext);
    readNext();
  });
}
function init() {
  if (VC_BASE < 200 || VC_BASE + POINTS.length - 1 > 299) {
    log('STOPPED: VC_BASE must leave nine IDs within 200..299');
    return;
  }
  if (typeof Virtual === 'undefined' || !Virtual.getHandle) {
    log('STOPPED: Virtual Components API unavailable on this firmware');
    return;
  }
  inspectComponents(0);
}
init();
