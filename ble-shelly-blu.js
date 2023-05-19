/**
 * This script sets up a BLE scanner, listens for advertising data from nearby Shelly BLU devices, 
 * decodes the data using a BTHome data structure, and emits the 
 * decoded data for further processing.
 * 
 * What can the event data containes, each value is explained below. 
 * Each device will provide data solely from its sensors.
 * - pid - packet id
 * - battery - the battery level of the device in %
 * - temperature - the temperature value in °C if the device has temperature sensor 
 * - humidity - the himidity value in % if the device has humidity sensor
 * - illuminance - the illuminance value in lux if the device has light sensor
 * - motion - 0/1 (motion/clear) if the device has motion sensor
 * - window - 0/1 (close/open) if the device has reed switch
 * - button - the number of presses if the device has button
 * - rotation - the angle of rotatation in ° if the device has gyroscope
 * - rssi - the signal strength is dB
 * - address - The mac address of the Shelly BLU device
 * 
 * 
 * More info about the event structure and data: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#shellyaddeventhandler-and-shellyaddstatushandler
 * 
 * Emited data example from Shelly BLU button:
    {
        "component": "script:1",
        "name": "script",
        "id": 1,
        "now": 1684315357.9794884,
        "info": { 
            "component": "script:1",
            "id": 1,
            "event": "shelly-blu",
            "data": {
                "encryption": false,
                "BTHome_version": 2,
                "pid": 33,
                "battery": 100,
                "button": 1,
                "rssi": -66,
                "address": "bc:02:6e:c3:ce:cc",
                "ts": 1684315357.98
            }
        }
    }
    {
        "component": "switch:0",
        "name": "switch",
        "id": 0,
        "now": 1684322855.926201,
        "info": {
            "component": "switch:0",
            "id": 0,
            "event": "toggle",
            "state": false,
            "ts": 1684322855.93
        }
    }
 */

/******************* START CHANGE HERE *******************/
let CONFIG = {
    /**
     * Determines the maximum number of attempts to start the BLE scanner before considering it a failure
     */
    maxScannerStartAttempts: 5,

    /**
     * Specifies the number of seconds that must elapse before start a scanner job that has previously failed to start
     */
    scannerStartAttemptDelay: 3, 

    /**
     * Specify the destination event where the decoded BLE data will be emitted. It allows for easy 
     * identification by other applications/scripts.
     */
    eventName: "shelly-blu",

    /**
     * When true, the scan is active, it will provide more detailed information like the device name, 
     * accurate signal strength (rssi), about the BLE event but consumes more power. 
     */
    activeScan: false,

    debug: false,
};
/******************* STOP CHANGE HERE *******************/

let scannerStartAttempts = 0;

let ALLTERCO_MFD_ID_STR = "0ba9";
let BTHOME_SVC_ID_STR = "fcd2";

let uint8 = 0;
let int8 = 1;
let uint16 = 2;
let int16 = 3;
let uint24 = 4;
let int24 = 5;

let BTH = {};
BTH[0x00] = { n: "pid", t: uint8 };
BTH[0x01] = { n: "battery", t: uint8, u: "%" };
BTH[0x02] = { n: "temperature", t: int16, f: 0.01, u: "tC" };
BTH[0x03] = { n: "humidity", t: uint16, f: 0.01, u: "%" };
BTH[0x05] = { n: "illuminance", t: uint24, f: 0.01 };
BTH[0x21] = { n: "motion", t: uint8 };
BTH[0x2d] = { n: "window", t: uint8 };
BTH[0x3a] = { n: "button", t: uint8 };
BTH[0x3f] = { n: "rotation", t: int16, f: 0.1 };

function getByteSize(type) {
    if (type === uint8 || type === int8) return 1;
    if (type === uint16 || type === int16) return 2;
    if (type === uint24 || type === int24) return 3;
    //impossible as advertisements are much smaller;
    return 255;
}

//TODO: rework
function logger(prefix, input) {
    if(!CONFIG.debug) {
        return;
    }

    let finalText = "";
    if(typeof input === "object") {
        for(let i in input) {
            finalText = finalText + " " + String(input[i]);
        }
    }
    else {
        finalText = JSON.stringify(input);
    }

    console.log(prefix, ":", finalText);
}

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
                logger("BTH", "unknown type");
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
    }
};

/**
 * Emits the provided data
 * @param {Object} data the decoded BLE data
 */
function emitData(data) {
    if(typeof data !== "object") {
        return;
    }

    Shelly.emitEvent(CONFIG.eventName, data);
}

//saving the id of the last packet, this is used to filter the duplicated packets
let lastPacketId = 0x100;

/**
 * Callback for the BLE scanner object
 */
function BLEScanCallback(event, result) {
    //exit if not a result of a scan 
    if (event !== BLE.Scanner.SCAN_RESULT) {
        return;
    }

    //exit if service data is null/device is encrypted
    if(     
        result.service_data === null || 
        typeof result.service_data === "undefined" || 
        typeof result.service_data[BTHOME_SVC_ID_STR] === "undefined"
    ) {
        logger("Error", "Encrypted devices are not supported");
        return;
    }

    let unpackedData = BTHomeDecoder.unpack(result.service_data[BTHOME_SVC_ID_STR]);

    //exit if unpacked data is null or the device is encrypted
    if(     
        unpackedData === null || 
        typeof unpackedData === "undefined" || 
        unpackedData["encryption"]
    ) {
        logger("Error", "Can't unpack the device's data");
        return;
    }

    //exit if the event is duplicated
    if (lastPacketId === unpackedData.pid) {
        return;
    }

    lastPacketId = unpackedData.pid;

    //store some device's data
    unpackedData.rssi = result.rssi;
    unpackedData.address = result.addr;

    emitData(unpackedData);
}

/**
 * Init the script and check the configuration
 */
function init() {
    //exit if the number of attempts exceeded the limit
    if(scannerStartAttempts > CONFIG.maxScannerStartAttempts) {
        logger(
            "Error", [
                "Error: Unable to start the scanner after", 
                JSON.stringify(CONFIG.maxScannerStartAttempts), 
                "attempts"
            ]
        );
        return;
    }

    //exit if can't find the config
    if(typeof CONFIG === "undefined") {
        logger("Error", "Undefined config");
        return;
    }

    //get the config of ble component
    let BLEConfig = Shelly.getComponentConfig("ble");

    //exit if the BLE isn't enabled
    if(!BLEConfig.enable) {
        logger("Error", "The Bluetooth is not enabled");
        return;
    }

    //check if the scanner is already running
    if( !BLE.Scanner.isRunning()) {
        //start a new scanner
        let bleScanner = BLE.Scanner.Start({
            duration_ms: BLE.Scanner.INFINITE_SCAN,
            active: CONFIG.activeScan
        });

        //exist if the scanner can not be started
        if(bleScanner === false) {
            scannerStartAttempts++;

            logger(
                "Error", [
                    "Error: Can not start a new scanner. Retry in",
                    JSON.stringify(CONFIG.scannerStartAttemptAfter),
                    "seconds"
                ]
            );

            Timer.set(CONFIG.scannerStartAttemptDelay * 1000, false, init);
            return;
        }

        logger("Info", "Started a new scanner");
    }

    //subscribe a callback to BLE scanner
    BLE.Scanner.Subscribe(BLEScanCallback);
}

init();