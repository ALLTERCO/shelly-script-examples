/**
 * @title Jaalee JHT BLE - MQTT Home Assistant Bridge
 * @description Parses iBeacon-format temperature/humidity/battery data from Jaalee JHT BLE sensors via Shelly BLU Gateway and publishes to Home Assistant via MQTT Auto-Discovery.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/scripts/mqtt/mqtt-jaalee-jht-bridge.shelly.js
 */

/**
 * Jaalee JHT BLE - MQTT Home Assistant Bridge
 *
 * Listens for BLE advertisements from Jaalee JHT temperature/humidity sensors
 * and publishes sensor data to Home Assistant via MQTT Auto-Discovery. Supports
 * both iBeacon (24-byte) and short (15-16 byte) advertisement formats.
 *
 * Hardware Connection:
 * - Jaalee JHT BLE sensor (standalone, no wiring required)
 * - Shelly device with BLE support acting as BLU Gateway
 *
 * Protocol:
 * - BLE iBeacon format: [Header 2B] [UUID 16B] [Temp 2B] [Humi 2B] [TX 1B] [Battery 1B]
 * - BLE short format:   [Flags] [Battery] [MAC 6B] [...] [Temp 2B] [Humi 2B]
 *
 * Components Created (MQTT Auto-Discovery):
 * - sensor/temperature  - Temperature (°C / °F / K)
 * - sensor/humidity     - Relative humidity (%)
 * - sensor/battery      - Battery level (%)
 * - sensor/rssi         - Signal strength (dBm, optional)
 * - sensor/last_seen    - Last seen timestamp (optional)
 * - sensor/link_quality - Link quality 0-100% (optional)
 * - sensor/data_age     - Age of last data in seconds (optional)
 * - binary_sensor/battery_low - Low battery warning (optional)
 * 
 * @see https://github.com/arboeh/jABas/blob/main/scripts/mqtt/README.mqtt-jaalee-jht-bridge.shelly.js.md
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const VERSION = '1.0.1';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CONFIG = {
  eventName: 'jABas-jaalee-jht',
  active: true, // Active scan required for Jaalee devices

  // Log levels: ERROR=0, WARN=1, INFO=2, DEBUG=3
  // INFO: Shows important events (sensor found, MQTT status, etc.)
  // DEBUG: Shows all BLE scans and detailed information
  logLevel: LOG_LEVELS.INFO,

  temperature: {
    unit: 'celsius', // 'celsius', 'fahrenheit' or 'kelvin'
  },

  mqtt: {
    enabled: true,
    discovery_prefix: 'homeassistant',
    device_prefix: 'jABas-jaalee-jht',

    publish_rssi: true,
    publish_last_seen: true,
    publish_link_quality: false,
    publish_battery_low: false,
    publish_data_age: false,

    sensor_timeout: 300, // Seconds without update -> offline (5 min)
    timeout_check_interval: 120, // Check interval in seconds (2 min)
    battery_low_threshold: 20, // Battery % threshold for low battery warning
  },

  knownDevices: {
    // Optional: Format: "mac-address": "friendly_name"
    'XX:XX:XX:XX:XX:XX': 'Jaalee JHT Kitchen',
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================

// Sensor calculation constants
const TEMP_SCALE_FACTOR = 175;
const TEMP_OFFSET = -45;
const HUMIDITY_SCALE_FACTOR = 100;
const ADC_MAX_VALUE = 65535;

// Sensor validation ranges
const TEMP_MIN = -40;
const TEMP_MAX = 80;
const HUMIDITY_MIN = 0;
const HUMIDITY_MAX = 100;

// RSSI to Link Quality conversion
const RSSI_EXCELLENT = -30; // 100% quality
const RSSI_UNUSABLE = -90; // 0% quality

// ============================================================================
// STATE
// ============================================================================

let discoveredDevices = {};
let lastSeenTimestamps = {};
let lastDataTimestamps = {};
let mqttConnected = false;

const LOGGER = {
  level: CONFIG.logLevel,

  error: function (message) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.log('[ERROR] jABas-jaalee-jht v' + VERSION + ':', message);
    }
  },
  warn: function (message) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.log('[WARN] jABas-jaalee-jht v' + VERSION + ':', message);
    }
  },
  info: function (message) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log('[INFO] jABas-jaalee-jht v' + VERSION + ':', message);
    }
  },
  debug: function (message) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG] jABas-jaalee-jht v' + VERSION + ':', message);
    }
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Round a number to 2 decimal places
 * @param {number} value Decimal value to round
 * @returns {number} Rounded value with 2 decimals
 */
