/**
 * BLE passive scanner and MQTT gateway
 * Detected devices will be automatically registered to HA/Domoticz using MQTT Autodiscovery.
 *
 * Usage:
 *
 * Because BLE passive scanner process data of all surroudning BLE devices, this script allows to filter them by MAC address.
 * To do so enter the device data into `CONFIG.allowed_devicess` variable, or into KVS under `allowed_devicess` key.
 * The KVS allows to add devices without need of changing the code of the script.

 * The format of those data is: { "<mac address>": [ "<manufacturer>", "<model>" ], } for example:
 *
 * {
 *   "xxxxxxxxxxxx": [ "Shelly", "DW BLU" ],
 *   "yyyyyyyyyyyy": [ "Shelly", "Motion BLU" ],
 *   "zzzzzzzzzzzz": [ "Shelly", "H&T BLU" ]
 * }
 *
 * The structure provides option to set manufacturer and model becuse those cannot be obtained from BLE messages.
 * Thanks to that this information can be passed to devices created via MQTT dicovery.
 * If you don't need that, pass empty array instead: { "3c2exxxxxxxx": [], }
 *
 * Debugging:
 *
 * You can disable mac filtering at all by setting CONFIG.filter_devices to false.
 *
 * If CONFIG.debug is true, script will output mac addresses of ignored and processed devices to the console.
 * Also it will output device and entity names, though once at time of registering them to MQTT Discovery.
 *
 * Supported payloads: ATC/Xiaomi/BTHomev2 through advertisements packets
 *
 * Sensor values sent to 'mqtt_topic' and device config objects sent to 'discovery_topic'.
 * Copyleft Alexander Nagy @ bitekmindenhol.blog.hu, Michal Bartak
 */

const DEVICE_INFO = Shelly.getDeviceInfo();

let CONFIG = {
    /**
     * If true, only selected devices will be processed.
     * Selection of devices is achieved by setting up `CONFIG.allowed_devices` or (preferably) storing that information in KVS store under `allowed_devices` key.
     *
     * If false (not recommended), no filtering is applied, and all BLE messages are intercepted and passed to MQTT.
     */
    filter_devices: true,

    /**
     * If true, it will output:
     * * MAC address of the ignored device
     * * MAC address for processed device
     * * If the device is discovered the first time, names of device and entities (to find them easier in HA))
     */
    debug: true,

    /**
     * Structure providing device data, identified by its MAC address
     *
     * IF `filter_devices` IS `true`, THEN
     * ONLY BLE DEVICES IDENTIFIED BY MAC ADDRESSES FOUND IN THIS STRUCTURE WILL BE PROCESSED
     *
     * Data might also be stored in KVS under `allowed_devices` key (the same structure). It will be merged with the variable.\
     * The script needs to be restarted to load changes from KVS.
     *
     * Examples:
     * * `{ "xxxxfxxxxxxx": [ "Shelly", "DW BLU" ], }`
     * * `{ "yyyyyyyyyyyy": [] }`
     * Model and Manufacturer are optional. But missing won't be reported to MQTT Discovery as device properties.
     */
    allowed_devices: {},

    /**
     * value added payload stored into mqtt_topic. Indicates a device which has stored the data (device the script is running on).
     * Set to null to disable reporting.
     */
    mqtt_src: DEVICE_INFO.id + " (" + DEVICE_INFO.name + ")",

    /**
     * The KVS key, a user can set up allowed devices.
     *
     * Data has to be prepared as JSON. For structure, refer `CONFIG.allowed_devicess` description
     */
    kvs_key: "allowed_devices",
    mqtt_topic: "blegateway/",
    discovery_topic: "homeassistant/",

    /**
     * Possible values: `mqtt_event`, `device_trigger`.\
     * Prefered one is: `mqtt_event` as most recent and better supported
     */
    buttons_as: "mqtt_event"
};
const SCAN_PARAM_WANT = { duration_ms: BLE.Scanner.INFINITE_SCAN, active: false }


