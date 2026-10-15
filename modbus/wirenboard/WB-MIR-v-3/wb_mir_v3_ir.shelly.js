/* @meta {"vc":{"slaveId":{"type":"number","config":{"name":"Slave ID","min":1,"max":247,"default_value":62,"persisted":true,"meta":{"ui":{"view":"field","step":1},"cloud":["status"],"role":"modbus_id"}}},"group":{"type":"group","config":{"name":"Wirenboard"}}}} */

/**
 * @title WB-MIR v3 IR Utility with managed Virtual Components
 * @description Dedicated MODBUS-RTU utility for WB-MIR v3 infrared
 *   functions over portable MbRtuClient RPC calls and a firmware-managed
 *   Modbus Slave ID. Supports learning IR commands to ROM or RAM, playing
 *   stored commands, dumping IR buffers, and erasing all saved commands.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3_ir.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - Infrared Utility (Managed Virtual Components)
 *
 * This script is dedicated to the WB-MIR v3 IR transceiver registers.
 * It does not poll temperature or button counters. Instead, it performs a
 * single IR-related operation selected in CONFIG.ACTION.
 *
 * Supported actions:
 *   - play_rom      Play a command already stored in ROM slot N
 *   - learn_rom     Learn one IR command from a remote into ROM slot N
 *   - learn_ram     Learn one IR command into RAM only, then dump the buffer
 *   - play_ram      Play the IR command currently stored in RAM buffer
 *   - dump_rom      Open ROM slot N for editing and print its raw IR buffer
 *   - erase_all_rom Delete all saved ROM IR commands
 *
 * Key IR registers from the Wirenboard IR manual:
 *   5000  Erase all ROM commands
 *   5001  Learn command into RAM
 *   5002  Play command from RAM
 *   5500  Play command from ROM by slot number
 *   5501  Open ROM command for editing in holding registers 2000+
 *   5502  Learn command into ROM by slot number
 *   2000+ Raw IR buffer in holding registers
 *
 * Notes:
 *   - Slot numbering is 1-based for the WB-MIR v3 IR command banks.
 *   - Only one IR operation can be active at a time; the device returns BUSY
 *     or an exception if another IR job is already running.
 *   - For reliable learning, point the remote at the WB-MIR receiver and press
 *     the remote button once from close range during the learn window.
 *
 * Device compatibility: Shelly devices exposing an MbRtuClient component
 * (e.g. Pro RS485 Add-on). MODBUS client component ID 100 (Pro RS485
 * Add-on) is detected automatically; other devices use client ID 0.
 *
 * Known limitation: Shelly Pill Gen3 firmware 2.0.1-ge1a198b reboots when a
 * script containing even a minimal managed VC declaration is started. Keep
 * using wb_mir_v3_ir.shelly.js on that firmware.
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
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *   WB-MIR IR Manual: https://wiki.wirenboard.com/wiki/WB-MSx_Consumer_IR_Manual
 *
 * @see https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Virtual/#managed-virtual-components
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  // play_rom | learn_rom | learn_ram | play_ram | dump_rom | erase_all_rom
  ACTION: 'play_rom',

  // WB-MIR IR banks are 1-based.
  ROM_SLOT: 1,

  OP_TIMEOUT: 20000,
  POLL_INTERVAL: 250,
  LEARN_WINDOW_MS: 10000,

  BUFFER_START: 2000,
  BUFFER_CHUNK_REGS: 32,
  BUFFER_MAX_REGS: 256,

  DEFAULT_SLAVE_ID: 62,
  MIN_SLAVE_ID: 1,
  MAX_SLAVE_ID: 247
};

var REG = {
  ERASE_ALL_ROM: 5000,
  LEARN_RAM: 5001,
  PLAY_RAM: 5002,
  PLAY_ROM: 5500,
  EDIT_ROM: 5501,
  LEARN_ROM: 5502,
  BUFFER_START: 2000
};

var MANAGED_ROLES = ['slaveId', 'group'];

// ============================================================================
// STATE
// ============================================================================

var vc = {};
var state = {
  opTimer: null
};

// ============================================================================
// HELPERS
// ============================================================================

function fail(msg) {
  if (state.opTimer) {
    Timer.clear(state.opTimer);
    state.opTimer = null;
  }
  print('[WB-MIR IR] ERROR: ' + msg);
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
      print('[WB-MIR IR] ERROR: managed Virtual Component role not available: ' + MANAGED_ROLES[i]);
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
    print('[WB-MIR IR] ERROR: managed dashboard group has no component ID');
    return;
  }
  if (!members[0]) {
    print('[WB-MIR IR] ERROR: cannot resolve managed dashboard member');
    return;
  }

  Shelly.call('Group.Set', { id: groupConfig.id, value: members }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      print('[WB-MIR IR] Group.Set failed: ' + errorCode + ' ' + errorMessage);
      return;
    }
    print('[WB-MIR IR] Managed dashboard group ready');
  });
}

// ============================================================================
// MODBUS RPC
// ============================================================================

function writeSingleRegister(addr, value, callback) {
  Shelly.call('MbRtuClient.WriteSingleRegister', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    value: value
  }, function(result, errorCode, errorMessage) {
    callback(errorCode === 0 ? null : { code: errorCode, message: errorMessage });
  });
}

function readHoldingRegisters(addr, qty, callback) {
  Shelly.call('MbRtuClient.ReadHoldingRegisters', {
    id: getModbusClientId(),
    sid: getSlaveId(),
    addr: addr,
    qty: qty
  }, function(result, errorCode, errorMessage) {
    if (errorCode !== 0 || !result || !result.values) {
      callback({ code: errorCode, message: errorMessage }, null);
      return;
    }
    callback(null, result.values);
  });
}

// ============================================================================
// IR HELPERS
// ============================================================================

function validateSlot() {
  if (CONFIG.ROM_SLOT < 1 || CONFIG.ROM_SLOT > 80) {
    fail('CONFIG.ROM_SLOT must be between 1 and 80');
    return false;
  }
  return true;
}

function monitorRegisterZero(reg, label, callback) {
  var remainingMs = CONFIG.OP_TIMEOUT;

  function poll() {
    readHoldingRegisters(reg, 1, function(err, regs) {
      var v;
      if (err) {
        callback(err);
        return;
      }
      v = regs[0];
      print(label + ' reg ' + reg + ' = ' + v);
      if (v === 0) {
        callback(null);
        return;
      }
      if (v === 0xFFFF) {
        callback('Device reported error 0xFFFF');
        return;
      }
      remainingMs -= CONFIG.POLL_INTERVAL;
      if (remainingMs <= 0) {
        callback(label + ' timeout');
        return;
      }
      Timer.set(CONFIG.POLL_INTERVAL, false, poll);
    });
  }

  poll();
}

function findDoubleZero(buf) {
  var i;
  for (i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0) return i;
  }
  return -1;
}

function printIrBuffer(buf) {
  var term = findDoubleZero(buf);
  var last = term >= 0 ? term + 2 : buf.length;
  var i;
  print('IR buffer words: ' + last);
  for (i = 0; i < last; i++) {
    print('  [' + i + '] = ' + buf[i]);
  }
}

function dumpIrBuffer(callback) {
  var all = [];

  function readChunk(offset) {
    var addr = CONFIG.BUFFER_START + offset;
    var remaining = CONFIG.BUFFER_MAX_REGS - offset;
    var qty = remaining > CONFIG.BUFFER_CHUNK_REGS ? CONFIG.BUFFER_CHUNK_REGS : remaining;
    var i;
    var term;

    if (qty <= 0) {
      callback(null, all);
      return;
    }

    readHoldingRegisters(addr, qty, function(err, regs) {
      if (err) {
        callback(err, null);
        return;
      }

      for (i = 0; i < regs.length; i++) all.push(regs[i]);

      term = findDoubleZero(all);
      if (term >= 0 || all.length >= CONFIG.BUFFER_MAX_REGS) {
        callback(null, all);
        return;
      }

      Timer.set(50, false, function() {
        readChunk(offset + qty);
      });
    });
  }

  readChunk(0);
}

// ============================================================================
// ACTIONS
// ============================================================================

function actionPlayRom() {
  if (!validateSlot()) return;
  print('Playing IR command from ROM slot ' + CONFIG.ROM_SLOT + '...');
  writeSingleRegister(REG.PLAY_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('play_rom start failed: ' + JSON.stringify(err));
      return;
    }
    monitorRegisterZero(REG.PLAY_ROM, 'play_rom', function(err) {
      if (err) {
        fail('play_rom failed: ' + err);
        return;
      }
      print('IR playback complete.');
    });
  });
}

function actionLearnRom() {
  if (!validateSlot()) return;
  print('Learning IR command into ROM slot ' + CONFIG.ROM_SLOT + '...');
  print('Point the remote at WB-MIR and press the desired button once.');
  writeSingleRegister(REG.LEARN_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('learn_rom start failed: ' + JSON.stringify(err));
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_ROM, 0, function(stopErr) {
        if (stopErr) {
          fail('learn_rom stop failed: ' + JSON.stringify(stopErr));
          return;
        }
        print('Learn window closed for ROM slot ' + CONFIG.ROM_SLOT + '.');
      });
    });
  });
}

function actionLearnRam() {
  print('Learning IR command into RAM...');
  print('Point the remote at WB-MIR and press the desired button once.');
  writeSingleRegister(REG.LEARN_RAM, 1, function(err) {
    if (err) {
      fail('learn_ram start failed: ' + JSON.stringify(err));
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_RAM, 0, function(stopErr) {
        if (stopErr) {
          fail('learn_ram stop failed: ' + JSON.stringify(stopErr));
          return;
        }
        print('Learn window closed. Dumping RAM buffer...');
        dumpIrBuffer(function(dumpErr, buf) {
          if (dumpErr) {
            fail('buffer dump failed: ' + JSON.stringify(dumpErr));
            return;
          }
          printIrBuffer(buf);
        });
      });
    });
  });
}

function actionPlayRam() {
  print('Playing IR command from RAM buffer...');
  writeSingleRegister(REG.PLAY_RAM, 1, function(err) {
    if (err) {
      fail('play_ram start failed: ' + JSON.stringify(err));
      return;
    }
    monitorRegisterZero(REG.PLAY_RAM, 'play_ram', function(doneErr) {
      if (doneErr) {
        fail('play_ram failed: ' + doneErr);
        return;
      }
      print('RAM playback complete.');
    });
  });
}

function actionDumpRom() {
  if (!validateSlot()) return;
  print('Opening ROM slot ' + CONFIG.ROM_SLOT + ' for buffer dump...');
  writeSingleRegister(REG.EDIT_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail('dump_rom open failed: ' + JSON.stringify(err));
      return;
    }

    dumpIrBuffer(function(dumpErr, buf) {
      if (dumpErr) {
        fail('dump_rom read failed: ' + JSON.stringify(dumpErr));
        return;
      }
      printIrBuffer(buf);
      writeSingleRegister(REG.EDIT_ROM, 0, function(closeErr) {
        if (closeErr) {
          fail('dump_rom close failed: ' + JSON.stringify(closeErr));
          return;
        }
        print('ROM slot ' + CONFIG.ROM_SLOT + ' closed.');
      });
    });
  });
}

function actionEraseAllRom() {
  print('Erasing all IR commands from ROM...');
  writeSingleRegister(REG.ERASE_ALL_ROM, 1, function(err) {
    if (err) {
      fail('erase_all_rom failed: ' + JSON.stringify(err));
      return;
    }
    print('All ROM IR commands erase requested.');
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  if (!bindManagedComponents()) {
    print('[WB-MIR IR] Check firmware support and the script @meta declaration');
    return;
  }

  if (!isModbusClientReady()) {
    print('[WB-MIR IR] ERROR: configure the serial component as mb_client at 9600 8N2');
    return;
  }

  setDashboardGroup();
  vc.slaveId.on('change', function() {
    print('[WB-MIR IR] Modbus Slave ID changed -> ' + getSlaveId());
  });

  print('WB-MIR v3 - IR Utility (managed VC)');
  print('======================');
  print('Action: ' + CONFIG.ACTION);
  print('Slave ID: ' + getSlaveId());
  print('');

  Timer.set(300, false, function() {
    if (CONFIG.ACTION === 'play_rom') {
      actionPlayRom();
    } else if (CONFIG.ACTION === 'learn_rom') {
      actionLearnRom();
    } else if (CONFIG.ACTION === 'learn_ram') {
      actionLearnRam();
    } else if (CONFIG.ACTION === 'play_ram') {
      actionPlayRam();
    } else if (CONFIG.ACTION === 'dump_rom') {
      actionDumpRom();
    } else if (CONFIG.ACTION === 'erase_all_rom') {
      actionEraseAllRom();
    } else {
      fail('Unknown CONFIG.ACTION: ' + CONFIG.ACTION);
    }
  });
}

init();