function roundTo2Decimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Convert Celsius to the configured temperature unit
 * @param {number} celsius Temperature in Celsius
 * @param {string} unit Optional unit override; defaults to CONFIG value
 * @returns {number} Temperature in configured unit
 */
function convertTemperature(celsius, unit) {
  const targetUnit = unit || CONFIG.temperature.unit;
  if (targetUnit === 'fahrenheit') {
    return roundTo2Decimals((celsius * 9) / 5 + 32);
  }
  if (targetUnit === 'kelvin') {
    return roundTo2Decimals(celsius + 273.15);
  }
  return celsius;
}

/**
 * Get temperature unit symbol based on configuration
 * @param {string} unit Optional unit override; defaults to CONFIG value
 * @returns {string} Temperature unit symbol (°C, °F or K)
 */
function getTemperatureUnit(unit) {
  const targetUnit = unit || CONFIG.temperature.unit;
  if (targetUnit === 'fahrenheit') return '°F';
  if (targetUnit === 'kelvin') return 'K';
  return '°C';
}

/**
 * Validate sensor data against known physical ranges
 * @param {number} temperature Temperature in configured unit
 * @param {number} humidity Humidity percentage
 * @returns {boolean} True if sensor data is valid
 */
function validateSensorData(temperature, humidity) {
  if (temperature < TEMP_MIN || temperature > TEMP_MAX) return false;
  if (humidity < HUMIDITY_MIN || humidity > HUMIDITY_MAX) return false;
  return true;
}

/**
 * Calculate link quality percentage from RSSI
 * @param {number} rssi RSSI value in dBm
 * @returns {number} Link quality percentage (0-100)
 */
function calculateLinkQuality(rssi) {
  const range = RSSI_EXCELLENT - RSSI_UNUSABLE;
  const quality = ((rssi - RSSI_UNUSABLE) * 100) / range;
  return Math.round(Math.min(100, Math.max(0, quality)));
}

/**
 * Check if battery level is below the configured threshold
 * @param {number} battery Battery percentage
 * @returns {boolean} True if battery is low
 */
function isBatteryLow(battery) {
  return battery <= CONFIG.mqtt.battery_low_threshold;
}

/**
 * Calculate age of last received data in seconds
 * @param {string} mac MAC address of the device
 * @returns {number} Age in seconds, or 0 if no timestamp available
 */
function getDataAge(mac) {
  if (!lastDataTimestamps[mac]) return 0;
  return getUnixTimestamp() - lastDataTimestamps[mac];
}

/**
 * Format MAC address for use in MQTT topics (lowercase, no colons)
 * @param {string} mac MAC address string
 * @returns {string} Formatted MAC address
 */
function formatMacForTopic(mac) {
  if (!mac) return '';
  const parts = mac.split(':');
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    result += parts[i].toLowerCase();
  }
  return result;
}

/**
 * Get current timestamp in ISO 8601 format
 * @returns {string} ISO timestamp string
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Get current Unix timestamp in seconds
 * @returns {number} Unix timestamp
 */
function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

/**
 * Jaalee JHT BLE data decoder for iBeacon and short advertisement formats
 */
