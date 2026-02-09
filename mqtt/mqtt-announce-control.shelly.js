/**
 * @title Backward compatibility with Gen1 MQTT format (extended)
 * @description Use MQTT in scripting to provide backwards compatibility with Gen1
 *   MQTT topics shellies/announce, shellies/command, <device-id>/command,
 *   /command/switch:0/output. Publish device status, input and switch
 *   status
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/mqtt/mqtt-announce-control.shelly.js
 */

// Shelly Script example: Use MQTT in scripting to provide backwards compatibility
// with Gen1 MQTT topics shellies/announce, shellies/command, <device-id>/command,
// /command/switch:0/output
// Publish device status, input and switch status

const deviceInfo = Shelly.getDeviceInfo();
const wifiStatus = Shelly.getComponentStatus("Wifi"); // Get wifi status
const mqttConfig = Shelly.getComponentConfig("MQTT"); // Get mqtt config
const CONFIG = {
  device_id: deviceInfo.id,
  device_mac: deviceInfo.mac,
  device_model: deviceInfo.model,
  fw_ver: deviceInfo.fw_id,
  topic_prefix: mqttConfig.topic_prefix,
  wifi_ip: wifiStatus.sta_ip,
};

function isConfigReady() {
  for (let key in CONFIG) {
    if (CONFIG[key] === "") return false;
  }
  return true;
}

//Monitor ip changes
Shelly.addStatusHandler(function (status) {
  if (status.component === "wifi" && status.delta.status === "got ip") {
    CONFIG.wifi_ip = status.delta.sta_ip;
  }
});

//Subscribe and announce changes
function announce() {
  MQTT.publish(CONFIG.topic_prefix + "/status", JSON.stringify(CONFIG));
  const inputStatus = Shelly.getComponentStatus("Input:0");
  const switchStatus = Shelly.getComponentStatus("Switch:0");

  MQTT.publish(CONFIG.topic_prefix + "/input:0", JSON.stringify(inputStatus));
  MQTT.publish(CONFIG.topic_prefix + "/switch:0", JSON.stringify(switchStatus));
}

function announceHandler(topic, message) {
  if (message !== "announce") return;
  announce();
}

function switchControlHandler(topic, message) {
  if (message !== "on" && message !== "off") return;
  Shelly.call("Switch.Set", { id: 0, on: message === "on" });
}

function subscribeToTopics() {
  MQTT.subscribe("shellies/command", announceHandler);
  MQTT.subscribe(CONFIG.topic_prefix + "/command", announceHandler);
  MQTT.subscribe(
    CONFIG.topic_prefix + "/command/switch:0/output",
    switchControlHandler
  );
}

//Start a timer that checks if all fields in CONFIG are populated
let configReadyTimer;
function connectToMQTT() {
  configReadyTimer = Timer.set(1000, true, function () {
    if (!isConfigReady()) return;
    if (!MQTT.isConnected()) return;

    subscribeToTopics();
    Timer.clear(configReadyTimer);
  });
}

connectToMQTT();

MQTT.setDisconnectHandler(function () {
  connectToMQTT();
});