//BTHomev2: ID , Size, Sign, Factor, Name
let datatypes = [
    [0x00, 1, false, 1,    'pid'],
    [0x01, 1, false, 1,    'battery'],
    [0x12, 2, false, 1,    'co2'],
    [0x0c, 2, false, 0.001,'voltage'],
    [0x4a, 2, false, 0.1,  'voltage'],
    [0x08, 2, true,  0.01, 'dewpoint'],
    [0x03, 2, false, 0.01, 'humidity'],
    [0x2e, 1, false, 1,    'humidity'],
    [0x05, 3, false, 0.01, 'illuminance'],
    [0x14, 2, false, 0.01, 'moisture'],
    [0x2f, 1, false, 1,    'moisture'],
    [0x04, 3, false, 0.01, 'pressure'],
    [0x45, 2, true,  0.1,  'temperature'],
    [0x02, 2, true,  0.01, 'temperature'],
    [0x3f, 2, true,  0.1,  'rotation'],
    [0x3a, 1, false, 1,    'button'], //selector
    [0x15, 1, false, 1,    'battery_ok'], //binary
    [0x16, 1, false, 1,    'battery_charging'], //binary
    [0x17, 1, false, 1,    'co'], //binary
    [0x18, 1, false, 1,    'cold'], //binary
    [0x1a, 1, false, 1,    'door'], //binary
    [0x1b, 1, false, 1,    'garage_door'], //binary
    [0x1c, 1, false, 1,    'gas'], //binary
    [0x1d, 1, false, 1,    'heat'], //binary
    [0x1e, 1, false, 1,    'light'], //binary
    [0x1f, 1, false, 1,    'lock'], //binary
    [0x20, 1, false, 1,    'moisture_warn'], //binary
    [0x21, 1, false, 1,    'motion'], //binary
    [0x2d, 1, false, 1,    'window'], //binary
];

let discovered = [];

//format is subset of https://docs.python.org/3/library/struct.html
let packedStruct = {
  buffer: '',
  setBuffer: function(buffer) {
    this.buffer = buffer;
  },
  utoi: function(u16) {
    return (u16 & 0x8000) ? u16 - 0x10000 : u16;
  },
  getUInt8: function() {
    return this.buffer.at(0)
  },
  getInt8: function() {
    let int = this.getUInt8();
    if(int & 0x80) int = int - 0x100;
    return int;
  },
  getUInt16LE: function() {
    return 0xffff & (this.buffer.at(1) << 8 | this.buffer.at(0));
  },
  getInt16LE: function() {
    return this.utoi(this.getUInt16LE());
  },
  getUInt16BE: function() {
    return 0xffff & (this.buffer.at(0) << 8 | this.buffer.at(1));
  },
  getInt16BE: function() {
    return this.utoi(this.getUInt16BE(this.buffer));
  },
  getUInt24LE: function() {
    return 0xffffff & (this.buffer.at(2) << 16 | this.buffer.at(1) << 8 | this.buffer.at(0));
  },
  getInt24LE: function() {
    return this.utoi(this.getUInt24LE());
  },
  getUInt24BE: function() {
    return 0xffffff & (this.buffer.at(0) << 16 | this.buffer.at(1) << 8 | this.buffer.at(2));
  },
  getInt24BE: function() {
    return this.utoi(this.getUInt24BE(this.buffer));
  },
  unpack: function(fmt, keyArr) {
    let b = '<>!';
    let le = fmt[0] === '<';
    if(b.indexOf(fmt[0]) >= 0) {
      fmt = fmt.slice(1);
    }
    let pos = 0;
    let jmp;
    let bufFn;
    let res = {};
    while(pos<fmt.length && pos<keyArr.length && this.buffer.length > 0) {
      jmp = 0;
      bufFn = null;
      if(fmt[pos] === 'b' || fmt[pos] === 'B') jmp = 1;
      if(fmt[pos] === 'h' || fmt[pos] === 'H') jmp = 2;
      if(fmt[pos] === 'i' || fmt[pos] === 'I') jmp = 3;
      if(fmt[pos] === '4') jmp = 4; //just skip for now
      if(fmt[pos] === '6') jmp = 6; //just skip for now

      if(fmt[pos] === 'b') {
        res[keyArr[pos]] = this.getInt8();
      }
      else if(fmt[pos] === 'B') {
        res[keyArr[pos]] = this.getUInt8();
      }
      else if(fmt[pos] === 'h') {
        res[keyArr[pos]] = le ? this.getInt16LE() : this.getInt16BE();
      }
      else if(fmt[pos] === 'H') {
        res[keyArr[pos]] = le ? this.getUInt16LE() : this.getUInt16BE();
      }
      else if(fmt[pos] === 'i') {
        res[keyArr[pos]] = le ? this.getInt24LE() : this.getInt24BE();
      }
      else if(fmt[pos] === 'I') {
        res[keyArr[pos]] = le ? this.getUInt24LE() : this.getUInt24BE();
      }
      this.buffer = this.buffer.slice(jmp);
      pos++;
    }
    return res;
  }
};

