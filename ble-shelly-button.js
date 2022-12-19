let CONFIG = {
  scan_duration: BLE.Scanner.INFINITE_SCAN,
  scan_active: true,
  //filter button with this address, remove this key for control by any button
  button_address: "bc:02:6e:c3:c8:b9",
  switch_id: 0,
};

let ALLTERCO_MFD_ID = 0x0ba9;
let BTHOME_SVC_ID = 0xfcd2;
let ALLTERCO_MFD_ID_STR = "oba9";
let BTHOME_SVC_ID_STR = "fcd2";

let SHELLY_BLU_BUTTON_NAME = "SBBT"; //SBBT-002C for first model

let uint8 = 0;
let int8 = 1;
let uint16 = 2;
let int16 = 3;
let uint24 = 4;
let int24 = 5;

let BTH = [];
BTH[0x00] = { n: "pid", t: uint8 };
BTH[0x01] = { n: "Battery", t: uint8, u: "%" };
BTH[0x3a] = { n: "Button", t: uint8 };

//TODO: Handle 24 bit numbers
let BTHomeDecoder = {
  buffer: null,
  setBuffer: function (buffer) {
    this.buffer = buffer;
  },
  utoi16: function (u16) {
    return u16 & 0x8000 ? u16 - 0x10000 : u16;
  },
  getUInt8: function () {
    return this.buffer.at(0);
  },
  getInt8: function () {
    let int = this.getUInt8();
    if (int & 0x80) int = int - 0x100;
    return int;
  },
  getUInt16LE: function () {
    return 0xffff & ((this.buffer.at(1) << 8) | this.buffer.at(0));
  },
  getInt16LE: function () {
    return this.utoi16(this.getUInt16LE());
  },
  unpack: function () {
    if (this.buffer === null) return null;
    let result = {};
    let dib = this.buffer.at(0);
    result["encryption"] = dib & 0x1 ? true : false;
    result["BTHome_version"] = dib >> 5;
    //Can handle only v2
    if (result["BTHome_version"] !== 2) return null;
    //Can't handle encrypted data
    if (result["encryption"] === 1) return null;
    this.buffer = this.buffer.slice(1);

    while (this.buffer.length > 0) {
      let _bth = BTH[this.buffer.at(0)];
      if (_bth === "undefined") return null;
      this.buffer = this.buffer.slice(1);
      let value = null;
      if (_bth.t === uint8) value = this.getUInt8();
      if (_bth.t === int8) value = this.getInt8();
      if (_bth.t === uint16) value = this.getUInt16LE();
      if (_bth.t === int16) value = this.getInt16LE();
      result[_bth.n] = value;
      let skip = _bth.t === uint16 || _bth.t === int16 ? 2 : 1;
      this.buffer = this.buffer.slice(skip);
    }
    return result;
  },
};

let ShellyButtonParser = {
  getData: function (res) {
    BTHomeDecoder.setBuffer(res.service_data[BTHOME_SVC_ID_STR]);
    let result = BTHomeDecoder.unpack();
    return result;
  },
};

function triggerAutomation() {
  Shelly.call("Switch.Toggle", { id: CONFIG.switch_id });
}

let last_pid = 0x100;
function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  if (
    typeof res.local_name !== "string" ||
    res.local_name.indexOf(SHELLY_BLU_BUTTON_NAME) !== 0
  )
    return;
  if (typeof res.service_data[BTHOME_SVC_ID_STR] === "undefined") return;
  if (
    typeof CONFIG.button_address !== "undefined" &&
    CONFIG.button_address !== res.addr
  )
    return;
  let buttonState = ShellyButtonParser.getData(res);
  if (buttonState === null) return;
  if (last_pid === buttonState.pid) return;
  last_pid = buttonState.pid;
  //Decide on number of button pushes
  //if(buttonState.Button === 1) {}
  triggerAutomation();
}

BLE.Scanner.Start(
  { duration_ms: CONFIG.scan_duration, active: CONFIG.scan_active },
  scanCB
);
