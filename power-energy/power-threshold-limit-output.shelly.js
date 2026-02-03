/**
 * @title Power threshold load shedding
 * @description Turns off configured channels when total power consumption exceeds a threshold.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/power-threshold-limit-output.shelly.js
 */

// Shelly Script example: Shelly Pro 4PM - If total power consumption goes above certain
// value turn off some channels
let CONFIG = {
  // channels to turn off
  load_shed_channels: [0,2],
  // power threshold
  maximum_total_power: 1000
};

// accumulator
let current_power = [0,0,0,0];

function calcTotalPower() {
  let _power = 0;
  let idx = 0;
  for(idx in current_power) {
    _power += current_power[idx];
  }
  return _power;
}

// turn off the channels configured
function shedLoad() {
  let idx = 0;
  for(idx in CONFIG.load_shed_channels) {
    console.log("Turning off channel ", CONFIG.load_shed_channels[idx]);
    Shelly.call("Switch.Set", {id:CONFIG.load_shed_channels[idx], on:false});
  }
}

// monitor status notifications, cull the ones not related to switch and power changes
// accumulate and calculate the total sum, decide if the overpower has occurred and stop channels
function _status_handler(status_ntf) {
  if(status_ntf.component.indexOf("switch") !== 0) return;
  if(typeof status_ntf.delta.apower === "undefined") return;

  current_power[status_ntf.id] = status_ntf.delta.apower;
  if(calcTotalPower() > CONFIG.maximum_total_power) {
    console.log("Overpower, will shed load...");
    shedLoad();
  }
}

Shelly.addStatusHandler(_status_handler);
