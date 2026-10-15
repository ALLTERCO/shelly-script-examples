/* @meta {"vc":{"pvPower":{"type":"number","config":{"name":"PV Power","meta":{"ui":{"view":"progressbar","unit":"W"}}}},"batteryStatus":{"type":"enum","config":{"name":"Battery Status","options":["Charging","Idle","Discharging"]}},"batterySoc":{"type":"number","config":{"name":"Battery SOC","meta":{"ui":{"view":"progressbar","unit":"%"}}}},"batteryPower":{"type":"number","config":{"name":"Battery Power","meta":{"ui":{"unit":"W"}}}},"onGrid":{"type":"boolean","config":{"name":"On Grid"}},"gridPower":{"type":"number","config":{"name":"Grid Power","meta":{"ui":{"unit":"W"}}}},"loadStatus":{"type":"enum","config":{"name":"Load Status","options":["Low","Medium","High","Peak"]}},"loadPower":{"type":"number","config":{"name":"Load Power","meta":{"ui":{"view":"progressbar","unit":"W"}}}},"operatingMode":{"type":"enum","config":{"name":"Operating Mode","options":["Self-Consumption","AI","TOU","Feed-in","Remote EMS","Custom","Unknown"]}},"group":{"type":"group","config":{"name":"Sigenergy"}}}} */

/**
 * @title Sigenergy SigenStor plant monitor with managed Virtual Components
 * @description Reads a Sigenergy SigenStor plant (PV, battery, grid, load,
 *   operating mode) over portable MbRtuClient RPC calls, publishing 9
 *   parameters as managed Virtual Components.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Sigenergy/SigenStor/sigenstor_plant_vc.shelly.js
 */

