/**
 * @title Example of remote calling a Shelly Gen2
 * @description A remote Shelly abstraction Call an RPC method on the remote Shelly
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/scheduling/remoterpc.shelly.js
 */

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
