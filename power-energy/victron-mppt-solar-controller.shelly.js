/**
 * @title Victron's Smartsolar charge controller data monitoring
 * @description This script allows the decryption of Victron's Smartsolar charge
 *   controller data and update the virtual components with live solar
 *   charger values.
 */

// 1. Install the VictronConnect app.
// 2. Open the app and pair with your Victron device.
// 3. Select the device you want to monitor from the device list.
// 4. Tap the gear icon to open its settings.
// 5. Open the menu and choose Product Info.
// 6. Scroll to Instant Readout via Bluetooth and enable it if it’s disabled.
// 7. Tap Show next to Instant Readout Details to reveal the encryption information.
// 8. Copy the MAC address and the advertisement key and use them here:

/******************* START CHANGE HERE *******************/
const BINDKEY_HEX = '01a0abc01a00a012345b4a32b5c2a6b5';
const MAC_ADDRESS = "00:00:00:00:00:00";

// Example of the object received 
// {
//   "charge_state":"bulk",
//   "charger_error":"no_error",
//   "battery_voltage":2.35,
//   "battery_charging_current":0,
//   "yield_today":0,
//   "solar_power":0,
//   "external_device_load":null
// }

// Here we configure which value to store in which component.
// We use the key that designates the `Component` key (in format `<type>:<id>`, e.g. `number:200`)
// After you create a virtual component from the ‘Components’ section of the Web interface , its key appears on the component’s card.
const vcChargeState = Virtual.getHandle('text:200'); // charge state (e.g.: off, low_power, absorption)
const vcChargerError = Virtual.getHandle('text:201'); // charger error (e.g.: temperature_battery_high, voltage_high)
const vcBatteryVoltage  = Virtual.getHandle('number:200'); // battery voltage 
const vcBatteryChargingCurrent = Virtual.getHandle('number:201'); // battery charging current in amps
const vcYieldToday = Virtual.getHandle('number:202'); // the amount of energy generated today in Wh
const vcSolarPower = Virtual.getHandle('number:203'); // solar power in W
const vcExternalDeviceLoad = Virtual.getHandle('number:204'); // external device load in amps
const NUMBER_THRESHOLD = 0.1;
/******************* STOP CHANGE HERE *******************/

// # Sourced from VE.Direct docs 
const chargeStateMap = {
  0: "off",
  1: "low_power",
  2: "fault",
  3: "bulk",
  4: "absorption",
  5: "float",
  6: "storage",
  7: "equalize_manual",
  9: "inverting",
  11: "power_supply",
  245: "starting_up",
  246: "repeated_absorption",
  247: "recondition",
  248: "battery_safe",
  249: "active",
  252: "252",
  255: "not_available"
};

