/**
 * @title Midea/Clivet R32 Modbus RTU bridge
 * @description Local zone-1, DHW and Silent Mode control with nine Virtual
 *   Components. Requires firmware 2.0.0+ and Shelly Pro Modbus Add-on.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Midea/midea-clivet-r32-pro-modbus-vc.shelly.js
 */

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Georgi Germanov and contributors
 *
 * Real-device validation: successful test confirmed by the contributor on
 * 2026-10-10. Compatibility remains limited to the documented R32 profile.
 *
 * Standalone adaptation of the LG THERMA V bridge in
 * drHouse-gif/lg-therma-v-shelly (upstream/lg-therma-v-pro-em50_vc.shelly.js).
 * The transport, read-before-write startup and readback pattern are retained;
 * the register map, bit-preserving writes and component provisioning differ.
 *
 * Profile: Midea R32 / 171H120F-compatible wired controllers, zone 1 under
 * leaving-water control. R290, SWAN-2 and room-control profiles are separate.
 * On the documented controller: H2 -> RS485 A+, H1 -> RS485 B-.
 * Follow the model manual for the signal reference and cable shield.
 *
 * Every read is FC03. Shared words 0, 2 and 5 use a fresh read-modify-write.
 * No force-heater, disinfection, installer-setting or mains-switching commands.
 * enableWrites defaults to false. Check the exact register map, then set
 * expectedControllerVersion to the word reported at address 131 before control.
 * hasDhwTank must match the installed tank/sensor; false skips its reads/writes.
 * allowCooling must match the commissioned system. Select the operating mode
 * on the original controller; Auto water-target writes are intentionally blocked.
 * Nine components, no groups: Boolean 220-222; Number 223-227; Text 228.
 * The base is adjustable. Other components are never deleted.
 * @see ./README.md
 */

// CONFIGURATION
var CONFIG = {
  profile: 'midea-r32-171h120f',
  serialId: 100,
  slaveId: 1, // Example only: use the address configured on the wired controller.
  baud: 9600,
  format: '8N1',
  enableWrites: false,
  expectedControllerVersion: null,
  hasDhwTank: false,
  allowCooling: false,
  waterMin: 20,
  waterMax: 60,
  coolingMin: 5,
  coolingMax: 25,
  dhwMin: 20,
  dhwMax: 60,
  writeFunction: 6, // 6: WriteSingleRegister; 16: one-word WriteHoldingRegisters.
  vcBase: 220,
  pollMs: 10000,
  retryMs: 10000,
  gapMs: 100,
  settleMs: 700
};

// Five controls followed by three temperatures and a status text.
var POINTS = [
  ['Boolean', 'Zone 1 Enable', 0, 0x0002],
  ['Boolean', 'DHW Enable', 0, 0x0004],
  ['Boolean', 'Silent Mode', 5, 0x0040],
  ['Number', 'Zone 1 Water Target', 2, 0x00ff],
  ['Number', 'DHW Target', 4, 0xffff],
  ['Number', 'Inlet Temperature', 104],
  ['Number', 'Outlet Temperature', 105],
  ['Number', 'Tank Temperature', 115],
  ['Text', 'Status', -1]
];
var READS = [[0, 6], [100, 2], [104, 2], [115, 1], [124, 1],
  [128, 1], [131, 1], [201, 4], [207, 2]];
var raw = {};
var actual = [];
var baseline = [];
var observed = [];
var ready = false;
var readIndex = 0;
var controlIndex = 0;
var publishIndex = 0;
var lastFault = '';
var lastVersion = null;
var lastNotice = '';
var components = [];

