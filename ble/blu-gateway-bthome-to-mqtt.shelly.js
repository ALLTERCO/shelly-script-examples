/**
 * @title BLU Gateway BTHome to MQTT Script
 * @description Publishes decoded Shelly BLU / BTHome advertisements as
 *   Shelly Gen2-style MQTT RPC notifications.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/blu-gateway-bthome-to-mqtt.shelly.js
 */

/**
 * For Shelly gateways that do not publish BLU BTHome data natively over MQTT,
 * this script listens for BLE advertisements, decodes supported BTHome values,
 * and republishes them using Shelly Gen2-style MQTT notifications.
 *
 * MQTT topic:
 *   <gateway-topic-prefix>/events/rpc
 *
 * Payloads use NotifyStatus for decoded device state and NotifyEvent for
 * button events or optional raw scan debugging.
 *
 * BLU device keys use a Shelly-style inferred prefix plus the full advertiser
 * address. Unknown devices are ignored until their type can be inferred.
 * Gateway topics use the configured MQTT topic_prefix when available.
 */

// *********************** Configuration ***********************

const CONFIG = {
  // Fallbacks used only when Shelly does not expose a more specific value.
  gatewayDevicePrefix: "shellyblugw",
  bluDevicePrefix: "shellyblu",
  // "rpc" publishes NotifyStatus/NotifyEvent on <gateway-topic-prefix>/events/rpc.
  // "namespace" publishes custom topics under <gateway-topic-prefix>/blu/<device>/<leaf>.
  topicMode: "rpc",
  customNamespace: "blu",
  gatewayEventDevice: "gateway",

  // Raw scan events are noisy; keep disabled unless debugging BLE reception.
  publishRawEvents: false,

  // Shelly Gen2 MQTT uses QoS 1 for device MQTT traffic.
  qos: 1,
  retainState: true,
  retainMeasurements: true,
};

const LEAF_ALIASES = {
  distance_mm: "distance-mm",
};

const MEASUREMENT_KEYS = {
  battery: true,
  temperature: true,
  humidity: true,
  illuminance: true,
  distance_mm: true,
  rotation: true,
  rssi: true,
};

const EVENT_KEYS = {
  button: true,
};

const BUTTON_EVENTS = {
  0: "none",
  1: "press",
  2: "double_press",
  3: "triple_press",
  4: "long_press",
  5: "long_double_press",
  6: "long_triple_press",
  128: "hold_press",
};

const STATE_KEYS = {
  motion: true,
  vibration: true,
  window: true,
};

const METADATA_KEYS = {
  BTHome_version: true,
  encryption: true,
  pid: true,
};

const KNOWN_DEVICE_TYPES = {};

// *********************** Decoding Method ***********************

const uint8 = 0;
const int8 = 1;
const uint16 = 2;
const int16 = 3;
const uint24 = 4;
const int24 = 5;

// BTHome object definitions used by common Shelly BLU devices.
const BTH = {
  0x00: { n: "pid", t: uint8 },
  0x01: { n: "battery", t: uint8, u: "%" },
  0x02: { n: "temperature", t: int16, f: 0.01, u: "tC" },
  0x03: { n: "humidity", t: uint16, f: 0.01, u: "%" },
  0x05: { n: "illuminance", t: uint24, f: 0.01 },
  0x21: { n: "motion", t: uint8 },
  0x2c: { n: "vibration", t: uint8 },
  0x2d: { n: "window", t: uint8 },
  0x2e: { n: "humidity", t: uint8, u: "%" },
  0x3a: { n: "button", t: uint8 },
  0x3f: { n: "rotation", t: int16, f: 0.1 },
  0x40: { n: "distance_mm", t: uint16 },
  0x45: { n: "temperature", t: int16, f: 0.1, u: "tC" },
};

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  return 255;
}

