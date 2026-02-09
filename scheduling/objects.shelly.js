/**
 * @title mJS example of how to create custom Objects that interact with components (Switch in this case)
 * @description Example of how to create wrappers around RPC calls and using
 *   Object.create.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/scheduling/objects.shelly.js
 */

// Shelly Script example: Creating wrappers around RPC calls and using object
// create
//
// This script does not produce immediate output, but is useful for testing with
// Script.Eval from the command line you execute mos call script.eval
// '{"id":3,"code":"OnePlusSwitch.turnOn()"}' --port=http://${SHELLY}/rpc mos
// call script.eval '{"id":3,"code":"OnePlusSwitch.turnOff()"}'
// --port=http://${SHELLY}/rpc

// In case you would disregard the results of the call such an empty callback
// can be used
function stubCB(res, error_code, error_msg, ud) {}

// Prototype object
let ShellySwitch = {
  turnOn: function () {
    Shelly.call("switch.set", { id: this.id, on: true }, stubCB, null);
  },
  turnOff: function () {
    Shelly.call("switch.set", { id: this.id, on: false }, stubCB, null);
  },
};

function getSwitch(id) {
  let o = Object.create(ShellySwitch);
  o.id = id;
  return o;
}

let OnePlusSwitch = getSwitch(0);

// OnePlusSwitch.turnOn();
// OnePlusSwitch.turnOff();
