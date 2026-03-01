/**
 * @title BLE open windows monitor
 * @description Scans Shelly BLU DoorWindow advertisements, tracks open windows,
 *   and updates Virtual Components with aggregate open-state information.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/ble-open-windows.shelly.js
 */

/**
 * BLE Open Windows Monitor
 *
 * Watches configured BLU DoorWindow devices and publishes:
 * - boolean:200  true if any configured window is open
 * - number:200   count of open windows
 * - text:200     last update timestamp
 * - text:201     most recently opened window name (or None)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEVICES = {
  // Replace sample MAC addresses with your real BLU DoorWindow addresses.
  'xx:xx:xx:xx:xx:01': { res: {}, name: 'Living Room Back Window', date: null },
  'xx:xx:xx:xx:xx:02': { res: {}, name: 'Children Room Front Window', date: null },
};

const COMPONENT_ANY_OPEN = 'boolean:200';
const COMPONENT_OPEN_COUNT = 'number:200';
const COMPONENT_LAST_UPDATE = 'text:200';
const COMPONENT_LAST_OPEN_NAME = 'text:201';

const BTHOME_SVC_ID_STR = 'fcd2';

// ============================================================================
// HELPERS
// ============================================================================

function setValue(component, value) {
  const handle = Virtual.getHandle(component);
  if (handle) {
    handle.setValue(value);
  }
}

function getTimestamp(date) {
  return date.toString().split('GMT')[0];
}

function getByteSize(type) {
  if (type === uint8 || type === int8) {
    return 1;
  }
  if (type === uint16 || type === int16) {
    return 2;
  }
  if (type === uint24 || type === int24) {
    return 3;
  }
  return 255;
}

// ============================================================================
// EVENT PROCESSING
// ============================================================================

function onEvent(res) {
  const addr = res.addr;
  const device = DEVICES[addr];
  if (!device) {
    return;
  }

  const date = new Date();
  device.res = res;
  device.date = date;

  let isOpenWindow = false;
  let openWindowsCount = 0;
  let lastOpenWindowDevice = null;

  for (const dev in DEVICES) {
    const trackedDevice = DEVICES[dev];
    if (trackedDevice.res.window === 1) {
      openWindowsCount += 1;
      isOpenWindow = true;
      if (!lastOpenWindowDevice || lastOpenWindowDevice.date <= trackedDevice.date) {
        lastOpenWindowDevice = trackedDevice;
      }
    }
  }

  setValue(COMPONENT_ANY_OPEN, isOpenWindow);
  setValue(COMPONENT_OPEN_COUNT, openWindowsCount);
  setValue(COMPONENT_LAST_UPDATE, getTimestamp(date));
  setValue(COMPONENT_LAST_OPEN_NAME, lastOpenWindowDevice ? lastOpenWindowDevice.name : 'None');
}

function scanCB(ev, res) {
  if (
    ev !== BLE.Scanner.SCAN_RESULT ||
    !res ||
    !DEVICES[res.addr] ||
    !res.service_data ||
    !res.service_data[BTHOME_SVC_ID_STR]
  ) {
    return;
  }

  const bthomeData = ShellyBLUParser.getData(res);
  if (bthomeData) {
    onEvent(bthomeData);
    return;
  }

  print('Failed to parse BTH data:', JSON.stringify(res));
}

function startBleScan() {
  const success = BLE.Scanner.Start(
    { duration_ms: BLE.Scanner.INFINITE_SCAN, active: false },
    scanCB
  );
  print('BLE scanner running:', success !== false);
}

function init() {
  const bleConfig = Shelly.getComponentConfig('ble');
  if (bleConfig.enable === false) {
    print('Error: BLE not enabled');
    return;
  }

  startBleScan();
}

// ============================================================================
// BTHOME PARSER
// ============================================================================

const uint8 = 0;
const int8 = 1;
const uint16 = 2;
const int16 = 3;
const uint24 = 4;
const int24 = 5;

const BTH = [];
BTH[0x00] = { n: 'pid', t: uint8 };
BTH[0x01] = { n: 'battery', t: uint8, u: '%' };
BTH[0x02] = { n: 'temperature', t: int16, f: 0.01, u: 'tC' };
BTH[0x03] = { n: 'humidity', t: uint16, f: 0.01, u: '%' };
BTH[0x05] = { n: 'illuminance', t: uint24, f: 0.01 };
BTH[0x21] = { n: 'motion', t: uint8 };
BTH[0x2d] = { n: 'window', t: uint8 };
BTH[0x3a] = { n: 'button', t: uint8 };
BTH[0x3f] = { n: 'rotation', t: int16, f: 0.1 };

const ShellyBLUParser = {
  getData: function(res) {
    const result = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]);
    if (result) {
      result.addr = res.addr;
      result.rssi = res.rssi;
    }
    return result;
  },
};

const BTHomeDecoder = {
  utoi: function(num, bitsz) {
    const mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function(buffer) {
    return buffer.at(0);
  },
  getInt8: function(buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function(buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function(buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function(buffer) {
    return 0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0));
  },
  getInt24LE: function(buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function(type, buffer) {
    if (buffer.length < getByteSize(type)) {
      return null;
    }

    let res = null;
    if (type === uint8) {
      res = this.getUInt8(buffer);
    }
    if (type === int8) {
      res = this.getInt8(buffer);
    }
    if (type === uint16) {
      res = this.getUInt16LE(buffer);
    }
    if (type === int16) {
      res = this.getInt16LE(buffer);
    }
    if (type === uint24) {
      res = this.getUInt24LE(buffer);
    }
    if (type === int24) {
      res = this.getInt24LE(buffer);
    }
    return res;
  },
  unpack: function(buffer) {
    if (typeof buffer !== 'string' || buffer.length === 0) {
      return null;
    }

    const result = {};
    const dib = buffer.at(0);
    result.encryption = dib & 0x1 ? true : false;
    result.BTHome_version = dib >> 5;

    // Encrypted data is not handled.
    if (result.BTHome_version !== 2 || result.encryption) {
      return null;
    }

    buffer = buffer.slice(1);
    while (buffer.length > 0) {
      const bth = BTH[buffer.at(0)];
      if (typeof bth === 'undefined') {
        return null;
      }

      buffer = buffer.slice(1);
      let value = this.getBufValue(bth.t, buffer);
      if (value === null) {
        return null;
      }

      if (typeof bth.f !== 'undefined') {
        value = value * bth.f;
      }

      result[bth.n] = value;
      buffer = buffer.slice(getByteSize(bth.t));
    }

    return result;
  },
};

// ============================================================================
// STARTUP
// ============================================================================

init();
