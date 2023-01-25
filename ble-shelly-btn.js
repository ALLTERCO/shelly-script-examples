/**
 * This script uses the BLE scan functionality in scripting
 * Selects Shelly BLU Buttons from the aired advertisements, decodes
 * the service data payload and toggles a relay on the device on
 * button push
 */

// Shelly BLU devices:
// SBBT - Shelly BLU Button
// SBDW - Shelly BLU DoorWindow

// BTHome data format: https://bthome.io/format/

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
// You can rely only on the address filtering and forego device name matching

// CHANGE HERE
function onButtonPress(BTHparsed) {
  print("Button pressed, emitting event");
  Shelly.emitEvent("BLU_BUTTON", {
    addr: BTHparsed.addr,
    rssi: BTHparsed.rssi,
    Button: BTHparsed.Button,
    Battery: BTHparsed.Battery,
  });
}

// remove name prefix to not filter by device name
// remove address to not filter by address
// filtering early by address or device name allows for faster execution
// actions is an array objects containing condition and action property
// conditions would be checked for equality against the parsed advertisement packet
// e.g. if there is an addr property in condition and it matches the value of addr property
// in BTH parsed object then the condition is true
let CONFIG = {
  shelly_blu_name_prefix: "SBBT",
  //shelly_blu_address: "bc:02:6e:c3:c8:b9",
  actions: [
    {
      cond: {
        addr: "bc:02:6e:c3:c8:b7",
        Button: 1,
      },
      action: onButtonPress,
    },
  ],
};
// END OF CHANGE

let ALLTERCO_MFD_ID_STR = "0ba9";
let BTHOME_SVC_ID_STR = "fcd2";

let SCAN_DURATION = BLE.Scanner.INFINITE_SCAN;
let ACTIVE_SCAN =
  typeof CONFIG.shelly_blu_name_prefix !== "undefined" &&
  CONFIG.shelly_blu_name_prefix !== null;

let uint8 = 0;
let int8 = 1;
let uint16 = 2;
let int16 = 3;
let uint24 = 4;
let int24 = 5;

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  //impossible as advertisements are much smaller;
  return 255;
}

let BTH = [];
BTH[0x00] = { n: "pid", t: uint8 };
BTH[0x01] = { n: "Battery", t: uint8, u: "%" };
BTH[0x05] = { n: "Illuminance", t: uint24, f: 0.01 };
BTH[0x1a] = { n: "Door", t: uint8 };
BTH[0x20] = { n: "Moisture", t: uint8 };
BTH[0x2d] = { n: "Window", t: uint8 };
BTH[0x3a] = { n: "Button", t: uint8 };
BTH[0x3f] = { n: "Rotation", t: int16, f: 0.1 };

let BTHomeDecoder = {
  utoi: function (num, bitsz) {
    let mask = 1 << (bitsz - 1);
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
  unpack: function (buffer) {
    // beacons might not provide BTH service data
    if (typeof buffer !== "string" || buffer.length === 0) return null;
    let result = {};
    let _dib = buffer.at(0);
    result["encryption"] = _dib & 0x1 ? true : false;
    result["BTHome_version"] = _dib >> 5;
    if (result["BTHome_version"] !== 2) return null;
    //Can not handle encrypted data
    if (result["encryption"]) return result;
    buffer = buffer.slice(1);

    let _bth;
    let _value;
    while (buffer.length > 0) {
      _bth = BTH[buffer.at(0)];
      if (_bth === "undefined") {
        console.log("BTH: unknown type");
        break;
      }
      buffer = buffer.slice(1);
      _value = this.getBufValue(_bth.t, buffer);
      if (_value === null) break;
      if (typeof _bth.f !== "undefined") _value = _value * _bth.f;
      result[_bth.n] = _value;
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

BLE.Scanner.Start({ duration_ms: SCAN_DURATION, active: ACTIVE_SCAN }, scanCB);
