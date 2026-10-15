/**
 * @title WB-MIR v3 MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Wirenboard WB-MIR v3 IR transceiver and
 *   environment sensor over RS485. Reads DS18B20 temperature, button press
 *   counters, IR module presence, and supply voltages.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - MODBUS-RTU Reader for Shelly (The Pill)
 *
 * WB-MIR v3 features:
 *   - IR transceiver (send/receive IR commands, up to 80 stored commands)
 *   - 1-Wire input for DS18B20 temperature sensor
 *   - Discrete input (button) with short / long / double press detection
 *   - RS485 MODBUS-RTU slave
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 1.
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
 *
 * The Pill 5-Terminal Add-on wiring:
 *
 *                         |=============|              |==============|
 *                    /====|         VCC |              |              |
 *                    |    | GND     GND |              | SLAVE DEVICE |
 * /========\         |    | TX      +5V |              |              |
 * |The Pill|-----=||||    | RX        A |------\/------| A            |
 * \========/         |    | RE/DE     B |------/\------| B            |
 *                    |    | +5V       A |              |              |
 *                    \====|           B |              |              |
 *                         |=============|              |==============|
 *
 * Register blocks read per poll cycle:
 *   Block A - Temperature:    FC 0x04, addr    7, qty  1  (1-Wire DS18B20)
 *   Block B - Discrete:       FC 0x02, addr    0, qty 17  (input state + probe)
 *   Block C - Supply voltage: FC 0x04, addr  121, qty  4  (voltages + MCU temp)
 *   Block D - Presence flags: FC 0x04, addr  375, qty  2  (IR + 1W module present)
 *   Block E - Short press:    FC 0x04, addr  464, qty  1
 *   Block F - Long press:     FC 0x04, addr  480, qty  1
 *   Block G - Double press:   FC 0x04, addr  496, qty  1
 *   Block H - Short+Long:     FC 0x04, addr  512, qty  1
 *
 * Layout of Block C (FC 0x04, addr 121, qty 4):
 *   regs[0]  addr 121  Current Supply Voltage   u16  mV
 *   regs[1]  addr 122  Min Supply Voltage        u16  mV
 *   regs[2]  addr 123  MCU Supply Voltage        u16  mV
 *   regs[3]  addr 124  MCU Internal Temperature  s16  x0.1 degC
 *
 * Layout of Block D (FC 0x04, addr 375, qty 2):
 *   regs[0]  addr 375  IR Transceiver Present  u8  0/1
 *   regs[1]  addr 376  1-Wire Sensor Present   u8  0/1
 *
 * Discrete Block B (FC 0x02, addr 0, qty 17):
 *   bit  0  addr  0  Input 1W State      0=open/1-wire, 1=closed
 *   bit 16  addr 16  1-Wire Probe Status  0=disconnected, 1=connected
 *
 * Temperature (Block A):
 *   raw s16 × 0.0625 = °C; raw value 0x7FFF indicates sensor error.
 *
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N2',             // WB-MIR v3 factory default: 8 data, no parity, 2 stop bits
  RESPONSE_TIMEOUT: 1000,  // ms
  INTER_READ_DELAY: 100,   // ms between chained block reads
  POLL_INTERVAL: 5000,     // ms between full poll cycles
  DEBUG: true,
};

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state2 = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print('[VC] ' + msg);
  }

  function componentKey(type, id) {
    return type + ':' + String(id);
  }

  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === 'meta') {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === 'object' && desired[k] !== null) {
        if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
      } else if (desired[k] !== current[k]) {
        return false;
      }
    }

    return true;
  }

  function normalizeComponent(spec) {
    if (!spec.config) spec.config = {};
    if (!spec.config.name) spec.config.name = spec.key;
    return spec;
  }

  function findExistingByName(type, name) {
    var i;
    var c;

    for (i = 0; i < state2.existing.length; i++) {
      c = state2.existing[i];
      if (c.type === type && c.name === name) return c;
    }

    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state2.ids[spec.key] = id;
    state2.keys[spec.key] = key;
    state2.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    var id;

    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
        state2.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state2.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log('Created ' + state2.keys[spec.key] + ' ' + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        cb(true);
      });
    });
  }

  function ensureOne(spec, cb) {
    var current;
    var existing;
    var key;

    spec = normalizeComponent(spec);

    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);

      if (current) {
        if (shallowConfigMatches(spec.config, current)) {
          remember(spec, spec.id);
          cb(true);
          return;
        }

        log('Recreating mismatched ' + key + ' ' + spec.config.name);
        deleteComponent(key, function() {
          addComponent(spec, cb);
        });
        return;
      }

      addComponent(spec, cb);
      return;
    }

    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) {
      remember(spec, existing.id);
      cb(true);
      return;
    }

    if (existing) {
      log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
    }
    addComponent(spec, cb);
  }

  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) {
      cb();
      return;
    }

    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        ensureList(index + 1, cb);
      });
    });
  }

  function createGroupConfig(name) {
    return { name: name, meta: { ui: { view: 'group' } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state2.keys[logicalKey]) members.push(state2.keys[logicalKey]);
    }

    return members;
  }

  function ensureGroup(index, cb) {
    var groups = manifest.groups || [];
    var group;
    var cfg;
    var current;
    var key;

    if (index >= groups.length) {
      cb();
      return;
    }

    group = groups[index];
    cfg = createGroupConfig(group.name);
    key = componentKey('group', group.id);
    current = getConfig('group', group.id);

    function setMembersAndContinue() {
      Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state2.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() {
          ensureGroup(index + 1, cb);
        });
      });
    }

    function addGroup() {
      Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state2.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() {
            ensureGroup(index + 1, cb);
          });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg));
        state2.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || '').split(':');
        state2.existing.push({
          key: c.key || componentKey(c.type || keyParts[0], cfg.id),
          type: c.type || keyParts[0],
          id: cfg.id,
          name: cfg.name,
          config: cfg
        });
      }

      if (offset + raw.length < total && raw.length > 0) {
        readExistingPage(offset + raw.length, cb);
      } else {
        cb();
      }
    });
  }

  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() {
        done(state2.ok, {
          ids: state2.ids,
          keys: state2.keys,
          handles: state2.handles
        });
      });
    });
  });
}

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 62;
var slaveIdHandle = null;

function getSlaveId() {
  var value = DEFAULT_SLAVE_ID;

  if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
  if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
  value = Math.round(value);
  if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
  if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

  if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
    slaveIdHandle.setValue(value);
  }

  return value;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// This script prints all values to the console; only the Modbus Slave ID is
// backed by a Virtual Component (it is configuration, not sensor data).

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'slaveId',
      type: 'number',
      id: 299,
      config: {
        name: 'Modbus Slave ID',
        min: MIN_SLAVE_ID,
        max: MAX_SLAVE_ID,
        default_value: DEFAULT_SLAVE_ID,
        persisted: true,
        meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    { id: 299, name: 'Wirenboard WB-MIR-v3 Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


/* === REGISTER MAP (for reference) === */
var REG = {
  // Block A - 1-Wire temperature
  TEMP:         { addr: 7,   qty: 1,  fc: 0x04 },
  // Block B - Discrete inputs (covers addr 0 and addr 16)
  DISCRETE:     { addr: 0,   qty: 17, fc: 0x02 },
  // Block C - Supply voltage + MCU temperature
  POWER:        { addr: 121, qty: 4,  fc: 0x04 },
  // Block D - Module presence flags
  PRESENCE:     { addr: 375, qty: 2,  fc: 0x04 },
  // Block E..H - Button press counters
  SHORT_PRESS:  { addr: 464, qty: 1,  fc: 0x04 },
  LONG_PRESS:   { addr: 480, qty: 1,  fc: 0x04 },
  DOUBLE_PRESS: { addr: 496, qty: 1,  fc: 0x04 },
  SL_PRESS:     { addr: 512, qty: 1,  fc: 0x04 },
};

