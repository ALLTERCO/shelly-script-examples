let CONFIG = {
  temperature_thr: 18,
  switch_id: 0,
  mqtt_topic: "ruuvi",
  event_name: "ruuvi.measurement",
  // exactly 8 bytes, needed for encrypted V8 only
  ruuvi_id: '\x00\x11\x22\x33\x44\x55\x66\x77',
  // exactly 16 bytes, needed for encrypted V8 only
  ruuvi_pw: 'RuuvicomRuuviTag',
};

const SCAN_PARAM_WANT = { duration_ms: BLE.Scanner.INFINITE_SCAN, active: false };

let RUUVI_MFD_ID = 0x0499;

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
  takeRaw: function(length) {
    let res = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return res;
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
      this.buffer = this.buffer.slice(jmp);
      pos++;
    }
    return res;
  }
};

function xor_strings(a, b) {
  let res = '';
  let i = 0;
  for (; i < a.length && i < b.length; ++i) {
    res += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  res += a.slice(i);
  res += b.slice(i);
  return res;
}

// "Class" for calculating CRC8 checksums...
// https://github.com/mode80/crc8js/blob/f947927adc069ad492bd13a18938f9af336097ff/crc8.js
function CRC8(polynomial, initial_value) { // constructor takes an optional polynomial type from CRC8.POLY
  if (polynomial == null) polynomial = CRC8.POLY.CRC8_CCITT
  this.table = CRC8.generateTable(polynomial);
  this.initial_value = initial_value;
}

// Returns the 8-bit checksum given an array of byte-sized numbers
CRC8.prototype.checksum = function(byte_array) {
  var c = this.initial_value;

  for (var i = 0; i < byte_array.length; i++ )
    c = this.table[(c ^ byte_array.charCodeAt(i)) % 256]

  return c;
}

// returns a lookup table byte array given one of the values from CRC8.POLY
CRC8.generateTable =function(polynomial)
{
  var csTable = [] // 256 max len byte array

  for ( var i = 0; i < 256; ++i ) {
    var curr = i
    for ( var j = 0; j < 8; ++j ) {
      if ((curr & 0x80) !== 0) {
        curr = ((curr << 1) ^ polynomial) % 256
      } else {
        curr = (curr << 1) % 256
      }
    }
    csTable[i] = curr
  }

  return csTable
}

// This "enum" can be used to indicate what kind of CRC8 checksum you will be calculating
CRC8.POLY = {
  CRC8 : 0xd5,
  CRC8_CCITT : 0x07,
  CRC8_DALLAS_MAXIM : 0x31,
  CRC8_SAE_J1850 : 0x1D,
  CRC_8_WCDMA : 0x9b,
}

let RuuviParser = {
  getData: function (res) {
    let data = BLE.GAP.ParseManufacturerData(res.advData);
    if (typeof data !== "string" || data.length < 3) return null;
    packedStruct.setBuffer(data);
    let hdr = packedStruct.unpack('<HB', ['mfd_id', 'data_fmt']);
    if(hdr.mfd_id !== RUUVI_MFD_ID) return null;

    if (hdr.data_fmt == 3) return this.parseV3(packedStruct, res);
    if (hdr.data_fmt == 5) return this.parseV5(packedStruct, res);
    if (hdr.data_fmt == 0xC5) return this.parseVC5(packedStruct, res);
    if (hdr.data_fmt == 8) return this.parseV8(packedStruct, res);

    print("unsupported data format", hdr.data_fmt, "from", res.addr);
    return null;
  },
  parseV3: function(packedStruct, res) {
    if (packedStruct.buffer.length < 13) {
      print("V3 packet too short (", packedStruct.buffer.length + 3, ") from", res.addr);
      return null;
    }
    let rm = packedStruct.unpack('>BbBHhhhH', [
      'humidity',
      'temp',
      'temp_centi',
      'pressure',
      'acc_x',
      'acc_y',
      'acc_z',
      'batt',
    ]);
    rm.temp = rm.temp + rm.temp_centi / 100;
    delete rm.temp_centi;
    rm.humidity = rm.humidity * 0.005;
    rm.pressure += 50000;
    rm.addr = res.addr;
    rm.rssi = res.rssi;
    return rm;
  },
  parseV5: function(packedStruct, res) {
    if (packedStruct.buffer.length < 23) {
      print("V5 packet too short (", packedStruct.buffer.length + 3, ") from", res.addr);
      return null;
    }
    let rm = packedStruct.unpack('>hHHhhhHBHBBBBBB', [
      'temp',
      'humidity',
      'pressure',
      'acc_x',
      'acc_y',
      'acc_z',
      'pwr',
      'cnt',
      'sequence',
      'mac_0','mac_1','mac_2','mac_3','mac_4','mac_5'
    ]);
    rm.temp = rm.temp * 0.005;
    rm.humidity = rm.humidity * 0.0025;
    rm.pressure = rm.pressure + 50000;
    rm.batt = (rm.pwr >> 5) + 1600;
    rm.tx = (rm.pwr & 0x001f * 2) - 40;
    rm.addr = res.addr;
    rm.rssi = res.rssi;
    return rm;
  },
  parseVC5: function(packedStruct, res) { // untested
    if (packedStruct.buffer.length < 17) {
      print("VC5 packet too short (", packedStruct.buffer.length + 3, ") from", res.addr);
      return null;
    }
    let rm = packedStruct.unpack('>hHHHBHBBBBBB', [
      'temp',
      'humidity',
      'pressure',
      'pwr',
      'cnt',
      'sequence',
      'mac_0','mac_1','mac_2','mac_3','mac_4','mac_5'
    ]);
    rm.temp = rm.temp * 0.005;
    rm.humidity = rm.humidity * 0.0025;
    rm.pressure = rm.pressure + 50000;
    rm.batt = (rm.pwr >> 5) + 1600;
    rm.tx = (rm.pwr & 0x001f * 2) - 40;
    rm.addr = res.addr;
    rm.rssi = res.rssi;
    return rm;
  },
  v8MakeKey: function() {
    if (CONFIG.ruuvi_pw.length != 16) return null;
    if (CONFIG.ruuvi_id.length != 8) return null;
    return xor_strings(CONFIG.ruuvi_id, CONFIG.ruuvi_pw);
  },
  parseV8: function(packedStruct, res) { // untested
    if (packedStruct.buffer.length < 23) {
      print("V8 packet too short (", packedStruct.buffer.length + 3, ") from", res.addr);
      return null;
    }
    if (typeof AES == 'undefined') {
      print("V8: No AES support present!");
      return null;
    }
    let encryptedPayload = packedStruct.takeRaw(16);
    let rm = packedStruct.unpack('>BBBBBBB', [
      'crc8',
      'mac_0','mac_1','mac_2','mac_3','mac_4','mac_5'
    ]);

    let key = this.v8MakeKey(rm.nonce);
    let payload = AES.decrypt(encryptedPayload, key, 'ECB');

    if (this.crc8 === undefined) this.crc8 = new CRC8(); // poly correct?
    rm.actual_crc8 = this.crc8(payload);

    packedStruct.setBuffer(payload);

    Object.assign(rm, packedStruct.unpack('>hHHHHHBBBB', [
      'temp',
      'humidity',
      'pressure',
      'pwr',
      'cnt',
      'sequence',
      'reserved_0','reserved_1','reserved_2','reserved_3'
    ]));

    rm.temp = rm.temp * 0.005;
    rm.humidity = rm.humidity * 0.0025;
    rm.pressure = rm.pressure + 50000;
    rm.batt = (rm.pwr >> 5) + 1600;
    rm.tx = (rm.pwr & 0x001f * 2) - 40;
    rm.addr = res.addr;
    rm.rssi = res.rssi;
    return rm;
  },
};

function publishToMqtt(measurement) {
  MQTT.publish(
    CONFIG.mqtt_topic + "/" + measurement.addr,
    JSON.stringify(measurement)
  );
}

function emitOverWs(measurement) {
  Shelly.emitEvent(CONFIG.event_name, measurement);
}

function triggerAutomation(measurement) {
  if (measurement.temp < CONFIG.temperature_thr) {
    // turn the heater on
    Shelly.call("Switch.Set", { id: CONFIG.switch_id, on: true });
  }
}

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  let measurement = RuuviParser.getData(res);
  if (measurement === null) return;
  print("ruuvi measurement:", JSON.stringify(measurement));
  publishToMqtt(measurement);
  emitOverWs(measurement);
  triggerAutomation(measurement);
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
