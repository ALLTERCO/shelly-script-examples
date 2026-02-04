/**
 * @title Shelly Plus 1PM - Stop the output after consuming certain amount of power
 * @description This script listens for the event when the output is turned on, and
 *   starts counting the power reported in NotifyStatus every minute. It is
 *   accumulated in a counter and if the combined consumption is over a
 *   threshold the output is turned off.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/consume-limited-power.shelly.js
 */

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
  if (typeof event.info.state !== "undefined") {
    if (event.info.state) {
      startMonitor = true;
      eAccumulator = 0;
    } 
    else {
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
