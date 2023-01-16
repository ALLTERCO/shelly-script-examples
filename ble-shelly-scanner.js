/**
 * This script uses the BLE scan functionality in scripting
 * Will look for Shelly BLU devices fingerprints in BLE advertisements
 * Prints device name and address
 */

// Shelly BLU devices:
// SBBT - Shelly BLU Button
// SBDW - Shelly BLU DoorWindow

let ALLTERCO_DEVICE_NAME_PREFIX = ["SBBT", "SBDW"];

let ALLTERCO_MFD_ID_STR = "0ba9";
let BTHOME_SVC_ID_STR = "fcd2";

let ALLTERCO_MFD_ID = JSON.parse('0x' + ALLTERCO_MFD_ID_STR);
let BTHOME_SVC_ID = JSON.parse('0x' + BTHOME_SVC_ID_STR);

let SCAN_DURATION = BLE.Scanner.INFINITE_SCAN;
let ACTIVE_SCAN = true;

let SHELLY_BLU_CACHE = {};

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  // skip if there is no service_data member
  if (typeof res.service_data === 'undefined' || typeof res.service_data[BTHOME_SVC_ID_STR] === 'undefined') return;
  // skip if we have already found this device
  if (typeof SHELLY_BLU_CACHE[res.addr] !== 'undefined') return;
  if (typeof res.local_name !== 'string') return;
  let shellyBluNameIdx = 0;
  for (shellyBluNameIdx in ALLTERCO_DEVICE_NAME_PREFIX) {
    if (res.local_name.indexOf(ALLTERCO_DEVICE_NAME_PREFIX[shellyBluNameIdx]) === 0) {
      console.log('New device found:');
      console.log('Address: ', res.addr, ' Name: ', res.local_name);
      SHELLY_BLU_CACHE[res.addr] = res.local_name;
    }
  }
}

BLE.Scanner.Start({ duration_ms: SCAN_DURATION, active: true }, scanCB);
