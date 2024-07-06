/**
 * BLE passive temperature sensor scanner and MQTT gateway
 * Detected devices will be automatically registered to HA/Domoticz MQTT Autodiscovery
 *
 * Supported payloads: ATC/Xiaomi/BTHomev2 through advertisements packets
 *
 * Sensor values sent to 'mqtt_topic' and device config objects sent to 'discovery_topic'.
 * Copyleft Alexander Nagy @ bitekmindenhol.blog.hu
 * Extended by Michal Bartak
 */

let CONFIG = {
  scan_duration: BLE.Scanner.INFINITE_SCAN,
  mqtt_topic: "blegateway/",
  // if mqtt_src is defined, there will be a src field with this value in every mqtt message to identify the shelly which created this message. ie. "shelly-123456"
  mqtt_src: null,
  discovery_topic: "homeassistant/",
};

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
       let byteSize = datatypes[i][1];
       let factor   = datatypes[i][3];
       let rawdata = payload.slice(index, index + byteSize);
       if (datatypes[i][2]) {
         value = convertByteArrayToSignedInt(rawdata, byteSize);
       } else {
         value = convertByteArrayToUnsignedInt(rawdata, byteSize);
       }
       extractedData[ datatypes[i][4] ] = value * factor;
       index += byteSize;
     } else { index = 10;}
    }

    return extractedData;
};

function gettopicname(resarray) {
         let resstr = "";
         let rlen = Object.keys(resarray).length;
         if (rlen>0) {
           if (rlen==1) {
             resstr = Object.keys(resarray)[0];
           } else if (("temperature" in resarray) || ("humidity" in resarray) || ("pressure" in resarray)) {
             resstr = "sensor";
           } else if ("battery" in resarray) {
             resstr = "telemetry";
           } else {
             resstr = "status";
           }
         }
         return resstr;
}

function autodiscovery(address, topname, topic, jsonstr) {

    let adstr = [];

    adstr = autodiscovery_sensors(adstr, address, topname, topic, jsonstr);
    adstr = autodiscovery_binary_sensors(adstr, address, topname, topic, jsonstr);

    return adstr;
}

function autodiscovery_sensors(adstr, address, topname, topic, jsonstr) {

    let params = Object.keys(jsonstr);
    let subt = "";
    let domain = "sensor"
    for (let i = 0; i < params.length; i++) {
        let pload = {};
        subt = "";
        pload["device"] = {};
        pload["device"]["name"] = address + " " + topname;
        pload["device"]["identifiers"] = [];
        pload["device"]["identifiers"].push(address);
        pload["name"] = params[i];
        pload["stat_t"] = topic;
        pload["uniq_id"] = address + "-" + params[i];
        pload["state_class"] = "measurement";
        if (params[i] == "temperature") {
            pload["dev_cla"] = params[i];
            pload["unit_of_meas"] = "C";
            subt = params[i];
        } else if (params[i] == "humidity") {
            pload["dev_cla"] = params[i];
            pload["unit_of_meas"] = "%";
            subt = params[i];
        } else if (params[i] == "battery") {
            pload["dev_cla"] = params[i];
            pload["unit_of_meas"] = "%";
            subt = params[i];
        } else if (params[i] == "illuminance") {
            pload["dev_cla"] = params[i];
            pload["unit_of_meas"] = "lx";
            subt = params[i];
        } else if (params[i] == "pressure") {
            pload["dev_cla"] = "atmospheric_pressure";
            pload["unit_of_meas"] = "hPa";
            subt = pload["dev_cla"];
        } else if (params[i] == "rssi") {
            pload["dev_cla"] = "signal_strength";
            pload["entity_category"] = "diagnostic";
            pload["unit_of_meas"] = "dBm";
            subt = "RSSI";
        } else if (params[i] == "rotation") {
            pload["unit_of_meas"] = "°";
            subt = params[i];
        }

        if (subt != "") {
            pload["value_template"] = "{{ value_json." + params[i] + " }}";
            adstr.push([CONFIG.discovery_topic + domain + "/" + address + "/" + subt + "/config", JSON.stringify(pload)]);
        }
    }
    return adstr;
}

function autodiscovery_binary_sensors(adstr, address, topname, topic, jsonstr) {

    let params = Object.keys(jsonstr);
    let subt = "";
    let domain = "binary_sensor";
    for (let i = 0; i < params.length; i++) {
        let pload = {};
        subt = "";
        pload["device"] = {};
        pload["device"]["name"] = address;
        pload["device"]["identifiers"] = [];
        pload["device"]["identifiers"].push(address);
        pload["name"] = params[i];
        pload["stat_t"] = topic;
        pload["uniq_id"] = address + "-" + params[i];
        pload["state_class"] = "measurement";

        if (params[i] == "window") {
            pload["dev_cla"] = params[i];
            subt = pload["dev_cla"];
            pload["pl_on"] = 1;
            pload["pl_off"] = 0;
        }

        if (subt != "") {
            pload["value_template"] = "{{ value_json." + params[i] + " }}";
            adstr.push([CONFIG.discovery_topic + domain + "/" + address + "/" + subt + "/config", JSON.stringify(pload)]);
        }
    }
    return adstr;
}

function mqttreport(address, rssi, jsonstr) {
  let addrstr = String(address).split(':').join('');
  let topname = gettopicname(jsonstr);
  let topic = CONFIG.mqtt_topic + addrstr + "/" + topname;
  jsonstr['rssi'] = rssi;
  if (CONFIG.mqtt_src) {
    jsonstr['src'] = CONFIG.mqtt_src;
  }
  if (discovered.indexOf(addrstr+topname) == -1) {
   let adstr = autodiscovery(addrstr,topname,topic,jsonstr);
   if (adstr.length > 0) {
    for (let i = 0; i<adstr.length; i++) {
      if (adstr[i].length > 1) {
       MQTT.publish(adstr[i][0],adstr[i][1],1,true);   //  console.log("AD",i,adstr[i][0],adstr[i][1]);
      }
    }
   }
   discovered.push(addrstr+topname); //mark as discovered
  } // end AD
  MQTT.publish(topic,JSON.stringify(jsonstr),0,false); //  console.log(topic,JSON.stringify(jsonstr),1,true);
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

// retry several times to start the scanner if script was started before
// BLE infrastructure was up in the Shelly
function startBLEScan() {
  discovered = [];
  let bleScanSuccess = BLE.Scanner.Start({ duration_ms:  CONFIG.scan_duration, active: false }, scanCB);
  if( bleScanSuccess === false ) {
    Timer.set(1000, false, startBLEScan);
  } else {
    console.log('Success: BLE passive scanner running');
  }
}

//Check for BLE config and print a message if BLE is not enabled on the device
let BLEConfig = Shelly.getComponentConfig('ble');
if(BLEConfig.enable === false) {
  console.log('Error: BLE not enabled');
} else {
  Timer.set(1000, false, startBLEScan);
}