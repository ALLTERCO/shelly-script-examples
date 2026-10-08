/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"MarsRock"}}}} */

/**
 * @title Diagnostic Register Scan with managed Virtual Components
 * @description One-shot register scan utility for discovering unknown
 *   register values on this device, using portable MbRtuClient RPC calls
 *   and a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/MarsRock/G2_SUN_Series_Grid_Tie_Inverter/diagnostic_register_scan.shelly.js
 */

/**
 * MarsRock G2 Register Diagnostic (Managed Virtual Components)
 *
 * One-shot scan of holding and input registers for temperature candidates
 * near 26.0 C (raw or byte-swapped, scaled by 0.1 or 0.01).
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using diagnostic_register_scan.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. This is a
 * diagnostic scan tool - results are printed to the console only.
 *
 * The firmware creates and reconciles all components before the script
 * starts. Their numeric IDs are intentionally not known or hard-coded by
 * the script.
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var RANGES = [
  { label: 'HT0', method: 'ReadHoldingRegisters', start: 0, qty: 64 },
  { label: 'HT64', method: 'ReadHoldingRegisters', start: 64, qty: 64 },
  { label: 'HT128', method: 'ReadHoldingRegisters', start: 128, qty: 64 },
  { label: 'IT0', method: 'ReadInputRegisters', start: 0, qty: 64 },
  { label: 'IT64', method: 'ReadInputRegisters', start: 64, qty: 64 },
  { label: 'IT128', method: 'ReadInputRegisters', start: 128, qty: 64 }
];

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};

// ============================================================================
// HELPERS
// ============================================================================

function swap16(v) {
  return ((v & 0xff) << 8) | ((v >> 8) & 0xff);
}

function toHex(v) {
  var s = (v >>> 0).toString(16).toUpperCase();
  while (s.length < 4) s = '0' + s;
  return '0x' + s;
}

function clampInteger(value, fallback, min, max) {
  value = Number(value);
  if (value !== value) value = fallback;
  value = Math.round(value);
  if (value < min) value = min;
  if (value > max) value = max;
  return value;
}

function getSlaveId() {
  var value = clampInteger(
    vc.slaveId.getValue(),
    CONFIG.DEFAULT_SLAVE_ID,
    CONFIG.MIN_SLAVE_ID,
    CONFIG.MAX_SLAVE_ID
  );

  if (vc.slaveId.getValue() !== value) vc.slaveId.setValue(value);
  return value;
}

function modbusErrorText(error) {
  if (!error) return 'unknown error';
  if (error.message !== undefined && error.code !== undefined) {
    return error.message + ' (code ' + error.code + ')';
  }
  return JSON.stringify(error);
}

function getModbusClientId() {
  return Shelly.getComponentConfig('serial', 100) ? 100 : 0;
}

function isModbusClientReady() {
  var id = getModbusClientId();
  var config = Shelly.getComponentConfig('serial', id);

  return config && config.mode === 'mb_client';
}

function bindManagedComponents() {
  var i;

  for (i = 0; i < MANAGED_ROLES.length; i++) {
    vc[MANAGED_ROLES[i]] = Script.getVcHandle(MANAGED_ROLES[i]);
    if (!vc[MANAGED_ROLES[i]]) {
      console.log('ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
      return false;
    }
  }

  return true;
}

function managedComponentKey(role, type) {
  var config = vc[role].getConfig();

  if (!config || config.id === undefined) return null;
  return type + ':' + config.id;
}

function setDashboardGroup() {
  var groupConfig = vc.group.getConfig();
  var members = [managedComponentKey('slaveId', 'number')];

  if (!groupConfig || groupConfig.id === undefined) {
    console.log('ERROR: managed dashboard group has no component ID');
    return;
  }
  if (!members[0]) {
    console.log('ERROR: cannot resolve managed dashboard member');
    return;
  }

  Shelly.call('Group.Set', { id: groupConfig.id, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      console.log('Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    console.log('Managed dashboard group ready');
  });
}

// ============================================================================
// MODBUS RPC
// ============================================================================

function readRange(method, addr, qty, callback) {
  Shelly.call('MbRtuClient.' + method, {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    qty: qty
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(null, { code: errorCode, message: errorMessage });
      return;
    }
    callback(result && result.values ? result.values : null, null);
  });
}

// ============================================================================
// SCAN
// ============================================================================

function scanRange(index, done) {
  var range;

  if (index >= RANGES.length) {
    done();
    return;
  }

  range = RANGES[index];
  readRange(range.method, range.start, range.qty, function(values, error) {
    var parts = [];
    var i, addr, raw, swapped, text;

    if (error) {
      console.log(range.label + ' error @' + range.start + ': ' + modbusErrorText(error));
      scanRange(index + 1, done);
      return;
    }

    for (i = 0; i < values.length; i++) {
      addr = range.start + i;
      raw = values[i];
      swapped = swap16(raw);
      text = 'r' + addr + '=' + raw + '/' + toHex(raw) +
        '/s' + swapped +
        '/x0.1:' + (raw * 0.1) + '/x0.01:' + (raw * 0.01) +
        '/sx0.1:' + (swapped * 0.1) + '/sx0.01:' + (swapped * 0.01);

      if (
        raw === 26 || swapped === 26 ||
        raw === 260 || swapped === 260 ||
        raw === 2600 || swapped === 2600 ||
        (raw >= 20 && raw <= 35) || (swapped >= 20 && swapped <= 35) ||
        (raw >= 200 && raw <= 350) || (swapped >= 200 && swapped <= 350)
      ) {
        parts.push(text);
      }
    }

    if (parts.length) console.log(range.label + ' ' + parts.join(' | '));
    scanRange(index + 1, done);
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('MarsRock G2 diagnostic register scan (managed VC)');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 9600 8N1');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    console.log('Modbus Slave ID changed -> ' + getSlaveId());
  });

  Timer.set(1200, false, function() {
    scanRange(0, function() { console.log('diag done'); });
  });
}

init();
