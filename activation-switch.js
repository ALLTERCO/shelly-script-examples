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

// Shelly Script example: Replicate activation_switch profile
// Gen1 behavior replicated with scripting

let CONFIG = {
  toggleTimeout: 5,
  inputId: 0,
  switchId: 0,
};

Shelly.call("Switch.SetConfig", {
  id: CONFIG.switchId,
  config: {
    in_mode: "detached",
  },
});

Shelly.addEventHandler(function (event) {
  if (typeof event.info.event === "undefined") return;
  if (event.info.component === "input:" + JSON.stringify(CONFIG.inputId)) {
    //ignore single_push and double_push events
    if(event.info.event.indexOf("push")>=0) return;
    let swParams = {
      id: CONFIG.switchId,
      on: true
    };
    if (event.info.event === "btn_up") {
      swParams.toggle_after = CONFIG.toggleTimeout;
    }
    Shelly.call("Switch.Set", swParams);
  }
});
