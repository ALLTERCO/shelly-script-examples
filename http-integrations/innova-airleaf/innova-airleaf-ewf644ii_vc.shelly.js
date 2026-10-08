/**
 * @title INNOVA AirLeaf EWF644II local controller
 * @description Memory-optimized local HTTP controller for INNOVA AirLeaf EWF644II deviceType 002 with Shelly Virtual Components.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/innova-airleaf/innova-airleaf-ewf644ii_vc.shelly.js
 */

/**
 * INNOVA AirLeaf EWF644II -> Shelly Smart Control
 *
 * Hardware / protocol:
 * - Shelly Gen3 with scripting and Dynamic Virtual Components.
 * - Hardware-tested on Shelly Plug S Gen3 firmware 2.0.0.
 * - INNOVA AirLeaf EWF644II reachable over local IPv4 HTTP.
 * - Validated device response: deviceType 002.
 * - API base path: /api/v/1/.
 *
 * Virtual Components:
 * - boolean:200 Power
 * - enum:201    Mode
 * - number:202  Target temperature
 * - enum:203    Fan
 * - number:204  Room temperature
 * - text:205    Connection/status
 *
 * Design:
 * - Self-contained VC bootstrap.
 * - Memory-optimized for constrained Shelly Gen3 devices.
 * - Serialized HTTP requests.
 * - Command coalescing for pending control changes.
 * - Physical-state readback after commands.
 * - HTTP watchdog and stale-callback protection.
 * - Script-generated VC feedback-loop protection.
 */

var CONFIG = {
  host: '192.0.2.10',
  pollMs: 15000,
  timeoutSec: 5,
  watchdogMs: 7500,
  settleMs: 500,
  maxQueue: 5
};

var API = 'http://' + CONFIG.host + '/api/v/1/';

var V = {};
var Q = [];
var A = null;

var requestId = 0;
var activeRequestId = 0;

var watchdogTimer = null;
var syncTimer = null;

var lastStatus = null;
var needSync = false;

var SPECS = [
  [
    'power',
    'boolean',
    200,
    {
      name: 'INNOVA Power',
      persisted: false,
      default_value: false,
      meta: {
        ui: {
          view: 'toggle',
          titles: {
            'false': 'Off',
            'true': 'On'
          }
        },
        cloud: ['log']
      }
    }
  ],
  [
    'mode',
    'enum',
    201,
    {
      name: 'INNOVA Mode',
      persisted: false,
      default_value: 'heating',
      options: [
        'heating',
        'cooling'
      ],
      meta: {
        ui: {
          view: 'Dropdown',
          titles: {
            heating: 'Heating',
            cooling: 'Cooling'
          }
        },
        cloud: ['log']
      }
    }
  ],
  [
    'setpoint',
    'number',
    202,
    {
      name: 'INNOVA Set temperature',
      persisted: false,
      default_value: 22,
      min: 16,
      max: 31,
      meta: {
        ui: {
          view: 'field',
          unit: 'C',
          step: 0.5
        },
        cloud: ['measurement']
      }
    }
  ],
  [
    'fan',
    'enum',
    203,
    {
      name: 'INNOVA Fan',
      persisted: false,
      default_value: 'auto',
      options: [
        'auto',
        'night',
        'min',
        'max'
      ],
      meta: {
        ui: {
          view: 'Dropdown',
          titles: {
            auto: 'Auto',
            night: 'Night',
            min: 'Minimum',
            max: 'Maximum'
          }
        },
        cloud: ['log']
      }
    }
  ],
  [
    'room',
    'number',
    204,
    {
      name: 'INNOVA Room temperature',
      persisted: false,
      default_value: 0,
      min: -20,
      max: 60,
      meta: {
        ui: {
          view: 'label',
          unit: 'C',
          step: 0.1
        },
        cloud: ['measurement']
      }
    }
  ],
  [
    'status',
    'text',
    205,
    {
      name: 'INNOVA Status',
      persisted: false,
      default_value: 'starting',
      meta: {
        ui: {
          view: 'label',
          maxLength: 80
        },
        cloud: ['log']
      }
    }
  ]
];

function log(message) {
  print('[INNOVA] ' + message);
}

function setValue(handle, value) {
  if (!handle) {
    return;
  }

  if (handle.getValue() !== value) {
    handle.setValue(value);
  }
}

function setStatus(message) {
  message = String(message);

  if (message.length > 80) {
    message = message.slice(0, 80);
  }

  setValue(V.status, message);
}

function isInternalEvent(event) {
  return (
    event &&
    typeof event.source === 'string' &&
    event.source.indexOf('script') === 0
  );
}

