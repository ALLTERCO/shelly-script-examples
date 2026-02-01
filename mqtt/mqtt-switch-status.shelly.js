/**
 * @title Send Switch status to a custom MQTT topic
 * @description Use MQTT in scripting to provide switch status updates on a custom
 *   topic
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

// Shelly Script example: Use MQTT in scripting to provide switch status updates on a custom topic

let CONFIG = {
  switchId: 0,
  MQTTPublishTopic: "v1/devices/me/telemetry",
};

// until 0.10.0 event and notifications were emitted by switch
// after that only notification is emitted
Shelly.addStatusHandler(function (notification) {
  if (notification.component !== "switch:" + JSON.stringify(CONFIG.switchId))
    return;
  if (typeof notification.delta.output === "undefined") return;
  MQTTAnnounceSwitch(notification.delta.output);
});

function MQTTAnnounceSwitch(status) {
  let announceObj = {
    SWITCH: status ? "ON" : "OFF",
  };
  MQTT.publish(CONFIG.MQTTPublishTopic, JSON.stringify(announceObj), 0, false);
}
