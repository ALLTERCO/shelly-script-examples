/**
 * @title SDS011 virtual components cycle reader
 * @description Cycled UART reader for SDS011 PM2.5/PM10 values with Virtual
 *   Component updates and wake/sleep duty cycle control.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/SDS011/sds011-vc-cycle.shelly.js
 */

/**
 * Nova Fitness SDS011 PM2.5/PM10 sensor with Virtual Components
 *
 * Reads SDS011 frames over UART, filters out invalid or sudden-spike values,
 * averages samples in a collection window, and writes results to Virtual
 * Components.
 *
 * Hardware connection:
 * - SDS011 TX (Pin 7) -> Shelly RX (GPIO)
 * - SDS011 RX (Pin 6) -> Shelly TX (GPIO)
 * - VCC (Pin 3) -> 5V
 * - GND (Pin 5) -> GND
 *
 * Script-owned Virtual Components:
 * - number:200  PM2.5 value (ug/m3)
 * - number:201  PM10 value (ug/m3)
 * - text:200    Last report timestamp
 * - text:201    Runtime status
 * - enum:200    Air quality category
 * - boolean:200 Power control (on/off)
 *
 * The script creates, verifies, and binds these components at startup.
 */


// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================
//
// Usage:
//
// var VIRTUAL_COMPONENTS = {
//   components: [
//     {
//       key: "soc",
//       type: "number",
//       id: 200, // optional; when omitted the helper creates the next free one
//       config: {
//         name: "Battery SOC",
//         min: 0,
//         max: 100,
//         unit: "%",
//         meta: { ui: { view: "progressbar" }, cloud: ["measurement"] }
//       }
//     },
//     {
//       key: "status",
//       type: "text",
//       config: {
//         name: "Status",
//         default_value: "",
//         persisted: false,
//         meta: { ui: { view: "label", maxLength: 255 }, cloud: ["log"] }
//       }
//     }
//   ],
//   groups: [
//     { id: 200, name: "Battery", components: ["soc", "status"] }
//   ]
// };
//
// ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, vc) {
//   if (!ok) {
//     print("Virtual Component setup failed");
//     return;
//   }
//
//   vc.handles.soc.setValue(73);
//   vc.handles.status.setValue("ready");
// });
//
// Notes:
// - `key` is only the logical name inside your script.
// - `type` is a Shelly dynamic component type: number, boolean, text, enum,
//   button, group.
// - For fixed IDs, the helper checks whether the existing component config
//   matches. If not, it deletes and recreates it.
// - Without fixed IDs, the helper searches by type + config.name. If a matching
//   component exists and fits the config, it reuses it. If not, it creates a new
//   component and stores the assigned id.
// - The callback receives `vc.ids[key]`, `vc.keys[key]`, and `vc.handles[key]`.
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print("[VC] " + msg);
  }

  function componentKey(type, id) {
    return type + ":" + String(id);
  }


  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === "meta") {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === "object" && desired[k] !== null) {
        if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
      } else if (desired[k] !== current[k]) {
        return false;
      }
    }

    return true;
  }

  function normalizeComponent(spec) {
    if (!spec.config) spec.config = {};
    if (!spec.config.name) spec.config.name = spec.key;
    return spec;
  }

  function findExistingByName(type, name) {
    var i;
    var c;
    for (i = 0; i < state.existing.length; i++) {
      c = state.existing[i];
      if (c.type === type && c.name === name) return c;
    }
    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state.ids[spec.key] = id;
    state.keys[spec.key] = key;
    state.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call("Virtual.Delete", { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log("Virtual.Delete skipped for " + key + ": " + String(errCode) + " " + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call("Virtual.Add", params, function(res, errCode, errMsg) {
      var id;

      if (errCode !== 0) {
        log("Virtual.Add failed for " + spec.key + ": " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log("Virtual.Add did not return id for " + spec.key);
        state.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log("Created " + state.keys[spec.key] + " " + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() { cb(true); });
    });
  }

  function ensureOne(spec, cb) {
    var current;
    var existing;
    var key;

    spec = normalizeComponent(spec);

    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);

      if (current) {
        if (shallowConfigMatches(spec.config, current)) {
          remember(spec, spec.id);
          cb(true);
          return;
        }

        log("Recreating mismatched " + key + " " + spec.config.name);
        deleteComponent(key, function() { addComponent(spec, cb); });
        return;
      }

      addComponent(spec, cb);
      return;
    }

    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) {
      remember(spec, existing.id);
      cb(true);
      return;
    }

    if (existing) {
      log("Existing " + existing.key + " does not fit " + spec.config.name + "; creating a new one");
    }
    addComponent(spec, cb);
  }

  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) {
      cb();
      return;
    }

    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        ensureList(index + 1, cb);
      });
    });
  }

  function createGroupConfig(name) {
    return { name: name, meta: { ui: { view: "group" } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state.keys[logicalKey]) members.push(state.keys[logicalKey]);
    }

    return members;
  }

  function ensureGroup(index, cb) {
    var groups = manifest.groups || [];
    var group;
    var cfg;
    var current;
    var key;

    if (index >= groups.length) {
      cb();
      return;
    }

    group = groups[index];
    cfg = createGroupConfig(group.name);
    key = componentKey("group", group.id);
    current = getConfig("group", group.id);

    function setMembersAndContinue() {
      Shelly.call("Group.Set", { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Group.Set failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    function addGroup() {
      Shelly.call("Virtual.Add", { type: "group", id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log("Virtual.Add group failed for " + key + ": " + String(errCode) + " " + String(errMsg));
          state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() { ensureGroup(index + 1, cb); });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log("Shelly.GetComponents failed: " + String(errCode) + " " + String(errMsg));
        state.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || "").split(":");
        state.existing.push({
          key: c.key || componentKey(c.type || keyParts[0], cfg.id),
          type: c.type || keyParts[0],
          id: cfg.id,
          name: cfg.name,
          config: cfg
        });
      }

      if (offset + raw.length < total && raw.length > 0) {
        readExistingPage(offset + raw.length, cb);
      } else {
        cb();
      }
    });
  }

  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() {
        done(state.ok, {
          ids: state.ids,
          keys: state.keys,
          handles: state.handles
        });
      });
    });
  });
}


