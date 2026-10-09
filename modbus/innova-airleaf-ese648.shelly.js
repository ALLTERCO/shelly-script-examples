/* @meta {"vc":{"power":{"type":"boolean","config":{"name":"INNOVA Power","default_value":false}},"room":{"type":"number","config":{"name":"Room temperature","min":0,"max":100,"default_value":0}},"target":{"type":"number","config":{"name":"Target temperature","min":5,"max":40,"default_value":20}},"mode":{"type":"enum","config":{"name":"Operating mode","options":["auto","heating","cooling","unknown"],"default_value":"unknown"}},"fan":{"type":"enum","config":{"name":"Fan mode","options":["auto","silent","night","maximum","unknown"],"default_value":"unknown"}},"aux":{"type":"number","config":{"name":"Actual setpoint","min":0,"max":100,"default_value":0}},"motor":{"type":"number","config":{"name":"Raw program flags","min":0,"max":65535,"default_value":0}},"alarm":{"type":"text","config":{"name":"Modbus diagnostics","default_value":"Starting"}},"online":{"type":"boolean","config":{"name":"Modbus online","default_value":false}}}} */
/**
 * @title INNOVA AirLeaf ESE648 Modbus RTU
 * @description Read-only by default; nine managed VCs for documented N273025C controllers.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/innova-airleaf-ese648.shelly.js
 */
/**
 * SPDX-License-Identifier: Apache-2.0
 * Hardware: The Pill + Modbus RS485 add-on; 9600 8N1 expected, verify on controller.
 * Modbus FC03/FC06, zero-based address notation, slave ID configurable below.
 * Managed VCs use @meta as first line, <=1024 chars, and Script.getVcHandle(role).
 * Nine roles: power, room, target, mode, fan, aux, motor, alarm, online.
 * power/target/mode/fan are commands ONLY when ENABLE_WRITES=true after commissioning.
 * Safety: read-only by default; no serial auto-configuration; no output on boot.
 * Auxiliary readings vary with controller profile, see README.
 */
var SLAVE_ID = 1;
var CLIENT_ID = 0;
var ENABLE_WRITES = false;
var POLL_MS = 3500;
var EXPECTED_BAUD = 9600;
var PROFILE = 'ese648';
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
function init() {
  var roles = ['power','room','target','mode','fan','aux','motor','alarm','online'];
  var j;
  for (j=0; j<roles.length; j++) {
    VC[roles[j]] = Script.getVcHandle(roles[j]);
    if (!VC[roles[j]]) { log('Managed VC missing: ' + roles[j]); return; }
  }
  put('online', false);
  fault('Waiting for Modbus');
  Shelly.call('Serial.GetConfig', {id:CLIENT_ID}, function(cfg, err) {
    if (err !== 0 || !cfg || cfg.mode !== 'mb_client' || !cfg.serial ||
        cfg.serial.baud !== EXPECTED_BAUD || cfg.serial.format !== '8N1') {
      log('Serial must be mb_client, 9600 8N1; configuration NOT changed');
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
init();
