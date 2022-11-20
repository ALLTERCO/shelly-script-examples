//For b-parasite data format see
//https://github.com/rbaron/b-parasite/blob/main/code/b-parasite/README.md

let CONFIG = {
    "scan_duration": BLE.Scanner.INFINITE_SCAN,
};

let BPARASITE_ESPF = "181a";

function getUInt16BE(bytes) {
  return bytes.at(0) << 8 | bytes.at(1);
}

function getInt16BE(bytes) {
  let num = getUInt16BE(bytes);
  if(num & 0x8000) num = num - 0x10000;
  return num;
}

let BParasiteBLEADVParser = {
  parseData: function(bleData) {
    let name = BLE.GAP.ParseName(bleData.advData);
    if(name !== "prst") return null;
    let env = BLE.GAP.ParseServiceData(bleData.advData, BPARASITE_ESPF);
    if(typeof(env) !== "string") return null;
    let proto = (env.at(0) & 0xf0) >> 4;
    if(proto !== 2) return null;
    let hasLux = false;
    if(env.at(0) & 1) hasLux = true;
    let result = {
      counter: env.at(1) & 0x0f,
      battery: getUInt16BE(env.slice(2)) / 1000,
      temperature: getUInt16BE(env.slice(4)) / 100,
      humidity: 100 * getUInt16BE(env.slice(6)) / 0x10000,
      moisture: 100 * getUInt16BE(env.slice(8)) / 0x10000
    };
    if(hasLux) {
      result.lux = getUInt16BE(env.slice(16));
    }
    return result;
  }
};

function scanCB(ev, res) {
  if(ev !== BLE.Scanner.SCAN_RESULT) return;
  let measurement = BParasiteBLEADVParser.parseData(res);
  if(measurement !== null) {
    print("B-Parasite measurement:");
    print(JSON.stringify(measurement));
  }
}

BLE.Scanner.Start({ duration_ms: CONFIG.scan_duration, active:false }, scanCB);