// HELPERS
function later(fn, ms) { Timer.set(typeof ms === 'number' ? ms : CONFIG.gapMs, false, fn); }
function log(message) { print('[Midea] ' + message); }
function isIntegerInRange(v, min, max) { return typeof v === 'number' && v >= min && v <= max && v === Math.floor(v); }
function isWord(v) { return isIntegerInRange(v, 0, 65535); }
function signed(v) { return v > 32767 ? v - 65536 : v; }
function same(a, b) { return typeof a === typeof b && a === b; }
function rpc(method, params, done) {
  Shelly.call(method, params, function(result, code, message) {
    later(function() { done(result, code, message); }, 1);
  });
}
function readWords(addr, qty, done) {
  rpc('MbRtuClient.ReadHoldingRegisters', {
    id: CONFIG.serialId, sid: CONFIG.slaveId, addr: addr, qty: qty
  }, function(result, code, message) {
    var i;
    if (code !== 0 || !result || !result.values || result.values.length !== qty) {
      done(null, 'FC03 @' + addr + ': ' + String(message)); return;
    }
    for (i = 0; i < qty; i++) {
      if (!isWord(result.values[i])) { done(null, 'Malformed word @' + (addr + i)); return; }
    }
    done(result.values, null);
  });
}
function pointId(i) { return CONFIG.vcBase + i; }
function pointKey(i) { return POINTS[i][0].toLowerCase() + ':' + pointId(i); }
function uiValue(i) {
  var status = Shelly.getComponentStatus(POINTS[i][0].toLowerCase(), pointId(i));
  return status ? status.value : undefined;
}
function validValue(i, value) {
  if (i < 3) return typeof value === 'boolean';
  if (i === 3) return isWord(value) && value >= 5 && value <= 75;
  if (i === 4) return isWord(value) && value >= 20 && value <= 75;
  if (i < 8) return typeof value === 'number' && value >= -50 && value <= 100;
  return typeof value === 'string';
}
function controlValue(i, word) {
  if (i < 3) return (word & POINTS[i][3]) !== 0;
  return word & POINTS[i][3];
}
function writesAllowed() {
  return CONFIG.enableWrites && isWord(CONFIG.expectedControllerVersion) &&
    raw[131] === CONFIG.expectedControllerVersion && (raw[0] & 1) === 0;
}
function liveStatus() {
  var operating = 'Unknown(' + raw[101] + ')';
  var value;
  if (raw[101] === 0) operating = 'Off';
  if (raw[101] === 2) operating = 'Cool';
  if (raw[101] === 3) operating = 'Heat';
  if (raw[101] === 5) operating = 'DHW';
  value = 'ONLINE | ' + (writesAllowed() ? 'CONTROL' : 'READ ONLY') +
    ' | ' + operating + ' | Hz=' + raw[100] + ' | fault=' + raw[124] + ' | controller=' + raw[131];
  if ((raw[128] & 2) !== 0) value += ' | DEFROST';
  if ((raw[0] & 1) !== 0) value += ' | ROOM CONTROL';
  if (CONFIG.expectedControllerVersion !== null && raw[131] !== CONFIG.expectedControllerVersion) value += ' | VERSION MISMATCH';
  if (!CONFIG.hasDhwTank) value += ' | DHW NOT CONFIGURED';
  if (lastNotice !== '') value += ' | ' + lastNotice;
  return value.slice(0, 250);
}
function fault(message) {
  ready = false; baseline = []; observed = []; actual = [];
  if (lastFault !== message) log('PAUSED: ' + message + '. Commands blocked; resynchronizing.');
  lastFault = message;
  rpc('Text.Set', { id: pointId(8), value: ('OFFLINE | last readings stale | ' + message).slice(0, 250) }, function() {
    later(begin, CONFIG.retryMs);
  });
}
function configurationError() {
  if (CONFIG.profile !== 'midea-r32-171h120f') return 'Unsupported profile';
  if (!isWord(CONFIG.serialId) || !isWord(CONFIG.slaveId) || CONFIG.slaveId < 1 || CONFIG.slaveId > 247) return 'Invalid serialId/slaveId';
  if (!isWord(CONFIG.vcBase) || CONFIG.vcBase < 200 || CONFIG.vcBase > 291) return 'vcBase must be 200..291';
  if (CONFIG.expectedControllerVersion !== null && !isWord(CONFIG.expectedControllerVersion)) return 'Invalid expectedControllerVersion';
  if (typeof CONFIG.enableWrites !== 'boolean' || typeof CONFIG.hasDhwTank !== 'boolean' || typeof CONFIG.allowCooling !== 'boolean') return 'Feature flags must be Boolean';
  if (CONFIG.writeFunction !== 6 && CONFIG.writeFunction !== 16) return 'writeFunction must be 6 or 16';
  if (!isIntegerInRange(CONFIG.baud, 1200, 115200)) return 'Invalid baud rate';
  if (CONFIG.format !== '8N1' && CONFIG.format !== '8N2' && CONFIG.format !== '8E1' && CONFIG.format !== '8O1') return 'Invalid serial format';
  if (!isIntegerInRange(CONFIG.pollMs, 1000, 600000) || !isIntegerInRange(CONFIG.retryMs, 1000, 600000) || !isIntegerInRange(CONFIG.gapMs, 20, 5000) || !isIntegerInRange(CONFIG.settleMs, 100, 10000)) return 'Invalid timing values';
  if (!isWord(CONFIG.waterMin) || !isWord(CONFIG.waterMax) || CONFIG.waterMin < 5 || CONFIG.waterMax > 75 || CONFIG.waterMin > CONFIG.waterMax) return 'Invalid heating limits';
  if (!isWord(CONFIG.coolingMin) || !isWord(CONFIG.coolingMax) || CONFIG.coolingMin < 5 || CONFIG.coolingMax > 25 || CONFIG.coolingMin > CONFIG.coolingMax) return 'Invalid cooling limits';
  if (!isWord(CONFIG.dhwMin) || !isWord(CONFIG.dhwMax) || CONFIG.dhwMin < 20 || CONFIG.dhwMax > 75 || CONFIG.dhwMin > CONFIG.dhwMax) return 'Invalid DHW limits';
  return null;
}

