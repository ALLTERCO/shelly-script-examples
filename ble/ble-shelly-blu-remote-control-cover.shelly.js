/**
 * @title Control a cover with a Shelly BLU Remote Control ZB
 * @description Script that handles bluetooh events from a Shelly BLU Remote Control
 *   ZB device and controls a cover connected to a Shelly 2PM (gen 2 or
 *   newer). Requires the "ble-shelly-blu.shelly.js" script to be installed
 *   and running (Requires firmware version: 1.0.0-beta or newer)
 */

/**
 * The following example will show how to handle events from a Shelly BLU remote
 * control to control a cover connected to a Shelly Plus 2 PM (gen 2) device.
 * Gen 2 devices do not support the BTHome components function, but with this script
 * similar functionality can be achieved also on those devices.
 *
 * IMPORTANT: this script CAN'T be used standalone. You need the `ble-shelly-blu.shelly.js`
 * example running in order to use this example as that script captures the bluetooth
 * events that this script subsequently handles.
 *
 * The minimum change you need to make is to change the ADDRESS field below to
 * the mac address of your remote. Also take note of the CHANNEL field, where you
 * can specify which one of the four channels listens to. So if you have multiple
 * covers, install this script on all of them with a different CHANNEL value.
 *
 * This script can be further customised similarly to the ble-events-handler.shelly.js
 * script on which it was based. See that script for more examples what you can do
 * and adjust the CONFIG section below.
 *
 * The original ble-events-handler.shelly.js script was only adjusted to support array
 * comparisons, which is needed because this remote has two buttons of which the
 * state is always sent together: so [1, 0] if the left buttons is pressed and
 * [0, 1] if the right button is pressed. As an added bonus, this script adds a
 * configurable PRESET setting, which specifies a set position the cover goes to
 * when both buttons are pressed at the same time (this takes a value of 0-100
 * where the default of 50 is in the middle).
 */

/****************** START CHANGE ******************/

// The MAC address of the Shelly BLU Remote (use lowercase)
let ADDRESS = "12:34:56:78:90:ab"; 
// The channel number (0, 1, 2 or 3) selected on the Shelly BLU Remote
let CHANNEL = 0;
// The preset position when pushing both buttons at the same time
let PRESET = 50;

let CONFIG = {
  // List of scenes
  scenes: [
    {
      // button left event -> cover closes
      conditions: {
        event: "shelly-blu",
        address: ADDRESS,
        channel: CHANNEL,
        button: [1, 0],
      },

      action: function (data) {
        Shelly.call("Cover.Close", { id: 0 });
      },
    },
    {
      // button right event -> cover opens
      conditions: {
        event: "shelly-blu",
        address: ADDRESS,
        channel: CHANNEL,
        button: [0, 1],
      },

      action: function (data) {
        Shelly.call("Cover.Open", { id: 0 });
      },
    },
    {
      // both buttons pushed at the same time -> cover goes to the PRESET position
      conditions: {
        event: "shelly-blu",
        address: ADDRESS,
        channel: CHANNEL,
        button: [1, 1],
      },

      action: function (data) {
        Shelly.call("Cover.GoToPosition", { id: 0, pos: PRESET});
      },
    },
    {
      // scroll up event
      conditions: {
        event: "shelly-blu",
        address: ADDRESS,
        channel: CHANNEL,
        dimmer: 1,
      },

      action: function (data) {
        // retrieve the current position and move up the number of steps received from the remote
        Shelly.call("Cover.GetStatus", { id: 0 }, function (result) {
          if (data.dimmersteps >= 0) {
            let newpos = result.current_pos + data.dimmersteps;
            if (newpos > 100) {
              newpos = 100;
            };
            Shelly.call("Cover.GoToPosition", { id: 0, pos: newpos});
          };
        });
      },
    },
    {
      // scroll down event
      conditions: {
        event: "shelly-blu",
        address: ADDRESS,
        channel: CHANNEL,
        dimmer: 2,
      },

      action: function (data) {
        // retrieve the current position and move down the number of steps received from the remote
        Shelly.call("Cover.GetStatus", { id: 0 }, function (result) {
          if (data.dimmersteps >= 0) {
            let newpos = result.current_pos - data.dimmersteps;
            if (newpos < 0) {
              newpos = 0;
            };
            Shelly.call("Cover.GoToPosition", { id: 0, pos: newpos});
          };
        });
      },
    },
  ],

  //When set to true, debug messages will be logged to the console
  debug: false,
};
/****************** STOP CHANGE ******************/

// Logs the provided message with an optional prefix to the console
function logger(message, prefix) {
  //exit if the debug isn't enabled
  if (!CONFIG.debug) {
    return;
  }

  let finalText = "";

  //if the message is list loop over it
  if (Array.isArray(message)) {
    for (let i = 0; i < message.length; i++) {
      finalText = finalText + " " + JSON.stringify(message[i]);
    }
  } else {
    finalText = JSON.stringify(message);
  }

  //the prefix must be string
  if (typeof prefix !== "string") {
    prefix = "";
  } else {
    prefix = prefix + ":";
  }

  //log the result
  console.log(prefix, finalText);
}