function convertByteArrayToSignedInt(bytes, byteSize) {
    let result = 0;
    const signBit = 1 << (byteSize * 8 - 1);
    for (let i = 0; i < byteSize; i++) {
        result |= (bytes.at(i) << (i * 8));
    }
    // Check sign bit and sign-extend if needed
    if ((result & signBit) !== 0) {
        result = result - (1 << (byteSize * 8));
    }
    return result;
};

function convertByteArrayToUnsignedInt(bytes, byteSize) {
    let result = 0;
    for (let i = 0; i < byteSize; i++) {
        result |= (bytes.at(i) << (i * 8));
    }
    return result >>> 0; // Ensure the result is an unsigned integer
};

function extractBTHomeData(payload) {
    let index = 0;
    let extractedData = {};
    while (index < payload.length) {
     dataId = payload.at(index);
     index = index + 1;
     let dataType = -1;
     for (let i=0; i<datatypes.length; i++) {
       if (datatypes[i][0] == dataId) {
         dataType = i;
         break;
       }
     }
     if (dataType >-1) {
       let byteSize = datatypes[dataType][1];
       let factor   = datatypes[dataType][3];
       let rawdata = payload.slice(index, index + byteSize);
       if (datatypes[dataType][2]) {
         value = convertByteArrayToSignedInt(rawdata, byteSize);
       } else {
         value = convertByteArrayToUnsignedInt(rawdata, byteSize);
       }
       extractedData[ datatypes[dataType][4] ] = value * factor;
       index += byteSize;
     } else { index = 10;}
    }

    return extractedData;
};


/**
 * Decides topic name for data
 *
 * Actually, this may break into pieces if the BLE payload differs between reports.
 * While for the topic alone it's ok, the topic is used as a part of a key to avoid repeating the discovery.
 *
 * @param {<Object>} resarray Array of data
 * @returns {string} name of an MQTT topic to store data to
 */
function getTopicName(resarray) {
    let resstr = "";
    let rlen = Object.keys(resarray).length;
    if (rlen == 0) return resstr

    if (rlen==1) {
      resstr = Object.keys(resarray)[0];
    } else if (("temperature" in resarray) || ("humidity" in resarray) || ("pressure" in resarray)) {
      resstr = "sensor";
    } else if ("battery" in resarray) {
      resstr = "telemetry";
    } else {
      resstr = "status";
    }
    return resstr;
}

/**
 * Function creates and return a device data in format requierd by MQTT discovery.
 *
 * Manufacturer and model are retrieved from CONFIG.allowedMACs global variable.
 * Device name is built from its mac address and model name (if exists)
 * via_device is set to Shelly address the script is run on.
 *
 * @param address {string} - normalized already mac address of the BLE device.
 * @returns {<Object>} device object structured for MQTT discovery
 */
function discoveryDevice(address) {

    model="";

    if (CONFIG.allowed_devices[address][1] !== undefined) {
      model = CONFIG.allowed_devices[address][1];
    }

    device = {};
    device["name"]          = address + (model==="" ? "" : "-" + model);
    device["identifiers"]   = [address];
    device["connections"]   = [["mac", address]];
    device["via_device"]    = normalizeMacAddress(DEVICE_INFO.mac);

    if (CONFIG.allowed_devices[address][0] !== undefined) {
      device["manufacturer"] = CONFIG.allowed_devices[address][0];
    }

    if (model !== "") {
      device["model"] = model;
    }

    printDebug("Device name: ", device["name"]);

    return device;
}

