/**
 * This script uses the BLE scan functionality in scripting
 * Selects Shelly BLU DoorWindow from the aired advertisements, decodes
 * the service data payload and toggles a relay on the device on
 * button push
 */

// Shelly BLU devices:
// SBBT - Shelly BLU Button
// SBDW - Shelly BLU DoorWindow

// sample Shelly DW service_data payload
// 0x40 0x00 0x4E 0x01 0x64 0x05 0x00 0x00 0x00 0x2D 0x01 0x3F 0x00 0x00

// First byte: BTHome device info, 0x40 - no encryption, BTHome v.2
// bit 0: “Encryption flag”
// bit 1-4: “Reserved for future use”
// bit 5-7: “BTHome Version”

// AD 0: PID, 0x00
// Value: 0x4E

// AD 1: Battery, 0x01
// Value, 100%

// AD 2: Illuminance, 0x05
// Value: 0

// AD 3: Window, 0x2D
// Value: true, open

// AD 4: Rotation, 0x3F
// Value: 0

// Device name can be obtained if an active scan is performed
// You can rely only on the addresss filtering and forego device name matching

// CHANGE HERE
function triggerAutomation() {
  print("Window is opened, will toggle the output");
  Shelly.call("Switch.Set", { id: 0, on: true });
}

function printClosed() {
  print("Window is opened, will toggle the output");
  Shelly.call("Switch.Set", { id: 0, on: false });
}

// remove name prefix to not filter by device name
// remove address to not filter by address

let CONFIG = {
  //shelly_blu_name_prefix: 'SBDW',
  //"BIND" to only this address
  shelly_blu_address: "bc:02:6e:c3:c9:0f",
  actions: [
    {
      cond: {
        Window: 0,
      },
      action: triggerAutomation,
    },
    {
      cond: {
        Window: 1,
      },
      action: printClosed,
    },
  ],
};
// END OF CHANGE
const SCAN_PARAM_WANT = {
  duration_ms: BLE.Scanner.INFINITE_SCAN,
  active: true,
}

const ALLTERCO_MFD_ID_STR = "0ba9";
const BTHOME_SVC_ID_STR = "fcd2";

const uint8 = 0;
const int8 = 1;
const uint16 = 2;
const int16 = 3;
const uint24 = 4;
const int24 = 5;

// The BTH object defines the structure of the BTHome data
const BTH = {
  0x00: { n: "pid", t: uint8 },
  0x01: { n: "battery", t: uint8, u: "%" },
  0x02: { n: "temperature", t: int16, f: 0.01, u: "tC" },
  0x03: { n: "humidity", t: uint16, f: 0.01, u: "%" },
  0x05: { n: "illuminance", t: uint24, f: 0.01 },
  0x21: { n: "motion", t: uint8 },
  0x2d: { n: "window", t: uint8 },
  0x2e: { n: "humidity", t: uint8, u: "%" },
  0x3a: { n: "button", t: uint8 },
  0x3f: { n: "rotation", t: int16, f: 0.1 },
  0x45: { n: "temperature", t: int16, f: 0.1, u: "tC" },
};

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  //impossible as advertisements are much smaller;
  return 255;
}