const JaaleeDecoder = {
  /**
   * Convert buffer to hex string
   * @param {Uint8Array} buffer Input buffer
   * @returns {string} Hexadecimal representation
   */
  bufferToHex: function (buffer) {
    let hex = '';
    for (let i = 0; i < buffer.length; i++) {
      hex += ('0' + buffer.at(i).toString(16)).slice(-2);
    }
    return hex;
  },

  /**
   * Extract 16-bit unsigned integer (big-endian)
   * @param {Uint8Array} buffer Input buffer
   * @param {number} offset Offset in buffer
   * @returns {number} 16-bit unsigned integer value
   */
  getUInt16BE: function (buffer, offset) {
    return (buffer.at(offset) << 8) | buffer.at(offset + 1);
  },

  /**
   * Calculate temperature in Celsius from raw ADC value
   * @param {number} rawValue Raw ADC value from sensor
   * @returns {number} Temperature in Celsius
   */
  calculateTemperature: function (rawValue) {
    const celsius =
      (TEMP_SCALE_FACTOR * rawValue) / ADC_MAX_VALUE + TEMP_OFFSET;
    return roundTo2Decimals(celsius);
  },

  /**
   * Calculate humidity percentage from raw ADC value
   * @param {number} rawValue Raw ADC value from sensor
   * @returns {number} Humidity percentage
   */
  calculateHumidity: function (rawValue) {
    const humidity = (HUMIDITY_SCALE_FACTOR * rawValue) / ADC_MAX_VALUE;
    return roundTo2Decimals(humidity);
  },

  /**
   * Parse iBeacon format (24 bytes)
   * @param {Uint8Array} data Manufacturer data buffer
   * @returns {object|null} Parsed sensor data or null
   */
  parseLongFormat: function (data) {
    if (data.length !== 24) return null;
    if (data.at(0) !== 0x02 || data.at(1) !== 0x15) return null;

    let hasJaaleeMarker = false;
    for (let i = 2; i < 17; i++) {
      if (data.at(i) === 0xf5 && data.at(i + 1) === 0x25) {
        hasJaaleeMarker = true;
        break;
      }
    }
    if (!hasJaaleeMarker) return null;

    const tempRaw = this.getUInt16BE(data, 18);
    const temperature = this.calculateTemperature(tempRaw);
    const humiRaw = this.getUInt16BE(data, 20);
    const humidity = this.calculateHumidity(humiRaw);
    const battery = data.at(23);

    if (!validateSensorData(temperature, humidity)) {
      LOGGER.debug('Sensor data validation failed (iBeacon format)');
      return null;
    }

    return {
      temperature: convertTemperature(temperature),
      humidity: humidity,
      battery: battery,
      format: 'iBeacon-24',
    };
  },

  /**
   * Parse short format (15-16 bytes)
   * @param {Uint8Array} data Manufacturer data buffer
   * @param {Uint8Array} expectedMac Expected MAC as byte array for verification, or null
   * @returns {object|null} Parsed sensor data or null
   */
  parseShortFormat: function (data, expectedMac) {
    if (data.length < 15 || data.length > 16) return null;

    const battery = data.at(4);
    const macAddress = [];
    for (let i = 10; i >= 5; i--) {
      macAddress.push(data.at(i));
    }

    if (expectedMac && expectedMac.length === 6) {
      let macMatch = true;
      for (let i = 0; i < 6; i++) {
        if (macAddress[i] !== expectedMac[i]) {
          macMatch = false;
          break;
        }
      }
      if (!macMatch) {
        LOGGER.debug('MAC address mismatch in short format');
        return null;
      }
    }

    const tempRaw = this.getUInt16BE(data, data.length - 4);
    const temperature = this.calculateTemperature(tempRaw);
    const humiRaw = this.getUInt16BE(data, data.length - 2);
    const humidity = this.calculateHumidity(humiRaw);

    if (!validateSensorData(temperature, humidity)) {
      LOGGER.debug('Sensor data validation failed (short format)');
      return null;
    }

    return {
      temperature: convertTemperature(temperature),
      humidity: humidity,
      battery: battery,
      format: 'short',
    };
  },

  /**
   * Parse BLE advertisement data, trying iBeacon then short format
   * @param {Uint8Array} advData Manufacturer data buffer
   * @param {Uint8Array} macAddress Expected MAC bytes for verification, or null
   * @returns {object|null} Parsed sensor data or null
   */
  parse: function (advData, macAddress) {
    if (!advData || advData.length === 0) return null;
    let result = this.parseLongFormat(advData);
    if (result) return result;
    return this.parseShortFormat(advData, macAddress);
  },
};