// ============================================================================
// CONFIGURATION
// ============================================================================

const BAUD = 9600;

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'pm25',
      type: 'number',
      id: 200,
      config: {
        name: 'PM2.5 value',
        default_value: 0,
        min: 0,
        max: 1000,
        meta: { ui: { view: 'label', unit: 'ug/m3', step: 0.1 }, cloud: ['measurement'] }
      }
    },
    {
      key: 'pm10',
      type: 'number',
      id: 201,
      config: {
        name: 'PM10 value',
        default_value: 0,
        min: 0,
        max: 1000,
        meta: { ui: { view: 'label', unit: 'ug/m3', step: 0.1 }, cloud: ['measurement'] }
      }
    },
    {
      key: 'lastReport',
      type: 'text',
      id: 200,
      config: {
        name: 'Last report timestamp',
        default_value: '',
        persisted: false,
        meta: { ui: { view: 'label', maxLength: 64 }, cloud: ['log'] }
      }
    },
    {
      key: 'stateReport',
      type: 'text',
      id: 201,
      config: {
        name: 'Runtime status',
        default_value: '',
        persisted: false,
        meta: { ui: { view: 'label', maxLength: 160 }, cloud: ['log'] }
      }
    },
    {
      key: 'airQuality',
      type: 'enum',
      id: 200,
      config: {
        name: 'Air quality category',
        options: ['n_a', 'good', 'moderate', 'poor', 'unhealthy', 'hazardous'],
        default_value: 'n_a',
        meta: {
          ui: {
            view: 'label',
            titles: {
              n_a: 'n/a',
              good: 'good',
              moderate: 'moderate',
              poor: 'poor',
              unhealthy: 'unhealthy',
              hazardous: 'hazardous'
            }
          },
          cloud: ['log']
        }
      }
    },
    {
      key: 'power',
      type: 'boolean',
      id: 200,
      config: {
        name: 'Power control',
        default_value: false,
        persisted: true,
        meta: { ui: { view: 'toggle', titles: ['off', 'on'] }, cloud: ['log'] }
      }
    }
  ]
};

var vc = null;

const WARMUP_SEC = 30;
const SAMPLE_SEC = 30;
const SLEEP_SEC = 15 * 60;
const MIN_SAMPLES = 10;

const HEADER_BYTE = 0xaa;
const TAIL_BYTE = 0xab;
const FRAME_LEN = 10;
const BUF_MAX_FRAMES = 50;
const BUF_MAX_LEN = FRAME_LEN * BUF_MAX_FRAMES;
const DATA_FRAME_TYPE = 0xc0;
const CMD_ACK_TYPE = 0xc5;
const CMD_FRAME_TYPE = 0xb4;
const CMD_SET_SLEEP = 0x06;
const CMD_SET_MODE = 0x02;
const SET_FLAG = 0x01;
const WAKEUP_ON = 0x01;
const WAKEUP_OFF = 0x00;
const MODE_ACTIVE = 0x00;

const MAX_PM25 = 1000;
const MAX_PM10 = 1000;
const FRAME_MAX_DELTA_PM25 = 100;
const FRAME_MAX_DELTA_PM10 = 200;

