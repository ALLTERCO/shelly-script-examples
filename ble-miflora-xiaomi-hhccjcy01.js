// Shelly BLU Scanner + MiFlora Parser inspired by xiaomi_hhccjcy01 sensor for esphome

// This script parses Xiaomi MiFlora sensor data from BLE advertisements and publishes it to MQTT.
// Available sensor data includes temperature, illuminance, moisture, and conductivity.

// Prerequisites:
// - MQTT broker running, configured in Shelly device and accessible
// - Bluetooth activated in Shelly device
// - Ensure you have the correct MAC address for your MiFlora device

// Tested with firmware version 1.5.1 on Shelly 1 Mini Gen3

// Configuration 
let MI_FLORA_MAC = "5c:85:7e:12:fc:a4";
let mqtt_prefix = "miflora/rasen1";

// DON'T CHANGE ANYTHING BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING

// Convert byte to hex string
function byteToHex(byte) {
    let hex = byte.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

const XIAOMI_SVC_ID = "fe95";

// Parse Xiaomi advertisement data
function parseXiaomiData(serviceData) {
    // Convert string data to array of byte values
    let data = [];
    for (let i = 0; i < serviceData.length; i++) {
        data.push(serviceData.charCodeAt(i));
    }

    // Print raw data in hex for debugging
    let dataHex = "";
    for (let i = 0; i < data.length; i++) {
        dataHex += byteToHex(data[i]) + " ";
    }

    // Initialize result object
    let result = {};

    // Check for minimum data length and 0x0D marker
    if (data.length < 12 || data[11] !== 0x0D) {
        return result;
    }

    // Get data type
    let dataType = data[12];

    // Parse based on data type
    switch (dataType) {
        case 0x04:  // Temperature
            if (data.length >= 17) {
                let temp = data[15] | (data[16] << 8);
                if (temp & 0x8000) {
                    temp = -((~temp + 1) & 0xFFFF);
                }
                result.temperature = temp / 10.0;
                console.log("Temperature: " + result.temperature + "°C");
            }
            break;

        case 0x06:  // Humidity (if your device has it)
            if (data.length >= 17) {
                let humidity = data[15] | (data[16] << 8);
                result.humidity = humidity / 10.0;
                console.log("Humidity: " + result.humidity + "%");
            }
            break;

        case 0x07:  // Illuminance
            if (data.length >= 18) {
                let illuminance = data[15] | (data[16] << 8) | (data[17] << 16);
                result.illuminance = illuminance;
                console.log("Illuminance: " + result.illuminance + " lux");
            } else if (data.length >= 17) {
                // In case it's only 2 bytes
                let illuminance = data[15] | (data[16] << 8);
                result.illuminance = illuminance;
                console.log("Illuminance: " + result.illuminance + " lux");
            }
            break;

        case 0x08:  // Moisture
            if (data.length >= 16) {
                result.moisture = data[15];
                console.log("Moisture: " + result.moisture + "%");
            }
            break;

        case 0x09:  // Conductivity
            if (data.length >= 17) {
                let conductivity = data[15] | (data[16] << 8);
                result.conductivity = conductivity;
                console.log("Conductivity: " + result.conductivity + " μS/cm");
            }
            break;

        default:
            console.log("Unknown data type: 0x" + byteToHex(dataType));
    }

    return result;
}

// BLE scanner handler
function handleScanResult(event, result) {
    if (event !== BLE.Scanner.SCAN_RESULT || !result) return;

    // Check if this is our Mi Flora device
    if (result.addr !== MI_FLORA_MAC) return;

    console.log("---------------------------------------------");
    console.log("Found Mi Flora device: " + result.addr + ", RSSI: " + result.rssi);

    // Check if the device has Xiaomi service data
    if (!result.service_data || !result.service_data[XIAOMI_SVC_ID]) {
        console.log("No Xiaomi service data");
        console.log("---------------------------------------------");
        return;
    }

    // Try to parse the sensor data
    let sensorData = parseXiaomiData(result.service_data[XIAOMI_SVC_ID]);
    if (!sensorData || Object.keys(sensorData).length === 0) {
        console.log("No sensor data parsed");
        console.log("---------------------------------------------");
        return;
    }

    // Add basic device info
    sensorData.addr = result.addr;
    sensorData.rssi = result.rssi;

    // Publish full state to MQTT
    MQTT.publish(mqtt_prefix + '/state', JSON.stringify(sensorData), 1, true);
    console.log("Published full state to MQTT");

    // Also publish individual values
    for (let key in sensorData) {
        // Only publish actual sensor values, not metadata
        if (key !== 'addr' && key !== 'rssi') {
            MQTT.publish(mqtt_prefix + '/' + key, sensorData[key].toString(), 1, true);
            console.log("Published " + key + " = " + sensorData[key] + " to MQTT");
        }
    }

    console.log("---------------------------------------------");
}

// Start BLE scanner
BLE.Scanner.Start({
    duration_ms: BLE.Scanner.INFINITE_SCAN,
    active: true
}, handleScanResult);

console.log("Mi Flora parser started");
console.log("Looking for device: " + MI_FLORA_MAC);