// # Source: VE.Direct-Protocol-3.32.pdf & https://www.victronenergy.com/live/mppt-error-codes
const chargerErrorMap = {
  // No error
  0: "no_error",

  // Err 1 - Battery temperature too high
  1: "temperature_battery_high",

  // Err 2 - Battery voltage too high
  2: "voltage_high",

  // Err 3–5 - Remote temperature sensor failures
  3: "remote_temperature_a",
  4: "remote_temperature_b",
  5: "remote_temperature_c",

  // Err 6–8 - Remote battery voltage sense failures
  6: "remote_battery_a",
  7: "remote_battery_b",
  8: "remote_battery_c",

  // Err 11 - Battery high ripple
  11: "high_ripple",

  // Err 14 - Battery temperature too low
  14: "temperature_battery_low",

  // Err 17 - Charger temperature too high
  17: "temperature_charger",

  // Err 18 - Overcurrent
  18: "over_current",

  // Err 20 - Bulk time exceeded
  20: "bulk_time",

  // Err 21 - Current sensor issue
  21: "current_sensor",

  // Err 22–23 - Internal temperature sensor failures
  22: "internal_temperature_a",
  23: "internal_temperature_b",

  // Err 24 - Fan failure
  24: "fan",

  // Err 26 - Terminals overheated
  26: "overheated",

  // Err 27 - Charger short circuit
  27: "short_circuit",

  // Err 28 - Converter issue
  28: "converter_issue",

  // Err 29 - Over-charge
  29: "over_charge",

  // Err 33–35 PV issues
  33: "input_voltage",
  34: "input_current",
  35: "input_power",

  // Err 38–40 PV shutdown issues
  38: "input_shutdown_voltage",
  39: "input_shutdown_current",
  40: "input_shutdown_failure",

  // Err 41–43 Inverter isolation / ground faults
  41: "inverter_shutdown_41",
  42: "inverter_shutdown_42",
  43: "inverter_shutdown_43",

  // Err 50–58 Inverter faults
  50: "inverter_overload",
  51: "inverter_temperature",
  52: "inverter_peak_current",
  53: "inverter_output_voltage_a",
  54: "inverter_output_voltage_b",
  55: "inverter_self_test_a",
  56: "inverter_self_test_b",
  57: "inverter_ac",
  58: "inverter_self_test_c",

  // Information
  65: "communication",
  66: "synchronisation",

  // Err 67 - BMS lost
  67: "bms",

  // Err 68–71 Network misconfigured
  68: "network_a",
  69: "network_b",
  70: "network_c",
  71: "network_d",

  // Err 80–87 PV input shutdown
  80: "pv_input_shutdown_80",
  81: "pv_input_shutdown_81",
  82: "pv_input_shutdown_82",
  83: "pv_input_shutdown_83",
  84: "pv_input_shutdown_84",
  85: "pv_input_shutdown_85",
  86: "pv_input_shutdown_86",
  87: "pv_input_shutdown_87",

  // Err 114 - CPU temp too high
  114: "cpu_temperature",

  // Err 116 - Calibration lost
  116: "calibration_lost",

  // Err 117 - Bad firmware
  117: "firmware",

  // Err 119 - Settings lost
  119: "settings",

  // Err 121 - Tester fail
  121: "tester_fail",

  // Err 200–201 DC voltage error
  200: "internal_dc_voltage_a",
  201: "internal_dc_voltage_b",

  // Err 202 - GFCI sensor self-test failure
  202: "self_test",

  // Err 203, 205, 212, 215 - Internal supply errors
  203: "internal_supply_a",
  205: "internal_supply_b",
  212: "internal_supply_c",
  215: "internal_supply_d"
};

function hexStringToByteArray(hexString) {
  if (hexString.length % 2 !== 0) {
    hexString = "0" + hexString;
  }

  const bytes = [];

  for (let i = 0; i < hexString.length; i += 2) {
    const byteHex = hexString.substr(i, 2);
    const byteValue = parseInt(byteHex, 16);
    bytes.push(byteValue);
  }

  return bytes;
}

function byteArrayToHexString(byteArray) {
  const hexParts = [];

  for (let i = 0; i < byteArray.length; i++) {
    const value = byteArray[i] & 0xFF;
    const hex = value.toString(16);
    hexParts.push(value < 16 ? "0" + hex : hex);
  }

  return hexParts.join("");
}

function stringToByteArray(str) {
  const bytes = [];

  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xFF);
  }

  return bytes;
}

function byteArrayToArrayBuffer(byteArray) {
  const view = new Uint8Array(byteArray.length);

  for (let i = 0; i < byteArray.length; i++) {
    view[i] = byteArray[i];
  }

  return view.buffer;
}

function arrayBufferToByteArray(buffer) {
  const view = new Uint8Array(buffer);
  const bytes = [];

  for (let i = 0; i < view.length; i++) {
    bytes.push(view[i] & 0xFF);
  }

  return bytes;
}

