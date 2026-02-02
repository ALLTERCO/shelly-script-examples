/**
 * @title PTM215B EnOcean BLE button handler
 * @description Handles PTM215B energy-harvesting BLE button events to control up to 4 relays.
 */

//This script handle the PTM215B BLE button from the enocean alliance
//It can be found in many third party seller like Feller in Switzerland and allow very nice use case
//That button can be used to drive up to 4 relay without any battery or wire as it harvest some energy from the push on it
//There is 4 switch on that button with distinct press and release action,
//However it is now only possible to scan BLE on 1/4 of the time some both of theses actions
//are used to improve the reliability

let CONFIG = {
    LOCK_DELAY: 600, //lock time before another action is allowed to avoid unattented double actions
    BTN_ADDR: "e2:15:00:05:68:53", // the address can be found on the bottom of the button
    DEBUG: false
};
const SCAN_PARAM_WANT = {
  duration_ms: BLE.Scanner.INFINITE_SCAN,
  active: false,
  interval_ms: 60,
  window_ms: 20
};

let lock = false;

function scanCB(ev, res) {
    if (ev !== BLE.Scanner.SCAN_RESULT) return;
    if (res.addr !== CONFIG.BTN_ADDR) {
        return;
    }

    if(CONFIG.DEBUG) {
        console.log('Lock status : ', lock)
    }

    if(lock === true){
        return
    }
        
    let btnAction = res.advData.charCodeAt(8);

    if(CONFIG.DEBUG){
        console.log('Byte number 9: ', btnAction , ' Rssi:' , res.rssi);
        console.log(JSON.stringify(ev));
        console.log('Address: ', res.addr, ' Name: ', res.local_name, ' Rssi: ', res.rssi, ' addr_type: ', res.addr_type, ' advData: ', res.advData);     
        console.log('Seq counter : ',getSequenceCounter(res.advData));
    }
    

    //Customize the actions that you what for each button
    if (btnAction === 3 || btnAction === 2) {
        Shelly.call("http.get", {url: 'http://10.0.0.201/color/0?turn=toggle'}, {}); 
        setLock();
    } else if (btnAction === 5 || btnAction === 4) {
        Shelly.call("Switch.Toggle", {id: 0})
        setLock();
    } else if (btnAction=== 9 || btnAction === 8) {
        Shelly.call("Switch.Toggle", {id: 2})
        setLock();
    } else if (btnAction === 17 || btnAction === 16) {
        Shelly.call("Switch.Toggle", {id: 3})
        setLock();
    } 
}


function setLock() {
    lock = true;
    Timer.set(CONFIG.LOCK_DELAY, 0, unsetLock);
}

function unsetLock() {
    lock = false;
}

function getSequenceCounter(advData) {
    let sequenceCounter = 0;
    
    for (let i = 7; i >= 4; i--) { // bytes 4 to 8, inclusive, in zero-based index
        sequenceCounter = (sequenceCounter << 8) + advData.charCodeAt(i);
    }

    return sequenceCounter;
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
