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

// Shelly 1 Plus MQTT Auto Discovery in Home Assistant/Domoticz + Gen1 MQTT paths
//
// This script is registering a virtual switch device for the relay, a binary_sensor for button
// and a sensor Temperature default with 30 sec update
//
// shellies/<model>-<deviceid>/relay/0 to report status: on, off
// shellies/<model>-<deviceid>/relay/0/command accepts on, off and applies accordingly
// shellies/<model>-<deviceid>/input/0 reports the state of the SW terminal
// shellies/<model>-<deviceid>/temperature reports internal device temperature in °C
// 
// MQTT configuration.yaml contains this section:
// mqtt:
//   broker: 127.0.0.1
//   discovery: true
//   discovery_prefix: homeassistant
//
// Cheers from https://bitekmindenhol.blog.hu/

let CONFIG = {
  shelly_id: null,
  shelly_mac: null,
  shelly_fw_id: null,
  shelly_model: null,
  ha_mqtt_ad: "homeassistant",
  device_name: "VIRTUAL_SWITCH",
  payloads: {
    on: "on",
    off: "off"
  },
  update_period: 30000
};
;
Shelly.call(
  "Shelly.GetDeviceInfo",
  {},
  function (result) {
    CONFIG.shelly_id = result.id;
    CONFIG.shelly_mac = result.mac;
    CONFIG.shelly_fw_id = result.fw_id;
    CONFIG.device_name = result.name || result.id;
    CONFIG.shelly_model = result.model;
    initMQTT();
  }
)

function buildMQTTConfigTopic(hatype, devname) {
  return CONFIG.ha_mqtt_ad + "/" + hatype + "/" + CONFIG.shelly_id + "-" + devname + "/config";
}

function buildMQTTStateCmdTopics(hatype, topic) {
  let _t = topic || "";
  if (_t.length) {
    _t = "/" + _t
  }
  return "shellies/" + CONFIG.shelly_id + "/" + hatype + _t;
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

Shelly.addStatusHandler(function (notification) {
  if (typeof notification.delta.output === "undefined") return;
  let _state_str = notification.delta.output ? "on" : "off";  
  if (notification.component === "switch:0"){
   MQTT.publish(buildMQTTStateCmdTopics("relay/0"), _state_str);
  }
  if (notification.component === "input:0"){
   MQTT.publish(buildMQTTStateCmdTopics("input/0"), _state_str);
  }  
});

function publishState() {
  Shelly.call("Switch.GetStatus", { id: 0 }, function (result) {
    let _temp = JSON.stringify(result.temperature.tC);
    MQTT.publish(buildMQTTStateCmdTopics("temperature"), _temp);
  });
};

/**
 * Activate periodic updates
 */
if(CONFIG.update_period > 0) Timer.set(CONFIG.update_period, true, publishState);

function initMQTT() {
  MQTT.subscribe(buildMQTTStateCmdTopics("relay/0", "command"), MQTTCmdListener);
  let _devname = "relay-0";
  MQTT.publish(
    buildMQTTConfigTopic("switch",_devname),
    JSON.stringify({
      name: CONFIG.device_name+"-"+_devname,
      "device": {
        "name": CONFIG.device_name+"-"+_devname,
        "ids": CONFIG.shelly_id+"-"+_devname,
        "mdl": CONFIG.shelly_model,
        "mf": "Allterco",
        "sw_version": CONFIG.shelly_fw_id
      },
      "unique_id": CONFIG.shelly_mac + "-"+ _devname,
      "pl_on": CONFIG.payloads.on,
      "pl_off": CONFIG.payloads.off,
      "cmd_t": "~/command",
      "stat_t": "~",
      "~": buildMQTTStateCmdTopics("relay/0")
    }),
    0,
    true
  );
  _devname = "input-0";
  MQTT.publish(
    buildMQTTConfigTopic("binary_sensor",_devname),
    JSON.stringify({
      name: CONFIG.device_name+"-"+_devname,
      "device": {
        "name": CONFIG.device_name+"-"+_devname,
        "ids": CONFIG.shelly_id+"-"+_devname,
        "mdl": CONFIG.shelly_model,
        "mf": "Allterco",
        "sw_version": CONFIG.shelly_fw_id
      },
      "unique_id": CONFIG.shelly_mac + "-"+ _devname,
      "pl_on": CONFIG.payloads.on,
      "pl_off": CONFIG.payloads.off,
      "stat_t": "~",
      "~": buildMQTTStateCmdTopics("input/0")
    }),
    0,
    true
  );  
  _devname = "temperature";
  MQTT.publish(
    buildMQTTConfigTopic("sensor",_devname),
    JSON.stringify({
      name: CONFIG.device_name+"-"+_devname,
      "device": {
        "name": CONFIG.device_name+"-"+_devname,
        "ids": CONFIG.shelly_id+"-"+_devname,
        "mdl": CONFIG.shelly_model,
        "mf": "Allterco",
        "sw_version": CONFIG.shelly_fw_id
      },
      "unique_id": CONFIG.shelly_mac + "-"+ _devname,
      "unit_of_measurement": "°C",
      "device_class": "temperature",
      "val_tpl":"",
      "stat_t": "~",
      "~": buildMQTTStateCmdTopics(_devname)
    }),
    0,
    true
  );    
}
