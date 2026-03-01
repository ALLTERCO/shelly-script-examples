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
 * Virtual Components used:
 * - number:200  PM2.5 value (ug/m3)
 * - number:201  PM10 value (ug/m3)
 * - text:200    Last report timestamp
 * - text:201    Runtime status
 * - enum:200    Air quality category
 * - boolean:200 Power control (on/off)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const BAUD = 9600;

const VC_PM25 = Virtual.getHandle('number:200');
const VC_PM10 = Virtual.getHandle('number:201');
const VC_LAST_REPORT = Virtual.getHandle('text:200');
const VC_STATE_REPORT = Virtual.getHandle('text:201');
const VC_AIR_QUALITY = Virtual.getHandle('enum:200');
const VC_POWER = Virtual.getHandle('boolean:200');

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
  next: null,
};

// ============================================================================
// HELPERS
// ============================================================================

function setValue(vc, value) {
  if (vc) {
    vc.setValue(value);
  }
}

function setStatus(status) {
  setValue(VC_STATE_REPORT, status);
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
  if (!VC_AIR_QUALITY) {
    return;
  }

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

  VC_AIR_QUALITY.setValue(key);
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
    setValue(VC_PM25, pm25);
    setValue(VC_PM10, round1(sum10 / cnt));
    setValue(VC_LAST_REPORT, ts());
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

  if (VC_POWER) {
    VC_POWER.on('change', function() {
      applyPowerState(!!VC_POWER.getValue());
    });

    // Start on boot only when Power is enabled.
    applyPowerState(!!VC_POWER.getValue());
    return;
  }

  applyPowerState(true);
}

init();