// Scene Manager object
let SceneManager = {
  scenes: [],

  setScenes: function (scenes) {
    this.scenes = scenes;
  },

  // Process new data and check if any scenes should be executed
  onNewData: function (data) {
    logger(["New data received", JSON.stringify(data)], "Info");
    for (let sceneIndex = 0; sceneIndex < this.scenes.length; sceneIndex++) {
      logger(
        ["Validating conditions for scene with index=", sceneIndex],
        "Info"
      );
      if (this.validateConditionsForScene(sceneIndex, data)) {
        logger(
          ["Conditions are valid for scene with index=", sceneIndex],
          "Info"
        );
        this.executeScene(sceneIndex, data);
      } else {
        logger(
          ["Conditions are invalid for scene with index=", sceneIndex],
          "Info"
        );
      }
    }
  },

  // Event handler for handling events from the device
  eventHandler: function (eventData, sceneEventObject) {
    let info = eventData.info;
    if (typeof info !== "object") {
      console.log("ERROR: ");
      logger("Can't find the info object", "Error");

      return;
    }

    if (typeof info.data === "object") {
      for (let key in info.data) {
        info[key] = info.data[key];
      }

      info.data = undefined;
    }

    sceneEventObject.onNewData(info);
  },

  // Check if the conditions are met
  checkCondition: function (compFunc, currValue, compValue) {
    if (
      typeof currValue === "undefined" ||
      typeof compValue === "undefined" ||
      typeof compFunc === "undefined"
    ) {
      return false;
    }

    if (typeof compFunc === "string") {
      if(compFunc in this.compFuncList) {
        compFunc = this.compFuncList[compFunc];
      }
      else {
        logger(["Unknown comapre function", compFunc], "Error");
      }
    }

    if (typeof compFunc === "function") {
      return compFunc(currValue, compValue);
    }

    return false;
  },

  // Validate conditions for a specific scene based on the received data
  validateConditionsForScene: function (sceneIndex, receivedData) {
    if (
      typeof sceneIndex !== "number" ||
      sceneIndex < 0 ||
      sceneIndex >= this.scenes.length
    ) {
      return false;
    }

    let conditions = this.scenes[sceneIndex].conditions;
    if (typeof conditions === "undefined") {
      return false;
    }

    for (let condKey in conditions) {
      let condData = conditions[condKey];
      let currValue = receivedData[condKey];
      let compValue = condData;
      let compFunc = condData;

      if (Array.isArray(condData)) {
        compFunc = "=="
      } else if (typeof condData === "object") {
        compValue = condData.value;
        compFunc = condData.compare;
      } else if (typeof condData !== "function") {
        compFunc = "==";
      }

      if (!this.checkCondition(compFunc, currValue, compValue)) {
        logger(
          ["Checking failed for", condKey, "in scene with index=", sceneIndex],
          "Info"
        );
        return false;
      }
    }

    return true;
  },

  // Execute the action for a specific scene
  executeScene: function (sceneIndex, data) {
    if (
      typeof sceneIndex !== "number" ||
      sceneIndex < 0 ||
      sceneIndex >= this.scenes.length
    ) {
      return;
    }

    let func = this.scenes[sceneIndex].action;
    if (typeof func === "function") {
      logger(["Executing action for scene with index=", sceneIndex], "Info");
      func(data);
    }
  },

  // Comparison functions used for validating conditions
  compFuncList: {
    "==": function (currValue, compValue) {
      if (typeof currValue !== typeof compValue) {
        return false;
      }

      if (Array.isArray(currValue) && Array.isArray(compValue)) {
        if (currValue.length !== compValue.length) {
          return false;
        }
        for (let i = 0; i < currValue.length; i++) {
          if (currValue[i] !== compValue[i]) {
            return false;
          }
        }
        return true;
      }

      return currValue === compValue;
    },
    "~=": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }

      return Math.round(currValue) === Math.round(compValue);
    },
    ">": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }

      return currValue > compValue;
    },
    "<": function (currValue, compValue) {
      if (typeof currValue !== "number" || typeof compValue !== "number") {
        return false;
      }

      return currValue < compValue;
    },
    "!=": function (currValue, compValue) {
      return !this.compFuncList["=="](currValue, compValue);
    },
    "in": function (currValue, compValue) {
      if (
        typeof currValue !== "undefined" &&
        typeof compValue !== "undefined" &&
        !Array.isArray(compValue)
      ) {
        return false;
      }

      return currValue in compValue;
    },
    "notin": function (currValue, compValue) {
      return !this.compFuncList["in"](currValue, compValue);
    },
  },
};

// Initialize function for the scene manager and register the event handler
function init() {
  SceneManager.setScenes(CONFIG.scenes);
  Shelly.addEventHandler(SceneManager.eventHandler, SceneManager);
  logger("Scene Manager successfully started", "Info");
}

init();
