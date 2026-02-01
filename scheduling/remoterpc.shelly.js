/**
 * @title Example of remote calling a Shelly Gen2
 * @description A remote Shelly abstraction Call an RPC method on the remote Shelly
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

// Shelly Script example: Remote calling a Shelly Gen2
//
// A remote Shelly abstraction Call an RPC method on the remote Shelly

let RemoteShelly = {
  _cb: function (result, error_code, error_message, callback) {
    let rpcResult = JSON.parse(result.body);
    let rpcCode = result.code;
    let rpcMessage = result.message;
    callback(rpcResult, rpcCode, rpcMessage);
  },
  composeEndpoint: function (method) {
    return "http://" + this.address + "/rpc/" + method;
  },
  call: function (rpc, data, callback) {
    let postData = {
      url: this.composeEndpoint(rpc),
      body: data,
    };
    Shelly.call("HTTP.POST", postData, RemoteShelly._cb, callback);
  },
  getInstance: function (address) {
    let rs = Object.create(this);
    // remove static method
    rs.getInstance = null;
    rs.address = address;
    return rs;
  },
};

let blueShelly = RemoteShelly.getInstance("192.168.2.16");
let redShelly = RemoteShelly.getInstance("192.168.2.14");

blueShelly.call(
  "switch.set",
  { id: 0, on: true },
  function (result, error_code, message) {
    print(JSON.stringify(result), error_message, message);
  }
);

redShelly.call(
  "switch.set",
  { id: 0, on: true },
  function (result, error_code, message) {
    print(JSON.stringify(result), error_message, message);
  }
);