// NON-DESTRUCTIVE VIRTUAL COMPONENT PROVISIONING
function desiredConfig(i) {
  var cfg = { name: 'Midea/Clivet ' + POINTS[i][1], persisted: false,
    meta: { ui: { view: 'label' } } };
  var interactive = CONFIG.enableWrites;
  if (i < 3) {
    cfg.default_value = false;
    cfg.meta.ui.titles = ['Off', 'On'];
    if (interactive && (i !== 1 || CONFIG.hasDhwTank)) cfg.meta.ui.view = 'toggle';
  } else if (i < 8) {
    cfg.default_value = i === 3 ? 35 : i === 4 ? 50 : 0;
    cfg.min = i === 3 ? 5 : i === 4 ? 20 : -50;
    cfg.max = i < 5 ? 75 : 100;
    cfg.meta.ui.unit = 'C'; cfg.meta.ui.step = 1;
    if (interactive && (i === 3 || (i === 4 && CONFIG.hasDhwTank))) cfg.meta.ui.view = 'field';
  } else {
    cfg.default_value = 'STARTING | awaiting physical readings'; cfg.max_len = 255;
  }
  return cfg;
}
function provisionNext(i) {
  var cfg, existing;
  if (i === POINTS.length) { later(begin, 1); return; }
  cfg = desiredConfig(i);
  existing = Shelly.getComponentConfig(POINTS[i][0].toLowerCase(), pointId(i));
  if (existing && existing.name !== cfg.name) {
    log('STOPPED: ' + pointKey(i) + ' belongs to another component. Change vcBase.'); return;
  }
  if (existing) {
    rpc(POINTS[i][0] + '.SetConfig', { id: pointId(i), config: cfg }, function(result, code, message) {
      if (code !== 0) { log('Component setup failed: ' + pointKey(i) + ': ' + message); return; }
      later(function() { provisionNext(i + 1); });
    });
  } else {
    rpc('Virtual.Add', { type: POINTS[i][0].toLowerCase(), id: pointId(i), config: cfg }, function(result, code, message) {
      if (code !== 0) { log('Component creation failed: ' + pointKey(i) + ': ' + message); return; }
      later(function() { provisionNext(i + 1); });
    });
  }
}
function inspectComponents(offset) {
  rpc('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(result, code, message) {
    var list, i, total, owned = 0, virtualCount = 0, key, kind, cfg;
    if (code !== 0 || !result || !result.components) { log('Cannot inspect components: ' + message); return; }
    list = result.components;
    for (i = 0; i < list.length; i++) components.push(list[i]);
    total = typeof result.total === 'number' ? result.total : components.length;
    if (offset + list.length < total && list.length > 0) {
      later(function() { inspectComponents(offset + list.length); }); return;
    }
    for (i = 0; i < components.length; i++) {
      key = components[i].key || ''; kind = key.split(':')[0];
      if (kind === 'boolean' || kind === 'number' || kind === 'enum' || kind === 'text' || kind === 'button' || kind === 'group') virtualCount++;
    }
    for (i = 0; i < POINTS.length; i++) {
      cfg = Shelly.getComponentConfig(POINTS[i][0].toLowerCase(), pointId(i));
      if (cfg && cfg.name !== desiredConfig(i).name) { log('STOPPED: ID conflict at ' + pointKey(i)); return; }
      if (cfg) owned++;
    }
    if (virtualCount + POINTS.length - owned > 10) {
      log('STOPPED: nine free/reusable Virtual Component slots are required. No components were deleted.'); return;
    }
    components = []; later(function() { provisionNext(0); });
  });
}