// ============================================================================
// MQTT FUNCTIONS
// ============================================================================

/**
 * Publish device availability status to MQTT
 * @param {string} mac MAC address of the device
 * @param {string} status 'online' or 'offline'
 */
function publishStatus(mac, status) {
  if (!mqttConnected) return;
  const macClean = formatMacForTopic(mac);
  const statusTopic = CONFIG.mqtt.device_prefix + '/' + macClean + '/status';
  MQTT.publish(statusTopic, status, 0, true);
  LOGGER.debug("Status '" + status + "' published for: " + mac);
}

/**
 * Create device info object for MQTT Discovery
 * @param {string} deviceId Unique device ID for Home Assistant
 * @param {string} deviceName Friendly name for the device
 * @returns {object} Device info object for MQTT Discovery
 */
function createDeviceInfo(deviceId, deviceName) {
  const shellyInfo = Shelly.getDeviceInfo();
  return {
    identifiers: [deviceId],
    name: deviceName,
    model: 'Jaalee JHT',
    manufacturer: 'Jaalee',
    sw_version: VERSION,
    via_device: shellyInfo.id,
  };
}

/**
 * Create sensor config object for MQTT Discovery
 * @param {string} deviceId Unique device ID for Home Assistant
 * @param {string} sensorType Type of sensor ('temperature', 'humidity', 'battery', 'rssi', 'last_seen', 'link_quality' or 'data_age')
 * @param {object} device Device info object for MQTT Discovery
 * @param {string} macClean Cleaned MAC address for topic construction
 * @param {string} availabilityTopic MQTT topic for availability status
 * @returns {object|null} Sensor config object for MQTT Discovery, or null if sensorType is invalid
 */
function createSensorConfig(
  deviceId,
  sensorType,
  device,
  macClean,
  availabilityTopic,
) {
  const configs = {
    temperature: {
      name: 'Temperature',
      unique_id: deviceId + '_temperature',
      value_template: '{{ value_json.temperature }}',
      unit_of_measurement: getTemperatureUnit(),
      device_class: 'temperature',
      state_class: 'measurement',
      enabled_by_default: true,
    },
    humidity: {
      name: 'Humidity',
      unique_id: deviceId + '_humidity',
      value_template: '{{ value_json.humidity }}',
      unit_of_measurement: '%',
      device_class: 'humidity',
      state_class: 'measurement',
      enabled_by_default: true,
    },
    battery: {
      name: 'Battery',
      unique_id: deviceId + '_battery',
      value_template: '{{ value_json.battery }}',
      unit_of_measurement: '%',
      device_class: 'battery',
      state_class: 'measurement',
      entity_category: 'diagnostic',
      enabled_by_default: true,
    },
    rssi: {
      name: 'Signal Strength',
      unique_id: deviceId + '_rssi',
      value_template: '{{ value_json.rssi }}',
      unit_of_measurement: 'dBm',
      device_class: 'signal_strength',
      state_class: 'measurement',
      entity_category: 'diagnostic',
      enabled_by_default: false,
    },
    last_seen: {
      name: 'Last Seen',
      unique_id: deviceId + '_last_seen',
      value_template: '{{ value_json.last_seen }}',
      device_class: 'timestamp',
      entity_category: 'diagnostic',
      enabled_by_default: false,
    },
    link_quality: {
      name: 'Link Quality',
      unique_id: deviceId + '_link_quality',
      value_template: '{{ value_json.link_quality }}',
      unit_of_measurement: '%',
      icon: 'mdi:wifi',
      state_class: 'measurement',
      entity_category: 'diagnostic',
      enabled_by_default: false,
    },
    data_age: {
      name: 'Data Age',
      unique_id: deviceId + '_data_age',
      value_template: '{{ value_json.data_age }}',
      unit_of_measurement: 's',
      icon: 'mdi:clock-outline',
      state_class: 'measurement',
      entity_category: 'diagnostic',
      enabled_by_default: false,
    },
  };

  const config = configs[sensorType];
  if (!config) return null;

  config.state_topic = CONFIG.mqtt.device_prefix + '/' + macClean + '/state';
  config.availability_topic = availabilityTopic;
  config.payload_available = 'online';
  config.payload_not_available = 'offline';
  config.device = device;

  return config;
}

