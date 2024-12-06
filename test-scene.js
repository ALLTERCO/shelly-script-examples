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

// Shelly Script example: Scene Test with multiple Shellies
//
// Playing a scene with four Shellies with that have a lamp as a load.
// Demonstration of a "Remote Shelly" wrapper object. object prototyping, and
// simple schene player


const sysStatus = Shelly.getComponentStatus('sys');

let CONFIG = {
  mac: sysStatus.mac,
};

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

let blueShelly1 = RemoteShelly.getInstance("192.168.205.31");
let blueShelly2 = RemoteShelly.getInstance("192.168.205.42");
let blueShelly3 = RemoteShelly.getInstance("192.168.205.101");

function setSwitch(swObj, how) {
  swObj.call(
    "switch.set",
    { id: 0, on: how },
    function (result, error_code, message) {
      print(JSON.stringify(result), error_code, message);
    }
  );
}

let Scene = [
  {
    delay: 1000,
    fn: function () {
      setSwitch(Shelly, true);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly1, true);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly2, true);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly3, true);
    },
  },
  {
    //cond will check the return value of fn to decide to continue
    type: "cond",
    fn: function () {
      return true;
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(Shelly, false);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly1, false);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly2, false);
    },
  },
  {
    delay: 1000,
    fn: function () {
      setSwitch(blueShelly3, false);
    },
  },
  {
    //run will just execute fn
    fn: function () {
      print("end-of-scene");
    },
  },
];

let ScenePlayer = {
  currentScene: null,
  sceneCounter: -1,
  sceneTimer: null,
  loop: false,
  play: function (scene, loop) {
    if (typeof loop !== "undefined") {
      this.loop = loop;
    }
    Timer.clear(this.sceneTimer);
    this.sceneCounter = -1;
    this.currentScene = scene;
    this.next();
  },
  next: function () {
    if (!this.currentScene) {
      return;
    }
    this.sceneCounter++;
    let delay = 1;
    if (this.sceneCounter === this.currentScene.length) {
      if (this.loop) {
        this.sceneCounter = -1;
        this.step(delay);
      }
      return;
    }
    if (
      this.currentScene[this.sceneCounter].type === "cond" &&
      !this.currentScene[this.sceneCounter].fn()
    ) {
      return;
    }
    this.currentScene[this.sceneCounter].fn();
    if (typeof this.currentScene[this.sceneCounter].delay !== "undefined") {
      delay = this.currentScene[this.sceneCounter].delay;
    }
    this.step(delay);
  },
  step: function (delay) {
    this.sceneTimer = Timer.set(
      delay,
      false,
      function (sp) {
        sp.next();
      },
      this
    );
  },
  cancel: function () {
    Timer.clear(this.sceneTimer);
    this.sceneCounter = -1;
    this.currentScene = null;
  },
};

ScenePlayer.play(Scene, true);
