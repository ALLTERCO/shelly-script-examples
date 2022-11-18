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

// Shelly Script example: Scene playing in Shelly Gen2
//
// Simple scene abstraction A scene is an array of actions or conditions that
// are played squentially. An action can have a delay property, which means
// after executing the action function wait until proceeding to the next one A
// condition is an element of a scene that has property type:"cond". If the
// result is true, the scene continues with the next item, if it is false it
// stops.

let Scene = [
  {
    delay: 1000,
    fn: function () {
      Shelly.call(
        "switch.set",
        { id: 0, on: true },
        function (result, error_code, error_message, user_data) {}
      );
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
      Shelly.call(
        "switch.set",
        { id: 0, on: false },
        function (result, error_code, error_message, user_data) {}
      );
    },
  },
  {
    delay: 1000,
    fn: function () {
      let postData = {
        url: "http://192.168.2.16/rpc/switch.set",
        body: { id: 0, on: true },
      };
      Shelly.call(
        "HTTP.POST",
        postData,
        function (response, error_code, error_message, self) {
          let rpcResult = JSON.parse(response.body);
          let rpcCode = response.code;
          let rpcMessage = response.message;
        },
        this
      );
    },
  },
  {
    //sync will run dn and wait
    delay: 1000,
    fn: function () {
      let postData = {
        url: "http://192.168.2.16/rpc/switch.set",
        body: { id: 0, on: false },
      };
      Shelly.call(
        "HTTP.POST",
        postData,
        function (response, error_code, error_message, self) {
          let rpcResult = JSON.parse(response.body);
          let rpcCode = response.code;
          let rpcMessage = response.message;
        },
        this
      );
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

ScenePlayer.play(Scene);