/**
 * Create binary sensor config for MQTT Discovery
 * @param {string} deviceId Unique device ID for Home Assistant
 * @param {string} sensorType Type of binary sensor ('battery_low')
 * @param {object} device Device info object for MQTT Discovery
 * @param {string} macClean Cleaned MAC address for topic construction
 * @param {string} availabilityTopic MQTT topic for availability status
 * @returns {object|null} Binary sensor config object for MQTT Discovery, or null if sensorType is invalid
 */
function createBinarySensorConfig(
  deviceId,
  sensorType,
  device,
  macClean,
  availabilityTopic,
) {
  const configs = {
    battery_low: {
      name: 'Battery Low',
      unique_id: deviceId + '_battery_low',
      state_topic: CONFIG.mqtt.device_prefix + '/' + macClean + '/state',
      value_template: '{{ value_json.battery_low }}',
      payload_on: 'ON',
      payload_off: 'OFF',
      device_class: 'battery',
      entity_category: 'diagnostic',
      enabled_by_default: false,
    },
  };

  const config = configs[sensorType];
  if (!config) return null;

  config.availability_topic = availabilityTopic;
  config.payload_available = 'online';
  config.payload_not_available = 'offline';
  config.device = device;

  return config;
}

/**
 * Publish MQTT Discovery configuration for all sensors of a device
 * @param {string} mac MAC address of the device
 * @param {string} friendlyName Optional friendly name for the device; if not provided, a default name based on MAC will be used
 */
function publishDiscovery(mac, friendlyName) {
  if (!mqttConnected) {
    LOGGER.warn('MQTT not connected, skipping discovery');
    return;
  }

  const macClean = formatMacForTopic(mac);
  const deviceId = CONFIG.mqtt.device_prefix + '_' + macClean;
  const deviceName = friendlyName || 'Jaalee JHT ' + mac;
  const availabilityTopic =
    CONFIG.mqtt.device_prefix + '/' + macClean + '/status';
  const device = createDeviceInfo(deviceId, deviceName);

  const primarySensors = ['temperature', 'humidity', 'battery'];
  for (let i = 0; i < primarySensors.length; i++) {
    const sensorType = primarySensors[i];
    const config = createSensorConfig(
      deviceId,
      sensorType,
      device,
      macClean,
      availabilityTopic,
    );
    const discoveryTopic =
      CONFIG.mqtt.discovery_prefix +
      '/sensor/' +
      deviceId +
      '_' +
      sensorType +
      '/config';
    MQTT.publish(discoveryTopic, JSON.stringify(config), 0, true);
  }

  if (CONFIG.mqtt.publish_rssi) {
    const config = createSensorConfig(
      deviceId,
      'rssi',
      device,
      macClean,
      availabilityTopic,
    );
    MQTT.publish(
      CONFIG.mqtt.discovery_prefix + '/sensor/' + deviceId + '_rssi/config',
      JSON.stringify(config),
      0,
      true,
    );
  }

  if (CONFIG.mqtt.publish_last_seen) {
    const config = createSensorConfig(
      deviceId,
      'last_seen',
      device,
      macClean,
      availabilityTopic,
    );
    MQTT.publish(
      CONFIG.mqtt.discovery_prefix +
        '/sensor/' +
        deviceId +
        '_last_seen/config',
      JSON.stringify(config),
      0,
      true,
    );
  }

  if (CONFIG.mqtt.publish_link_quality) {
    const config = createSensorConfig(
      deviceId,
      'link_quality',
      device,
      macClean,
      availabilityTopic,
    );
    MQTT.publish(
      CONFIG.mqtt.discovery_prefix +
        '/sensor/' +
        deviceId +
        '_link_quality/config',
      JSON.stringify(config),
      0,
      true,
    );
  }

  if (CONFIG.mqtt.publish_data_age) {
    const config = createSensorConfig(
      deviceId,
      'data_age',
      device,
      macClean,
      availabilityTopic,
    );
    MQTT.publish(
      CONFIG.mqtt.discovery_prefix + '/sensor/' + deviceId + '_data_age/config',
      JSON.stringify(config),
      0,
      true,
    );
  }

  if (CONFIG.mqtt.publish_battery_low) {
    const config = createBinarySensorConfig(
      deviceId,
      'battery_low',
      device,
      macClean,
      availabilityTopic,
    );
    MQTT.publish(
      CONFIG.mqtt.discovery_prefix +
        '/binary_sensor/' +
        deviceId +
        '_battery_low/config',
      JSON.stringify(config),
      0,
      true,
    );
  }

  LOGGER.info('MQTT Discovery published for: ' + mac);
}

