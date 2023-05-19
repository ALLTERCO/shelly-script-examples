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
        "id": 1,
        "event": "shelly-blu",
        "encryption": false,
        "BTHome_version": 2,
        "pid": 33,
        "battery": 100,
        "button": 1,
        "rssi": -66,
        "address": "bc:02:6e:c3:ce:cc",
        "ts": 1684315357.98
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

    /**
     * When set to true, debug messages will be logged to the console.
     */
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

/**
 * The BTH object defines the structure of the BTHome data. 
 * Each entry in the object represents a data field and can contains the following properties:
 * - n: Name of the data field
 * - t: Type of the data field (uint8, int8, uint16, int16, uint24, int24)
 * - u: Unit of the data field (optional)
 * - f: Factor to multiply the value with (optional)
 */
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

/**
 * Logs the provided message with an optional prefix to the console.
 * @param {string} message - The message to log.
 * @param {string} [prefix] - An optional prefix for the log message.
 */
function logger(message, prefix) {

    //exit if the debug isn't enabled
    if(!CONFIG.debug) {
        return;
    }

    let finalText = "";

    //if the message is list loop over it
    if(typeof message === "object") {
        for(let i in message) {
            finalText = finalText + " " + message[i];
        }
    }
    else {
        finalText = message;
    }

    //the prefix must be string
    if(typeof prefix !== "string") {
        prefix = "";
    }
    else {
        prefix = prefix + " :"
    }

    //log the result
    console.log(prefix, finalText);
}

/**
 * Functions for decoding and unpacking the service data from Shelly BLU devices. 
 * It is used to extract specific data fields from the service data received during BLE scanning
 */
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

    /**
     * Unpacks the service data buffer from a Shelly BLU device
     * @param {String} buffer 
     * @returns {Object|null} an object containing the decoded data fields
     */
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
                logger("unknown type", "BTH");
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
 * Еmitting the decoded BLE data to a specified event. It allows other scripts to receive and process the emitted data.
 * @param {Object} data An object containing the decoded BLE data to be emitted
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
 * Callback for the BLE scanner object. 
 * It is called when a scan result event occurs. The function processes the received 
 * advertising data from a Shelly BLU device and extracts the BTHome service data
 * 
 * @param {Number} event The event type of the scan result
 * @param {Object|null} result The scan result object that contains information about the scanned device
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
        logger("Encrypted devices are not supported", "Error");
        return;
    }

    let unpackedData = BTHomeDecoder.unpack(result.service_data[BTHOME_SVC_ID_STR]);

    //exit if unpacked data is null or the device is encrypted
    if(     
        unpackedData === null || 
        typeof unpackedData === "undefined" || 
        unpackedData["encryption"]
    ) {
        logger("Can't unpack the device's data", "Error");
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
 * Initializes the script and performs the necessary checks and configurations
 */
function init() {
    //exit if the number of attempts exceeded the limit
    if(scannerStartAttempts > CONFIG.maxScannerStartAttempts) {
        logger(
            [
                "Error: Unable to start the scanner after", 
                JSON.stringify(CONFIG.maxScannerStartAttempts), 
                "attempts"
            ],
            "Error"
        );
        return;
    }

    //exit if can't find the config
    if(typeof CONFIG === "undefined") {
        logger("Undefined config", "Error");
        return;
    }

    //get the config of ble component
    let BLEConfig = Shelly.getComponentConfig("ble");

    //exit if the BLE isn't enabled
    if(!BLEConfig.enable) {
        logger("The Bluetooth is not enabled", "Error");
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
                [
                    "Error: Can not start a new scanner. Retry in",
                    JSON.stringify(CONFIG.scannerStartAttemptAfter),
                    "seconds"
                ],
                "Error"
            );

            Timer.set(CONFIG.scannerStartAttemptDelay * 1000, false, init);
            return;
        }

        logger("Started a new scanner", "Info");
    }

    //subscribe a callback to BLE scanner
    BLE.Scanner.Subscribe(BLEScanCallback);
}

init();