/* === ENTITIES (full register map for documentation and optional VC binding) === */
var ENTITIES = [
  //
  // --- Discrete Inputs (FC 0x02) ---
  //
  { name: 'Input 1W State',      units: '-',   reg: { addr: 0,   rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: '1-Wire Probe Status', units: '-',   reg: { addr: 16,  rtype: 0x02, itype: 'bool', bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  //
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  //
  { name: '1-Wire Temperature',  units: 'degC', reg: { addr: 7,   rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.0625, rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Uptime',              units: 's',    reg: { addr: 104, rtype: 0x04, itype: 'u32',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Supply Voltage',      units: 'mV',   reg: { addr: 121, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Min Supply Voltage',  units: 'mV',   reg: { addr: 122, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'MCU Supply Voltage',  units: 'mV',   reg: { addr: 123, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'MCU Temperature',     units: 'degC', reg: { addr: 124, rtype: 0x04, itype: 'i16',  bo: 'BE', wo: 'BE' }, scale: 0.1,    rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'IR Transceiver',      units: '-',    reg: { addr: 375, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: '1-Wire Sensor',       units: '-',    reg: { addr: 376, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Short Press Counter', units: '-',    reg: { addr: 464, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Long Press Counter',  units: '-',    reg: { addr: 480, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Double Press Counter',units: '-',    reg: { addr: 496, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  { name: 'Short+Long Counter',  units: '-',    reg: { addr: 512, rtype: 0x04, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'R',  vcId: null, handle: null, vcHandle: null },
  //
  // --- Holding Registers (FC 0x03) - configuration ---
  //
  { name: 'Conn Loss Timeout',   units: 's',    reg: { addr: 8,   rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Sensor Poll Period',  units: 's',    reg: { addr: 101, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Input 1W Mode',       units: '-',    reg: { addr: 275, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Debounce Time',       units: 'ms',   reg: { addr: 340, rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Long Press Duration', units: 'ms',   reg: { addr: 1100,rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
  { name: 'Double Press Wait',   units: 'ms',   reg: { addr: 1140,rtype: 0x03, itype: 'u16',  bo: 'BE', wo: 'BE' }, scale: 1,      rights: 'RW', vcId: null, handle: null, vcHandle: null },
];

/* === CRC-16 TABLE (MODBUS polynomial 0xA001) === */
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

/* === STATE === */
var state = {
  uart: null,
  rxBuffer: [],
  isReady: false,
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
};

/* === HELPERS === */

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    s += toHex(bytes[i]);
    if (i < bytes.length - 1) s += ' ';
  }
  return s;
}

function debug(msg) {
  if (CONFIG.DEBUG) {
    print('[WB-MIR] ' + msg);
  }
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function bytesToStr(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xFF);
  }
  return s;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  for (var i = 0; i < data.length; i++) {
    frame.push(data[i] & 0xFF);
  }
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

/* === SIGNED CONVERSION === */

function toSigned16(v) {
  return v >= 0x8000 ? v - 0x10000 : v;
}

/* === DISPLAY FORMATTERS (integer arithmetic only) === */

// 0.1 degC units -> "X.X C"
function fmtC(tenths) {
  var sign = tenths < 0 ? '-' : '';
  var abs = tenths < 0 ? -tenths : tenths;
  return sign + Math.floor(abs / 10) + '.' + (abs % 10) + ' C';
}

// 0.0625 degC units -> "XX.XXXX C" (4 decimal places)
function fmtC16(raw) {
  // raw × 0.0625 = raw / 16
  var sign = raw < 0 ? '-' : '';
  var abs = raw < 0 ? -raw : raw;
  var whole = Math.floor(abs / 16);
  var frac = (abs % 16) * 625;  // 0-9375 in units of 0.0001 degC
  var f4 = ('0000' + frac).slice(-4);
  return sign + whole + '.' + f4 + ' C';
}

/* === MODBUS CORE === */

function sendRequest(functionCode, startAddr, qty, callback) {
  if (!state.isReady) {
    callback('Not initialised', null);
    return;
  }
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var data = [
    (startAddr >> 8) & 0xFF,
    startAddr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];

  var frame = buildFrame(getSlaveId(), functionCode, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { functionCode: functionCode, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      debug('Timeout');
      cb('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!data || data.length === 0) return;
  for (var i = 0; i < data.length; i++) {
    state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  }
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) { state.rxBuffer = []; return; }
  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];

  // Exception response (high bit set on FC byte)
  if (fc & 0x80) {
    var excCrc = calcCRC(state.rxBuffer.slice(0, 3));
    var recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (excCrc === recvCrc) {
      clearResponseTimeout();
      var exCode = state.rxBuffer[2];
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      state.rxBuffer = [];
      cb('Exception 0x' + toHex(exCode), null);
    }
    return;
  }

  // FC 0x06 write-register echo: slave(1)+FC(1)+addr(2)+value(2)+CRC(2) = 8 bytes (no byteCount)
  if (fc === 0x06) {
    if (state.rxBuffer.length < 8) return;
    var frame6 = state.rxBuffer.slice(0, 8);
    var crc6 = calcCRC(frame6.slice(0, 6));
    var recv6 = frame6[6] | (frame6[7] << 8);
    if (crc6 !== recv6) { debug('CRC error (FC06)'); return; }
    debug('RX: ' + bytesToHex(frame6));
    clearResponseTimeout();
    var cb6 = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb6(null, true);
    return;
  }

  // FC 0x02 / 0x03 / 0x04: slave(1)+FC(1)+byteCount(1)+data(N)+CRC(2)
  if (state.rxBuffer.length < 3) return;
  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);

  if (crc !== recvCrc) { debug('CRC error'); return; }

  debug('RX: ' + bytesToHex(frame));
  clearResponseTimeout();

  var responseData = frame.slice(2, expectedLen - 2);
  var cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  cb(null, responseData);
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

// Read qty input registers (FC 0x04) starting at addr.
// Callback receives (err, regs[]) where regs[] is an array of uint16.
function readInputRegisters(addr, qty, callback) {
  sendRequest(0x04, addr, qty, function(err, response) {
    if (err) { callback(err, null); return; }
    var regs = [];
    for (var i = 1; i < response.length; i += 2) {
      regs.push((response[i] << 8) | response[i + 1]);
    }
    callback(null, regs);
  });
}

// Read qty holding registers (FC 0x03) starting at addr.
// Callback receives (err, regs[]) where regs[] is an array of uint16.
function readHoldingRegisters(addr, qty, callback) {
  sendRequest(0x03, addr, qty, function(err, response) {
    if (err) { callback(err, null); return; }
    var regs = [];
    for (var i = 1; i < response.length; i += 2) {
      regs.push((response[i] << 8) | response[i + 1]);
    }
    callback(null, regs);
  });
}

// Read qty discrete inputs (FC 0x02) starting at addr.
// Callback receives (err, bits[]) where bits[] is an array of 0/1.
function readDiscreteInputs(addr, qty, callback) {
  sendRequest(0x02, addr, qty, function(err, response) {
    if (err) { callback(err, null); return; }
    var bits = [];
    for (var i = 0; i < qty; i++) {
      var byteIdx = Math.floor(i / 8) + 1;
      var bitIdx = i % 8;
      if (byteIdx < response.length) {
        bits.push((response[byteIdx] >> bitIdx) & 0x01);
      }
    }
    callback(null, bits);
  });
}

// Write a single holding register (FC 0x06).
// Callback receives (err, success).
function writeSingleRegister(addr, value, callback) {
  if (!state.isReady) { callback('Not initialised', false); return; }
  if (state.pendingRequest) { callback('Request pending', false); return; }

  var data = [
    (addr >> 8) & 0xFF, addr & 0xFF,
    (value >> 8) & 0xFF, value & 0xFF,
  ];
  var frame = buildFrame(getSlaveId(), 0x06, data);
  debug('TX: ' + bytesToHex(frame));

  state.pendingRequest = { functionCode: 0x06, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var cb = state.pendingRequest.callback;
      state.pendingRequest = null;
      debug('Timeout');
      cb('Timeout', false);
    }
  });

  state.uart.write(bytesToStr(frame));
}

/* === PARSE HELPERS === */

// Parses Block C response (FC 0x04, addr 121, qty 4) -> power info object
function parsePowerBlock(regs) {
  return {
    supplyV:  regs[0],               // mV  current averaged
    minV:     regs[1],               // mV  minimum since boot
    mcuV:     regs[2],               // mV  MCU supply
    mcuTemp:  toSigned16(regs[3]),   // 0.1 degC
  };
}

// Parses Block D response (FC 0x04, addr 375, qty 2) -> presence flags
function parsePresenceBlock(regs) {
  return {
    irPresent: regs[0] !== 0,
    owPresent: regs[1] !== 0,
  };
}

// Parses Block B response (FC 0x02, addr 0, qty 17) -> discrete state
// Bit 0  = addr 0  (Input 1W State)
// Bit 16 = addr 16 (1-Wire Probe Status)
function parseDiscreteBlock(bits) {
  return {
    input1wState: bits[0],   // 0=open/1-wire mode, 1=closed
    probeConnected: bits[16] === 1,
  };
}

/* === PRINT === */

function printData(d) {
  print('--- WB-MIR v3 ---');

  // Temperature
  if (d.tempRaw === 0x7FFF) {
    print('  Temperature:  sensor error');
  } else {
    print('  Temperature:  ' + fmtC16(toSigned16(d.tempRaw)) +
          (d.discrete ? (d.discrete.probeConnected ? '' : '  [probe disconnected]') : ''));
  }

  // Input state
  if (d.discrete) {
    print('  Input state:  ' + (d.discrete.input1wState ? 'closed' : 'open/1-wire'));
    print('  Probe:        ' + (d.discrete.probeConnected ? 'connected' : 'disconnected'));
  }

  // Power info
  if (d.power) {
    print('  Supply:       ' + d.power.supplyV + ' mV' +
          '  (min ' + d.power.minV + ' mV  MCU ' + d.power.mcuV + ' mV)');
    print('  MCU Temp:     ' + fmtC(d.power.mcuTemp));
  }

  // Module presence
  if (d.presence) {
    print('  IR module:    ' + (d.presence.irPresent ? 'present' : 'absent'));
    print('  1-Wire:       ' + (d.presence.owPresent ? 'present' : 'absent'));
  }

  // Button counters
  print('  Buttons:      short=' + d.shortPress +
        '  long=' + d.longPress +
        '  double=' + d.doublePress +
        '  s+l=' + d.slPress);

  print('');
}

/* === POLL === */

function pollDevice() {
  var result = {
    tempRaw:     null,
    discrete:    null,
    power:       null,
    presence:    null,
    shortPress:  null,
    longPress:   null,
    doublePress: null,
    slPress:     null,
  };

  // Block A: temperature
  readInputRegisters(REG.TEMP.addr, REG.TEMP.qty, function(err, regs) {
    if (err) {
      print('[WB-MIR] Temp read error: ' + err);
    } else {
      result.tempRaw = regs[0];
    }

    Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
      // Block B: discrete inputs
      readDiscreteInputs(REG.DISCRETE.addr, REG.DISCRETE.qty, function(err, bits) {
        if (err) {
          print('[WB-MIR] Discrete read error: ' + err);
        } else {
          result.discrete = parseDiscreteBlock(bits);
        }

        Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
          // Block C: supply voltage + MCU temperature
          readInputRegisters(REG.POWER.addr, REG.POWER.qty, function(err, regs) {
            if (err) {
              print('[WB-MIR] Power read error: ' + err);
            } else {
              result.power = parsePowerBlock(regs);
            }

            Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
              // Block D: module presence flags
              readInputRegisters(REG.PRESENCE.addr, REG.PRESENCE.qty, function(err, regs) {
                if (err) {
                  print('[WB-MIR] Presence read error: ' + err);
                } else {
                  result.presence = parsePresenceBlock(regs);
                }

                Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
                  // Block E: short press counter
                  readInputRegisters(REG.SHORT_PRESS.addr, REG.SHORT_PRESS.qty, function(err, regs) {
                    result.shortPress = err ? null : regs[0];

                    Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
                      // Block F: long press counter
                      readInputRegisters(REG.LONG_PRESS.addr, REG.LONG_PRESS.qty, function(err, regs) {
                        result.longPress = err ? null : regs[0];

                        Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
                          // Block G: double press counter
                          readInputRegisters(REG.DOUBLE_PRESS.addr, REG.DOUBLE_PRESS.qty, function(err, regs) {
                            result.doublePress = err ? null : regs[0];

                            Timer.set(CONFIG.INTER_READ_DELAY, false, function() {
                              // Block H: short+long press counter
                              readInputRegisters(REG.SL_PRESS.addr, REG.SL_PRESS.qty, function(err, regs) {
                                result.slPress = err ? null : regs[0];
                                printData(result);
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

/* === INIT === */

function init() {
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
      if (!ok) {
        print('ERROR: Virtual component setup failed');
        return;
      }
      vcHandles = readyVc.handles;
      slaveIdHandle = readyVc.handles.slaveId;
      slaveIdHandle.on('change', function() {
        debug('Slave ID changed -> ' + getSlaveId());
      });

  print('WB-MIR v3 - MODBUS-RTU Reader');
  print('==============================');

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
  state.isReady = true;

  debug('UART: ' + CONFIG.BAUD_RATE + ' baud, ' + CONFIG.MODE);
  debug('Slave ID: ' + getSlaveId());
  print('Poll interval: ' + (CONFIG.POLL_INTERVAL / 1000) + ' s');
  print('');

  // First poll after 500 ms, then periodic
  Timer.set(500, false, pollDevice);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollDevice);

    });
}

init();
