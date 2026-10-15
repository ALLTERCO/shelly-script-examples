/* @meta {"vc":{"ROOM_TEMP":{"type":"number","config":{"name":"Room Temp","unit":"degC"}},"HUMIDITY":{"type":"number","config":{"name":"Humidity","unit":"%"}},"FLOOR_TEMP":{"type":"number","config":{"name":"Floor Temp","unit":"degC"}},"RELAY_STATE":{"type":"number","config":{"name":"Relay Status"}},"ALARM":{"type":"number","config":{"name":"Alarm"}},"MODE":{"type":"number","config":{"name":"Mode"}},"FAN_SPEED":{"type":"number","config":{"name":"Fan Speed"}},"SETPOINT":{"type":"number","config":{"name":"Setpoint","unit":"degC"}},"POWER":{"type":"number","config":{"name":"Power"}},"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":1,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"LinkedGo"}}}} */

/**
 * @title LinkedGo ST802 Thermostat + BMS command simulation (managed Virtual Components)
 * @description Reads a LinkedGo ST802 Youth Smart Thermostat over portable
 *   MbRtuClient RPC calls, publishes 9 curated parameters as managed
 *   Virtual Components, and rotates disabled-by-default BMS command
 *   simulation scenarios.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LinkedGo/ST802/st802_bms_vc.shelly.js
 */

