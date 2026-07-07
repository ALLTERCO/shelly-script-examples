/**
 * @title Sigenergy SigenStor MODBUS-RTU plant monitor
 * @description Reads SigenStor plant PV, battery, grid, load, SOC, grid state, and status values into Virtual Components with cloud logging.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Sigenergy/SigenStor/sigenstor_plant_vc.shelly.js
 */

/**
 * Sigenergy SigenStor MODBUS-RTU Plant Monitor
 *
 * Firmware requirements: Shelly Pro firmware with scripting, Virtual
 * Components, Shelly Pro RS485 Addon, and `MbRtuClient.*` RPC support.
 *
 * Hardware:
 * - Shelly Pro device with Shelly Pro RS485 Addon
 * - Sigenergy RS485-1 wired to the RS485 Addon:
 *   - A+  -> pin 15
 *   - B-  -> pin 16
 *   - GND -> pin 11
 *
 * Required device configuration:
 * - Shelly Pro RS485 Addon present
 * - Serial id 100 configured as MODBUS client (`mb_client`)
 * - Serial settings: 9600 baud, 8N1
 * - Sigenergy MODBUS enabled by installer
 * - Sigenergy RS485-1 configured as MODBUS-RTU slave, 9600 8N1
 *
 * Before use, set CONFIG.pvMaxW and CONFIG.inverterMaxW for the installation.
 *
 * Virtual Components created in display order:
 * - group:200    Sigenergy SigenStor
 * - number:200   PV Power, W
 * - enum:201     Battery Status
 * - number:201   Battery SOC, %
 * - number:202   Battery Power, W, positive means charging
 * - boolean:200  On Grid
 * - number:203   Grid Power, W, positive means export
 * - enum:200     Load Status
 * - number:204   Load Power, W
 * - enum:202     Operating Mode
 *
 * Cloud metadata:
 * - Number components use `meta.cloud: ['measurement']` for statistics.
 * - Boolean and enum components use `meta.cloud: ['log']` for state-change
 *   history.
 * - Enum components use `meta.ui.titles` so the Shelly app displays labels.
 *
 * Protocol notes:
 * - Sigenergy plant data uses MODBUS slave ID 247.
 * - Registers are read with FC04 (`MbRtuClient.ReadInputRegisters`).
 * - PDU address is the full register number from the Sigenergy protocol.
 * - If reads return `-115` with `id 0`, A/B is commonly reversed.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  serialId: 100,
  slaveId: 247,
  pollMs: 1000,
  heartbeatEvery: 10,
  pvMaxW: 10000, // Set this: PV array maximum power in W.
  inverterMaxW: 10000, // Set this: inverter rated power in W.
};

var COMPONENT_IDS = {
  group: 200,
  pvPower: 200,
  batterySoc: 201,
  batteryPower: 202,
  gridPower: 203,
  loadPower: 204,
  onGrid: 200,
  loadStatus: 200,
  batteryStatus: 201,
  operatingMode: 202,
};

var ICON_COLOR = '%2323D3B4';

function iconUrl(name) {
  return 'https://api.iconify.design/solar:' + name + '-bold-duotone.svg?color=' + ICON_COLOR;
}

var ICONS = {
  pvPower: iconUrl('sun-2'),
  batterySoc: iconUrl('battery-full'),
  batteryPower: iconUrl('battery-charge'),
  gridPower: iconUrl('bolt'),
  loadPower: iconUrl('home-2'),
  onGrid: iconUrl('plug-circle'),
  loadStatus: iconUrl('chart-2'),
  batteryStatus: iconUrl('battery-charge'),
  operatingMode: iconUrl('settings'),
};

var COMPONENTS = [
  {
    type: 'number',
    id: COMPONENT_IDS.pvPower,
    key: 'number:' + COMPONENT_IDS.pvPower,
    name: 'PV Power',
    unit: 'W',
    icon: ICONS.pvPower,
    min: 0,
    max: CONFIG.pvMaxW,
    step: 1,
    view: 'progressbar',
    stat: 'measurement',
    vcHandle: null,
  },
  {
    type: 'enum',
    id: COMPONENT_IDS.batteryStatus,
    key: 'enum:' + COMPONENT_IDS.batteryStatus,
    name: 'Battery Status',
    options: ['Charging', 'Idle', 'Discharging'],
    icon: ICONS.batteryStatus,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.batterySoc,
    key: 'number:' + COMPONENT_IDS.batterySoc,
    name: 'Battery SOC',
    unit: '%',
    icon: ICONS.batterySoc,
    min: 0,
    max: 100,
    step: 0.1,
    view: 'progressbar',
    stat: 'measurement',
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.batteryPower,
    key: 'number:' + COMPONENT_IDS.batteryPower,
    name: 'Battery Power',
    unit: 'W',
    icon: ICONS.batteryPower,
    min: -50000,
    max: 50000,
    step: 1,
    view: 'label',
    stat: 'measurement',
    vcHandle: null,
  },
  {
    type: 'boolean',
    id: COMPONENT_IDS.onGrid,
    key: 'boolean:' + COMPONENT_IDS.onGrid,
    name: 'On Grid',
    icon: ICONS.onGrid,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.gridPower,
    key: 'number:' + COMPONENT_IDS.gridPower,
    name: 'Grid Power',
    unit: 'W',
    icon: ICONS.gridPower,
    min: -50000,
    max: 50000,
    step: 1,
    view: 'label',
    stat: 'measurement',
    vcHandle: null,
  },
  {
    type: 'enum',
    id: COMPONENT_IDS.loadStatus,
    key: 'enum:' + COMPONENT_IDS.loadStatus,
    name: 'Load Status',
    options: ['Low', 'Medium', 'High', 'Peak'],
    icon: ICONS.loadStatus,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.loadPower,
    key: 'number:' + COMPONENT_IDS.loadPower,
    name: 'Load Power',
    unit: 'W',
    icon: ICONS.loadPower,
    min: 0,
    max: CONFIG.inverterMaxW,
    step: 1,
    view: 'progressbar',
    stat: 'measurement',
    vcHandle: null,
  },
  {
    type: 'enum',
    id: COMPONENT_IDS.operatingMode,
    key: 'enum:' + COMPONENT_IDS.operatingMode,
    name: 'Operating Mode',
    options: ['Self-Consumption', 'AI', 'TOU', 'Feed-in', 'Remote EMS', 'Custom', 'Unknown'],
    icon: ICONS.operatingMode,
    vcHandle: null,
  },
];

var EMS_MODES = {
  0: 'Self-Consumption',
  1: 'AI',
  2: 'TOU',
  5: 'Feed-in',
  7: 'Remote EMS',
  9: 'Custom',
};

// ============================================================================
// STATE
// ============================================================================

var state = {
  tick: 0,
  pollTimer: null,
  pollActive: false,
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

// Enum options are stored as keys. Map each key to itself so the Shelly app
// renders a visible label for every enum value.
function optionTitles(options) {
  var titles = {};
  var i;

  for (i = 0; i < options.length; i++) {
    titles[options[i]] = options[i];
  }

  return titles;
}

function componentConfig(component) {
  var ui = {
    icon: component.icon,
  };

  if (component.type === 'boolean') {
    ui.view = 'label';
    ui.titles = {
      'false': 'off-grid',
      'true': 'on-grid',
    };

    return {
      name: component.name,
      default_value: false,
      meta: {
        ui: ui,
        cloud: ['log'],
      },
    };
  }

  if (component.type === 'enum') {
    ui.view = 'label';
    ui.titles = optionTitles(component.options);
    return {
      name: component.name,
      options: component.options,
      default_value: component.options[0],
      meta: {
        ui: ui,
        cloud: ['log'],
      },
    };
  }

  ui.view = component.view;
  ui.unit = component.unit;
  ui.step = component.step;

  return {
    name: component.name,
    default_value: 0,
    min: component.min,
    max: component.max,
    meta: {
      ui: ui,
      cloud: [component.stat],
    },
  };
}

function setComponent(component, value) {
  if (!component.vcHandle) {
    component.vcHandle = Virtual.getHandle(component.key);
  }

  if (!component.vcHandle) {
    log('Missing Virtual Component ' + component.key);
    return;
  }

  component.vcHandle.setValue(value);
}

function findComponent(key) {
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    if (COMPONENTS[i].key === key) return COMPONENTS[i];
  }

  return null;
}

function setNumber(id, value) {
  var component = findComponent('number:' + id);
  if (component) setComponent(component, value);
}

function setBoolean(id, value) {
  var component = findComponent('boolean:' + id);
  if (component) setComponent(component, value);
}

function setEnum(id, value) {
  var component = findComponent('enum:' + id);
  if (component) setComponent(component, value);
}

function schedulePoll() {
  if (state.pollTimer) Timer.clear(state.pollTimer);
  state.pollTimer = Timer.set(CONFIG.pollMs, false, poll);
}

// ============================================================================
// VIRTUAL COMPONENT SETUP
// ============================================================================

function ensureComponent(type, id, config, cb) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finalize() {
    var finalHandle = Virtual.getHandle(key);
    if (!finalHandle) {
      log('Failed to get handle for ' + key);
      cb(false);
      return;
    }

    finalHandle.setConfig(config);
    cb(true);
  }

  if (handle) {
    handle.setConfig(config);
    cb(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      cb(false);
      return;
    }

    finalize();
  });
}

function setGroupMembers(done) {
  var members = [];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) members.push(COMPONENTS[i].key);

  Shelly.call('Group.Set', { id: COMPONENT_IDS.group, value: members }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Group.Set failed: ' + errCode + ' ' + errMsg);
    }

    done();
  });
}

function setupComponents(done) {
  var specs = [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: { name: 'Sigenergy SigenStor' },
    },
  ];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    specs.push({
      type: COMPONENTS[i].type,
      id: COMPONENTS[i].id,
      config: componentConfig(COMPONENTS[i]),
    });
  }

  function next(index) {
    if (index >= specs.length) {
      for (i = 0; i < COMPONENTS.length; i++) {
        COMPONENTS[i].vcHandle = Virtual.getHandle(COMPONENTS[i].key);
      }
      setGroupMembers(done);
      return;
    }

    ensureComponent(specs[index].type, specs[index].id, specs[index].config, function() {
      Timer.set(80, false, function() {
        next(index + 1);
      });
    });
  }

  next(0);
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

      setNumber(COMPONENT_IDS.pvPower, pv);
      setNumber(COMPONENT_IDS.batterySoc, soc);
      setNumber(COMPONENT_IDS.batteryPower, battery);
      setNumber(COMPONENT_IDS.gridPower, gridExport);
      setNumber(COMPONENT_IDS.loadPower, load);
      setBoolean(COMPONENT_IDS.onGrid, onGrid);
      setEnum(COMPONENT_IDS.loadStatus, loadStatus(load));
      setEnum(COMPONENT_IDS.batteryStatus, batteryStatus(battery));
      setEnum(COMPONENT_IDS.operatingMode, operatingMode(emsMode));

      state.tick++;
      if (state.tick % CONFIG.heartbeatEvery === 0) {
        log(
          'PV=' +
            pv +
            'W SOC=' +
            soc +
            '% Bat=' +
            battery +
            'W Grid=' +
            gridExport +
            'W Load=' +
            load +
            'W(' +
            loadStatus(load) +
            ') Mode=' +
            operatingMode(emsMode) +
            ' OnGrid=' +
            onGrid
        );
      }

      state.pollActive = false;
      schedulePoll();
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Sigenergy SigenStor MODBUS monitor enhanced');
  log('Serial=' + CONFIG.serialId + ' Slave=' + CONFIG.slaveId + ' Poll=' + CONFIG.pollMs + 'ms');

  setupComponents(function() {
    log('Virtual Components ready');
    poll();
  });
}

init();
