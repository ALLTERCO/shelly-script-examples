/**
 * ARANET4 BLE Support in Shelly
 * https://aranet.com/products/aranet4/
 * Parses BLE advertisements and executes actions depending on conditions
 */

/** =============================== CHANGE HERE =============================== */

//Callback functions
function printAranetData(aranet_data) {
  print("Aranet temperature condition" );
  Shelly.emitEvent("ARANET4_TEMPERATURE", {
    addr: aranet_data.sys.addr,
    rssi: aranet_data.sys.rssi,
    tc: aranet_data.tC,
    pid: aranet_data.packet_counter
  });
}

function printCO2Warning(aranet_data) {
  print("Aranet CO2 warning" );
  Shelly.emitEvent("ARANET4_CO2", {
    addr: aranet_data.sys.addr,
    rssi: aranet_data.sys.rssi,
    co2_level: aranet_data.co2_aranet_level,
    co2_pppm: aranet_data.co2_ppm,
    pid: aranet_data.packet_counter
  });
}

function printBatteryWarning(aranet_data) {
  console.log("Aranet battery is low");
  Shelly.emitEvent("ARANET4_BATTERY", {
    addr: aranet_data.sys.addr,
    rssi: aranet_data.sys.rssi,
    co2_level: aranet_data.co2_aranet_level,
    co2_pppm: aranet_data.co2_ppm,
    pid: aranet_data.packet_counter,
    battery: aranet_data.battery
  });
}
 
/**
 * "dedupe" if true, will de-duplicate Aranet4 packets with the same packet id
 * Supported conditions:
 * > ">" - Check if the measured value is greater than the target value
 * > "<" - Check if the measured value is less than the target value
 * > "==" - Check if the measured value matches with the target value (Supports non-number values)
 * > "~=" - Check if the rounded measured value matches the target value
 */
let CONFIG = {
  dedupe: true,
  actions: [
    {
      cond: {//if measured tC is greater than 19, call printArnetData function
        tC: {
          cmp: ">", 
          value: 19
        }
      },
      action: printAranetData
    },
    {
      cond: { //if co2_aranet_level equals to 2, call printCO2Waring function
        co2_aranet_level: 2 
      },
      action: printCO2Warning
    },
    {
      cond: { //if the battery is below 50% and the temperature is above 20C, call printBatteryWarning function
        battery: {
          cmp: "<",
          value: 50
        },
        tC: {
          cmp: ">",
          value: 20
        }
      },
      action: printBatteryWarning
    }
  ]
};

/** =============================== STOP CHANGING HERE =============================== */

let SCAN_PARAM_WANT = {
  duration_ms: BLE.Scanner.INFINITE_SCAN,
  active: false
};

//ARANET manufacturer id is 0x0702
let ARANET_MFD_ID = 0x0702;

//unpack bytestream
//format is subset of https://docs.python.org/3/library/struct.html
let packedStruct = {
  buffer: '',
  setBuffer: function (buffer) {
    this.buffer = buffer;
  },
  utoi: function (u16) {
    return (u16 & 0x8000) ? u16 - 0x10000 : u16;
  },
  getUInt8: function () {
    return this.buffer.at(0)
  },
  getInt8: function () {
    let int = this.getUInt8();
    if (int & 0x80) int = int - 0x100;
    return int;
  },
  getUInt16LE: function () {
    return 0xffff & (this.buffer.at(1) << 8 | this.buffer.at(0));
  },
  getInt16LE: function () {
    return this.utoi(this.getUInt16LE());
  },
  getUInt16BE: function () {
    return 0xffff & (this.buffer.at(0) << 8 | this.buffer.at(1));
  },
  getInt16BE: function () {
    return this.utoi(this.getUInt16BE(this.buffer));
  },
  unpack: function (fmt, keyArr) {
    let b = '<>!';
    let le = fmt[0] === '<';
    if (b.indexOf(fmt[0]) >= 0) {
      fmt = fmt.slice(1);
    }
    let pos = 0;
    let jmp;
    let bufFn;
    let res = {};
    while (pos < fmt.length && pos < keyArr.length && this.buffer.length > 0) {
      jmp = 0;
      bufFn = null;
      if (fmt[pos] === 'b' || fmt[pos] === 'B') jmp = 1;
      if (fmt[pos] === 'h' || fmt[pos] === 'H') jmp = 2;
      if (fmt[pos] === 'b') {
        res[keyArr[pos]] = this.getInt8();
      }
      else if (fmt[pos] === 'B') {
        res[keyArr[pos]] = this.getUInt8();
      }
      else if (fmt[pos] === 'h') {
        res[keyArr[pos]] = le ? this.getInt16LE() : this.getInt16BE();
      }
      else if (fmt[pos] === 'H') {
        res[keyArr[pos]] = le ? this.getUInt16LE() : this.getUInt16BE();
      }
      this.buffer = this.buffer.slice(jmp);
      pos++;
    }
    return res;
  }
};