function ensureVirtualComponent(index, done) {
  var spec;
  var key;
  var handle;

  if (index >= SPECS.length) {
    SPECS = null;
    done(true);
    return;
  }

  spec = SPECS[index];
  key = spec[1] + ':' + spec[2];
  handle = Virtual.getHandle(key);

  if (handle) {
    handle.setConfig(spec[3]);
    V[spec[0]] = handle;

    Timer.set(
      20,
      false,
      function() {
        ensureVirtualComponent(index + 1, done);
      }
    );

    return;
  }

  Shelly.call(
    'Virtual.Add',
    {
      type: spec[1],
      id: spec[2],
      config: spec[3]
    },
    function(result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        log(
          'Virtual.Add ' +
          key +
          ' failed: ' +
          errorCode +
          ' ' +
          errorMessage
        );

        done(false);
        return;
      }

      Timer.set(
        40,
        false,
        function() {
          handle = Virtual.getHandle(key);

          if (!handle) {
            log('Missing handle: ' + key);
            done(false);
            return;
          }

          V[spec[0]] = handle;

          ensureVirtualComponent(
            index + 1,
            done
          );
        }
      );
    }
  );
}

function applyStatus(data) {
  if (!data) {
    return;
  }

  lastStatus = data;

  if (typeof data.ps === 'number') {
    setValue(
      V.power,
      data.ps === 1
    );
  }

  if (typeof data.sp === 'number') {
    setValue(
      V.setpoint,
      data.sp / 10
    );
  }

  if (typeof data.ta === 'number') {
    setValue(
      V.room,
      data.ta / 10
    );
  }

  if (data.wm === 3) {
    setValue(
      V.mode,
      'heating'
    );
  }

  if (data.wm === 5) {
    setValue(
      V.mode,
      'cooling'
    );
  }

  if (data.fn === 1) {
    setValue(
      V.fan,
      'auto'
    );
  }

  if (data.fn === 2) {
    setValue(
      V.fan,
      'night'
    );
  }

  if (data.fn === 3) {
    setValue(
      V.fan,
      'min'
    );
  }

  if (data.fn === 4) {
    setValue(
      V.fan,
      'max'
    );
  }
}

function clearSyncTimer() {
  if (syncTimer !== null) {
    Timer.clear(syncTimer);
    syncTimer = null;
  }
}

function queueContains(key) {
  var i;

  if (
    A !== null &&
    A.key === key
  ) {
    return true;
  }

  for (
    i = 0;
    i < Q.length;
    i += 1
  ) {
    if (Q[i].key === key) {
      return true;
    }
  }

  return false;
}

function addJob(job, replaceExisting) {
  var i;

  clearSyncTimer();

  if (replaceExisting) {
    for (
      i = 0;
      i < Q.length;
      i += 1
    ) {
      if (Q[i].key === job.key) {
        Q[i] = job;
        processNextJob();
        return;
      }
    }
  }

  if (Q.length >= CONFIG.maxQueue) {
    setStatus('error: command queue full');
    return;
  }

  Q.push(job);

  processNextJob();
}

function addStatusRequest(label) {
  addJob(
    {
      key: 'status',
      method: 'GET',
      path: 'status',
      body: null,
      label: label,
      isStatus: true
    },
    true
  );
}

function addCommand(
  key,
  path,
  body,
  label,
  replaceExisting
) {
  addJob(
    {
      key: key,
      method: 'POST',
      path: path,
      body: body,
      label: label,
      isStatus: false
    },
    replaceExisting
  );
}

function scheduleStatusSync() {
  if (!needSync) {
    return;
  }

  if (A !== null) {
    return;
  }

  if (Q.length !== 0) {
    return;
  }

  if (syncTimer !== null) {
    return;
  }

  syncTimer = Timer.set(
    CONFIG.settleMs,
    false,
    function() {
      syncTimer = null;

      if (
        A === null &&
        Q.length === 0 &&
        needSync
      ) {
        addStatusRequest(
          'status after command'
        );
      }
    }
  );
}

function failJob(job, message) {
  log(
    job.label +
    ' failed: ' +
    message
  );

  setStatus(
    'offline: ' +
    message
  );

  if (!job.isStatus) {
    Q = [];
    needSync = true;
  }
}

function onHttpTimeout() {
  var job;

  if (A === null) {
    return;
  }

  job = A;

  A = null;
  activeRequestId = 0;
  watchdogTimer = null;

  failJob(
    job,
    'timeout'
  );

  processNextJob();
  scheduleStatusSync();
}

function onHttpDone(
  result,
  errorCode,
  errorMessage,
  callbackRequestId
) {
  var job;
  var response;
  var message;

  if (
    A === null ||
    callbackRequestId !== activeRequestId
  ) {
    return;
  }

  job = A;

  A = null;
  activeRequestId = 0;

  if (watchdogTimer !== null) {
    Timer.clear(watchdogTimer);
    watchdogTimer = null;
  }

  if (
    errorCode !== 0 ||
    !result ||
    result.code !== 200
  ) {
    message =
      errorMessage ||
      (
        'HTTP ' +
        (
          result
            ? result.code
            : 'no response'
        )
      );

    failJob(
      job,
      message
    );

    processNextJob();
    scheduleStatusSync();

    return;
  }

  try {
    response = JSON.parse(
      result.body
    );
  } catch (error) {
    failJob(
      job,
      'invalid JSON'
    );

    processNextJob();
    scheduleStatusSync();

    return;
  }

  if (
    !response ||
    response.success !== true
  ) {
    failJob(
      job,
      'rejected by INNOVA'
    );

    processNextJob();
    scheduleStatusSync();

    return;
  }

  if (job.isStatus) {
    if (!response.RESULT) {
      setStatus(
        'error: missing RESULT'
      );
    } else if (
      String(response.deviceType) !== '002'
    ) {
      setStatus(
        'error: not AirLeaf 002'
      );
    } else {
      applyStatus(
        response.RESULT
      );

      needSync = false;

      setStatus(
        'online / type 002'
      );
    }
  } else {
    log(
      job.label +
      ' accepted'
    );

    needSync = true;
  }

  processNextJob();
  scheduleStatusSync();
}

