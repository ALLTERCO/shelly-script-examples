/**
 * @title Mitsubishi Heavy AC control via Tasmota IR bridge
 * @description Creates Virtual Components for Mitsubishi Heavy HVAC control
 *   and automatically sends IRHVAC commands to one or more Tasmota IR bridges
 *   over HTTP when values change.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js
 */

/**
 * Mitsubishi Heavy AC Virtual Components Controller
 *
 * This script builds a Shelly-side control panel for one or more Mitsubishi
 * Heavy indoor units controlled through Tasmota IR bridges.
 *
 * Workflow:
 * - Creates Virtual Components for mode, fan, temperature, swing, and target
 * - Lets the user change values in the Shelly app
 * - Sends the selected state automatically after a short debounce
 *
 * Tasmota requirements:
 * - Each target IP must be reachable from the Shelly device
 * - The target device must expose the Tasmota command endpoint `/cm`
 * - The IR bridge must support the `IRHVAC` command for
 *   `MITSUBISHI_HEAVY_88`
 *
 * Virtual Components created:
 * - group:208   Mitsubishi Heavy AC
 * - enum:202    AC Mode
 * - enum:203    AC Fan
 * - number:204  AC Temp
 * - enum:205    AC Swing V
 * - enum:209    IR Target
 *
 * Configuration:
 * - `IR_TARGET_IPS`: Maps target labels to Tasmota IR bridge IP addresses
 * - `DEFAULTS`: Initial HVAC state shown in the Shelly UI
 * - `SEND_DEBOUNCE_MS`: Delay before sending after a value change
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var TASMOTA_CM_PATH = '/cm?cmnd=';

var IR_TARGETS = ['Living Room', 'Bedroom 2', 'All'];

var IR_TARGET_IPS = {
  'Living Room': '192.0.2.10',
  'Bedroom 2': '192.0.2.11'
};

var IDS = {
  mode: 202,
  fan: 203,
  temp: 204,
  swingV: 205,
  status: 207,
  group: 208,
  target: 209
};

var DEFAULTS = {
  mode: 'Heat',
  fan: 'Auto',
  temp: 20,
  swingV: 'Auto',
  target: 'Bedroom 2'
};

var MODES = ['Off', 'Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
var FAN_SPEEDS = ['Auto', 'Min', 'Low', 'Med', 'High', 'Max'];
var SWING_V = ['Off', 'Auto', 'Min', 'Low', 'Mid', 'High', 'Max'];
var SEND_DEBOUNCE_MS = 400;

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var sendTimer = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  print('[ac-vc] ' + msg);
}

function setStatus(msg) {
  log(msg);
}

function ensureComponent(type, id, config, cb) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finalize() {
    vc[id] = Virtual.getHandle(key);
    if (!vc[id]) {
      log('Failed to get handle for ' + key);
      if (cb) cb(false);
      return;
    }
    vc[id].setConfig(config);
    if (cb) cb(true);
  }

  if (handle) {
    vc[id] = handle;
    handle.setConfig(config);
    if (cb) cb(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      if (cb) cb(false);
      return;
    }
    finalize();
  });
}

function deleteComponent(key, cb) {
  Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Delete skipped for ' + key + ': ' + errCode + ' ' + errMsg);
    }
    if (cb) cb();
  });
}

function getComponentSpecs() {
  return [
    {
      type: 'group',
      id: IDS.group,
      config: {
        name: 'Mitsubishi Heavy AC'
      }
    },
    {
      type: 'enum',
      id: IDS.mode,
      config: {
        name: 'AC Mode',
        persisted: true,
        default_value: DEFAULTS.mode,
        options: MODES,
        meta: {
          ui: {
            view: 'Dropdown'
          }
        }
      }
    },
    {
      type: 'enum',
      id: IDS.fan,
      config: {
        name: 'AC Fan',
        persisted: true,
        default_value: DEFAULTS.fan,
        options: FAN_SPEEDS,
        meta: {
          ui: {
            view: 'Dropdown'
          }
        }
      }
    },
    {
      type: 'number',
      id: IDS.temp,
      config: {
        name: 'AC Temp',
        persisted: true,
        default_value: DEFAULTS.temp,
        min: 16,
        max: 31,
        meta: {
          ui: {
            view: 'slider',
            unit: 'C',
            step: 1
          }
        }
      }
    },
    {
      type: 'enum',
      id: IDS.swingV,
      config: {
        name: 'AC Swing V',
        persisted: true,
        default_value: DEFAULTS.swingV,
        options: SWING_V,
        meta: {
          ui: {
            view: 'Dropdown'
          }
        }
      }
    },
    {
      type: 'enum',
      id: IDS.target,
      config: {
        name: 'IR Target',
        persisted: true,
        default_value: DEFAULTS.target,
        options: IR_TARGETS,
        meta: {
          ui: {
            view: 'Dropdown'
          }
        }
      }
    }
  ];
}

function ensureComponents(index, specs, done) {
  function next(nextIndex) {
    if (nextIndex >= specs.length) {
      Shelly.call(
        'Group.Set',
        {
          id: IDS.group,
          value: [
            'enum:' + IDS.mode,
            'enum:' + IDS.fan,
            'number:' + IDS.temp,
            'enum:' + IDS.swingV,
            'enum:' + IDS.target
          ]
        },
        function(res, errCode, errMsg) {
          if (errCode !== 0) {
            log('Group.Set failed: ' + errCode + ' ' + errMsg);
            if (done) done(false);
            return;
          }
          if (done) done(true);
        }
      );
      return;
    }

    ensureComponent(specs[nextIndex].type, specs[nextIndex].id, specs[nextIndex].config, function(ok) {
      if (!ok) {
        if (done) done(false);
        return;
      }
      Timer.set(1, false, function() {
        next(nextIndex + 1);
      });
    });
  }

  deleteComponent('enum:' + IDS.temp, function() {
    deleteComponent('number:' + IDS.temp, function() {
      deleteComponent('boolean:202', function() {
        deleteComponent('boolean:201', function() {
          deleteComponent('boolean:200', function() {
            deleteComponent('text:' + IDS.status, function() {
              deleteComponent('button:206', function() {
                deleteComponent('button:210', function() {
                  next(0);
                });
              });
            });
          });
        });
      });
    });
  });
}

function readValue(handle, fallback) {
  var value;

  if (!handle) return fallback;

  value = handle.getValue();
  if (value === null || value === undefined) return fallback;

  return value;
}

function toHex(code) {
  var hex = code.toString(16).toUpperCase();
  return hex.length < 2 ? '0' + hex : hex;
}

function urlEncode(str) {
  var out = '';
  var i;
  var ch;
  var code;

  for (i = 0; i < str.length; i++) {
    ch = str.charAt(i);
    code = str.charCodeAt(i);

    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      ch === '-' ||
      ch === '_' ||
      ch === '.' ||
      ch === '~'
    ) {
      out += ch;
    } else {
      out += '%' + toHex(code);
    }
  }

  return out;
}

function getTargetIps() {
  var target = readValue(vc.target, DEFAULTS.target);

  if (target === 'All') {
    return [IR_TARGET_IPS['Living Room'], IR_TARGET_IPS['Bedroom 2']];
  }

  return [IR_TARGET_IPS[target]];
}

function buildAcState() {
  var acSwingV = readValue(vc.swingV, DEFAULTS.swingV);
  var selectedMode = readValue(vc.mode, DEFAULTS.mode);
  var acFan = readValue(vc.fan, DEFAULTS.fan);
  var acTemp = readValue(vc.temp, DEFAULTS.temp);
  var power = selectedMode === 'Off' ? 'Off' : 'On';
  var acMode = selectedMode === 'Off' ? 'Auto' : selectedMode;

  return {
    Vendor: 'MITSUBISHI_HEAVY_88',
    Power: power,
    Beep: 'On',
    SwingV: acSwingV,
    Mode: acMode,
    FanSpeed: acFan,
    Temp: parseInt(acTemp, 10)
  };
}

// ============================================================================
// TASMOTA COMMAND DISPATCH
// ============================================================================

function sendAcState(acState, successText) {
  var payload = 'IRHVAC ' + JSON.stringify(acState);
  var targets = getTargetIps();
  var pending = targets.length;
  var failed = 0;
  var lastError = '';

  setStatus('Sending...');

  function finishOne(ok, msg) {
    pending -= 1;

    if (!ok) {
      failed += 1;
      lastError = msg;
    }

    if (pending > 0) return;

    if (failed === 0) {
      setStatus(successText);
      return;
    }

    if (failed === targets.length) {
      setStatus('Send failed: ' + lastError);
      return;
    }

    setStatus('Partial send failure: ' + lastError);
  }

  targets.forEach(function(ip) {
    var url = 'http://' + ip + TASMOTA_CM_PATH + urlEncode(payload);

    Shelly.call('HTTP.GET', { url: url, timeout: 10 }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('HTTP.GET failed for ' + ip + ': ' + errCode + ' ' + errMsg);
        finishOne(false, 'HTTP ' + errCode + ' on ' + ip);
        return;
      }

      if (!res || res.code !== 200) {
        finishOne(false, 'Tasmota ' + (res ? res.code : 'no response') + ' on ' + ip);
        return;
      }

      finishOne(true, '');
    });
  });
}

function sendCurrentState() {
  var acState = buildAcState();

  sendAcState(
    acState,
    'Sent to ' +
      readValue(vc.target, DEFAULTS.target) +
      ': ' +
      acState.Power +
      ' ' +
      acState.Mode +
      ' ' +
      acState.Temp +
      'C'
  );
}

function scheduleSend(reason) {
  if (reason) setStatus(reason + '. Sending...');

  if (sendTimer !== null) Timer.clear(sendTimer);

  sendTimer = Timer.set(SEND_DEBOUNCE_MS, false, function() {
    sendTimer = null;
    sendCurrentState();
  });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function bindHandlers() {
  vc.mode = vc[IDS.mode];
  vc.fan = vc[IDS.fan];
  vc.temp = vc[IDS.temp];
  vc.swingV = vc[IDS.swingV];
  vc.target = vc[IDS.target];

  if (vc.mode) {
    vc.mode.on('change', function(ev) {
      scheduleSend('Mode set to ' + ev.value);
    });
  }

  if (vc.fan) {
    vc.fan.on('change', function(ev) {
      scheduleSend('Fan set to ' + ev.value);
    });
  }

  if (vc.temp) {
    vc.temp.on('change', function(ev) {
      scheduleSend('Temp set to ' + parseInt(ev.value, 10) + 'C');
    });
  }

  if (vc.swingV) {
    vc.swingV.on('change', function(ev) {
      scheduleSend('Swing V set to ' + ev.value);
    });
  }

  if (vc.target) {
    vc.target.on('change', function(ev) {
      scheduleSend('IR target set to ' + ev.value);
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  ensureComponents(0, getComponentSpecs(), function(ok) {
    if (!ok) {
      setStatus('Virtual component setup failed');
      return;
    }

    bindHandlers();
    setStatus('Ready. Changes are sent automatically.');
  });
}

main();