/**
 * LinkedGo ST802 Thermostat + BMS Command Simulation (Managed Virtual Components)
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using st802_bms_vc.shelly.js on that firmware.
 *
 * Managed Virtual Component roles:
 * - ROOM_TEMP, HUMIDITY, FLOOR_TEMP, RELAY_STATE, ALARM, MODE, FAN_SPEED,
 *   SETPOINT, POWER: the 9 most valuable parameters
 * - slaveId: Persisted MODBUS server ID (configuration, not sensor data)
 * - group: Home-page group containing all 10
 *
 * The @meta block must remain the first comment and one physical line. Its
 * complete comment, including delimiters, must not exceed 1024 characters;
 * firmware silently ignores declarations beyond that boundary. Every other
 * register (system type, heat/cool select, humidity setpoint, min/max
 * setpoint) is printed to the console every poll instead.
 *
 * BMS command simulation: rotates through 8 preset scenarios every
 * CMD_INTERVAL seconds, each a chained setMode/setSetpoint/setFanSpeed/
 * setPower sequence. Every scenario is disabled by default (ENABLE.* =
 * false) - enable individual scenarios explicitly before relying on this.
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
  POLL_INTERVAL: 30,
  CMD_INTERVAL: 60,
  DEFAULT_SLAVE_ID: 1,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var POWER = { OFF: 0, ON: 1 };
var MODE = { COOLING: 0, DRY: 3, HEATING: 4, FLOOR_HEATING: 5, VENTILATION: 7 };
var FAN = { AUTO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, SPD4: 4, SPD5: 5 };
var RELAYS = { HIGH_SPEED: 0, MEDIUM_SPEED: 1, LOW_SPEED: 2, FAN_COIL_VALVE: 3, FLOOR_VALVE: 4, DRY_CONTACT: 5 };

var ENABLE = {
  CMD_MORNING_HEAT: false,
  CMD_COOLING: false,
  CMD_ECONOMY_HEAT: false,
  CMD_VENTILATION: false,
  CMD_DRY: false,
  CMD_FLOOR_HEAT: false,
  CMD_NIGHT_SETBACK: false,
  CMD_STANDBY: false
};

var VC_KEYS = ['ROOM_TEMP', 'HUMIDITY', 'FLOOR_TEMP', 'RELAY_STATE', 'ALARM', 'MODE', 'FAN_SPEED', 'SETPOINT', 'POWER'];

var ENTITIES = [
  { key: 'POWER', name: 'Power', units: '', addr: 0x1001, scale: 1 },
  { key: 'SYS_TYPE', name: 'System Type', units: '', addr: 0x1003, scale: 1 },
  { key: 'MODE', name: 'Operating Mode', units: '', addr: 0x1004, scale: 1 },
  { key: 'HC_SELECT', name: 'Heat/Cool Select', units: '', addr: 0x1006, scale: 1 },
  { key: 'FAN_SPEED', name: 'Fan Speed', units: '', addr: 0x1007, scale: 1 },
  { key: 'SETPOINT', name: 'Setpoint Temp', units: 'degC', addr: 0x1008, scale: 0.1 },
  { key: 'HUMIDITY_SP', name: 'Humidity Setpoint', units: '%', addr: 0x1009, scale: 0.1 },
  { key: 'MIN_SP', name: 'Min Setpoint', units: 'degC', addr: 0x1018, scale: 0.1 },
  { key: 'MAX_SP', name: 'Max Setpoint', units: 'degC', addr: 0x1019, scale: 0.1 },
  { key: 'ROOM_TEMP', name: 'Room Temperature', units: 'degC', addr: 0x2101, scale: 0.1 },
  { key: 'HUMIDITY', name: 'Humidity', units: '%', addr: 0x2102, scale: 0.1 },
  { key: 'FLOOR_TEMP', name: 'Floor Temperature', units: 'degC', addr: 0x2103, scale: 0.1 },
  { key: 'RELAY_STATE', name: 'Relay Status', units: '', addr: 0x2110, scale: 1 },
  { key: 'ALARM', name: 'Alarm', units: '', addr: 0x211A, scale: 1 }
];

var REG = {};
(function buildRegLookup() {
  var i;
  for (i = 0; i < ENTITIES.length; i++) REG[ENTITIES[i].key] = ENTITIES[i].addr;
})();

var MANAGED_ROLES = VC_KEYS.concat(['slaveId', 'group']);

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  isPolling: false,
  pollTimer: null,
  cmdStep: 0
};

// ============================================================================
// HELPERS
// ============================================================================

function decodeRelayStatus(mask) {
  return {
    highSpeed: !!(mask & (1 << RELAYS.HIGH_SPEED)),
    mediumSpeed: !!(mask & (1 << RELAYS.MEDIUM_SPEED)),
    lowSpeed: !!(mask & (1 << RELAYS.LOW_SPEED)),
    fanCoilValve: !!(mask & (1 << RELAYS.FAN_COIL_VALVE)),
    floorValve: !!(mask & (1 << RELAYS.FLOOR_VALVE)),
    dryContact: !!(mask & (1 << RELAYS.DRY_CONTACT))
  };
}

function modeLabel(v) {
  switch (v) {
    case MODE.COOLING: return 'Cooling';
    case MODE.DRY: return 'Dry';
    case MODE.HEATING: return 'Heating';
    case MODE.FLOOR_HEATING: return 'FloorHeating';
    case MODE.VENTILATION: return 'Ventilation';
    default: return 'Unknown(' + v + ')';
  }
}

function fanLabel(v) {
  switch (v) {
    case FAN.AUTO: return 'Auto';
    case FAN.LOW: return 'Low';
    case FAN.MEDIUM: return 'Medium';
    case FAN.HIGH: return 'High';
    case FAN.SPD4: return 'Speed4';
    case FAN.SPD5: return 'Speed5';
    default: return 'Unknown(' + v + ')';
  }
}

function tempToRaw(degC) {
  return Math.round(degC * 2) * 5;
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
  var members = [];
  var i;

  for (i = 0; i < VC_KEYS.length; i++) {
    members.push(managedComponentKey(VC_KEYS[i], 'number'));
  }
  members.push(managedComponentKey('slaveId', 'number'));

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

function writeSingleRegister(addr, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    value: value
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      callback(errorCode === 0, { code: errorCode, message: errorMessage });
      return;
    }
    callback(true, null);
  });
}

// ============================================================================
// ST802 CONTROL API (call from the Shelly script console)
// ============================================================================

function setPower(onOff, callback) {
  writeSingleRegister(REG.POWER, onOff, function(success, error) {
    if (success) console.log('Power set to ' + (onOff ? 'ON' : 'OFF'));
    else console.log('setPower error: ' + modbusErrorText(error));
    if (callback) callback(success ? null : error, success);
  });
}

function setMode(mode, callback) {
  writeSingleRegister(REG.MODE, mode, function(success, error) {
    if (success) console.log('Mode set to ' + modeLabel(mode));
    else console.log('setMode error: ' + modbusErrorText(error));
    if (callback) callback(success ? null : error, success);
  });
}

function setFanSpeed(speed, callback) {
  writeSingleRegister(REG.FAN_SPEED, speed, function(success, error) {
    if (success) console.log('Fan speed set to ' + fanLabel(speed));
    else console.log('setFanSpeed error: ' + modbusErrorText(error));
    if (callback) callback(success ? null : error, success);
  });
}

function setSetpoint(degC, callback) {
  var raw = tempToRaw(degC);
  writeSingleRegister(REG.SETPOINT, raw, function(success, error) {
    if (success) console.log('Setpoint set to ' + degC + 'degC (raw ' + raw + ')');
    else console.log('setSetpoint error: ' + modbusErrorText(error));
    if (callback) callback(success ? null : error, success);
  });
}

function setHumiditySetpoint(pct, callback) {
  var raw = pct * 10;
  if (raw < 400) raw = 400;
  if (raw > 750) raw = 750;
  writeSingleRegister(REG.HUMIDITY_SP, raw, function(success, error) {
    if (success) console.log('Humidity setpoint set to ' + pct + '% (raw ' + raw + ')');
    else console.log('setHumiditySetpoint error: ' + modbusErrorText(error));
    if (callback) callback(success ? null : error, success);
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function pollNext(index) {
  var item;

  if (index >= ENTITIES.length) {
    state.isPolling = false;
    return;
  }

  item = ENTITIES[index];
  readHoldingRegisters(item.addr, 1, function(values, error) {
    var raw;
    var value;
    var relays;

    if (error) {
      console.log(item.name + ' read error: ' + modbusErrorText(error));
    } else if (!values || values.length < 1) {
      console.log(item.name + ': invalid response');
    } else {
      raw = values[0];
      value = raw * item.scale;

      if (item.key === 'RELAY_STATE') {
        relays = decodeRelayStatus(raw);
        console.log('Relays: Hi=' + (relays.highSpeed ? '1' : '0') +
          ' Med=' + (relays.mediumSpeed ? '1' : '0') +
          ' Lo=' + (relays.lowSpeed ? '1' : '0') +
          ' FanValve=' + (relays.fanCoilValve ? '1' : '0') +
          ' FloorValve=' + (relays.floorValve ? '1' : '0') +
          ' DryContact=' + (relays.dryContact ? '1' : '0'));
      } else if (item.key === 'ALARM') {
        console.log('Alarm: ' + ((raw & 0x01) ? 'Room sensor failure!' : 'OK'));
      } else if (item.key === 'MODE') {
        console.log('Mode: ' + modeLabel(value));
      } else if (item.key === 'FAN_SPEED') {
        console.log('Fan: ' + fanLabel(value));
      } else if (item.key === 'POWER') {
        console.log('Power: ' + (value ? 'ON' : 'OFF'));
      } else {
        console.log(item.name + ': ' + value + ' [' + item.units + ']');
      }

      if (vc[item.key]) vc[item.key].setValue(value);
    }

    pollNext(index + 1);
  });
}

function poll() {
  if (state.isPolling) return;
  state.isPolling = true;
  console.log('--- ST802 status ---');
  pollNext(0);
}

// ============================================================================
// BMS COMMAND SIMULATION
// ============================================================================

var CMD_SCENARIOS = [
  { key: 'CMD_MORNING_HEAT', label: 'Morning start - Heating 22degC, Auto fan', fn: function() {
    setPower(POWER.ON, function() {
      Timer.set(300, false, function() {
        setMode(MODE.HEATING, function() {
          Timer.set(300, false, function() {
            setSetpoint(22.0, function() {
              Timer.set(300, false, function() { setFanSpeed(FAN.AUTO, null); });
            });
          });
        });
      });
    });
  } },
  { key: 'CMD_COOLING', label: 'Occupied - Cooling 24degC, Medium fan', fn: function() {
    setMode(MODE.COOLING, function() {
      Timer.set(300, false, function() {
        setSetpoint(24.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.MEDIUM, null); });
        });
      });
    });
  } },
  { key: 'CMD_ECONOMY_HEAT', label: 'Economy - Heating 20degC, Low fan', fn: function() {
    setMode(MODE.HEATING, function() {
      Timer.set(300, false, function() {
        setSetpoint(20.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.LOW, null); });
        });
      });
    });
  } },
  { key: 'CMD_VENTILATION', label: 'Ventilation only, Auto fan', fn: function() {
    setMode(MODE.VENTILATION, function() {
      Timer.set(300, false, function() { setFanSpeed(FAN.AUTO, null); });
    });
  } },
  { key: 'CMD_DRY', label: 'Dehumidify (Dry mode) 24degC', fn: function() {
    setMode(MODE.DRY, function() {
      Timer.set(300, false, function() { setSetpoint(24.0, null); });
    });
  } },
  { key: 'CMD_FLOOR_HEAT', label: 'Floor heating 21degC', fn: function() {
    setMode(MODE.FLOOR_HEATING, function() {
      Timer.set(300, false, function() { setSetpoint(21.0, null); });
    });
  } },
  { key: 'CMD_NIGHT_SETBACK', label: 'Night setback - Heating 18degC, Low fan', fn: function() {
    setMode(MODE.HEATING, function() {
      Timer.set(300, false, function() {
        setSetpoint(18.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.LOW, null); });
        });
      });
    });
  } },
  { key: 'CMD_STANDBY', label: 'Standby - Power OFF', fn: function() {
    setPower(POWER.OFF, null);
  } }
];

function runNextBmsCommand() {
  var total = CMD_SCENARIOS.length;
  var checked = 0;
  var scenario;

  while (checked < total) {
    scenario = CMD_SCENARIOS[state.cmdStep % total];
    state.cmdStep++;
    checked++;
    if (ENABLE[scenario.key] === false) continue;
    console.log('Sending BMS command: ' + scenario.label);
    scenario.fn();
    return;
  }
  console.log('All command scenarios disabled -- nothing to send.');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('LinkedGo ST802 thermostat + managed Virtual Components');

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

  Timer.set(1000, false, runNextBmsCommand);
  Timer.set(3000, false, poll);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL * 1000, true, poll);
  Timer.set(CONFIG.CMD_INTERVAL * 1000, true, runNextBmsCommand);
}

init();
