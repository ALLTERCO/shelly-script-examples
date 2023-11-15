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

// Shelly Script example: IP Assignment Watchdog
//
// This script monitors if the Shelly devices has a valid IP assignment from the DHCP of the router,
// and if there is no valid IP for a few minutes - reboots the Shelly device. This is useful in scenarios
// where the router's configuration has changed or the router was restarted, but the Shelly devices
// keeps hanging on to the old connection for some reason. In essence, this is am automated
// self-healing mechanism in case you have installed many Shelly devices in hard to reach places,
// and you've disabled their Wireless Access Point for security reasons. Basically, during such scenarios,
// you are locked out of the Shelly device's admin panel and can't connect to its AP because it's disabled
// and you can't visit it's local IP, because it couldn't acquire an IP from the router. A simple restart
// solves the problem in 99% of the cases.

let CONFIG = {
  // number of failures before triggering a Restart
  numberOfFails: 5, // 5 minutes
  // time in seconds between retries
  retryIntervalSeconds: 60,
};

let failCounter = 0;
let pingTimer = null;

function checkForWifi() {
  Shelly.call("WiFi.GetStatus",{}, function (response) {
    const isConnected = response.status==='got ip';
    
    // Connection is now established OR was never broken
    // Reset counter and start over
    if(isConnected){
      console.log(Date.now(), 'WiFi works correctly. Resetting counter to 0')
      failCounter = 0;
      return;
    }
    
    // If not connected, increment counter of failures
    failCounter++;
    
    if(failCounter < CONFIG.numberOfFails){
      const remainingAttemptsBeforeRestart = CONFIG.numberOfFails-failCounter;
      console.log(Date.now(), 'WiFi healthcheck failed ', failCounter, ' out of ', CONFIG.numberOfFails, ' times')
      return;
    }

    console.log(Date.now(), 'WiFi healthcheck failed all attempts. Restarting device...')
    Shelly.call('Shelly.Reboot')
  });
}

print(Date.now(), "Start WiFi monitor");

pingTimer = Timer.set(CONFIG.retryIntervalSeconds * 1000, true, checkForWifi);

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

  Timer.clear(pingTimer);
    
  // start the loop to ping the endpoints again
  pingTimer = Timer.set(CONFIG.retryIntervalSeconds * 1000, true, checkForWifi);
});
