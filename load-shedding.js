// load-shedding script will keep measured usage between a low (min_before_re_adding) and high
// (max_before_shedding) total power (watts), by controlling power to other devices

/************************   settings  ************************/

// Key considerations:

// 1. Make sure the value set for max_before_shedding is greater than the value set for min_before_re_adding (10% should be considered the lowest spread, 20% is a better minimum spread)
// 2. The greater the distance between min and max, the less "churn" you'll have. Setting ample space between these values will make your load shedding more efficient.
// 3. The lowest value for poll_time should be 60 - during "turn on" cycles, you should allow enough time for inrush spikes to settle.
// 4. You are not limited to 5 devices. You can use fewer or more devices, 5 is just the number of examples here. Please note that the higher numbered entries (4 and 5 here) would be considered the most important circuits - last turned off, first turned on.

// The examples below are:
// 192.168.1.100 - a Shelly Pro 3EM
// 192.168.52.4 - a first generation Shelly relay
// "http://192.168.1.101/rpc/switch.Set?id=0&on=true" - an example of a webhook (labelled "on_url") that triggers when the script turns on devices when low power threshold is reached
// "http://192.168.1.101/rpc/switch.Set?id=0&on=false" - an example of a webhook (labelled "off_url") that triggers when the script turns on devices when max power threshold is reached
// 192.168.52.3 - a Shelly Plus or Pro relay (single channel or first channel)
// 192.168.52.2 - a Shelly Plus or Pro relay (second channel)

let first_to_last_to_shed = [
  { addr: "192.168.1.100", gen: 2, type: "Switch", id: 100 },
  { addr: "192.168.52.4", gen: 1, type: "relay", id: 0 },
  {
    on_url: "http://192.168.1.101/rpc/switch.Set?id=0&on=true",
    off_url: "http://192.168.1.101/rpc/switch.Set?id=0&on=false",
  },
  { addr: "192.168.52.3", gen: 2, type: "relay", id: 0 },
  { addr: "192.168.52.2", gen: 2, type: "relay", id: 1 },
];

let max_before_shedding = 1200;
let min_before_re_adding = 900;
let poll_time = 300; // minimum time span between applying normal on/off steps
let short_poll = 10; // span after toggling on a device presumed to already be on

let Pro4PM_channels = [0, 1, 2, 3]; // default to sum of all channels for either 4PM or 3EM
let Pro3EM_channels = ["a", "b", "c"];

let logging = false;
let simulation_power = 0; // set this to manually test in console

/***************   program variables, do not change  ***************/

let ts = 0;
let idx_next_to_toggle = -1;
let last_cycle_time = 0;
let direction = "coasting";
let power_states = [];
let channel_power = {};
let verifying = false;

function total_power() {
  if (simulation_power) return simulation_power;
  let power = 0;
  for (k in channel_power) power += channel_power[k];
  return power;
}

function log() {
  if (logging)
    print(
      Math.round(total_power()).toString() +
        " " +
        JSON.stringify(power_states) +
        " " +
        direction
    );
}

function callback(result, error_code, error_message) {
  if (error_code != 0) {
    print("fail");
    // TBD: currently we don't have any retry logic
  } else {
    if (logging) print("success");
  }
}

function turn(idx, dir) {
  if (dir == "on" && power_states[idx] == "on") verifying = true;
  else verifying = false;
  power_states[idx] = dir;
  o = first_to_last_to_shed[idx];
  on = dir == "on" ? "true" : "false";
  if (def(o.gen)) {
    let cmd;
    if (o.gen == 1) cmd = o.type + "/" + o.id.toString() + "?turn=" + dir;
    else cmd = "rpc/" + o.type + ".Set?id=" + o.id.toString() + "&on=" + on;
    Shelly.call("HTTP.GET", { url: "http://" + o.addr + "/" + cmd }, callback);
  }
  if (def(o.on_url) && dir == "on")
    Shelly.call("HTTP.GET", { url: o.on_url }, callback);
  if (def(o.off_url) && dir == "off")
    Shelly.call("HTTP.GET", { url: o.off_url }, callback);
  log();
}

function check_power(msg) {
  if (!def(msg.delta)) return;
  // print( JSON.stringify( msg ) );
  if (def(msg.delta.apower) && msg.id in Pro4PM_channels)
    channel_power[msg.id] = msg.delta.apower;
  if (def(msg.delta.a_act_power))
    for (k in Pro3EM_channels)
      channel_power[Pro3EM_channels[k]] =
        msg.delta[Pro3EM_channels[k] + "_act_power"];
  let total = total_power();
  if (total > max_before_shedding) {
    if (direction !== "shedding") {
      direction = "shedding";
      idx_next_to_toggle = 0;
    }
  } else if (total < min_before_re_adding) {
    if (direction !== "loading") {
      direction = "loading";
      idx_next_to_toggle = first_to_last_to_shed.length - 1;
    }
  } else if (direction !== "coasting") {
    direction = "coasting";
    log();
  }

  if (
    Date.now() / 1000 > last_cycle_time + poll_time ||
    (verifying && Date.now() / 1000 > last_cycle_time + short_poll)
  ) {
    last_cycle_time = Date.now() / 1000;
    if (direction === "loading") {
      turn(idx_next_to_toggle, "on");
      if (idx_next_to_toggle > 0) idx_next_to_toggle -= 1;
    }
    if (direction === "shedding") {
      turn(idx_next_to_toggle, "off");
      if (idx_next_to_toggle < first_to_last_to_shed.length - 1)
        idx_next_to_toggle += 1;
    }
  }
}

function def(o) {
  return typeof o !== "undefined";
}

Shelly.addStatusHandler(check_power);
