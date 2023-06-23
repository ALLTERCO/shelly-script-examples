/**
 * The `CONFIG` object contains a scenes property which is an array of scene objects.
 * Each scene object consists of two properties: `conditions` and `action`. The `conditions` property
 * defines the conditions under which the scene should be triggered, and the `action`
 * property defines the function to be executed when the conditions are met.
 *
 * The `conditions` are defined as key-value pairs.
 * These keys correspond to specific data values received with the event.
 * The values associated with these keys can be either a direct value, an object specifying a comparison, or a function that
 * must return boolean value.
 *
 * The `action` property defines a function that receives event's data as an input. You can write custom code within this function to
 * perform specific actions.
 *
 * The following example will show how to handle events from Shelly BLU devices what are emited from `ble-shelly-blu.js` example.
 * This script CAN'T be used standone for BLE events.
 *
 * Event name for the `ble-shelly-blu.js` example is `shelly-blu`.
 */

/****************** START CHANGE ******************/
let CONFIG = {
  // List of scenes
  scenes: [
    /** SCENE START 1 - Shelly BLU example **/
    {
      // when event name is `shelly-blu` and button is pressed more than 0 times
      conditions: {
        event: "shelly-blu",
        button: {
          compare: ">",
          value: 0,
        },
      },

      // Logs a message to the console
      action: function (data) {
        console.log("The button was pressed");
      },
    },
    /** SCENE END 1 **/

    /** SCENE START 2 - Shelly BLU Door/Window example **/
    {
      // when event name is `shelly-blu` and window is equal to 1 (open)
      conditions: {
        event: "shelly-blu",
        window: 1,
      },

      // publish a message via MQTT with the addess of the Shelly BLU Door/Window
      action: function (data) {
        MQTT.publish(
          "mymqttbroker/shelly/window/open",
          "The window with addess " + data.address + " was opened"
        );
      },
    },
    /** SCENE END 2 **/

    /** SCENE START 3 - Shelly BLU Scanner example **/
    {
      // when event name is `shelly-blu`
      conditions: {
        event: "shelly-blu",
      },

      // publish a message via MQTT with the addess of the Shelly BLU Door/Window
      action: function (data) {
        console.log("New device found", JSON.stringify(data));
      },
    },
    /** SCENE END 3 **/
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
  if (typeof message === "array") {
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
      compFunc = this.compareFunctions[compFunc];
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

      if (typeof condData === "object") {
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
  compareFunctions: {
    "==": function (currValue, compValue) {
      if (typeof currValue !== typeof compValue) {
        return false;
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
      return !this.compareFunctions["=="](currValue, compValue);
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
      return !this.compareFunctions["in"](currValue, compValue);
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
