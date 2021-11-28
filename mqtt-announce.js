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
// with Gen1 MQTT topics shellies/announce and shellies/command

let deviceInfo = null;

Shelly.call(
  "Shelly.GetDeviceInfo",
  {},
  function (result, error_code, error_message) {
    if (error_code) return;
    deviceInfo = result;
  }
);

MQTT.subscribe(
  "shellies/command",
  function (topic, message, ud) {
    if (deviceInfo === null) return;
    if (message === "announce") {
      MQTT.publish("shellies/announce", JSON.stringify(deviceInfo), 0, false);
    }
    print(message);
  },
  null
);