function decryptVictronPayload(encryptedBytes, keyBytes, counterLsb, counterMsb) {
  const nonceBlock = new Uint8Array(16);
  nonceBlock[0] = counterLsb;
  nonceBlock[1] = counterMsb;

  const keyBuffer   = byteArrayToArrayBuffer(keyBytes);
  const nonceBuffer = nonceBlock.buffer;

  const keyStreamRaw = AES.encrypt(nonceBuffer, keyBuffer, { mode: "ECB" });
  if (!keyStreamRaw) {
    console.log("AES error: encrypt() returned no data");
    return [];
  }

  // AES.encrypt returns ArrayBuffer
  const keyStream = arrayBufferToByteArray(keyStreamRaw);
  if (!keyStream || !keyStream.length) {
    console.log("AES error: could not obtain keystream bytes");
    return [];
  }

  const plainBytes = [];

  for (let i = 0; i < encryptedBytes.length; i++) {
    const ksByte = keyStream[i] || 0;
    plainBytes.push((encryptedBytes[i] ^ ksByte) & 0xFF);
  }

  return plainBytes;
}


function parseSolarCharger(decrypted) {
  if (!decrypted || decrypted.length < 11) {
    console.log(
      "SOLAR_CHARGER: decrypted payload too short:",
      decrypted ? decrypted.length : 0
    );
    return;
  }

  // Raw status bytes
  const charge_state_raw  = decrypted[0];
  const charger_error_raw = decrypted[1];

  // Battery voltage
  const battV_u = (decrypted[3] << 8) | decrypted[2];
  const battV_s = (battV_u & 0x8000) ? battV_u - 0x10000 : battV_u;

  // Battery current 
  const battI_u = (decrypted[5] << 8) | decrypted[4];
  const battI_s = (battI_u & 0x8000) ? battI_u - 0x10000 : battI_u;

  // Yield + solar 
  const yield_raw = (decrypted[7] << 8) | decrypted[6];
  const solar_raw = (decrypted[9] << 8) | decrypted[8];

  // External load 
  let ext_load_raw = null;
  if (decrypted.length >= 12) {
    ext_load_raw = (decrypted[10] & 0xFF) | ((decrypted[11] & 0x01) << 8);
  }

  const battery_voltage_val =
    battV_u === 0x7FFF ? null : battV_s / 100.0;

  const battery_charging_current_val =
    battI_u === 0x7FFF ? null : battI_s / 10.0;

  const yield_today_val =
    yield_raw === 0xFFFF ? null : yield_raw * 10; // Wh

  const solar_power_val =
    solar_raw === 0xFFFF ? null : solar_raw; // W

  const external_device_load_val =
    (ext_load_raw === null || ext_load_raw === 0x1FF)
      ? null
      : ext_load_raw / 10.0;

  if (vcChargeState) {
    if (charge_state_raw !== 0xFF) {
      const cs = chargeStateMap[charge_state_raw];
      if (cs !== undefined && vcChargeState.getValue() !== cs)
      {
        vcChargeState.setValue(cs);
      }
    }
  }

  if (vcChargerError) {
    if (charger_error_raw !== 0xFF) {
      const err = chargerErrorMap[charger_error_raw];
      if (err !== undefined && vcChargerError.getValue() !== err){
        vcChargerError.setValue(err);
      } 
    }
  }

  if (vcBatteryVoltage && battery_voltage_val !== null && (Math.abs(battery_voltage_val - vcBatteryVoltage.getValue()) > NUMBER_THRESHOLD)) {
    vcBatteryVoltage.setValue(battery_voltage_val);
  }

  if (vcBatteryChargingCurrent && battery_charging_current_val !== null && (Math.abs(battery_charging_current_val - vcBatteryChargingCurrent.getValue()) > NUMBER_THRESHOLD)) {
    vcBatteryChargingCurrent.setValue(battery_charging_current_val);
  }

  if (vcYieldToday && yield_today_val !== null && (Math.abs(yield_today_val - vcYieldToday.getValue()) > NUMBER_THRESHOLD)) {
    vcYieldToday.setValue(yield_today_val);
  }

  if (vcSolarPower && solar_power_val !== null && (Math.abs(solar_power_val - vcSolarPower.getValue() > NUMBER_THRESHOLD))) {
    vcSolarPower.setValue(solar_power_val);
  }

  if (vcExternalDeviceLoad && external_device_load_val !== null && (Math.abs(external_device_load_val - vcExternalDeviceLoad.getValue() > NUMBER_THRESHOLD))) {
    vcExternalDeviceLoad.setValue(external_device_load_val);
  }

}

