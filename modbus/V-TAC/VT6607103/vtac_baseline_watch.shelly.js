/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"V-TAC"}}}} */

/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher with managed Virtual Components
 * @description Polls known readable holding registers from the V-TAC
 *   VT-66036103, comparing them against embedded baseline values, over
 *   portable MbRtuClient RPC calls and a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_baseline_watch.shelly.js
 */

/**
 * V-TAC VT-66036103 Baseline MODBUS Watcher (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using vtac_baseline_watch.shelly.js on that firmware.
 *
 * Latest working hypotheses from live testing:
 * - 5776 (0x1690) = pv1_voltage, scale 0.1 V
 * - 5778 (0x1692) = pv2_voltage, scale 0.1 V
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5788 (0x169C) = igbt_temperature, scale 0.01 degC
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 *
 * All blocks below use FC 0x03 (Read Holding Registers). Each block is
 * "start,len,nz" where nz is an optional "offset=baseline|offset=baseline"
 * list of non-zero baseline values (omitted offsets default to baseline 0).
 * This script prints all values to the console; only the Modbus Slave ID is
 * backed by a managed Virtual Component (it is configuration, not sensor
 * data).
 *
 * Managed Virtual Component roles:
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary.
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
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MANAGED_ROLES = ['slaveId', 'group'];

var BLOCKS = [
  '5632,12,',
  '5664,1,',
  '5674,1,',
  '5684,1,',
  '5694,1,',
  '5704,1,',
  '5714,1,',
  '5724,1,',
  '5734,1,',
  '5744,1,0=4',
  '5752,1,0=6405',
  '5756,3,0=7',
  '5760,16,',
  '5777,1,',
  '5779,5,',
  '5785,1,',
  '5787,3,0=1|1=10|2=1',
  '5791,1,',
  '5793,2,0=100',
  '5796,1,',
  '5798,4,0=240|1=540|2=240',
  '5804,1,',
  '5810,1,',
  '5824,8,0=7|2=9|4=7|6=10',
  '5873,2,',
  '5936,1,',
  '5960,1,'
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0
};

// ============================================================================
// HELPERS
// ============================================================================

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

function readHoldingRegisters(addr, qty, callback) {
  Shelly.call('MbRtuClient.ReadHoldingRegisters', {
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
// MAIN LOGIC
// ============================================================================

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = '0' + s;
  return s;
}

function makeKey(addr) {
  return '' + addr;
}

function parseBlock(s) {
  var parts = s.split(',');
  return {
    start: JSON.parse(parts[0]),
    len: JSON.parse(parts[1]),
    nz: parts.length > 2 ? parts[2] : ''
  };
}

function baselineAt(block, offset) {
  var items;
  var i;
  var kv;

  if (block.nz === '') return 0;
  items = block.nz.split('|');
  for (i = 0; i < items.length; i++) {
    kv = items[i].split('=');
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function handleValue(addr, baseline, raw) {
  var key = makeKey(addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print('[HOLDING] CHANGED addr=' + addr + ' (0x' + toHex16(addr) + ') default=' + baseline + ' current=' + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print('[HOLDING] RESTORED addr=' + addr + ' (0x' + toHex16(addr) + ') value=' + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print('[V-TAC] Previous cycle still running; skipping this interval');
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    var block;

    if (index >= BLOCKS.length) {
      print('[V-TAC] Cycle done: blocks=' + BLOCKS.length + ' deviations=' + state.cycleDeviations + ' errors=' + state.cycleErrors);
      print('');
      state.cycleRunning = false;
      return;
    }

    block = parseBlock(BLOCKS[index]);
    readHoldingRegisters(block.start, block.len, function(values, error) {
      if (!values) {
        state.cycleErrors++;
        print('[HOLDING] ERROR addr=' + block.start + ' qty=' + block.len + ' (' + JSON.stringify(error) + ')');
      } else {
        processBlock(block, values);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print('[V-TAC] Starting baseline comparison cycle');
  readNext(0);
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
    console.log('ERROR: configure the serial component as mb_client at 9600 8N1');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    console.log('Modbus Slave ID changed -> ' + getSlaveId());
  });

  print('V-TAC VT-66036103 baseline MODBUS watcher (managed VC)');
  print('==========================================');
  print('Baseline blocks: ' + BLOCKS.length);
  print('Polling every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, runCycle);
  Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);
}

init();