/**
 * Cretes and publishes discovery topic for single entity
 * @param {string} address MAC address of the BLE device
 * @param {string} topic MQTT topic where data are reported to. Needed to include into Discovery definition
 * @param {string} name Data
 * @param {<Object>} device Device information to be added to dicovery data
 */
function discoveryEntity(address, topic, name, device) {

    let domain = "sensor"

    let pload = {};
    pload["device"]  = device;
    pload["name"]    = name;
    pload["stat_t"]  = topic;
    pload["val_tpl"] = "{{ value_json." + name + " }}";

    let subt = "";

    switch (name) {

        /* SENSORS */

        case "temperature":
        case "humidity":
            domain                  = "sensor";
            pload["dev_cla"]        = name;
            pload["unit_of_meas"]   = name === "temperature" ? "°C" : "%";
            subt                    = name;
            break;

        case "battery":
            domain                  = "sensor";
            pload["dev_cla"]        = "battery";
            pload["ent_cat"]        = "diagnostic";
            pload["unit_of_meas"]   = "%";
            subt                    = "battery";
            break;

        case "illuminance":
            domain                  = "sensor";
            pload["dev_cla"]        = "illuminance";
            pload["unit_of_meas"]   = "lx";
            subt                    = "illuminance";
            break;

        case "pressure":
            domain                  = "sensor";
            pload["dev_cla"]        = "atmospheric_pressure";
            pload["unit_of_meas"]   = "hPa";
            subt                    = "atmospheric_pressure";
            break;

        case "rssi":
            domain                  = "sensor";
            pload["dev_cla"]        = "signal_strength";
            pload["ent_cat"]        = "diagnostic";
            pload["unit_of_meas"]   = "dBm";
            subt                    = "rssi";
            break;

        case "rotation":
            pload["name"]           = "tilt";
            domain                  = "sensor";
            pload["unit_of_meas"]   = "°";
            subt                    = "tilt";
            pload["stat_t"]         = topic + "/rotation";
            delete pload.val_tpl;
            break;

        /* BINARY SENSORS */

        case "window":
            domain                  = "binary_sensor";
            pload["name"]           = "contact";
            pload["dev_cla"]        = "opening";
            subt                    = "opening";
            pload["pl_on"]          = 1;
            pload["pl_off"]         = 0;
            pload["stat_t"]         = topic + "/window";
            delete pload.val_tpl;
            break;

        case "motion":
            domain                  = "binary_sensor";
            pload["dev_cla"]        = "motion";
            subt                    = "motion";
            pload["pl_on"]          = 1;
            pload["pl_off"]         = 0;
            break;

        /* BUTTON */

        case "button":

            switch (CONFIG.buttons_as) {
                case "mqtt_event":
                    domain                  = "event";
                    pload["platform"]       = "event";
                    pload["device_class"]   = "button";
                    pload["event_types"]    = ["click"];

                    pload["name"]           = "button";
                    subt                    = pload["name"];
                    pload["state_topic"]    = topic;
                    pload["val_tpl"] = ' \
{ {% if  value_json.get("button") %} \
"button": "button", \
"event_type": "click" \
{% endif %} }';
                    break;
                case "device_trigger":
                    domain                  = "device_automation";
                    pload["automation_type"]= "trigger";
                    pload["platform"]       = "device_automation";
                    pload["type"]           = "action";
                    pload["subtype"]        = "button_click";
                    subt                    = pload["type"] + "_" +  pload["subtype"];
                    pload["payload"]        = "1";
                    pload["topic"]          = topic;
                    break;
            }
            break;
        default:
            printDebug("Unrecognized param: ", name);
            return;
            break;
    }

    // has to be after the case statement, because of pload["name"]
    pload["uniq_id"] = address + "-" + pload["name"];

    if (domain === "sensor") pload["stat_cla"] = "measurement";

    let discoveryTopic = CONFIG.discovery_topic + domain + "/" + address + "/" + subt + "/config";
    printDebug("Discovered: ", pload["name"], "; path", discoveryTopic );

    let adstr = {"topic": discoveryTopic, "data": pload};
    MQTT.publish(adstr.topic + "", JSON.stringify(adstr.data), 1, true);
}


/**
 * Normalize MAC address removing : and - characters, and making the rest lowercase
 * @param {string} address MAC address
 * @returns {string} normalized MAC address
 */
