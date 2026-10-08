/* @meta {"vc":{"slaveIdCurrent":{"type":"number","config":{"name":"Current Slave ID","min":1,"max":247,"default_value":133,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"slaveIdTarget":{"type":"number","config":{"name":"Target Slave ID","min":1,"max":247,"default_value":62,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"]}}},"group":{"type":"group","config":{"name":"Wirenboard"}}}} */

/**
 * @title WB-MIR v3 MODBUS Reconfiguration Utility with managed Virtual Components
 * @description One-shot utility to change the WB-MIR v3 slave ID over
 *   portable MbRtuClient RPC calls, using firmware-managed Virtual
 *   Components for both the current and target slave IDs. Writes the new
 *   slave ID to register 128; power-cycle the device afterwards.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3_reconfig.shelly.js
 */

/**
 * WB-MIR v3 - MODBUS Reconfiguration Utility (Managed Virtual Components)
 *
 * Writes holding register 128 (0x0080, Slave ID, RW) to move the device
 * from its current slave ID to a target slave ID.
 *
 * Register source:
 *   https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *
 * IMPORTANT:
 *   - Both reads and writes in this script use the SAME Serial baud/mode
 *     configuration (the device only applies a baud rate CHANGE after a
 *     power cycle; this script does not change baud, only slave ID).
 *     Configure the Serial component for the device's CURRENT baud rate
 *     (e.g. 115200 8N2) before running.
 *   - Changes take effect immediately for the slave ID (no power cycle
 *     required for a slave ID change on WB-MIR v3).
 *   - The current slave ID is written first at slaveIdCurrent; once
 *     confirmed, this script starts addressing the device at
 *     slaveIdTarget for anything afterwards.
 *   - Delete or disable this script after a successful reconfiguration.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using wb_mir_v3_reconfig.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - slaveIdCurrent: Persisted MODBUS server ID the device currently
 *   answers on (configuration, not sensor data)
 * - slaveIdTarget: Persisted MODBUS server ID to write into the device
 * - group: Home-page group containing both slave ID fields
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
  STEP_DELAY: 200,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247,
  DEFAULT_SLAVE_ID_CURRENT: 133,
  DEFAULT_SLAVE_ID_TARGET: 62
};

var REG_SLAVE_ID = 128;

var MANAGED_ROLES = ['slaveIdCurrent', 'slaveIdTarget', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};

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

function getSlaveIdCurrent() {
  var value = clampInteger(
    vc.slaveIdCurrent.getValue(),
    CONFIG.DEFAULT_SLAVE_ID_CURRENT,
    CONFIG.MIN_SLAVE_ID,
    CONFIG.MAX_SLAVE_ID
  );

  if (vc.slaveIdCurrent.getValue() !== value) vc.slaveIdCurrent.setValue(value);
  return value;
}

function getSlaveIdTarget() {
  var value = clampInteger(
    vc.slaveIdTarget.getValue(),
    CONFIG.DEFAULT_SLAVE_ID_TARGET,
    CONFIG.MIN_SLAVE_ID,
    CONFIG.MAX_SLAVE_ID
  );

  if (vc.slaveIdTarget.getValue() !== value) vc.slaveIdTarget.setValue(value);
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
      print('ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
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
    managedComponentKey('slaveIdCurrent', 'number'),
    managedComponentKey('slaveIdTarget', 'number')
  ];
  var i;

  if (!groupConfig || groupConfig.id === undefined) {
    print('ERROR: managed dashboard group has no component ID');
    return;
  }
  for (i = 0; i < members.length; i++) {
    if (!members[i]) {
      print('ERROR: cannot resolve managed dashboard member');
      return;
    }
  }

  Shelly.call('Group.Set', { id: groupConfig.id, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      print('Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    print('Managed dashboard group ready');
  });
}

// ============================================================================
// MODBUS RPC
// ============================================================================

function writeSingleRegister(sid, addr, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: getModbusClientId(),
    sid: sid,
    addr: addr,
    value: value
  }, function(result, errorCode, errorMessage) {
    callback(errorCode === 0, errorCode === 0 ? null : { code: errorCode, message: errorMessage });
  });
}

// ============================================================================
// RECONFIGURATION SEQUENCE
// ============================================================================

function step1WriteSlaveId() {
  var current = getSlaveIdCurrent();
  var target = getSlaveIdTarget();

  print('Step 1/1 - Writing new slave ID: ' + target + ' (reg ' + REG_SLAVE_ID + ') at current slave ' + current);

  writeSingleRegister(current, REG_SLAVE_ID, target, function(success, error) {
    if (!success) {
      print('  FAILED: ' + JSON.stringify(error));
      print('  Check wiring, power, and current settings.');
      return;
    }
    print('  OK');
    printDone(target);
  });
}

function printDone(target) {
  print('');
  print('=========================================');
  print('Reconfiguration complete.');
  print('');
  print('New settings:');
  print('  Slave ID:  ' + target);
  print('=========================================');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!bindManagedComponents()) {
    print('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    print('ERROR: configure the serial component as mb_client at the device\'s current baud/mode');
    return;
  }

  setDashboardGroup();

  print('WB-MIR v3 - MODBUS Reconfiguration Utility (managed VC)');
  print('===========================================');
  print('Current slave: ' + getSlaveIdCurrent());
  print('Target slave:  ' + getSlaveIdTarget());
  print('');

  Timer.set(300, false, step1WriteSlaveId);
}

init();
