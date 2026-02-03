/**
 * @title Gateway between Shelly BLU button1 and other devices
 * @description Use your Gen2 device as a gateway between Shelly Blu button1 and other
 *   Shelly devices (no matter Gen1 or Gen2) by sending local requests by
 *   their local IP APIs.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/ble-shelly-btn-gateway-for-other-devices.shelly.js
 */

/**
 * What you should change before using it:
 * > bluButtonAddress -> You should put the mac address of your blu button here.
 *                          This script will help you find the mac address: https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble-shelly-scanner.shelly.js
 *
 * > actions -> You should put the urls here to be executed at the specified event. Urls that shoudl be called on single/short push
 *              of the button, must be placed in the singlePush object. This applies to the double and triple push as well. Example below.
 *
 * Limitations:
 * > At the moment there is a limit of 5 RPC calls at the same time and because of this, the script will execute every 3 urls with a 1 second delay.
 *      Limitations can be check here: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#resource-limits
 *
 * > The order of the execution of the urls can't be guaranteed
 */

/** =============================== CHANGE HERE =============================== */
const CONFIG = {
    bluButtonAddress: "b4:35:22:fe:56:e5", //the mac address of shelly blu button1 that will trigger the actions
    actions: { //urls to be called on a event
        //when adding urls you must separate them with commas and put them in quotation marks
        singlePush: [ //urls that will be executed at singlePush event from the blu button1
            "http://192.168.1.35/roller/0?go=open",
            "http://192.168.1.36/relay/0?turn=off",
            "http://192.168.1.36/relay/1?turn=on"
        ],
        doublePush: [ //urls that will be executed at doublePush event from the blu button1
            "http://192.168.1.35/roller/0?go=close"
        ],
        triplePush: [ //urls that will be executed at triplePush event from the blu button1
            "http://192.168.1.38/color/0?turn=on&red=200&green=0&blue=0",
            "http://192.168.1.38/light/0?turn=on",
            "http://192.168.1.40/rpc/Switch.Set?id=0&on=false",
            "http://192.168.1.40/rpc/Switch.Set?id=1&on=false"
        ],
        longPush: [ //urls that will be executed at longPush event from the blu button1
            "http://192.168.1.41/rpc/Cover.Close",
            "http://192.168.1.42/rpc/Cover.Close"
        ]
    }
};
/** =============================== STOP CHANGING HERE =============================== */

let urlsPerCall = 3;
let urlsQueue = [];
let callsCounter = 0;

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

function callQueue() {
    if (callsCounter < 6 - urlsPerCall) {
        for (let i = 0; i < urlsPerCall && i < urlsQueue.length; i++) {
            let url = urlsQueue.splice(0, 1)[0];
            callsCounter++;
            Shelly.call("HTTP.GET", {
                url: url,
                timeout: 5
            },
                function (_, error_code, _, data) {
                    if (error_code !== 0) {
                        console.log("Calling", data.url, "failed");
                    }
                    callsCounter--;
                },
                { url: url }
            );
        }
    }

    //if there are more urls in the queue
    if (urlsQueue.length > 0) {
        Timer.set(
            1000, //the delay
            false,
            function () {
                callQueue();
            }
        );
    }
}

let lastPacketId = 0x100;
function bleScanCallback(event, result) {
    //exit if the call is not for a received result
    if (event !== BLE.Scanner.SCAN_RESULT) {
        return;
    }

    //exit if the data is not coming from a Shelly Blu button1 and if the mac address doesn't match
    if (typeof result.local_name === "undefined" ||
        typeof result.addr === "undefined" ||
        result.local_name.indexOf("SBBT") !== 0 ||
        result.addr !== CONFIG.bluButtonAddress
    ) {
        return;
    }

    let servData = result.service_data;

    //exit if service data is null/device is encrypted
    if (servData === null || typeof servData === "undefined" || typeof servData[BTHOME_SVC_ID_STR] === "undefined") {
        console.log("Can't handle encrypted devices");
        return;
    }

    let receivedData = BTHomeDecoder.unpack(servData[BTHOME_SVC_ID_STR]);

    //exit if unpacked data is null or the device is encrypted
    if (receivedData === null || typeof receivedData === "undefined" || receivedData["encryption"]) {
        console.log("Can't handle encrypted devices");
        return;
    }

    //exit if the event is duplicated
    if (lastPacketId === receivedData.pid) {
        return;
    }

    lastPacketId = receivedData["pid"];

    //getting and execuing the action
    let actionType = ["", "singlePush", "doublePush", "triplePush", "longPush"][receivedData["button"]];

    let actionUrls = CONFIG.actions[actionType];

    //exit if the event doesn't exist in the config    
    if (typeof actionType === "undefined") {
        console.log("Unknown event type in the config");
        return;
    }

    //save all urls into the queue for the current event
    for (let i in actionUrls) {
        urlsQueue.push(actionUrls[i]);
    }

    callQueue();
}

function bleScan() {
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
  BLE.Scanner.Subscribe(bleScanCallback);
}

function init() {
    //exit if there isn't a config
    if (typeof CONFIG === "undefined") {
        console.log("Can't read the config");
        return;
    }

    //exit if there isn't a blu button address
    if (typeof CONFIG.bluButtonAddress !== "string") {
        console.log("Error with the Shelly BLU button1's address");
        return;
    }

    //exit if there isn't action object
    if (typeof CONFIG.actions === "undefined") {
        console.log("Can't find the actions object in the config");
        return;
    }

    //start the ble scan
    bleScan();
}

//init the script
init();