function normalizeMacAddress(address) {
  return String(address).split("-").join("").split(":").join("").toLowerCase();
}

/**
 * Determines whethere device identified by the `address` has to be processed or skipped.
 * @param {string} address Normalized form of MAC address
 * @returns {bool}
 */
function allowDevices(address) {
  if (!CONFIG.filter_devices) return true;

  // escape if not mac address found
  if (CONFIG.allowed_devices[address] === undefined) {
      return false;
  }

  return true;
}

/**
 * Generate discovery topics when not yet reported
 * @param {string} address
 * @param {string} topic
 * @param {<Object>} jsonstr
 */
function discoveryItems(address, topic, jsonstr) {

  let params = Object.keys(jsonstr);
  let device = discoveryDevice(address);

  // Iterate through all values, even unsupported.
  // Not supported params will be ignored within autodiscovery()
  // then stored into `discovered` array and never processed again.
  for (let i = 0; i < params.length; i++) {

    let discKey = address+params[i];

    if (discovered.indexOf(discKey) == -1) {

      discoveryEntity(address, topic, params[i], device);

      discovered.push(discKey); //mark as discovered
    }
  }

}

function mqttreport(address, rssi, jsonstr) {
    let macNormalized = normalizeMacAddress(address);

    if (!allowDevices(macNormalized)) {
      printDebug("Ignored MAC: ", macNormalized);
      return;
    }

    printDebug("Processed MAC: ", macNormalized);
    printDebug("Data: ", JSON.stringify(jsonstr));

    let topname = getTopicName(jsonstr);
    let topic = CONFIG.mqtt_topic + macNormalized + "/" + topname;
    printDebug("Topic:", topic);

    jsonstr['rssi'] = rssi;
    if (CONFIG.mqtt_src) {
        jsonstr['src'] = CONFIG.mqtt_src;
    }

    discoveryItems(macNormalized, topic, jsonstr);

    MQTT.publish(topic, JSON.stringify(jsonstr), 1, false);

    // Need to store those parameters into separate topics, since they are not reported with every message.
    // It renders in unavailable state on HA restart
    if (jsonstr.hasOwnProperty('window')) {
        MQTT.publish(topic + '/window', JSON.stringify(jsonstr.window), 1, true);
    }

    if (jsonstr.hasOwnProperty('rotation')) {
        MQTT.publish(topic + '/rotation', JSON.stringify(jsonstr.rotation), 1, true);
    }

}

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
   if (res.advData.length < 10) return;
   let prot = "";
   let sc = 0;
   while (sc < 10) { //strip unneeded data
     sc = sc + 1;
     if (res.advData.at(0) > 9) {
       sc = 10;
     } else {
       if (res.advData.length > res.advData.at(0)) {
         res.advData = res.advData.slice( res.advData.at(0)+1 );
       }
     }
   }
   if (res.advData.length < 10) return;
   let hdr = {};