function processNextJob() {
  if (A !== null) {
    return;
  }

  if (Q.length === 0) {
    return;
  }

  A = Q[0];
  Q = Q.slice(1);

  requestId += 1;
  activeRequestId = requestId;

  if (!A.isStatus) {
    setStatus(
      'sending: ' +
      A.label
    );
  }

  watchdogTimer = Timer.set(
    CONFIG.watchdogMs,
    false,
    onHttpTimeout
  );

  if (A.method === 'GET') {
    Shelly.call(
      'HTTP.GET',
      {
        url:
          API +
          A.path,

        timeout:
          CONFIG.timeoutSec
      },
      onHttpDone,
      activeRequestId
    );

    return;
  }

  Shelly.call(
    'HTTP.POST',
    {
      url:
        API +
        A.path,

      body:
        A.body === null
          ? '{}'
          : A.body,

      content_type:
        'application/json',

      timeout:
        CONFIG.timeoutSec
    },
    onHttpDone,
    activeRequestId
  );
}

function onPowerChanged(event) {
  if (isInternalEvent(event)) {
    return;
  }

  if (event.value === true) {
    addCommand(
      'power',
      'power/on',
      null,
      'power on',
      true
    );
  } else {
    addCommand(
      'power',
      'power/off',
      null,
      'power off',
      true
    );
  }
}

function onModeChanged(event) {
  if (isInternalEvent(event)) {
    return;
  }

  if (
    event.value !== 'heating' &&
    event.value !== 'cooling'
  ) {
    return;
  }

  if (
    (
      !lastStatus ||
      lastStatus.ps !== 1
    ) &&
    !queueContains('power-guard')
  ) {
    addCommand(
      'power-guard',
      'power/on',
      null,
      'power on before mode',
      false
    );
  }

  addCommand(
    'mode',
    'set/mode/' +
      event.value,
    null,
    'mode ' +
      event.value,
    true
  );
}

function onSetpointChanged(event) {
  var temperature;

  if (isInternalEvent(event)) {
    return;
  }

  temperature =
    Math.round(
      Number(event.value) * 2
    ) / 2;

  if (
    temperature < 16 ||
    temperature > 31
  ) {
    if (lastStatus) {
      applyStatus(
        lastStatus
      );
    }

    return;
  }

  addCommand(
    'setpoint',
    'set/setpoint',
    JSON.stringify({
      temp:
        Math.round(
          temperature * 10
        )
    }),
    'setpoint ' +
      temperature,
    true
  );
}

function onFanChanged(event) {
  if (isInternalEvent(event)) {
    return;
  }

  if (
    event.value !== 'auto' &&
    event.value !== 'night' &&
    event.value !== 'min' &&
    event.value !== 'max'
  ) {
    return;
  }

  addCommand(
    'fan',
    'set/function/' +
      event.value,
    null,
    'fan ' +
      event.value,
    true
  );
}

function poll() {
  if (A !== null) {
    return;
  }

  if (Q.length !== 0) {
    return;
  }

  if (syncTimer !== null) {
    return;
  }

  addStatusRequest(
    'status'
  );
}

function startApp() {
  if (
    !V.power ||
    !V.mode ||
    !V.setpoint ||
    !V.fan ||
    !V.room ||
    !V.status
  ) {
    log(
      'Virtual Component handles unavailable'
    );

    return;
  }

  V.power.on(
    'change',
    onPowerChanged
  );

  V.mode.on(
    'change',
    onModeChanged
  );

  V.setpoint.on(
    'change',
    onSetpointChanged
  );

  V.fan.on(
    'change',
    onFanChanged
  );

  setStatus(
    'connecting to ' +
    CONFIG.host
  );

  poll();

  Timer.set(
    CONFIG.pollMs,
    true,
    poll
  );

  log(
    'Controller started for ' +
    CONFIG.host
  );
}

function init() {
  if (
    typeof Virtual === 'undefined' ||
    typeof Virtual.getHandle !== 'function'
  ) {
    log(
      'Virtual API unavailable'
    );

    return;
  }

  ensureVirtualComponent(
    0,
    function(ok) {
      if (!ok) {
        log(
          'Virtual Component setup failed'
        );

        return;
      }

      startApp();
    }
  );
}

init();
