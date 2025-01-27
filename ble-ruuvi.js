let CONFIG = {
  temperature_thr: 18,
  switch_id: 0,
  mqtt_topic: "ruuvi",
  event_name: "ruuvi.measurement",
};
const SCAN_PARAM_WANT = { duration_ms: BLE.Scanner.INFINITE_SCAN, active: false };

let RUUVI_MFD_ID = 0x0499;
let RUUVI_DATA_FMT = 5;

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

let RuuviParser = {
  getData: function (res) {
    let data = BLE.GAP.ParseManufacturerData(res.advData);
    if (typeof data !== "string" || data.length < 26) return null;
    packedStruct.setBuffer(data);
    let hdr = packedStruct.unpack('<HB', ['mfd_id', 'data_fmt']);
    if(hdr.mfd_id !== RUUVI_MFD_ID) return null;
    if(hdr.data_fmt !== RUUVI_DATA_FMT) {
      print("unsupported data format from", res.addr);
      print("expected format", RUUVI_DATA_FMT);
      return null;
    };
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
    rm.addr = res.addr.slice(0, -2);
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
