/* @meta {"vc":{"outputConfig":{"type":"enum","config":{"name":"Output Config","options":["0","1","2"],"default_value":"0"}},"chargeConfig":{"type":"enum","config":{"name":"Charge Config","options":["0","1","2"],"default_value":"0"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Growatt"}}}} */

/**
 * @title Vc Modes Growatt with managed Virtual Components
 * @description Application example demonstrating enum-based Virtual
 *   Component mode selectors for Growatt inverters, using portable
 *   MbRtuClient RPC writes and a firmware-managed Modbus Slave ID.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/application_examples/vc_modes_growatt_vc.shelly.js
 */

/**
 * Growatt VC Modes Example (Managed Virtual Components)
 *
 * NOTE: option values are the raw u16 register values this script writes.
 * Adjust the option list to match your inverter's documented mode codes.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using vc_modes_growatt.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - outputConfig: dropdown, writes register 1 (0/1/2)
 * - chargeConfig: dropdown, writes register 2 (0/1/2)
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all three
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary.
 *
 * Writes are gated by ENABLE_MODBUS_LOCAL (default off, matching the
 * original example) so this stays UI-demo-only until wired to real
 * hardware. The original's HTTP-remote read path (a second Shelly's
 * RPC proxy) is intentionally not ported - it targets a different
 * device's network address, unrelated to this script's own MbRtuClient.
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
  ENABLE_MODBUS_LOCAL: false,
  OUTPUT_CONFIG_ADDR: 1,
  CHARGE_CONFIG_ADDR: 2,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var MANAGED_ROLES = ['outputConfig', 'chargeConfig', 'slaveId', 'group'];

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
  var members = [
    managedComponentKey('outputConfig', 'enum'),
    managedComponentKey('chargeConfig', 'enum'),
    managedComponentKey('slaveId', 'number')
  ];
  var i;

  if (!groupConfig || groupConfig.id === undefined) {
    console.log('ERROR: managed dashboard group has no component ID');
    return;
  }
  for (i = 0; i < members.length; i++) {
    if (!members[i]) {
      console.log('ERROR: cannot resolve managed dashboard member');
      return;
    }
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

function writeHoldingRegister(addr, value) {
  if (!CONFIG.ENABLE_MODBUS_LOCAL) return;

  Shelly.call('MbRtuClient.WriteHoldingRegisters', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    values: [value]
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      console.log('Write error: ' + modbusErrorText({ code: errorCode, message: errorMessage }));
    }
  });
}

// ============================================================================
// MODE HANDLERS
// ============================================================================

function initModes() {
  vc.outputConfig.on('change', function(ev) {
    console.log('Output Config: ' + ev.value);
    writeHoldingRegister(CONFIG.OUTPUT_CONFIG_ADDR, Number(ev.value));
  });

  vc.chargeConfig.on('change', function(ev) {
    console.log('Charge Config: ' + ev.value);
    writeHoldingRegister(CONFIG.CHARGE_CONFIG_ADDR, Number(ev.value));
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Growatt VC modes example (managed VC)');

  if (!bindManagedComponents()) {
    console.log('Check firmware support and the script @meta declaration');
    return;
  }

  if (CONFIG.ENABLE_MODBUS_LOCAL && !isModbusClientReady()) {
    console.log('ERROR: configure the serial component as mb_client at 9600 8N1');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    console.log('Modbus Slave ID changed -> ' + getSlaveId());
  });

  initModes();
}

init();