const BTHomeDecoder = {
  utoi: function (num, bitsz) {
    const mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function (buffer) {
    return buffer.at(0);
  },
  getInt8: function (buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function (buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function (buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function (buffer) {
    return (
      0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0))
    );
  },
  getInt24LE: function (buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function (type, buffer) {
    if (buffer.length < getByteSize(type)) return null;
    let res = null;
    if (type === uint8) res = this.getUInt8(buffer);
    if (type === int8) res = this.getInt8(buffer);
    if (type === uint16) res = this.getUInt16LE(buffer);
    if (type === int16) res = this.getInt16LE(buffer);
    if (type === uint24) res = this.getUInt24LE(buffer);
    if (type === int24) res = this.getInt24LE(buffer);
    return res;
  },
  unpack: function (buffer) {
    if (typeof buffer !== "string" || buffer.length === 0) return null;

    let result = {};
    let dib = buffer.at(0);
    result.encryption = (dib & 0x1) ? true : false;
    result.BTHome_version = dib >> 5;

    if (result.BTHome_version !== 2) return null;
    if (result.encryption) return result;

    buffer = buffer.slice(1);

    while (buffer.length > 0) {
      let bth = BTH[buffer.at(0)];
      if (typeof bth === "undefined") {
        console.log("BTH: Unknown type");
        break;
      }

      buffer = buffer.slice(1);
      let value = this.getBufValue(bth.t, buffer);
      if (value === null) break;
      if (typeof bth.f !== "undefined") value = value * bth.f;

      if (typeof result[bth.n] === "undefined") {
        result[bth.n] = value;
      } else if (Array.isArray(result[bth.n])) {
        result[bth.n].push(value);
      } else {
        result[bth.n] = [result[bth.n], value];
      }

      buffer = buffer.slice(getByteSize(bth.t));
    }

    return result;
  },
};

// *********************** MQTT Helpers ***********************

function normalizeAddress(addr) {
  return String(addr || "").toLowerCase();
}

function isLowerAlphaNum(charCode) {
  return (
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57)
  );
}

function isLowerHex(charCode) {
  return (
    (charCode >= 97 && charCode <= 102) ||
    (charCode >= 48 && charCode <= 57)
  );
}

function sanitizeTopicSegment(value) {
  const text = String(value || "").toLowerCase();
  let result = "";
  let pendingHyphen = false;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);

    if (isLowerAlphaNum(charCode)) {
      if (pendingHyphen && result.length > 0) {
        result += "-";
      }
      result += text.charAt(i);
      pendingHyphen = false;
    } else {
      pendingHyphen = true;
    }
  }

  return result;
}

function trimTopicSlashes(value) {
  const text = String(value || "");
  let start = 0;
  let end = text.length;

  while (start < end && text.charAt(start) === "/") {
    start++;
  }

  while (end > start && text.charAt(end - 1) === "/") {
    end--;
  }

  return text.slice(start, end);
}

function getLeafName(key) {
  return LEAF_ALIASES[key] || sanitizeTopicSegment(key);
}

function buildNamespacedTopic(device, leaf) {
  return [
    getGatewayTopicPrefix(),
    sanitizeTopicSegment(CONFIG.customNamespace),
    sanitizeTopicSegment(device),
    sanitizeTopicSegment(leaf),
  ].join("/");
}

function buildRpcTopic() {
  return [
    getGatewayTopicPrefix(),
    "events",
    "rpc",
  ].join("/");
}

function getNotificationTs() {
  const sysStatus = Shelly.getComponentStatus("sys") || {};
  if (typeof sysStatus.unixtime === "number" && sysStatus.unixtime > 0) {
    return sysStatus.unixtime;
  }
  return 0;
}

function getMqttConfig() {
  return Shelly.getComponentConfig("mqtt") || Shelly.getComponentConfig("MQTT") || {};
}

function getCompactAddress(addr) {
  const text = normalizeAddress(addr);
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (isLowerHex(charCode)) {
      result += text.charAt(i);
    }
  }

  return result;
}