// SERIAL CONFIGURATION AND PHYSICAL READS
function begin() {
  var i;
  for (i = 0; i < POINTS.length; i++) {
    if (!Shelly.getComponentConfig(POINTS[i][0].toLowerCase(), pointId(i))) { fault('Missing ' + pointKey(i)); return; }
  }
  rpc('Serial.GetConfig', { id: CONFIG.serialId }, function(result, code, message) {
    if (code !== 0 || !result) { fault('Serial configuration: ' + message); return; }
    if (result.mode === 'mb_client' && result.serial && result.serial.baud === CONFIG.baud && result.serial.format === CONFIG.format) {
      startRead(); return;
    }
    ready = false;
    rpc('Serial.SetConfig', { id: CONFIG.serialId, config: {
      mode: 'mb_client', serial: { baud: CONFIG.baud, format: CONFIG.format }
    } }, function(response, error, text) {
      if (error !== 0) { fault('Serial setup: ' + text); return; }
      if (response && response.restart_required) { fault('Shelly reboot required'); return; }
      later(startRead, 500);
    });
  });
}
function startRead() { raw = {}; actual = []; readIndex = 0; later(readNext); }
function readNext() {
  var query, i;
  if (readIndex === READS.length) { decodeCycle(); return; }
  query = READS[readIndex++];
  if (!CONFIG.hasDhwTank && (query[0] === 115 || query[0] === 207)) { later(readNext, 1); return; }
  readWords(query[0], query[1], function(words, error) {
    if (error !== null) { fault(error); return; }
    for (i = 0; i < words.length; i++) raw[query[0] + i] = words[i];
    later(readNext);
  });
}
function decodeCycle() {
  var i;
  for (i = 0; i < 5; i++) actual[i] = controlValue(i, raw[POINTS[i][2]]);
  actual[5] = signed(raw[104]); actual[6] = signed(raw[105]);
  if (CONFIG.hasDhwTank) actual[7] = signed(raw[115]);
  if (raw[1] !== 1 && raw[1] !== 2 && raw[1] !== 3) { fault('Unexpected configured mode at register 1'); return; }
  for (i = 0; i < 8; i++) {
    if ((!CONFIG.hasDhwTank && i === 7)) continue;
    if (!validValue(i, actual[i])) { fault('Unexpected physical value: ' + POINTS[i][1]); return; }
  }
  if (lastVersion !== raw[131]) { lastVersion = raw[131]; log('Controller version (register 131) = ' + lastVersion); }
  observed = [];
  for (i = 0; i < 5; i++) {
    observed[i] = uiValue(i);
    if (!validValue(i, observed[i])) { fault('Invalid/missing UI control: ' + POINTS[i][1]); return; }
  }
  lastNotice = ''; controlIndex = 0; publishIndex = 0;
  later(ready ? controlNext : publishNext);
}

