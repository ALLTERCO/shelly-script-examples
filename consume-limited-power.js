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

// Shelly Script example: Shelly Plus 1PM - Stop the output after consuming
// certain amount of power
//
// This script listens for the event when the output is turned on, and starts
// counting the power reported in NotifyStatus every minute It is accumulated in
// a counter and if the combined consumption is over a threshold the output is
// turned off

let startMonitor = false;
let eAccumulator = 0;
let maxEnergy = 120; //threshold, in milliwatthours
Shelly.addEventHandler(function (event, user_data) {
  if (typeof event.info.output !== "undefined") {
    if (event.info.output) {
      startMonitor = true;
      eAccumulator = 0;
    } else {
      startMonitor = false;
    }
  }
}, null);

Shelly.addStatusHandler(function (event, user_data) {
  print(JSON.stringify(event));
  if (typeof event.delta.aenergy !== "undefined") {
    if (startMonitor) {
      eAccumulator = eAccumulator + event.delta.aenergy.by_minute[0];
      if (eAccumulator > maxEnergy) {
        print("Will turn off because of power consumed");
        Shelly.call(
          "switch.set",
          { id: 0, on: false },
          function (result, code, msg, ud) {},
          null
        );
      }
    }
  }
}, null);