/**
 * Publish sensor state payload to MQTT
 * @param {string} mac MAC address of the device
 * @param {object} data Sensor data object
 */
function publishSensorData(mac, data) {
  if (!mqttConnected) return;

  const macClean = formatMacForTopic(mac);
  const stateTopic = CONFIG.mqtt.device_prefix + '/' + macClean + '/state';

  const payload = {
    temperature: data.temperature,
    humidity: data.humidity,
    battery: data.battery,
  };

  if (CONFIG.mqtt.publish_rssi) payload.rssi = data.rssi;
  if (CONFIG.mqtt.publish_last_seen) payload.last_seen = getTimestamp();
  if (CONFIG.mqtt.publish_link_quality)
    payload.link_quality = calculateLinkQuality(data.rssi);
  if (CONFIG.mqtt.publish_battery_low)
    payload.battery_low = isBatteryLow(data.battery) ? 'ON' : 'OFF';
  if (CONFIG.mqtt.publish_data_age) payload.data_age = getDataAge(mac);

  MQTT.publish(stateTopic, JSON.stringify(payload), 0, false);
  LOGGER.debug('Sensor data published to: ' + stateTopic);

  lastDataTimestamps[mac] = getUnixTimestamp();
}

/**
 * Check for timed-out sensors and publish offline status
 */
function checkSensorTimeouts() {
  if (!mqttConnected) return;

  const now = getUnixTimestamp();
  const timeout = CONFIG.mqtt.sensor_timeout;

  for (let mac in lastSeenTimestamps) {
    const diff = now - lastSeenTimestamps[mac];
    if (diff > timeout) {
      publishStatus(mac, 'offline');
      LOGGER.warn('Sensor timeout: ' + mac + ' (no data for ' + diff + 's)');
      delete lastSeenTimestamps[mac];
      delete lastDataTimestamps[mac];
    }
  }
}

/**
 * Emit parsed Jaalee sensor data as Shelly event and publish to MQTT
 * @param {object} data Parsed sensor data
 */