// FRESH READ-MODIFY-WRITE WITH PER-COMMAND READBACK
function commandError(i, requested) {
  var low, high, factoryLow, factoryHigh, currentMode = raw[1];
  if (!writesAllowed()) return 'WRITES BLOCKED';
  if (raw[124] !== 0) return 'ACTIVE FAULT';
  if ((i === 1 || i === 4) && !CONFIG.hasDhwTank) return 'DHW NOT CONFIGURED';
  if (i === 0 && requested && currentMode !== 3 && !CONFIG.allowCooling) return 'SELECT HEAT BEFORE ENABLING ZONE 1';
  if (i === 3) {
    if ((raw[5] & 0x1000) !== 0) return 'WEATHER CURVE ACTIVE';
    if (currentMode === 2) {
      if (!CONFIG.allowCooling) return 'COOLING DISABLED';
      low = CONFIG.coolingMin; high = CONFIG.coolingMax;
      factoryLow = raw[202] & 0xff; factoryHigh = raw[201] & 0xff;
    } else if (currentMode === 3) {
      low = CONFIG.waterMin; high = CONFIG.waterMax;
      factoryLow = raw[204] & 0xff; factoryHigh = raw[203] & 0xff;
    } else return 'SELECT HEAT/COOL FOR WATER TARGET';
  } else if (i === 4) {
    low = CONFIG.dhwMin; high = CONFIG.dhwMax;
    factoryLow = raw[208]; factoryHigh = raw[207];
  } else return null;
  if (!isWord(factoryLow) || !isWord(factoryHigh) || factoryLow < 5 || factoryHigh > 75 || factoryLow > factoryHigh) return 'INVALID CONTROLLER LIMITS';
  low = Math.max(low, factoryLow); high = Math.min(high, factoryHigh);
  if (requested < low || requested > high) return 'TARGET OUTSIDE ' + low + '..' + high + ' C';
  return null;
}
function mergeWord(i, original, requested) {
  var mask = POINTS[i][3];
  var encoded = i < 3 ? (requested ? mask : 0) : requested;
  return ((original & (0xffff ^ mask)) | (encoded & mask)) & 0xffff;
}
function applyReadback(addr, word) {
  var i;
  raw[addr] = word;
  for (i = 0; i < 5; i++) if (POINTS[i][2] === addr) actual[i] = controlValue(i, word);
}
function refreshCommandGuards(i, done) {
  var queries = [[0, 6], [124, 1]];
  var index = 0;
  if (i === 3) queries.push([201, 4]);
  if (i === 4) queries.push([207, 2]);
  function nextGuard() {
    var query, j;
    if (index === queries.length) { done(null); return; }
    query = queries[index++];
    readWords(query[0], query[1], function(words, error) {
      if (error !== null) { done(error); return; }
      for (j = 0; j < words.length; j++) {
        raw[query[0] + j] = words[j];
        if (query[0] === 0) applyReadback(j, words[j]);
      }
      later(nextGuard);
    });
  }
  later(nextGuard);
}
function controlNext() {
  var i, requested, error, addr;
  if (controlIndex === 5) { later(publishNext); return; }
  i = controlIndex++; requested = uiValue(i); observed[i] = requested;
  if (!validValue(i, requested)) { fault('Invalid command: ' + POINTS[i][1]); return; }
  if (same(requested, baseline[i]) || same(requested, actual[i])) { later(controlNext); return; }
  error = commandError(i, requested);
  if (error !== null) { lastNotice = error; log('REJECTED ' + POINTS[i][1] + ': ' + error); later(controlNext); return; }
  addr = POINTS[i][2];
  refreshCommandGuards(i, function(guardError) {
    if (guardError !== null) { fault(guardError); return; }
    readWords(addr, 1, function(words, readError) {
      var original, value, params, method;
      if (readError !== null) { fault(readError); return; }
      original = words[0]; applyReadback(addr, original);
      // Do not act on a command replaced by the user during the preparatory read.
      if (!same(uiValue(i), requested)) { later(controlNext); return; }
      error = commandError(i, requested);
      if (error !== null) { lastNotice = error; later(controlNext); return; }
      value = mergeWord(i, original, requested);
      if (value === original) { later(controlNext); return; }
      params = { id: CONFIG.serialId, sid: CONFIG.slaveId, addr: addr };
      method = CONFIG.writeFunction === 6 ? 'WriteSingleRegister' : 'WriteHoldingRegisters';
      if (CONFIG.writeFunction === 6) params.value = value; else params.values = [value];
      rpc('MbRtuClient.' + method, params, function(result, code, message) {
        if (code !== 0) { fault('Unconfirmed write @' + addr + ': ' + message); return; }
        later(function() {
          readWords(addr, 1, function(back, backError) {
            var accepted;
            if (backError !== null) { fault('Readback: ' + backError); return; }
            applyReadback(addr, back[0]); accepted = controlValue(i, back[0]);
            if (!validValue(i, accepted)) { fault('Invalid readback: ' + POINTS[i][1]); return; }
            if (same(accepted, requested)) log('CONFIRMED ' + POINTS[i][1] + ' = ' + accepted);
            else { lastNotice = 'COMMAND NOT CONFIRMED'; log('NOT CONFIRMED ' + POINTS[i][1] + ': requested ' + requested + ', reported ' + accepted); }
            later(controlNext);
          });
        }, CONFIG.settleMs);
      });
    });
  });
}

