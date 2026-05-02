/**
 * @title V-TAC VT-66036103 six-register example + Virtual Components
 * @description Reads six currently inferred live holding registers from the
 *   V-TAC VT-66036103, updates Shelly Virtual Components, and prints values
 *   to the console every 15 seconds.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/V-TAC/vtac_six_register_example_vc.shelly.js
 */

/**
 * V-TAC VT-66036103 Six-Register Example + Virtual Components
 *
 * This is a compact example built from current live-testing results.
 * It focuses on the six strongest current live register candidates:
 * - PV1 voltage
 * - PV2 voltage
 * - input voltage
 * - output voltage
 * - power
 * - frequency
 *
 * Virtual Components created:
 * - group:200   V-TAC Six Registers
 * - number:200  PV1 Voltage
 * - number:201  PV2 Voltage
 * - number:202  Input Voltage
 * - number:203  Output Voltage
 * - number:204  Power
 * - number:205  Frequency
 *
 * Important:
 * - These names and scales are still inferred, not vendor-confirmed.
 * - This script is intended as a compact example, not a final production map.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
};

var COMPONENT_IDS = {
  group: 200,
  firstNumber: 200,
};

var ICONS = {
  pv1: 'https://api.iconify.design/mdi/solar-panel-large.svg?color=white',
  inputVoltage: 'https://api.iconify.design/mdi/transmission-tower.svg?color=white',
  outputVoltage: 'https://api.iconify.design/mdi/home-lightning-bolt-outline.svg?color=white',
  power: 'https://api.iconify.design/mdi/flash.svg?color=white',
  frequency: 'https://api.iconify.design/mdi/sine-wave.svg?color=white',
};

var ENTITIES = [
  { name: 'PV1 Voltage', addr: 5776, scale: 0.1, unit: 'V', vcId: 'number:200', vcHandle: null },
  { name: 'PV2 Voltage', addr: 5778, scale: 0.1, unit: 'V', vcId: 'number:201', vcHandle: null },
  { name: 'Input Voltage', addr: 5784, scale: 0.1, unit: 'V', vcId: 'number:202', vcHandle: null },
  { name: 'Output Voltage', addr: 5786, scale: 0.1, unit: 'V', vcId: 'number:203', vcHandle: null },
  { name: 'Power', addr: 5790, scale: 0.01, unit: 'W', vcId: 'number:204', vcHandle: null },
  { name: 'Frequency', addr: 5792, scale: 0.01, unit: 'Hz', vcId: 'number:205', vcHandle: null },
];

var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  print('[vtac-6reg-vc] ' + msg);
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildFrame(addr, qty) {
  var frame = [
    CONFIG.SLAVE_ID & 0xFF,
    0x03,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function formatValue(raw, scale) {
  var value = raw * scale;
  if (scale === 1) return '' + value;
  if (scale === 0.1) return value.toFixed(1);
  if (scale === 0.01) return value.toFixed(2);
  return '' + value;
}

function toUiValue(raw, scale) {
  var value = raw * scale;

  if (scale === 0.1) return Math.round(value * 10) / 10;
  if (scale === 0.01) return Math.round(value * 100) / 100;

  return value;
}

function updateVc(entity, raw) {
  if (!entity || !entity.vcHandle) return;
  entity.vcHandle.setValue(toUiValue(raw, entity.scale));
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

function getComponentSpecs() {
  var specs = [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: {
        name: 'V-TAC Six Registers',
      },
    },
  ];
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    var ui = {
      view: 'progressbar',
      unit: ENTITIES[i].unit,
      icon: null,
      step: 1,
    };
    var min = -999999999999999;
    var max = 999999999999999;
    var defaultValue = 0;
    var persisted = false;

    if (i < 2) {
      min = 125;
      max = 500;
      defaultValue = 125;
      persisted = true;
      ui.icon = ICONS.pv1;
    } else if (i === 2) {
      ui.icon = ICONS.inputVoltage;
    } else if (i === 3) {
      ui.icon = ICONS.outputVoltage;
    } else if (i === 4) {
      ui.icon = ICONS.power;
    } else if (i === 5) {
      min = 49;
      max = 51;
      defaultValue = 49;
      persisted = true;
      ui.icon = ICONS.frequency;
    }

    specs.push({
      type: 'number',
      id: COMPONENT_IDS.firstNumber + i,
      config: {
        name: ENTITIES[i].name,
        min: min,
        max: max,
        persisted: persisted,
        default_value: defaultValue,
        meta: {
          ui: ui,
        },
      },
    });
  }

  return specs;
}

function ensureComponents(index, specs, done) {
  if (index >= specs.length) {
    var members = [];
    var i;

    for (i = 0; i < ENTITIES.length; i++) members.push(ENTITIES[i].vcId);

    Shelly.call(
      'Group.Set',
      {
        id: COMPONENT_IDS.group,
        value: members,
      },
      function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed: ' + errCode + ' ' + errMsg);
          done(false);
          return;
        }

        done(true);
      }
    );
    return;
  }

  ensureComponent(specs[index].type, specs[index].id, specs[index].config, function(ok) {
    if (!ok) {
      done(false);
      return;
    }

    Timer.set(1, false, function() {
      ensureComponents(index + 1, specs, done);
    });
  });
}

function bindVcHandles() {
  var i;

  for (i = 0; i < ENTITIES.length; i++) {
    ENTITIES[i].vcHandle = Virtual.getHandle(ENTITIES[i].vcId);
  }
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRead(addr, callback) {
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var done = state.pendingRequest.callback;
      state.pendingRequest = null;
      done('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(buildFrame(addr, 1)));
}

function onReceive(data) {
  if (!state.pendingRequest || !data || data.length === 0) return;

  var i;
  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) return;
  if (state.rxBuffer.length < 7) return;

  var frame = state.rxBuffer.slice(0, 7);
  var crc = calcCRC(frame.slice(0, 5));
  var recvCrc = frame[5] | (frame[6] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimeout();

  var done = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  if (frame[1] & 0x80) {
    done('Exception: 0x' + frame[2].toString(16).toUpperCase(), null);
    return;
  }

  done(null, (frame[3] << 8) | frame[4]);
}

// ============================================================================
// POLL LOOP
// ============================================================================

function pollEntities() {
  var results = [];

  function readNext(index) {
    if (index >= ENTITIES.length) {
      var i;
      print('--- V-TAC six-register example + VC ---');
      for (i = 0; i < results.length; i++) print(results[i]);
      print('');
      return;
    }

    var entity = ENTITIES[index];
    sendRead(entity.addr, function(err, raw) {
      if (err) {
        results.push(entity.name + ': ERROR (' + err + ')');
      } else {
        updateVc(entity, raw);
        results.push(entity.name + ': ' + formatValue(raw, entity.scale) + ' [' + entity.unit + '] raw=' + raw);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  readNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function startPolling() {
  print('Polling ' + ENTITIES.length + ' registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, pollEntities);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollEntities);
}

function init() {
  print('V-TAC VT-66036103 six-register example + VC');
  print('============================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);

  ensureComponents(0, getComponentSpecs(), function(ok) {
    if (!ok) {
      print('ERROR: Virtual component setup failed');
      return;
    }

    bindVcHandles();
    startPolling();
  });
}

init();
