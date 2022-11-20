// For ruuvi data format see
// https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-5-rawv2

let CONFIG = {
  scan_duration: BLE.Scanner.INFINITE_SCAN,
  temperature_thr: 18,
  switch_id: 0,
  mqtt_topic: "ruuvi",
  event_name: "ruuvi.measurement",
};

let RUUVI_MFD_ID_LE = 0x9904;
let RUUVI_DATA_FMT = 5;

let RuuviParser = {
  getUInt16BE: function (bytes) {
    return (bytes.at(0) << 8) | bytes.at(1);
  },

  getInt16BE: function (bytes) {
    let num = this.getUInt16BE(bytes);
    //two's complement
    if (num & 0x8000) num = num - 0x10000;
    return num;
  },

  //3,4
  getTemperature: function (mfd) {
    return this.getInt16BE(mfd.slice(3)) * 0.005;
  },

  getHumidity: function (mfd) {
    return this.getUInt16BE(mfd.slice(5)) * 0.0025;
  },

  getPressure: function (mfd) {
    return this.getUInt16BE(mfd.slice(7)) + 50000;
  },

  getAccelXYZ: function (mfd) {
    return {
      x: this.getInt16BE(mfd.slice(9)),
      y: this.getInt16BE(mfd.slice(11)),
      z: this.getInt16BE(mfd.slice(13)),
    };
  },

  getBatteryMv: function (mfd) {
    let power_info = this.getUInt16BE(mfd.slice(15));
    let battery_mv = (power_info >> 5) + 1600;
    return battery_mv;
  },

  getTxPower: function (mfd) {
    return -40 + (mfd.at(16) & 0x1f) * 2;
  },

  getMovementCounter: function (mfd) {
    return mfd.at(17);
  },

  getSequence: function (mfd) {
    return this.getUInt16BE(mfd.slice(18));
  },

  getMac: function (mfd) {
    let mac = mfd.slice(20, 26);
    print(mac.length);
    return mac;
  },

  getData: function (res) {
    let data = BLE.GAP.ParseManufacturerData(res.advData);
    if (typeof data !== "string" || data.length < 26) return null;
    //Manufacturer ID is at the beginning of the result
    if (this.getUInt16BE(data) !== RUUVI_MFD_ID_LE) return null;
    if (data.at(2) !== RUUVI_DATA_FMT) {
      print("unsupported data format from", res.addr);
      print("expected format", RUUVI_DATA_FMT);
      return null;
    }
    let m = {
      temperature: this.getTemperature(data),
      humidity: this.getHumidity(data),
      pressure: this.getPressure(data),
      accel: this.getAccelXYZ(data),
      battery_mv: this.getBatteryMv(data),
      tx_power: this.getTxPower(data),
      movement_counter: this.getMovementCounter(data),
      sequence: this.getSequence(data),
      // mac: this.getMac(data),
      addr: res.addr.slice(0, -2),
      rssi: res.rssi,
    };
    return m;
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
  if (measurement.temperature < CONFIG.temperature_thr) {
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

BLE.Scanner.Start({ duration_ms: CONFIG.scan_duration }, scanCB);
