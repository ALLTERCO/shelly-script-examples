let CONFIG = {
    "temperature": 26,
};

// https://docs.ruuvi.com/communication/bluetooth-advertisements/data-format-5-rawv2
let RuuviParser = {

    getInt16BE: function(bytes) {
        let num = bytes.at(0) * 256 + bytes.at(1);
        if (num >= 0x8000) {
            num = num - 0x10000;
        }
        return num;
    },

    getTemperature: function (mfd) {
        let temp = this.getInt16BE(mfd.slice(3, 5));
        temp = temp * 0.005;
        return temp;
    },

    getHumidity: function (mfd) {
        return (mfd.at(5) * 256 + mfd.at(6)) * 0.0025;
    },

    getPressure: function (mfd) {
        return (mfd.at(7) * 256 + mfd.at(8)) + 50000;
    },

    getAccelXYZ: function(mfd) {
        return {
            x: this.getInt16BE(mfd.slice(9)),
            y: this.getInt16BE(mfd.slice(11)),
            z: this.getInt16BE(mfd.slice(13))
        }
    },

    getBatteryMv: function(mfd) {
        let power_info = (mfd.at(15) * 256 + mfd.at(16));
        let battery_mv = (power_info >> 5) + 1600;
        return battery_mv;
    },

    getTxPower: function(mfd) {
        return -40 + (mfd.at(16) & 0x1f) * 2;
    },

    getMovementCounter: function(mfd) {
        return mfd.at(17);
    },

    getSequence: function(mfd) {
        return mfd.at(18) * 256 + mfd.at(19);
    },

    getMac: function(mfd) {
        let mac =  mfd.slice(20, 26);
        print(mac.length);
        return mac;
    },

    getData: function(res) {
        let data = BLE.GAP.ParseManufacturerData(res.advData);
        if (data.length < 26) {
            return null;
        }
        if (typeof (data) !== "string" || data.slice(0, 2) !== "\x99\x04") {
            return null;
        }
        if (data.charCodeAt(2) !== 5) {
            print("unsupported data format from", res.addr);
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
    }
};

function publishToMqtt(measurement) {
    MQTT.publish("ruuvi/" + measurement.addr, JSON.stringify(measurement));
}

function emitOverWs(measurement) {
    Shelly.emitEvent("ruuvi.measurement", measurement);
}

function triggerAutomation(measurement) {
    if (measurement.temperature < CONFIG.temperature) {
        // turn the heater on
        Shelly.call("Switch.Set", {id: 0, on: true});
    }
}

function scanCB(ev, res) {
    if (ev === BLE.Scanner.SCAN_RESULT) {
        let measurement = RuuviParser.getData(res);
        if (measurement === null) return;
        print("ruuvi measurement:", JSON.stringify(measurement));

        publishToMqtt(measurement);
        emitOverWs(measurement);
        triggerAutomation(measurement);
    }
}

// BLE.Scanner.Subscribe(scanCB, null);
BLE.Scanner.Start({ duration_ms: -1}, scanCB);