/**
 * Sigenergy SigenStor Plant Monitor (Managed Virtual Components)
 *
 * Device compatibility: Shelly Pro RS485 Add-on (MODBUS client component
 * ID 100 by default - adjust CONFIG.serialId if different).
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. This
 * script does not run on that firmware; there is no non-managed fallback.
 *
 * Managed Virtual Component roles:
 * - pvPower, batterySoc, batteryPower, gridPower, loadPower: telemetry, W/%
 * - onGrid: boolean, on/off-grid state
 * - batteryStatus, loadStatus, operatingMode: derived enum labels
 * - group: Home-page group containing all 9
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Per-role
 * min/max/icon metadata is intentionally trimmed to stay inside that
 * budget - PV/load power ranges and Iconify icons from the classical
 * version are dropped; the underlying clamping logic (loadStatus/
 * batteryStatus thresholds) is unaffected since it runs in code, not UI.
 *
 * The slave ID (247) and serial/client ID are configured in CONFIG below,
 * not through a dynamic Virtual Component, matching the classical version.
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
  serialId: 100,
  slaveId: 247,
  pollMs: 1000,
  heartbeatEvery: 10,
  pvMaxW: 10000,
  inverterMaxW: 10000
};

var EMS_MODES = {
  0: 'Self-Consumption',
  1: 'AI',
  2: 'TOU',
  5: 'Feed-in',
  7: 'Remote EMS',
  9: 'Custom'
};

var MANAGED_ROLES = [
  'pvPower', 'batteryStatus', 'batterySoc', 'batteryPower', 'onGrid',
  'gridPower', 'loadStatus', 'loadPower', 'operatingMode', 'group'
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  tick: 0,
  pollTimer: null,
  pollActive: false
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[sigenstor-vc] ' + msg);
}

function s32(hi, lo) {
  var value = hi * 65536 + lo;
  if (value > 2147483647) value = value - 4294967296;
  return value;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function loadStatus(loadW) {
  var rated = CONFIG.inverterMaxW;
  if (loadW >= rated) return 'Peak';
  if (loadW >= 0.7 * rated) return 'High';
  if (loadW >= 0.3 * rated) return 'Medium';
  return 'Low';
}

function batteryStatus(watts) {
  if (watts > 50) return 'Charging';
  if (watts < -50) return 'Discharging';
  return 'Idle';
}

function operatingMode(raw) {
  return EMS_MODES[raw] || 'Unknown';
}

function bindManagedComponents() {
  var i;

  for (i = 0; i < MANAGED_ROLES.length; i++) {
    vc[MANAGED_ROLES[i]] = Script.getVcHandle(MANAGED_ROLES[i]);
    if (!vc[MANAGED_ROLES[i]]) {
      log('ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
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
  var members = [
    managedComponentKey('pvPower', 'number'),
    managedComponentKey('batteryStatus', 'enum'),
    managedComponentKey('batterySoc', 'number'),
    managedComponentKey('batteryPower', 'number'),
    managedComponentKey('onGrid', 'boolean'),
    managedComponentKey('gridPower', 'number'),
    managedComponentKey('loadStatus', 'enum'),
    managedComponentKey('loadPower', 'number'),
    managedComponentKey('operatingMode', 'enum')
  ];
  var i;

  if (!groupConfig || groupConfig.id === undefined) {
    log('ERROR: managed dashboard group has no component ID');
    return;
  }
  for (i = 0; i < members.length; i++) {
    if (!members[i]) {
      log('ERROR: cannot resolve managed dashboard member');
      return;
    }
  }

  Shelly.call('Group.Set', { id: groupConfig.id, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      log('Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    log('Managed dashboard group ready');
  });
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function readInputRegisters(addr, qty, cb) {
  Shelly.call(
    'MbRtuClient.ReadInputRegisters',
    { id: CONFIG.serialId, sid: CONFIG.slaveId, addr: addr, qty: qty },
    function(res, errCode, errMsg) {
      if (errCode !== 0 || !res || !res.values) {
        cb(null, errCode, errMsg);
        return;
      }

      cb(res.values, 0, null);
    }
  );
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  if (state.pollActive) return;
  state.pollActive = true;

  readInputRegisters(30003, 12, function(a, errA, msgA) {
    var emsMode;
    var grid;
    var onGridRaw;
    var soc;

    if (!a) {
      log('read block A failed: ' + errA + ' ' + msgA);
      state.pollActive = false;
      schedulePoll();
      return;
    }

    emsMode = a[0];
    grid = s32(a[2], a[3]);
    onGridRaw = a[6];
    soc = round1(a[11] / 10);

    readInputRegisters(30035, 4, function(b, errB, msgB) {
      var pv;
      var battery;
      var gridExport;
      var load;
      var onGrid;

      if (!b) {
        log('read block B failed: ' + errB + ' ' + msgB);
        state.pollActive = false;
        schedulePoll();
        return;
      }

      pv = s32(b[0], b[1]);
      battery = s32(b[2], b[3]);
      gridExport = -grid;
      load = pv + grid - battery;
      if (load < 0) load = 0;
      onGrid = onGridRaw === 0;

      vc.pvPower.setValue(pv);
      vc.batterySoc.setValue(soc);
      vc.batteryPower.setValue(battery);
      vc.gridPower.setValue(gridExport);
      vc.loadPower.setValue(load);
      vc.onGrid.setValue(onGrid);
      vc.loadStatus.setValue(loadStatus(load));
      vc.batteryStatus.setValue(batteryStatus(battery));
      vc.operatingMode.setValue(operatingMode(emsMode));

      state.tick++;
      if (state.tick % CONFIG.heartbeatEvery === 0) {
        log(
          'PV=' + pv + 'W SOC=' + soc + '% Bat=' + battery + 'W Grid=' + gridExport +
          'W Load=' + load + 'W(' + loadStatus(load) + ') Mode=' + operatingMode(emsMode) +
          ' OnGrid=' + onGrid
        );
      }

      state.pollActive = false;
      schedulePoll();
    });
  });
}

function schedulePoll() {
  if (state.pollTimer) Timer.clear(state.pollTimer);
  state.pollTimer = Timer.set(CONFIG.pollMs, false, poll);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Sigenergy SigenStor MODBUS monitor (managed VC)');
  log('Serial=' + CONFIG.serialId + ' Slave=' + CONFIG.slaveId + ' Poll=' + CONFIG.pollMs + 'ms');

  if (!bindManagedComponents()) {
    log('Check firmware support and the script @meta declaration');
    return;
  }

  setDashboardGroup();
  log('Virtual Components ready');
  poll();
}

init();
