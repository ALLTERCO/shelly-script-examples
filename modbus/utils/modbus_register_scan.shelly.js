/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Utils"}}}} */

/**
 * @title MODBUS Register Discovery Scanner with managed Virtual Components
 * @description Sweeps a register-address range at each configured baud rate
 *   to discover readable holding/input registers, using portable
 *   MbRtuClient RPC calls and a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/utils/modbus_register_scan.shelly.js
 */

/**
 * MODBUS Register Discovery Scanner (Managed Virtual Components)
 *
 * Unlike modbus_scan.shelly.js, this utility targets ONE already-addressed
 * device and sweeps register addresses/baud rates, not slave IDs.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using modbus_register_scan.shelly.js on that firmware.
 *
 * Multi-baud limitation: the classical version reconfigures the UART baud
 * rate per sweep via ModbusController.get(). The portable MbRtuClient RPC
 * path has no per-request baud override - baud is a property of the
 * Serial component's own configuration, changed via Serial.SetConfig,
 * which can require a device restart to take effect. This script does
 * NOT attempt to reconfigure Serial baud between sweeps; if CONFIG.
 * BAUD_RATES lists more than one rate, only the currently-configured
 * Serial baud is actually scanned for every entry (the loop structure is
 * kept for output-format fidelity with the classical version).
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
  BAUD_RATES: [9600],
  MODE: '8N1',
  RTYPE_LIST: ['HOLDING', 'INPUT'],
  ADDR_START: 0,
  ADDR_END: 5000,
  QTY: 1,
  RESPONSE_TIMEOUT_MS: 400,
  INTER_FRAME_MS: 40,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  baudIdx: 0,
  rtypeIdx: 0,
  addr: CONFIG.ADDR_START,
  results: {},
  readable: {}
};

// ============================================================================
// HELPERS
// ============================================================================

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = '0' + s;
  return s;
}

function currentRtype() { return CONFIG.RTYPE_LIST[state.rtypeIdx]; }
function currentBaud() { return CONFIG.BAUD_RATES[state.baudIdx]; }
function currentLabel() { return currentRtype(); }
function currentBucket() { return currentBaud() + '/' + currentLabel(); }
function currentReadableKey() { return currentBaud() + '_' + currentLabel().toLowerCase(); }

function printResult(status, extra) {
  var line = '[' + currentBaud() + '][' + currentLabel() + '] addr=' + state.addr + ' (0x' + toHex16(state.addr) + ') -> ' + status;
  if (extra) line += ' ' + extra;
  print(line);
}

function ensureResultBuckets() {
  var i, j, key, readableKey;

  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    for (j = 0; j < CONFIG.RTYPE_LIST.length; j++) {
      key = CONFIG.BAUD_RATES[i] + '/' + CONFIG.RTYPE_LIST[j];
      if (!state.results[key]) state.results[key] = { ok: 0, exception: 0, timeout: 0 };
      readableKey = CONFIG.BAUD_RATES[i] + '_' + CONFIG.RTYPE_LIST[j].toLowerCase();
      if (!state.readable[readableKey]) state.readable[readableKey] = [];
    }
  }
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

function readRegister(rtype, addr, qty, callback) {
  var method = rtype === 'HOLDING' ? 'MbRtuClient.ReadHoldingRegisters' : 'MbRtuClient.ReadInputRegisters';

  Shelly.call(method, {
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

function sendRead() {
  var bucket = state.results[currentBucket()];
  var timedOut = false;
  var timer;

  timer = Timer.set(CONFIG.RESPONSE_TIMEOUT_MS, false, function() {
    timedOut = true;
    bucket.timeout++;
    advance();
  });

  readRegister(currentRtype(), state.addr, CONFIG.QTY, function(values, error) {
    if (timedOut) return;
    Timer.clear(timer);

    if (values && values.length > 0) {
      bucket.ok++;
      state.readable[currentReadableKey()].push(state.addr);
      printResult('OK', 'value=' + values[0] + ' hex=0x' + toHex16(values[0]));
    } else {
      bucket.exception++;
    }

    advance();
  });
}

function advance() {
  state.addr++;

  if (state.addr > CONFIG.ADDR_END) {
    state.rtypeIdx++;
    if (state.rtypeIdx >= CONFIG.RTYPE_LIST.length) {
      state.rtypeIdx = 0;
      state.baudIdx++;
      if (state.baudIdx >= CONFIG.BAUD_RATES.length) {
        printSummary();
        return;
      }
      print('');
      print('=== Switching to baud ' + currentBaud() + ' ===');
    }

    state.addr = CONFIG.ADDR_START;
    print('');
    print('--- ' + currentBaud() + ' / ' + currentLabel() + ' REGISTERS ---');
  }

  Timer.set(CONFIG.INTER_FRAME_MS, false, sendRead);
}

function printFcSummary(baud, rtype) {
  var key = baud + '/' + rtype;
  var item = state.results[key];
  var name = rtype === 'HOLDING' ? 'Holding Registers' : 'Input Registers';

  print(name + ' (' + baud + '):');
  print('  OK: ' + item.ok);
  print('  Exception: ' + item.exception);
  print('  Timeout: ' + item.timeout);
}

function printSummary() {
  var i;

  print('');
  print('========================================');
  print('MODBUS Register Discovery Summary');
  print('========================================');
  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    print('Baud ' + CONFIG.BAUD_RATES[i] + ':');
    printFcSummary(CONFIG.BAUD_RATES[i], 'HOLDING');
    printFcSummary(CONFIG.BAUD_RATES[i], 'INPUT');
    print('  Readable holding addresses: ' + state.readable[CONFIG.BAUD_RATES[i] + '_holding'].length);
    print('  Readable input addresses: ' + state.readable[CONFIG.BAUD_RATES[i] + '_input'].length);
  }
  print('========================================');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client');
    return;
  }

  setDashboardGroup();

  print('');
  print('MODBUS Register Discovery Scanner (managed VC)');
  print('=================================');
  print('Slave:   ' + getSlaveId());
  print('UART:    ' + CONFIG.BAUD_RATES.join(', ') + ' ' + CONFIG.MODE);
  print('Range:   ' + CONFIG.ADDR_START + '..' + CONFIG.ADDR_END);
  print('Qty:     ' + CONFIG.QTY);
  print('');

  ensureResultBuckets();

  print('--- ' + currentBaud() + ' / ' + currentLabel() + ' REGISTERS ---');
  Timer.set(300, false, sendRead);
}

init();