function emitJaaleeData(data) {
  if (typeof data !== 'object') return;

  Shelly.emitEvent(CONFIG.eventName, data);

  if (CONFIG.mqtt.enabled && data.address && mqttConnected) {
    const friendlyName = CONFIG.knownDevices[data.address] || null;

    if (!discoveredDevices[data.address]) {
      publishDiscovery(data.address, friendlyName);
      discoveredDevices[data.address] = true;
    }

    lastSeenTimestamps[data.address] = getUnixTimestamp();
    publishStatus(data.address, 'online');
    publishSensorData(data.address, data);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * BLE scan result callback
 * @param {number} event BLE event type
 * @param {object} result BLE scan result
 */
function JaaleeScanCallback(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT) return;

  let advData = null;
  if (typeof result.manufacturer_data !== 'undefined') {
    for (let key in result.manufacturer_data) {
      advData = result.manufacturer_data[key];
      break;
    }
  }
  if (!advData) return;

  LOGGER.debug(
    'BLE Device: ' +
      result.addr +
      ' | RSSI: ' +
      result.rssi +
      ' | Data length: ' +
      advData.length,
  );

  let macBytes = null;
  if (result.addr) {
    const macParts = result.addr.split(':');
    if (macParts.length === 6) {
      macBytes = [];
      for (let i = 0; i < macParts.length; i++) {
        macBytes.push(parseInt(macParts[i], 16));
      }
    }
  }

  const parsed = JaaleeDecoder.parse(advData, macBytes);
  if (parsed) {
    parsed.rssi = result.rssi;
    parsed.address = result.addr;
    parsed.model = 'Jaalee JHT';

    LOGGER.info(
      'Jaalee JHT found - MAC: ' +
        result.addr +
        ' | Temp: ' +
        parsed.temperature +
        getTemperatureUnit() +
        ' | Humidity: ' +
        parsed.humidity +
        '%',
    );
    LOGGER.debug(
      'Battery: ' +
        parsed.battery +
        '% | ' +
        'RSSI: ' +
        parsed.rssi +
        'dBm | ' +
        'Format: ' +
        parsed.format,
    );

    emitJaaleeData(parsed);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the script: validate config, start BLE scanner, set up MQTT
 * connection monitoring and sensor timeout checks.
 */
function init() {
  LOGGER.info('jABas-jaalee-jht parser initialized (v' + VERSION + ')');
  LOGGER.info(
    'Log level: ' +
      (LOGGER.level === 3
        ? 'DEBUG'
        : LOGGER.level === 2
          ? 'INFO'
          : LOGGER.level === 1
            ? 'WARN'
            : 'ERROR'),
  );
  LOGGER.info('Temperature unit: ' + getTemperatureUnit());

  const opts = [];
  if (CONFIG.mqtt.publish_rssi) opts.push('RSSI');
  if (CONFIG.mqtt.publish_last_seen) opts.push('Last Seen');
  LOGGER.info(
    'Optional sensors enabled: ' + (opts.length ? opts.join(', ') : 'none'),
  );

  if (typeof Shelly === 'undefined') return; // Node.js -> exit

  const BLEConfig = Shelly.getComponentConfig('ble');
  if (!BLEConfig.enable) {
    LOGGER.error('Bluetooth not enabled');
    return;
  }

  if (CONFIG.mqtt.enabled) {
    mqttConnected = MQTT.isConnected();
    LOGGER.info('MQTT ' + (mqttConnected ? 'connected' : 'not connected'));
  }

  if (!BLE.Scanner.isRunning()) {
    if (
      !BLE.Scanner.Start({
        duration_ms: BLE.Scanner.INFINITE_SCAN,
        active: CONFIG.active,
      })
    ) {
      LOGGER.error('BLE scanner failed');
      return;
    }
  }
  BLE.Scanner.Subscribe(JaaleeScanCallback);

  if (CONFIG.mqtt.enabled) {
    Timer.set(
      CONFIG.mqtt.timeout_check_interval * 1000,
      true,
      checkSensorTimeouts,
    );
    LOGGER.info(
      'Timeout monitoring started (' +
        CONFIG.mqtt.timeout_check_interval +
        's)',
    );
  }
}

if (typeof module !== 'undefined' && module.exports) {
  if (typeof Shelly === 'undefined') {
    init();
  }
  module.exports = {
    roundTo2Decimals,
    convertTemperature,
    validateSensorData,
    calculateLinkQuality,
    formatMacForTopic,
    JaaleeDecoder,
    getTemperatureUnit,
    isBatteryLow,
    getDataAge,
  };
}

if (typeof module === 'undefined') {
  init();
}