function decodeVictron(manufBytes) {
  if (!manufBytes || manufBytes.length < 8) {
    console.log("manufacturer data too short");
    return;
  }

  const man_type = manufBytes[0];

  // Only "instant readout" (0x10)
  if (man_type !== 0x10) {
    return;
  }

  const product_id       = (manufBytes[3] << 8) | manufBytes[2];
  const record_type      = manufBytes[4];
  const counter_lsb      = manufBytes[5];
  const counter_msb      = manufBytes[6];
  const encryption_key_0 = manufBytes[7];
  const crypted          = manufBytes.slice(8);

  if (BINDKEY_HEX.length !== 32) {
    console.log(
      "Please set BINDKEY_HEX to a 32-char hex string (16 bytes). Currently:",
      BINDKEY_HEX
    );
    return;
  }

  const key = hexStringToByteArray(BINDKEY_HEX);
  if (key[0] !== encryption_key_0) {
    console.log(
      "WARNING: bindkey first byte (0x" + key[0].toString(16) +
      ") does not match encryption_key_0 (0x" + encryption_key_0.toString(16) +
      "); decryption may fail."
    );
  }

  const decrypted = decryptVictronPayload(crypted, key, counter_lsb, counter_msb);
  if (!decrypted || !decrypted.length) {
    console.log("Victron: decryption failed or empty");
    return;
  }

  if (record_type === 0x01) { // SOLAR_CHARGER
    parseSolarCharger(decrypted);
  } else if (record_type === 0x02) { // BATTERY_MONITOR (optional)
    if (decrypted.length >= 4 && vcBatteryVoltage) {
      const rawBV   = (decrypted[3] << 8) | decrypted[2];
      const battVol = ((rawBV & 0x8000) ? rawBV - 0x10000 : rawBV) * 0.01;
      vcBatteryVoltage.setValue(battVol);
    }
  } else {
    console.log("Victron: unhandled record_type 0x" + record_type.toString(16));
  }
}


let last_data_hex = null;

function scanCB(ev, res) {
  const md = res && res.manufacturer_data;

  if (ev === BLE.Scanner.SCAN_RESULT && md) {
    const id = Object.keys(md)[0];
    const val = id ? md[id] : null;

    // Must be Victron manufacturer ID 0x02E1 and have a value
    if (id && val && id.toLowerCase() === "02e1") {
      const bytes = stringToByteArray(val);

      // Need non-empty bytes and Instant Readout frame (0x10)
      if (bytes && bytes.length && ((bytes[0] & 0xFF) === 0x10)) {
        const hex = byteArrayToHexString(bytes);

        // Skip if same as last frame
        if (hex !== last_data_hex) {
          last_data_hex = hex;

          const decoded = decodeVictron(bytes);

          if (decoded && decoded.payload) {
            const response = {
              name: res.name || null,
              address: res.addr || res.address || null,
              rssi: res.rssi,
              payload: decoded.payload
            };

            console.log("RESPONSE ", JSON.stringify(response));
          }
        }
      }
    }
  }
}

let last_data_hex = null;

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;

  const md = res && res.manufacturer_data;
  if (!md) return;

  // Directly get Victron manufacturer entry if present
  const val = md["02e1"] || md["02E1"];
  if (!val) return;

  const bytes = stringToByteArray(val);
  if (!bytes || !bytes.length) return;

  // Instant-readout frames only (0x10)
  if ((bytes[0] & 0xFF) !== 0x10) return;

  const hex = byteArrayToHexString(bytes);
  if (hex === last_data_hex) return;  // dedupe
  last_data_hex = hex;

  decodeVictron(bytes);
}

BLE.Scanner.Start(
  {
    duration_ms: BLE.Scanner.INFINITE_SCAN,
    filters: [{ addrs: [MAC_ADDRESS] }]
  },
  scanCB
);