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
  numberOfFails: 3,         // failures before reset
  httpTimeout: 10,          // seconds before request timeout
  toggleTime: 30,           // seconds to keep relay off
  pingTime: 60,            // seconds between connectivity checks
  maxBackoffTime: 14400,    // max backoff (4 hours)
  initialBackoffTime: 300,  // initial backoff (5 minutes)
  backoffMultiplier: 2,     // backoff multiplier
};

let endpointIdx = 0;
let failCounter = 0;
let pingTimer = null;
let resetCounter = 0;
let currentBackoffTime = 0;

/**
 * Reset router with exponential backoff for persistent failures
 */
function resetRouter() {
  print("Too many fails, resetting...");
  failCounter = 0;
  resetCounter++;
  Timer.clear(pingTimer);
  
  // Apply backoff after first reset
  if (resetCounter > 1) {
    if (currentBackoffTime === 0) {
      currentBackoffTime = CONFIG.initialBackoffTime;
    } else {
      // Increase backoff time exponentially with cap
      currentBackoffTime = currentBackoffTime * CONFIG.backoffMultiplier;
      if (currentBackoffTime > CONFIG.maxBackoffTime) {
        currentBackoffTime = CONFIG.maxBackoffTime;
      }
    }
    print("Backoff active: " + currentBackoffTime + " seconds before next check");
  }
  
  // Turn off switch and toggle back after delay
  Shelly.call(
    "Switch.Set",
    { id: 0, on: false, toggle_after: CONFIG.toggleTime },
    function () {}
  );
}

/**
 * Start timer for connectivity checks
 */
function startPingTimer() {
  pingTimer = Timer.set(CONFIG.pingTime * 1000, true, pingEndpoints);
}

function pingEndpoints() {
  Shelly.call(
    "http.get",
    { url: CONFIG.endpoints[endpointIdx], timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      //http timeout, magic number, not yet documented
      if (error_code === -114 || error_code === -104) {
        print("Failed to fetch ", CONFIG.endpoints[endpointIdx]);
        failCounter++;
        print("Number of fails:", failCounter);
        print("Checking next endpoint...");
        endpointIdx++;
        endpointIdx = endpointIdx % CONFIG.endpoints.length;
      } else {
        print("We are online :)");
        failCounter = 0;
        // Reset backoff on successful connection
        resetCounter = 0;
        currentBackoffTime = 0;
      }

      if (failCounter >= CONFIG.numberOfFails) {
        resetRouter();
        return;
      }
    }
  );
}

print("Starting watchdog timer...");
startPingTimer();

// Handle router restart completion
Shelly.addStatusHandler(function (status) {
  // Only process switch events from timer for our switch
  if (status.name !== "switch" || 
      status.id !== 0 || 
      typeof status.delta.source === "undefined" || 
      status.delta.source !== "timer" || 
      status.delta.output !== true) return;
  
  // Apply backoff if needed or restart immediately
  if (currentBackoffTime > 0) {
    print("Applying backoff: " + currentBackoffTime + " seconds");
    Timer.set(currentBackoffTime * 1000, false, function() {
      print("Backoff complete, resuming checks");
      startPingTimer();
    });
  } else {
    startPingTimer();
  }
});