// ============================================================================
// STATE
// ============================================================================

const uart = UART.get();

let power = false;
let buf = '';
let collecting = false;
let sum25 = 0;
let sum10 = 0;
let cnt = 0;
let rxBytes = 0;
let lastFramePm25 = null;
let lastFramePm10 = null;

const timers = {
  start: null,
  wakeup: null,
  warmup: null,
  stop: null,
  next: null
};

// ============================================================================
// HELPERS
// ============================================================================

function getVcHandle(key) {
  if (!vc || !vc.handles) {
    return null;
  }
  return vc.handles[key] || null;
}

function setValue(key, value) {
  var handle = getVcHandle(key);
  if (handle) {
    handle.setValue(value);
  }
}

function setStatus(status) {
  setValue('stateReport', status);
}

function ts() {
  return new Date().toString().split('GMT')[0].trim();
}

function byteAt(s, i) {
  return s.charCodeAt(i) & 0xff;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function resetStats() {
  sum25 = 0;
  sum10 = 0;
  cnt = 0;
  lastFramePm25 = null;
  lastFramePm10 = null;
}

function resetBuffer() {
  buf = '';
}

function resetRxBytes() {
  rxBytes = 0;
}

function reset() {
  resetStats();
  resetBuffer();
  resetRxBytes();
}

function setAirQuality(pm25) {
  let key = 'n_a';
  if (pm25 === undefined || pm25 < 0) {
    key = 'n_a';
  } else if (pm25 <= 10) {
    key = 'good';
  } else if (pm25 <= 35) {
    key = 'moderate';
  } else if (pm25 <= 55) {
    key = 'poor';
  } else if (pm25 <= 150) {
    key = 'unhealthy';
  } else {
    key = 'hazardous';
  }

  setValue('airQuality', key);
}

function clearTimer(id) {
  if (id !== undefined && id !== null) {
    Timer.clear(id);
  }
}

function clearAllTimers() {
  for (const k in timers) {
    clearTimer(timers[k]);
    timers[k] = null;
  }
}

function schedule(key, ms, fn) {
  if (!(key in timers)) {
    return;
  }

  clearTimer(timers[key]);
  timers[key] = Timer.set(ms, false, fn);
}

function clampDelta(v, last, maxDelta) {
  if (last === null || last === undefined) {
    return v;
  }
  if (v > last + maxDelta) {
    return last + maxDelta;
  }
  if (v < last - maxDelta) {
    return last - maxDelta;
  }
  return v;
}

function isFiniteNumber(n) {
  return typeof n === 'number' && isFinite(n);
}

function findHeaderIndex(s) {
  for (let i = 0; i < s.length; i++) {
    if (byteAt(s, i) === HEADER_BYTE) {
      return i;
    }
  }
  return -1;
}

function beginCollecting() {
  reset();
  collecting = true;
  setStatus('Collecting for ' + SAMPLE_SEC + ' sec.');
}

// ============================================================================
// SDS011 COMMANDS
// ============================================================================

function bytesToStr(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xff);
  }
  return s;
}

function sumLow8(bytes, from, to) {
  let s = 0;
  for (let i = from; i <= to; i++) {
    s = (s + (bytes[i] & 0xff)) & 0xff;
  }
  return s & 0xff;
}

function buildCmd(cmd, setFlag, value) {
  const b = [HEADER_BYTE, CMD_FRAME_TYPE, cmd & 0xff, setFlag & 0xff, value & 0xff, 0x00];
  for (let i = 0; i < 9; i++) {
    b.push(0x00);
  }
  b.push(0xff, 0xff);
  b.push(sumLow8(b, 2, 16));
  b.push(TAIL_BYTE);
  return b;
}

function sendCmd(cmd, setFlag, value) {
  uart.write(bytesToStr(buildCmd(cmd, setFlag, value)));
}

function cmdWake() {
  sendCmd(CMD_SET_SLEEP, SET_FLAG, WAKEUP_ON);
}

function cmdSleep() {
  sendCmd(CMD_SET_SLEEP, SET_FLAG, WAKEUP_OFF);
}

function cmdActive() {
  sendCmd(CMD_SET_MODE, SET_FLAG, MODE_ACTIVE);
}

// ============================================================================
// SDS011 FRAME PARSING
// ============================================================================

function checkSum10(frame) {
  let sum = 0;
  for (let i = 2; i <= 7; i++) {
    sum = (sum + byteAt(frame, i)) & 0xff;
  }
  return sum === byteAt(frame, 8);
}

