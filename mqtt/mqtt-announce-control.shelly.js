/**
 * @title Backward compatibility with Gen1 MQTT format (extended)
 * @description Use MQTT in scripting to provide backwards compatibility with Gen1
 *   MQTT topics shellies/announce, shellies/command, <device-id>/command,
 *   /command/switch:0/output. Publish device status, input and switch
 *   status
 */

// Copyright 2021 Allterco Robotics EOOD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Shelly is a Trademark of Allterco Robotics

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