let Aranet4Parser = {
  lastPC: null,
  getData: function (res) {
    let rm = null;
    let mfd_data = BLE.GAP.ParseManufacturerData(res.advData);
    if (typeof mfd_data !== "string" || mfd_data.length < 8) return null;
    packedStruct.setBuffer(mfd_data);
    let hdr = packedStruct.unpack('<HB', ['mfd_id', 'status']);
    if (hdr.mfd_id !== ARANET_MFD_ID) return null;

    let aranet_status = {
      integration: (hdr.status & (1 << 5)) !== 0,
      dfu: (hdr.status & (1 << 4)) !== 0,
      cal_state: (hdr.status >> 1) & 3
    };

    let aranet_sys_data = packedStruct.unpack('<BBHB', [
      'fw_patch',
      'fw_minor',
      'fw_major',
      'hw'
    ]);

    aranet_sys_data.addr = res.addr;
    aranet_sys_data.rssi = res.rssi;

    rm = {
      status: aranet_status,
      sys: aranet_sys_data
    };

    if (!aranet_status.integration) return rm;

    let aranet_data = packedStruct.unpack('<BBHHHBBBHHB', [
      'region',
      'packaging',
      'co2_ppm',
      'tC',
      'pressure_dPa',
      'rh',
      'battery',
      'co2_aranet_level',
      'refresh_interval',
      'age',
      'packet_counter'
    ]);

    //skip if PC has not changed
    if (CONFIG.dedupe && this.lastPC !== null && this.lastPC === aranet_data.packet_counter) return null;

    this.lastPC = aranet_data.packet_counter;

    aranet_data.tC = aranet_data.tC / 20.0;

    let dIdx;
    for(dIdx in aranet_data) {
      rm[dIdx] = aranet_data[dIdx];
    }

    return rm;
  }
};

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  let measurement = Aranet4Parser.getData(res);
  if (measurement === null) return;
  print("aranet measurement:", JSON.stringify(measurement));

  // execute actions from CONFIG
  let aIdx = null;
  for (aIdx in CONFIG.actions) {
    // skip if no condition defined
    if (typeof CONFIG.actions[aIdx]["cond"] === "undefined") continue;
    let cond = CONFIG.actions[aIdx]["cond"];
    let condKey = null;
    let run = true;
    for (condKey in cond) {
      let measuredValue = measurement[condKey];

      if (typeof measuredValue === "undefined") {
        run = false;
        console.log("Invalid condition key at", condKey);
        break;
      }

      //check for shorthanded condition
      if (typeof cond[condKey] === "object") {
        let cmp = cond[condKey]["cmp"];
        let value = cond[condKey]["value"];

        //check if the condition object is valid
        if(typeof cmp === "undefined" || typeof value === "undefined") {
          run = false;
          console.log("Missing required keys at", condKey);
          break;
        }

        if(cmp === ">" && typeof value === "number" && typeof measuredValue === "number") {
          if(measuredValue < value) {
            run = false; 
          }
        } else if(cmp === "<" && typeof value === "number" && typeof measuredValue === "number") {
          if(measuredValue > value) {
            run = false;
          }
        }
        else if(cmp === "==" || cmp === "===") {
          if(measuredValue !== value) {
            run = false;
          }
        }
        else if(cmp === "~=" && typeof value === "number" && typeof measuredValue === "number") {
          if(Math.round(measuredValue) !== value) {
            run = false;
          }
        }
        else { //default exit
          console.log("Invalid compare argument at", condKey); 
          run = false;
        }
      } else if (measuredValue !== cond[condKey]) { 
        run = false;
      }
    }
    // if all conditions evaluated to true then execute
    if (run) CONFIG.actions[aIdx]["action"](measurement);
  }
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
