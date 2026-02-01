/**
 * @title Router Watchdog
 * @description This script tries to execute HTTP GET requests within a set time,
 *   against a set of endpoints. After certain number of failures the
 *   script sets the Switch off and after some time turns it back on.
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

// Shelly Script example: Router Watchdog
//
// This script tries to execute HTTP GET requests within a set time, against a set of endpoints
// After certain number of failures the script sets the Switch off and after some time
// turns it back on

let CONFIG = {
  endpoints: [
    "https://global.gcping.com/ping",
    "https://us-central1-5tkroniexa-uc.a.run.app/ping",
  ],
  //number of failures that trigger the reset
  numberOfFails: 3,
  //time in seconds after which the http request is considered failed
  httpTimeout: 10,
  //time in seconds for the relay to be off
  toggleTime: 30,
  //time in seconds to retry a "ping"
  pingTime: 60,
};

let endpointIdx = 0;
let failCounter = 0;
let pingTimer = null;

function pingEndpoints() {
  Shelly.call(
    "http.get",
    { url: CONFIG.endpoints[endpointIdx], timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      //http timeout, magic number, not yet documented
      if (error_code === -114 || error_code === -104) {
        print("Failed to fetch ", CONFIG.endpoints[endpointIdx]);
        failCounter++;
        print("Rotating through endpoints");
        endpointIdx++;
        endpointIdx = endpointIdx % CONFIG.endpoints.length;
      } else {
        failCounter = 0;
      }

      if (failCounter >= CONFIG.numberOfFails) {
        print("Too many fails, resetting...");
        failCounter = 0;
        Timer.clear(pingTimer);
        //set the output with toggling back
        Shelly.call(
          "Switch.Set",
          { id: 0, on: false, toggle_after: CONFIG.toggleTime },
          function () {}
        );
        return;
      }
    }
  );
}

print("Start watchdog timer");
pingTimer = Timer.set(CONFIG.pingTime * 1000, true, pingEndpoints);

Shelly.addStatusHandler(function (status) {
  //is the component a switch
  if(status.name !== "switch") return;
  //is it the one with id 0
  if(status.id !== 0) return;
  //does it have a delta.source property
  if(typeof status.delta.source === "undefined") return;
  //is the source a timer
  if(status.delta.source !== "timer") return;
  //is it turned on
  if(status.delta.output !== true) return;
  //start the loop to ping the endpoints again
  pingTimer = Timer.set(CONFIG.pingTime * 1000, true, pingEndpoints);
});