//   console.log(res.addr,res.rssi,res.advData.length,res.advData.at(0), res.advData.at(1) ,res.advData.at(2), res.advData.at(3),res.advData.at(6), res.advData.at(7),res.advData.at(15), res.advData.at(16));
   if (res.advData.at(1) == 0x16) {
    packedStruct.setBuffer(res.advData);
    if ((res.advData.at(2) == 0x1a) && (res.advData.at(3) == 0x18)) { //atc
      if (res.advData.length==17) { //atc1441
       hdr = packedStruct.unpack('>46hBBHB', ['id','mac','temperature','humidity','battery','battery_mv','frame']);
       hdr.temperature = hdr.temperature / 10.0;
       prot =  "atc1441";
      } else if (res.advData.length==19) { //atc custom
       hdr = packedStruct.unpack('<46hHHBBB', ['id','mac','temperature','humidity','battery_mv','battery','frame']);
       hdr.temperature = hdr.temperature * 0.01;
       hdr.humidity = hdr.humidity * 0.01;
       prot = "atc_custom";
      }
    } //end atc
    else if ((res.advData.at(2) == 0x95) && (res.advData.at(3) == 0xfe)) { //xiaomi
      if (res.advData.length < 18) return;
      prot = "xiaomi";
      let ofs = 0;
      if ( (res.advData.at(16) != 0x10) && (res.advData.at(17) == 0x10) ) {
         ofs = 1;
      }
      if ( (res.advData.at(6) == 0x76) && (res.advData.at(7) == 0x05) ) {
        packedStruct.setBuffer(res.advData.slice(17));
        hdr = packedStruct.unpack('<hH', ['temperature','humidity']);
        hdr.temperature = hdr.temperature / 10.0;
        hdr.humidity = hdr.humidity / 10.0;

      } else {
        let dataType = res.advData.at(15 + ofs);
        let dataSize = res.advData.at(17 + ofs);

        if ( (dataType == 4) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<h', ['temperature']);
          hdr.temperature = hdr.temperature / 10.0;

        } else if ( (dataType == 6) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<H', ['humidity']);
          hdr.humidity = hdr.humidity / 10.0;

        } else if ( (dataType == 7) && (dataSize >= 3) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<I', ['illuminance']);

        } else if ( (dataType == 8) && (dataSize == 1) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<B', ['moisture']);

        } else if ( (dataType == 9) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<H', ['soil']);

        } else if ( (dataType == 0xA) && (dataSize > 0) ) {
          hdr = { battery: res.advData.at(18+ofs)};

        } else if ( (dataType == 0xD) && (dataSize > 3) ) {
            packedStruct.setBuffer(res.advData.slice(18+ofs));
            hdr = packedStruct.unpack('<hH', ['temperature','humidity']);
            hdr.temperature = hdr.temperature / 10.0;
            hdr.humidity = hdr.humidity / 10.0;
        }
      }
    } // end xiaomi
    else if ((res.advData.at(2) == 0xd2) && (res.advData.at(3) == 0xfc)) { //bthomev2
         if ( (res.advData.at(4) & 0x1) != 1 ) { // no encryption
            prot = 'bthome2';
            hdr = extractBTHomeData(res.advData.slice(5))
         }
    } // end bthomev2
   } //0x16
 if (prot != "") { mqttreport(res.addr, res.rssi, hdr); }; // console.log(prot, res.addr, res.rssi, hdr);
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

/**
 * Outputs passed arguments to console, only if `CONFIG.debug` is true
 */
function printDebug() {
    if (!CONFIG.debug) return;

    let str = "";
    for (let i = 0; i < arguments.length; i++) {
      str = str + arguments[i];
    }

    console.log(str);
}


/**
 * Get value from KVS
 *
 * @param {string} key Name of the key
 * @param {function} callback Callback function
 * @async
 */
function kvsGet(key, callback) {
    Shelly.call(
        "KVS.Get",
        { key: key },
        function (result, error) {
            if (error == -105) {
                printDebug("No `" + key + "` key found in KVS. It's OK if you don't need that");
            } else if (error) {
                print("KVS Get Error:", JSON.stringify(error));
                callback(null);
            } else {
                callback(result.value);
            }
        }
    );
}



/**
 * Loads data of devices to be processed from KVS to `CONFIG.allowed_devices`.\
 * @param {function} callback
 * @async
 */
function loadBleMacsFromKVS(callback) {
    kvsGet(CONFIG.kvs_key, function(value) {
        if (value !== null) {
            let macs = JSON.parse(value);

            for (let k in macs) {
              CONFIG.allowed_devices[normalizeMacAddress(k)] = macs[k];
            }
        }
        callback();
    });
}

loadBleMacsFromKVS(function() {
  if (Object.keys(CONFIG.allowed_devices).length == 0 && CONFIG.filter_devices) {
    printDebug("No devices will be processed beucase filter_devices is true and allowed_devices are not set");
  }

  if (Object.keys(CONFIG.allowed_devices).length > 0 && CONFIG.debug) {
    let msg = "Devices configured for processing:\n";
    for (let k in CONFIG.allowed_devices) {
      msg = msg + "\n" + "MAC: " + k
              + "; Manufacturer: " + (CONFIG.allowed_devices[k][0] === undefined ? "<none>" : CONFIG.allowed_devices[k][0])
              + "; Model: " + (CONFIG.allowed_devices[k][1] === undefined ? "<none>" : CONFIG.allowed_devices[k][1]);
    }

    printDebug(msg);
  }
});