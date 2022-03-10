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
// Switch sensors are also registered as entities
// Reference:
// https://www.home-assistant.io/docs/mqtt/discovery/
//
// MQTT configuration.yaml contains this section:
// mqtt:
//   broker: 127.0.0.1
//   discovery: true
//   discovery_prefix: garage_homeassistant

/**
 * @typedef {"switch" | "binary_sensor" | "sensor"} HADeviceType
 * @typedef {"config"|"stat"|"cmd"} HATopicType
 */

let CONFIG = {
  shelly_id: null,
  shelly_mac: null,
  shelly_fw_id: null,
  device_name: "VIRTUAL_SWITCH_SENSORS",
  ha_mqtt_ad: "garage_homeassistant",
  ha_dev_type: {
    name: "",
    ids: [""],
    mdl: "Shelly-virtual-sensors",
    sw: "",
    mf: "Allterco",
  },
  payloads: {
    on: "on",
    off: "off",
  },
  update_period: 2500,
};

Shelly.call("Shelly.GetDeviceInfo", {}, function (result) {
  CONFIG.shelly_id = result.id;
  CONFIG.shelly_mac = result.mac;
  CONFIG.shelly_fw_id = result.fw_id;
  CONFIG.device_name = result.name || CONFIG.device_name;
  CONFIG.ha_dev_type.name = CONFIG.shelly_id;
  CONFIG.ha_dev_type.ids[0] = CONFIG.shelly_id;
  CONFIG.ha_dev_type.sw = CONFIG.shelly_fw_id;
  initMQTT();
});

/**
 * Construct config topic
 * @param   {HADeviceType}  hatype HA device type
 * @param   {string}        object_id
 * @returns {string}        topic - ha_mqtt_auto_discovery_prefix/device_type/device_id/config
 */
function buildMQTTConfigTopic(hatype, object_id) {
  return (
    CONFIG.ha_mqtt_ad +
    "/" +
    hatype +
    "/" +
    CONFIG.shelly_id +
    "/" +
    object_id +
    "/config"
  );
}

/**
 * @param   {HADeviceType}   hatype HA device type
 * @param   {HATopicType}    topic HA topic
 * @returns {string}         topic string
 */
function buildMQTTStateCmdTopics(hatype, topic) {
  let _t = topic || "";
  if (_t.length) {
    _t = "/" + _t;
  }
  return CONFIG.shelly_id + "/" + hatype + _t;
}

/**
 * Control device switch
 * @param {boolean} sw_state
 */
function switchActivate(sw_state) {
  Shelly.call("Switch.Set", {
    id: 0,
    on: sw_state,
  });
}

/**
 * Listen to ~/cmd topic for switch conrol
 * @param {string} topic
 * @param {string} message
 */
function MQTTCmdListener(topic, message) {
  let _sw_state = message === "on" ? true : false;
  switchActivate(_sw_state);
}

/**
 * Publish update on switch change
 */
Shelly.addEventHandler(function (ev_data) {
  if (
    ev_data.component === "switch:0" &&
    typeof ev_data.info.output !== "undefined"
  ) {
    let _state_str = ev_data.info.output ? "on" : "off";
    MQTT.publish(buildMQTTStateCmdTopics("switch", "state"), _state_str);
  }
});

function publishState() {
  Shelly.call("Switch.GetStatus", { id: 0 }, function (result) {
    let _sensor = {
      temp: 0,
      current: 0,
      voltage: 0,
    };
    _sensor.temp = result.temperature.tC;
    _sensor.current = result.current;
    _sensor.voltage = result.voltage;
    _sensor.state = result.output;
    MQTT.publish(
      buildMQTTStateCmdTopics("sensor", "state"),
      JSON.stringify(_sensor)
    );
    let _state_str = _sensor.state ? "on" : "off";
    MQTT.publish(buildMQTTStateCmdTopics("switch", "state"), _state_str);
  });
}

/**
 * Activate periodic updates
 */
if(CONFIG.update_period > 0) Timer.set(CONFIG.update_period, true, publishState);

/**
 * Initialize listeners and configure switch and sensors entries
 */
function initMQTT() {
  MQTT.subscribe(buildMQTTStateCmdTopics("switch", "cmd"), MQTTCmdListener);
  /**
   * Configure the switch
   */
  MQTT.publish(
    buildMQTTConfigTopic("switch", "switch"),
    JSON.stringify({
      dev: CONFIG.ha_dev_type,
      "~": buildMQTTStateCmdTopics("switch"),
      cmd_t: "~/cmd",
      stat_t: "~/state",
      pl_on: CONFIG.payloads.on,
      pl_off: CONFIG.payloads.off,
      name: CONFIG.device_name + "_SW",
      uniq_id: CONFIG.shelly_mac + ":" + CONFIG.device_name + "_SW",
    }),
    0,
    true
  );
  /**
   * Configure temperature, current and voltage sensors
   */
  let sensorStateTopic = buildMQTTStateCmdTopics("sensor", "state");
  MQTT.publish(
    buildMQTTConfigTopic("sensor", "temperature"),
    JSON.stringify({
      dev: CONFIG.ha_dev_type,
      "~": sensorStateTopic,
      stat_t: "~",
      val_tpl: "{{ value_json.temp }}",
      name: CONFIG.device_name + "_T",
      uniq_id: CONFIG.shelly_mac + ":" + CONFIG.device_name + "_T",
    }),
    0,
    true
  );
  MQTT.publish(
    buildMQTTConfigTopic("sensor", "current"),
    JSON.stringify({
      dev: CONFIG.ha_dev_type,
      "~": sensorStateTopic,
      stat_t: "~",
      val_tpl: "{{ value_json.current }}",
      name: CONFIG.device_name + "_A",
      uniq_id: CONFIG.shelly_mac + ":" + CONFIG.device_name + "_A",
    }),
    0,
    true
  );
  MQTT.publish(
    buildMQTTConfigTopic("sensor", "voltage"),
    JSON.stringify({
      dev: CONFIG.ha_dev_type,
      "~": sensorStateTopic,
      stat_t: "~",
      val_tpl: "{{ value_json.voltage }}",
      name: CONFIG.device_name + "_V",
      uniq_id: CONFIG.shelly_mac + ":" + CONFIG.device_name + "_V",
    }),
    0,
    true
  );
}
