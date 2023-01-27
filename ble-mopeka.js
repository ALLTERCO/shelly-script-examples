// Mopeka Ultrasonic Propane Tank Guage - reads BLE, decodes and publishes to MQTT
// this is written in mJS to run as a script on a Shelly device (not full ES6!)
// requires Shelly firmware 0.12 or greater, MQTT and bluetooth enabled.

let debug = false;

let CONFIG = {
    "scan_duration": BLE.Scanner.INFINITE_SCAN,
};

// MFG code for mopeka devices
let MOPEKA = "0059";

// Magic numbers from Mopeka developer doc
let COEF = [ 0.573045, -0.002822, -0.00000535 ];

/**
 * @param timeMs time in ms for for the echo to return
 * @param rawTemp the raw temperature value in C without the 40 degree offset.
 * @returns depth in mm
 **/
function getTankLevel(timeMs, rawTemp) {
  return Math.round(timeMs * (COEF[0] + COEF[1] * rawTemp + COEF[2] * rawTemp * rawTemp));
}

// Extract time in ms from bleData
function rawLevel(bleData) {
  return ((bleData.at(4) & 0x3f) << 8) + bleData.at(3);
}

// Accel values are stored as signed bytes
function byteToSignedInt(val) {
  return (val & 0x80) ?  val - 0x100 : val;
}

let MopekaBLEParser = {
  parseData: function(bleData) {
    
    // We only support type 3 (Bottom up Propane) and type 8 (Pro+ bottom up propane)
    if (bleData.at(0) !== 0x3 && bleData.at(0) !== 0x8) {
      return null;
    }
    
    // Extract the "raw" level (actualy time in ms)
    let rawTankLevel = rawLevel(bleData);
    
    let result = {
      deviceType: bleData.at(0),
      batteryVoltage: (bleData.at(1) & 0x7f) / 32,
      // Temperature is offset 40 degreec C
      temperatureC: (bleData.at(2) & 0x7f) - 40,
      // quality is 0-3 "stars"
      quality: bleData.at(4) >> 6,
      rawTime: rawTankLevel,
      // Use raw temperature to calculate depth in mm
      tankLevel: getTankLevel(rawTankLevel, (bleData.at(2) & 0x7f)), 
      // if the sense isn't level the readins are not accurate
      acceloY: byteToSignedInt(bleData.at(8)) / 1024,
      acceloX: byteToSignedInt(bleData.at(9)) / 1024,
      // tank id is the last three bytes of the mac
      id: (bleData.at(5) << 16) + (bleData.at(6) << 8) + bleData.at(7),
    };
    
    return result;
  }
};

function scanCB(ev, res) {
  if(ev !== BLE.Scanner.SCAN_RESULT) return;

  // Look for a Mopeka device
  if (res.manufacturer_data && res.manufacturer_data[MOPEKA]) {
    let tankData = MopekaBLEParser.parseData(res.manufacturer_data[MOPEKA]);
 
    // Bail if no data (unsupported device)
    if (tankData === null) {
        return
    }
    
    // Data is only considered valid if quality is >= 2
    let message = JSON.stringify({
      data: tankData,
      rssi: res.rssi,
      addr: res.addr,
      valid: tankData.quality >= 2 ?  true : false,
    });
      
    let topic = 'mopekaStatus-' + JSON.stringify(tankData.id) + '/status';
      
    if(MQTT.isConnected()) {
      MQTT.publish(topic, message, 1, true);
      if (debug) {
        print(topic);
        print(message);
      }
    }
  }
}

BLE.Scanner.Start({ duration_ms: CONFIG.scan_duration, active:false }, scanCB);