function getGatewayDeviceName() {
  const mqttConfig = getMqttConfig();

  if (typeof mqttConfig.topic_prefix === "string" && mqttConfig.topic_prefix.length > 0) {
    const topicPrefix = trimTopicSlashes(mqttConfig.topic_prefix);
    if (topicPrefix.length > 0) return topicPrefix;
  }

  const deviceInfo = Shelly.getDeviceInfo() || {};

  if (typeof deviceInfo.id === "string" && deviceInfo.id.length > 0) {
    return deviceInfo.id;
  }

  const mac = getCompactAddress(deviceInfo.mac);
  if (mac.length > 0) {
    return CONFIG.gatewayDevicePrefix + "-" + mac;
  }

  return CONFIG.gatewayDevicePrefix;
}

function getGatewayTopicPrefix() {
  const gateway = getGatewayDeviceName();

  if (gateway.length > 0) {
    return gateway;
  }

  return sanitizeTopicSegment(CONFIG.gatewayDevicePrefix);
}

function getInferredDeviceType(serviceData) {
  if (serviceData !== null && typeof serviceData === "object") {
    if (typeof serviceData.window !== "undefined") return "door-window";
    if (typeof serviceData.button !== "undefined") return "button";
    if (typeof serviceData.motion !== "undefined") return "motion";
    if (typeof serviceData.temperature !== "undefined" && typeof serviceData.humidity !== "undefined") {
      return "temperature-humidity";
    }
  }

  return "bluetooth-sensor";
}

function getDevicePrefix(deviceType) {
  if (deviceType === "door-window") return "shellybludw";
  if (deviceType === "button") return "shellyblubutton1";
  if (deviceType === "motion") return "shellyblumotion";
  if (deviceType === "temperature-humidity") return "shellybluht";
  return "";
}

function getDeviceIdentity(addr, serviceData) {
  const compactAddr = getCompactAddress(addr);
  let deviceType = getInferredDeviceType(serviceData);

  if (deviceType === "bluetooth-sensor" && KNOWN_DEVICE_TYPES[compactAddr]) {
    deviceType = KNOWN_DEVICE_TYPES[compactAddr];
  } else if (deviceType !== "bluetooth-sensor" && compactAddr.length > 0) {
    KNOWN_DEVICE_TYPES[compactAddr] = deviceType;
  }

  const devicePrefix = getDevicePrefix(deviceType);

  return {
    device: compactAddr.length > 0 && devicePrefix.length > 0 ? devicePrefix + "-" + compactAddr : "",
    device_type: deviceType,
    supported: devicePrefix.length > 0,
  };
}

function classifyKey(key) {
  if (EVENT_KEYS[key]) return "event";
  if (MEASUREMENT_KEYS[key]) return "measurement";
  if (STATE_KEYS[key]) return "state";
  return "state";
}

function getRetainForKind(kind) {
  if (kind === "event") return false;
  if (kind === "state") return CONFIG.retainState;
  return CONFIG.retainMeasurements;
}

function mqttPublish(topic, payload, retain) {
  if (!MQTT.isConnected()) {
    console.log("MQTT: not connected, dropping " + topic);
    return false;
  }

  return MQTT.publish(topic, payload, CONFIG.qos, retain);
}

function isMqttConfigured() {
  const mqttConfig = getMqttConfig();
  return mqttConfig.enable === true;
}

function publishRpcNotification(method, params) {
  const gateway = getGatewayTopicPrefix();
  const frame = {
    src: gateway,
    dst: gateway + "/events",
    method: method,
    params: params,
  };
  mqttPublish(buildRpcTopic(), JSON.stringify(frame), false);
}

function publishRawEvent(addr, rssi, localName, serviceData) {
  if (!CONFIG.publishRawEvents) return;

  const payload = {
    source: "ble",
    addr: normalizeAddress(addr),
    rssi: rssi,
    local_name: localName || "",
    service_data: serviceData,
  };

  if (CONFIG.topicMode === "rpc") {
    publishRpcNotification("NotifyEvent", {
      ts: getNotificationTs(),
      events: [{
        component: "blu",
        event: "scan_result",
        ts: getNotificationTs(),
        data: payload,
      }],
    });
    return;
  }

  mqttPublish(
    buildNamespacedTopic(CONFIG.gatewayEventDevice, "event"),
    JSON.stringify(payload),
    false
  );
}

