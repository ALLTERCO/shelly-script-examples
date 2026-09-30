/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"DFRobot"}}}} */

/**
 * @title DFRobot SEN0492 with managed Virtual Components
 * @description Reads distance and status from a DFRobot SEN0492 RS-485
 *   laser ranging sensor over MODBUS-RTU using portable MbRtuClient RPC
 *   calls and a firmware-managed Modbus Slave ID.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/DFRobot/SEN0492/sen0492.shelly.js
 */

/**
 * DFRobot SEN0492 MODBUS-RTU Reader (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using sen0492.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing slaveId
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. This script
 * only exposes the Modbus Slave ID as a Virtual Component; distance and
 * status are printed to the console every poll instead.
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
  UPDATE_RATE: 5,
  DISTANCE_ADDR: 0x34,
  STATUS_ADDR: 0x35,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var STATUS_NAMES = {
  0x00: 'Valid',
  0x01: 'Sigma Fail',
  0x02: 'Signal Fail',
  0x03: 'Min Range Fail',
  0x04: 'Phase Fail',
  0x05: 'Hardware Fail',
  0x07: 'No Update'
};

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  isPolling: false,
  pollTimer: null
};

// ============================================================================
// HELPERS
// ============================================================================

function statusName(code) {
  var name = STATUS_NAMES[code];
  return name !== undefined ? name : 'Unknown (0x' + code.toString(16) + ')';
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

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;

  readHoldingRegisters(CONFIG.DISTANCE_ADDR, 1, function(distanceValues, distanceError) {
    if (distanceError) {
      console.log('Distance read error: ' + modbusErrorText(distanceError));
      state.isPolling = false;
      return;
    }

    readHoldingRegisters(CONFIG.STATUS_ADDR, 1, function(statusValues, statusError) {
      var distance;
      var status;

      state.isPolling = false;
      if (statusError) {
        console.log('Status read error: ' + modbusErrorText(statusError));
        return;
      }
      if (!distanceValues || !statusValues) {
        console.log('SEN0492: invalid response');
        return;
      }

      distance = distanceValues[0];
      status = statusValues[0];
      console.log('Distance: ' + distance + ' [mm]  Status: ' + statusName(status));
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('DFRobot SEN0492 MODBUS-RTU reader (managed VC)');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 115200 8N1');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    console.log('Modbus Slave ID changed -> ' + getSlaveId());
  });

  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.UPDATE_RATE * 1000, true, poll);
}

init();
