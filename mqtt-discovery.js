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

// Shelly Script example: MQTT Auto Discovery in Home Assistant
//
// This script is registering a virtual switch device in HA
// The implementation is banal and directly reports switch state and controls a switch
// but you can have a totally different virtual device: valve, light, scene
// Reference:
// https://www.home-assistant.io/docs/mqtt/discovery/
// 
// MQTT configuration.yaml contains this section:
// mqtt:
//   broker: 127.0.0.1
//   discovery: true
//   discovery_prefix: garage_homeassistant


/**
 * @typedef {"switch" | "binary_sensor"} HADeviceType
 * @typedef {"config"|"stat"|"cmd"} HATopicType
 */

let CONFIG = {
  shelly_id: null,
  shelly_mac: null,
  shelly_fw_id: null,
  ha_mqtt_ad: "garage_homeassistant",
  device_name: "VIRTUAL_SWITCH",
  payloads: {
    on: "on",
    off: "off"
  }
};

Shelly.call(
  "Shelly.GetDeviceInfo",
  {},
  function (result) {
    CONFIG.shelly_id = result.id;
    CONFIG.shelly_mac = result.mac;
    CONFIG.shelly_fw_id = result.fw_id;
    initMQTT();
  }
)

/**
 * @param   {HADeviceType}   hatype HA device type
 * @returns {string} topic - ha_mqtt_auto_discovery_prefix/device_type/device_id/config
 */
function buildMQTTConfigTopic(hatype) {
  return CONFIG.ha_mqtt_ad + "/" + hatype + "/" + CONFIG.shelly_id + "/config";
}

/**
 * @param   {HADeviceType}   hatype HA device type
 * @param   {HATopicType}    topic HA topic 
 * @returns {string}
 */
function buildMQTTStateCmdTopics(hatype, topic) {
  let _t = topic || "";
  if (_t.length) {
    _t = "/" + _t
  }
  return CONFIG.shelly_id + "/" + hatype + _t;
}

/**
 * @param {boolean} sw_state 
 */
function switchActivate(sw_state) {
  Shelly.call(
    "Switch.Set",
    {
      id: 0,
      on: sw_state
    }
  );
}

/**
 * @param {string} topic 
 * @param {string} message 
 */
function MQTTCmdListener(topic, message) {
  let _sw_state = message === "on" ? true : false;
  switchActivate(_sw_state);
}

Shelly.addEventHandler(function (ev_data) {
  if (ev_data.component === "switch:0" && typeof ev_data.info.output !== "undefined") {
    let _state_str = ev_data.info.output ? "on" : "off";
    MQTT.publish(buildMQTTStateCmdTopics("switch", "state"), _state_str);
  }
})

function initMQTT() {
  MQTT.subscribe(buildMQTTStateCmdTopics("switch", "cmd"), MQTTCmdListener);
  MQTT.publish(
    buildMQTTConfigTopic("switch"),
    JSON.stringify({
      name: CONFIG.device_name,
      "device": {
        "name": CONFIG.device_name,
        "ids": [CONFIG.device_name],
        "mdl": "virtual-Shelly",
        "mf": "Allterco",
        "sw_version": CONFIG.shelly_fw_id
      },
      "unique_id": CONFIG.shelly_mac + ":" + CONFIG.device_name,
      "pl_on": CONFIG.payloads.on,
      "pl_off": CONFIG.payloads.off,
      "cmd_t": "~/cmd",
      "stat_t": "~/state",
      "~": buildMQTTStateCmdTopics("switch")
    }),
    0,
    true
  )
}