function buildStatePayload(addr, rssi, localName, serviceData) {
  let state = {
    addr: normalizeAddress(addr),
    rssi: rssi,
    local_name: localName || "",
  };

  for (let key in serviceData) {
    if (!METADATA_KEYS[key]) {
      state[key] = serviceData[key];
    }
  }

  return state;
}

function publishState(identity, addr, rssi, localName, serviceData) {
  const state = buildStatePayload(addr, rssi, localName, serviceData);
  state.device_type = identity.device_type;

  if (CONFIG.topicMode === "rpc") {
    let params = {
      ts: getNotificationTs(),
      blu: {},
    };
    params.blu[identity.device] = state;
    publishRpcNotification("NotifyStatus", params);
    return;
  }

  mqttPublish(
    buildNamespacedTopic(identity.device, "state"),
    JSON.stringify(state),
    CONFIG.retainState
  );
}

function publishEvents(identity, serviceData) {
  if (CONFIG.topicMode !== "rpc") return;

  let events = [];

  for (let key in EVENT_KEYS) {
    if (typeof serviceData[key] === "undefined") continue;
    let data = {
      device: identity.device,
      value: serviceData[key],
    };

    if (key === "button") {
      data.event = BUTTON_EVENTS[serviceData[key]] || "unknown";
    }

    events.push({
      component: "blu",
      event: getLeafName(key),
      ts: getNotificationTs(),
      data: data,
    });
  }

  if (events.length === 0) return;

  publishRpcNotification("NotifyEvent", {
    ts: getNotificationTs(),
    events: events,
  });
}

function publishLeaves(identity, rssi, serviceData) {
  if (CONFIG.topicMode === "rpc") return;

  let values = { rssi: rssi };

  for (let key in serviceData) {
    if (!METADATA_KEYS[key]) {
      values[key] = serviceData[key];
    }
  }

  for (let key in values) {
    const kind = classifyKey(key);
    const retain = getRetainForKind(kind);
    const topic = buildNamespacedTopic(identity.device, getLeafName(key));

    mqttPublish(topic, JSON.stringify(values[key]), retain);
  }
}

// *********************** Main Methods ***********************

const BTHOME_SVC_ID_STR = "fcd2";

const SCAN_OPTION = {
  duration_ms: BLE.Scanner.INFINITE_SCAN,
  active: false,
};

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  if (typeof res.addr === "undefined") return;
  if (typeof res.service_data === "undefined") return;
  if (typeof res.service_data[BTHOME_SVC_ID_STR] === "undefined") return;

  try {
    const addr = normalizeAddress(res.addr);
    const decoded = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]);

    if (decoded === null) return;

    publishRawEvent(addr, res.rssi, res.local_name, decoded);
    if (decoded.encryption) return;

    const identity = getDeviceIdentity(addr, decoded);
    if (!identity.supported) return;

    publishState(identity, addr, res.rssi, res.local_name, decoded);
    publishEvents(identity, decoded);
    publishLeaves(identity, res.rssi, decoded);
  } catch (err) {
    console.log(err);
  }
}

function init() {
  const BLEConfig = Shelly.getComponentConfig("ble") || {};

  if (!BLEConfig.enable) {
    console.log("Error: Bluetooth is not enabled. Enable it from Shelly settings.");
    return;
  }

  if (!isMqttConfigured()) {
    console.log("Error: MQTT is not enabled. Enable it from Shelly settings.");
    return;
  }

  if (!MQTT.isConnected()) {
    console.log("Info: MQTT is enabled but not connected yet. BLE updates will publish after MQTT connects.");
  }

  if (BLE.Scanner.isRunning()) {
    console.log("Info: BLE scanner is already running.");
  } else if (!BLE.Scanner.Start(SCAN_OPTION)) {
    console.log("Error: Can not start BLE scanner.");
    return;
  }

  BLE.Scanner.Subscribe(scanCB);
  console.log("Info: Standard BLU to MQTT script started.");
}

init();