// functions for decoding and unpacking the service data from Shelly BLU devices
const BTHomeDecoder = {
  utoi: function (num, bitsz) {
    const mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function (buffer) {
    return buffer.at(0);
  },
  getInt8: function (buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function (buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function (buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function (buffer) {
    return (
      0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0))
    );
  },
  getInt24LE: function (buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function (type, buffer) {
    if (buffer.length < getByteSize(type)) return null;
    let res = null;
    if (type === uint8) res = this.getUInt8(buffer);
    if (type === int8) res = this.getInt8(buffer);
    if (type === uint16) res = this.getUInt16LE(buffer);
    if (type === int16) res = this.getInt16LE(buffer);
    if (type === uint24) res = this.getUInt24LE(buffer);
    if (type === int24) res = this.getInt24LE(buffer);
    return res;
  },

  // Unpacks the service data buffer from a Shelly BLU device
  unpack: function (buffer) {
    //beacons might not provide BTH service data
    if (typeof buffer !== "string" || buffer.length === 0) return null;
    let result = {};
    let _dib = buffer.at(0);
    result["encryption"] = _dib & 0x1 ? true : false;
    result["BTHome_version"] = _dib >> 5;
    if (result["BTHome_version"] !== 2) return null;
    //can not handle encrypted data
    if (result["encryption"]) return result;
    buffer = buffer.slice(1);

    let _bth;
    let _value;
    while (buffer.length > 0) {
      _bth = BTH[buffer.at(0)];
      if (typeof _bth === "undefined") {
        console.log("BTH: Unknown type");
        break;
      }
      buffer = buffer.slice(1);
      _value = this.getBufValue(_bth.t, buffer);
      if (_value === null) break;
      if (typeof _bth.f !== "undefined") _value = _value * _bth.f;

      if (typeof result[_bth.n] === "undefined") {
        result[_bth.n] = _value;
      }
      else {
        if (Array.isArray(result[_bth.n])) {
          result[_bth.n].push(_value);
        }
        else {
          result[_bth.n] = [
            result[_bth.n],
            _value
          ];
        }
      }

      buffer = buffer.slice(getByteSize(_bth.t));
    }
    return result;
  },
};

let ShellyBLUParser = {
  getData: function (res) {
    let result = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]);
    result.addr = res.addr;
    result.rssi = res.rssi;
    return result;
  },
};

let last_packet_id = 0x100;
function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  // skip if there is no service_data member
  if (
    typeof res.service_data === "undefined" ||
    typeof res.service_data[BTHOME_SVC_ID_STR] === "undefined"
  )
    return;
  // skip if we are looking for name match but don't have active scan as we don't have name
  if (
    typeof CONFIG.shelly_blu_name_prefix !== "undefined" &&
    (typeof res.local_name === "undefined" ||
      res.local_name.indexOf(CONFIG.shelly_blu_name_prefix) !== 0)
  )
    return;
  // skip if we don't have address match
  if (
    typeof CONFIG.shelly_blu_address !== "undefined" &&
    CONFIG.shelly_blu_address !== res.addr
  )
    return;
  let BTHparsed = ShellyBLUParser.getData(res);
  // skip if parsing failed
  if (BTHparsed === null) {
    console.log("Failed to parse BTH data");
    return;
  }
  // skip, we are deduping results
  if (last_packet_id === BTHparsed.pid) return;
  last_packet_id = BTHparsed.pid;
  console.log("Shelly BTH packet: ", JSON.stringify(BTHparsed));
  // execute actions from CONFIG
  let aIdx = null;
  for (aIdx in CONFIG.actions) {
    // skip if no condition defined
    if (typeof CONFIG.actions[aIdx]["cond"] === "undefined") continue;
    let cond = CONFIG.actions[aIdx]["cond"];
    let cIdx = null;
    let run = true;
    for (cIdx in cond) {
      if (typeof BTHparsed[cIdx] === "undefined") run = false;
      if (BTHparsed[cIdx] !== cond[cIdx]) run = false;
    }
    // if all conditions evaluated to true then execute
    if (run) CONFIG.actions[aIdx]["action"](BTHparsed);
  }
}

function init() {
  // get the config of ble component
  const BLEConfig = Shelly.getComponentConfig("ble");

  // exit if the BLE isn't enabled
  if (!BLEConfig.enable) {
    console.log(
      "Error: The Bluetooth is not enabled, please enable it from settings"
    );
    return;
  }

  // check if the scanner is already running
  if (BLE.Scanner.isRunning()) {
    console.log("Info: The BLE gateway is running, the BLE scan configuration is managed by the device");
  }
  else {
    // start the scanner
    const bleScanner = BLE.Scanner.Start(SCAN_PARAM_WANT);

    if (!bleScanner) {
      console.log("Error: Can not start new scanner");
    }
  }

  // subscribe a callback to BLE scanner
  BLE.Scanner.Subscribe(scanCB);
}

init();