function parseFrame(frame) {
  if (
    frame.length !== FRAME_LEN ||
    byteAt(frame, 0) !== HEADER_BYTE ||
    byteAt(frame, 1) !== DATA_FRAME_TYPE ||
    byteAt(frame, 9) !== TAIL_BYTE ||
    !checkSum10(frame)
  ) {
    return null;
  }

  const pm25 = (((byteAt(frame, 3) << 8) | byteAt(frame, 2)) & 0xffff) / 10.0;
  const pm10 = (((byteAt(frame, 5) << 8) | byteAt(frame, 4)) & 0xffff) / 10.0;
  return { pm25: pm25, pm10: pm10 };
}

function isValidReading(p) {
  if (!p) {
    return false;
  }
  if (!isFiniteNumber(p.pm25) || !isFiniteNumber(p.pm10)) {
    return false;
  }
  if (p.pm25 < 0 || p.pm10 < 0 || p.pm25 > MAX_PM25 || p.pm10 > MAX_PM10) {
    return false;
  }
  return true;
}

function collectDataFrame(frame) {
  if (!collecting) {
    return;
  }

  const p = parseFrame(frame);
  if (!p) {
    return;
  }

  p.pm25 = clampDelta(p.pm25, lastFramePm25, FRAME_MAX_DELTA_PM25);
  p.pm10 = clampDelta(p.pm10, lastFramePm10, FRAME_MAX_DELTA_PM10);
  if (isValidReading(p)) {
    sum25 += p.pm25;
    sum10 += p.pm10;
    cnt++;
    lastFramePm25 = p.pm25;
    lastFramePm10 = p.pm10;
  }
}

function scanFrames() {
  while (buf.length >= FRAME_LEN) {
    const start = findHeaderIndex(buf);
    if (start < 0) {
      buf = '';
      return;
    }

    if (start > 0) {
      buf = buf.slice(start);
    }
    if (buf.length < FRAME_LEN) {
      return;
    }

    const frame = buf.slice(0, FRAME_LEN);
    const type = byteAt(frame, 1);
    buf = buf.slice(FRAME_LEN);

    if (type === CMD_ACK_TYPE) {
      continue;
    }
    if (type === DATA_FRAME_TYPE) {
      collectDataFrame(frame);
      continue;
    }

    buf = frame.slice(1) + buf;
  }
}

// ============================================================================
// CYCLE CONTROL
// ============================================================================

function startCycle() {
  if (!power) {
    return;
  }

  clearAllTimers();
  collecting = false;
  reset();

  cmdActive();
  cmdWake();
  schedule('wakeup', 500, cmdWake);
  setStatus('Warmup for ' + WARMUP_SEC + ' sec.');
  schedule('warmup', WARMUP_SEC * 1000, beginCollecting);
  schedule('stop', (WARMUP_SEC + SAMPLE_SEC) * 1000, finishCycle);
}

function finishCycle() {
  scanFrames();
  collecting = false;

  const sleepMin = Math.floor(SLEEP_SEC / 60);
  if (cnt >= MIN_SAMPLES) {
    const pm25 = round1(sum25 / cnt);
    setValue('pm25', pm25);
    setValue('pm10', round1(sum10 / cnt));
    setValue('lastReport', ts());
    setAirQuality(pm25);
    setStatus('Sleeping for ' + sleepMin + ' min.');
  } else {
    let error = 'No samples collected. ';
    if (cnt === 0 && rxBytes === 0) {
      error = 'No data received from sensor. ';
    }
    setStatus(error + 'Sleeping for ' + sleepMin + ' min.');
  }

  cmdSleep();
  reset();
  schedule('next', Math.max(1, SLEEP_SEC) * 1000, startCycle);
}

function applyPowerState(isOn) {
  power = !!isOn;
  clearAllTimers();

  if (power) {
    setStatus('Power ON. Starting cycle...');
    schedule('start', 300, startCycle);
    return;
  }

  collecting = false;
  reset();
  cmdSleep();
  setAirQuality(-1);
  setStatus('Power OFF. Sleeping.');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!uart || !uart.configure({ baud: BAUD, mode: '8N1' })) {
    setStatus('Unable to configure UART @ ' + BAUD);
    die();
  }

  uart.recv(function(data) {
    if (!power || !data || !data.length) {
      return;
    }

    rxBytes += data.length;
    buf += data;

    if (buf.length > BUF_MAX_LEN) {
      buf = buf.slice(buf.length - BUF_MAX_LEN);
    }

    scanFrames();
  });

  var powerHandle = getVcHandle('power');

  if (powerHandle) {
    powerHandle.on('change', function() {
      applyPowerState(!!powerHandle.getValue());
    });

    // Start on boot only when Power is enabled.
    applyPowerState(!!powerHandle.getValue());
    return;
  }

  applyPowerState(true);
}

ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
  if (!ok) {
    print('[SDS011] Virtual Component setup failed');
    return;
  }

  vc = readyVc;
  init();
});
