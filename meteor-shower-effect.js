/**
 * Select profile with rgb or light component
 */
const CONFIG = {
  color: [
    //yellow
    [255, 255, 0],
    //green
    [0, 255, 0],
    //blue
    [0, 0, 255],
    //red
    [255, 0, 0],
  ],
  colorAsText: ["yellow", "green", "blue", "red"],
  channelCycleDelay: [1, 1, 1, 1],
  minBrightness: [15, 15, 15, 15],
  maxBrightness: [95, 95, 95, 95],
  transition_duration: [6, 6, 6, 6],
  rgbComponent: "rgb",
  lightComponent: "light"
}

//Get current profile
const profile = Shelly.getDeviceInfo().profile;

let componentId = 0;
let colorId = 0;
let statusHandler = null;
let colorHandler = [null, null, null, null];
let activeColor = [false, false, false, false];

function activateChannel(id, component, brightness, colorId) {
  console.log("Turn on " + component + ":" + id);
  const method = component + ".set";
  Shelly.call(
    method, 
    {
      id: id,
      on: true,
      brightness: brightness,
      transition_duration: CONFIG.transition_duration[colorId],
      rgb: CONFIG.color[colorId]
    },
    function() {
      activeColor[colorId] = true;
    }
  );
}

function deactivateChannel(id, component) {
  console.log("Turn off " + component + ":" + id);
  const method = component + ".set";
  Shelly.call(
    method,
    {
      id: id,
      on: false
    },
    function() {
      activeColor[id] = false;
    }
  );
}

function handleBrightnessChange (eventData) {
  if (eventData.component !== "undefined" &&
    (eventData.component.indexOf("rgb") !== -1 || eventData.component.indexOf("light") !== -1) &&
    typeof eventData.delta.brightness !== "undefined" &&
    typeof eventData.id !== "undefined") {

      console.log("eventData: ", JSON.stringify(eventData))

      const component = eventData.component.split(":")[0];
      const brightness = eventData.delta.brightness;
      const id = eventData.id;

      console.log("brightness: ", brightness);
      console.log("id: ", id);

      if (brightness >= CONFIG.maxBrightness[colorId]) {
        console.log("MAX brightness is reached!");
        activateChannel(id, component, CONFIG.minBrightness[colorId], colorId);
      } else if (brightness <= CONFIG.minBrightness[colorId] && activeColor[colorId]) {
        //Restart cycle / change color
        colorId++;
        if (colorId == colorHandler.length) {
          colorId = 0; 
        }
        if (profile.indexOf("rgb") !== -1) {
          start(id, colorId, component);
        } else {
          deactivateChannel(id, component);
          start(colorId, colorId, component);
        }
      }
  }
}

if (statusHandler) {
  Shelly.removeStatusHandler(statusHandler);
}

statusHandler = Shelly.addStatusHandler(handleBrightnessChange);

function start(channelId, colorId, component) {
  console.log("Set color: " + CONFIG.colorAsText[colorId]);

  if (colorHandler[colorId]) {
    Timer.clear(colorHandler[colorId]);
  }

  colorHandler[colorId] = Timer.set(
    CONFIG.channelCycleDelay[colorId] * 1000,
    false,
    function (userData) {
      activateChannel(userData.id, userData.component, userData.brightness, userData.colorId);
    },
    {
      id: channelId,
      component: component,
      brightness: CONFIG.maxBrightness[colorId],
      colorId: colorId
    }
  )
}

function init() {
  console.log("Current profile: ", profile);

  if (profile.indexOf("rgb") !== -1) { //With rgb component
    console.log("Effect with rgb");

    const rgbOutput = Shelly.getComponentStatus(CONFIG.rgbComponent + ":" + 0).output;

    if (rgbOutput) {
      deactivateChannel(0, CONFIG.rgbComponent);
    }

    start(0, colorId, CONFIG.rgbComponent);
  } else if (profile.indexOf("light") !== -1) { //With light component
    console.log("Effect with light");

    colorHandler = [null, null, null];
    activeColor = [false, false, false];

    for (i = 0; i < activeColor.length; i++) {
      const lightOutput = Shelly.getComponentStatus(CONFIG.lightComponent + ":" + i).output;
      if (lightOutput) {
        deactivateChannel(i, CONFIG.lightComponent);
      }
    }

    start(0, colorId, CONFIG.lightComponent);
  } else {
    console.log("Select supported profile!");
  }
}

init();