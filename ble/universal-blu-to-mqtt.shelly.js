/**
 * @title Example - Universal BLU to MQTT Script
 * @description This script is about shares any BLU product's complete payload to
 *   MQTT..
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/universal-blu-to-mqtt.shelly.js
 */

/**
 * Short description:
 *   - This script shares any BLU product's complete payload to MQTT.
 *   - The script does not require an individual BLU device's MAC address, rather it will "listen" for any BLU device.
 *   - It uses the MAC address to create the topic, with a key-value for each data point in the payload.
 *
 * Running Process:
 *   - Scanning: The script will open a BLU passive scan to receive any BLU device data. Using the BLE.Scanner.Start and BLE.Scanner.Subscribe modules.
 *   - Data Extraction: For each device found, it checks for service data associated with the BTHome standard (Service ID: fcd2).
 *   - Decoding: The BTHomeDecoder decodes the service data into human-readable format, including details such as temperature, battery, etc.
 *   - MQTT Push: The MQTT uses each device MAC address as a topic, then publishes device service_data or any other data you want to the MQTT.
 */

// *********************** Decoding Method ***********************
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
  0x2c: { n: "vibration", t: uint8 },
  0x2d: { n: "window", t: uint8 },
  0x2e: { n: "humidity", t: uint8, u: "%" },
  0x3a: { n: "button", t: uint16 },
  0x3f: { n: "rotation", t: int16, f: 0.1 },
  0x40: { n: "distance_mm", t: uint16 },
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

// ***********************  Main Methods ***********************

const BTHOME_SVC_ID_STR = "fcd2";

// Bluetooth scan options
const SCAN_OPTION = {
  duration_ms: BLE.Scanner.INFINITE_SCAN, // Scan duration
  active: false,
}

// Push BLE devices to MQTT
function pushToMQ(addr, message) {
  if (!MQTT.isConnected()) return false; // Check the MQTT status

  MQTT.publish(addr, message);

  return true
}

// BLE scan callback
function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  const addr = res.addr; // Get devive's MAC address
  if (typeof res.service_data === 'undefined' || typeof res.service_data[BTHOME_SVC_ID_STR] === 'undefined') return;
  if (typeof addr === 'undefined') return; // If the device addredd is empty, return

  try {
    const decodeData = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]); // Decode service data

    // Combine data
    const postMessage = {
      addr: addr,
      rssi: res.rssi,
      local_name: res.local_name || "",
      service_data: decodeData,
    };

    // console.log(res.local_name, JSON.stringify(postMessage));

    // post data to MQTT
    pushToMQ(addr, JSON.stringify(postMessage));

  } catch (err) {
    console.log(err)
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
    const bleScanner = BLE.Scanner.Start(SCAN_OPTION);

    if (!bleScanner) {
      console.log("Error: Can not start new scanner");
    }
  }

  // subscribe a callback to BLE scanner
  BLE.Scanner.Subscribe(scanCB);
}

init();
