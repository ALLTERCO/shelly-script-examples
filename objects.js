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