// PHYSICAL STATE -> UI; STARTUP/OFFLINE VALUES NEVER BECOME COMMANDS
function publishNext() {
  var i, current, j;
  if (publishIndex === POINTS.length) {
    if (!ready) {
      for (j = 0; j < 5; j++) {
        if (!same(uiValue(j), actual[j])) { fault('UI changed during initial synchronization'); return; }
      }
      ready = true; log('READY: 9 components synchronized; ' + (writesAllowed() ? 'control enabled' : 'read-only mode'));
    }
    lastFault = ''; later(begin, CONFIG.pollMs); return;
  }
  i = publishIndex++;
  if (!CONFIG.hasDhwTank && i === 7) { later(publishNext, 1); return; }
  if (i === 8) actual[i] = liveStatus();
  current = uiValue(i);
  if (ready && i < 5 && !same(current, observed[i])) { later(publishNext, 1); return; }
  if (same(current, actual[i])) {
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1); return;
  }
  rpc(POINTS[i][0] + '.Set', { id: pointId(i), value: actual[i] }, function(result, code, message) {
    if (code !== 0) { fault('UI update ' + POINTS[i][1] + ': ' + message); return; }
    if (i < 5) baseline[i] = actual[i]; later(publishNext, 1);
  });
}

// INITIALIZATION
var configError = configurationError();
if (configError !== null) log('STOPPED: ' + configError);
else {
  log('R32 profile; RTU ' + CONFIG.baud + ' ' + CONFIG.format + '; server ' + CONFIG.slaveId);
  if (CONFIG.enableWrites && CONFIG.expectedControllerVersion === null) log('Set expectedControllerVersion after reading register 131; writes remain blocked.');
  later(function() { inspectComponents(0); }, 1);
}
