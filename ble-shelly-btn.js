/**
 * This script uses the BLE scan functionality in scripting
 * Selects Shelly BLU Buttons from the aired advertisements, decodes
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
    print('Button pressed, will toggle the output');
    Shelly.call("Switch.Toggle", { id: 0 });
}

let CONFIG = {
    shelly_blu_name_prefix: null,
    //"BIND" to only this address
    shelly_blu_address: "bc:02:6e:c3:c8:b9",
    actions: [
        {
            cond: {
                Button: 1
            },
            action: triggerAutomation
        }
    ]
};
// END OF CHANGE

let ALLTERCO_MFD_ID_STR = "0ba9";
let BTHOME_SVC_ID_STR = "fcd2";

let ALLTERCO_MFD_ID = JSON.parse('0x' + ALLTERCO_MFD_ID_STR);
let BTHOME_SVC_ID = JSON.parse('0x' + BTHOME_SVC_ID_STR);

let SCAN_DURATION = BLE.Scanner.INFINITE_SCAN;
let ACTIVE_SCAN = typeof CONFIG.shelly_blu_name_prefix !== 'undefined' && CONFIG.shelly_blu_name_prefix !== null;

let SHELLY_BLU_DEV_NAME_PREFIX = "SBDW"; //SBDW-002D for first model

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
}

let BTH = [];
BTH[0x00] = { n: 'pid', t: uint8 };
BTH[0x01] = { n: 'Battery', t: uint8, u: '%' };
BTH[0x3A] = { n: 'Button', t: uint8 };
BTH[0x1A] = { n: 'Door', t: uint8 };
BTH[0x2D] = { n: 'Window', t: uint8 };
BTH[0x05] = { n: 'Illuminance', t: uint24, f: 0.01 };
BTH[0x3F] = { n: 'Rotation', t: int16, f: 0.1 };

//TODO: Handle 24 bit numbers
let BTHomeDecoder = {
    buffer: null,
    setBuffer: function (buffer) {
        this.buffer = buffer;
    },
    utoi: function (num, bitsz) {
        let mask = 1 << (bitsz - 1);
        return (num & mask) ? num - (1 << bitsz) : num;
    },
    getUInt8: function () {
        return this.buffer.at(0)
    },
    getInt8: function () {
        return this.utoi(this.getUInt8(), 8);
    },
    getUInt16LE: function () {
        return 0xffff & (this.buffer.at(1) << 8 | this.buffer.at(0));
    },
    getInt16LE: function () {
        return this.utoi(this.getUInt16LE(), 16);
    },
    getUInt24LE: function () {
        return 0x00ffffff & (this.buffer.at(2) << 16 | this.buffer.at(1) << 8 | this.buffer.at(0));
    },
    getInt24LE: function () {
        return this.utoi(this.getUInt24LE(), 24);
    },
    getBufValue: function (type) {
        if (type === uint8) return this.getUInt8();
        if (type === int8) return this.getInt8();
        if (type === uint16) return this.getUInt16LE();
        if (type === int16) return this.getInt16LE();
        if (type === uint24) return this.getUInt24LE();
        if (type === int24) return this.getInt24LE();
        return null;
    },
    unpack: function () {
        if (this.buffer === null) return null;
        let result = {};
        let dib = this.buffer.at(0);
        result['encryption'] = (dib & 0x1) ? true : false;
        result['BTHome_version'] = (dib >> 5);
        if (result['BTHome_version'] !== 2) return null;
        //Can not handle encrypted data
        if (result['encryption'] === 1) return null;
        this.buffer = this.buffer.slice(1);

        while (this.buffer.length > 0) {
            let _bth = BTH[this.buffer.at(0)];
            if (_bth === 'undefined') return null;
            this.buffer = this.buffer.slice(1);
            let _value = this.getBufValue(_bth.t);
            if (_value === null) return null;
            if (typeof _bth.f !== 'undefined') _value = _value * _bth.f;
            result[_bth.n] = _value;
            this.buffer = this.buffer.slice(getByteSize(_bth.t));
        }
        return result;
    }
};

let ShellyBLUParser = {
    getData: function (res) {
        BTHomeDecoder.setBuffer(res.service_data[BTHOME_SVC_ID_STR]);
        let result = BTHomeDecoder.unpack();
        return result;
    },
};

let last_pid = 0x100;
function scanCB(ev, res) {
    if (ev !== BLE.Scanner.SCAN_RESULT) return;
    // skip if there is no service_data member
    if (typeof res.service_data === 'undefined' || typeof res.service_data[BTHOME_SVC_ID_STR] === 'undefined') return;
    // skip if we are looking for name match but don't have active scan as we don't have name
    if (CONFIG.scan_active === true && (typeof res.local_name !== 'string' || res.local_name.indexOf(SHELLY_BLU_DEV_NAME_PREFIX) !== 0)) return;
    // skip if we don't have address match
    if (typeof CONFIG.shelly_blu_address !== 'undefined' && CONFIG.shelly_blu_address !== res.addr) return;
    let BTHparsed = ShellyBLUParser.getData(res);
    // skip if parsing failed
    if (BTHparsed === null) return;
    // skip, we are deduping results
    if (last_pid === BTHparsed.pid) return;
    last_pid = BTHparsed.pid;
    console.log(JSON.stringify(BTHparsed));
    // execute actions from CONFIG
    let aIdx = null;
    for (aIdx in CONFIG.actions) {
        // skip if no conditionn defined
        if (typeof CONFIG.actions[aIdx]['cond'] === 'undefined') continue;
        let cond = CONFIG.actions[aIdx]['cond'];
        let cIdx = null;
        let run = true;
        for (cIdx in cond) {
            if (typeof BTHparsed[cIdx] === 'undefined') run = false;
            if (BTHparsed[cIdx] !== cond[cIdx]) run = false;
        }
        // if all conditions evaluated to true then execute
        if (run) CONFIG.actions[aIdx]['action'](BTHparsed);
    }
}

BLE.Scanner.Start({ duration_ms: SCAN_DURATION, active: ACTIVE_SCAN }, scanCB);
