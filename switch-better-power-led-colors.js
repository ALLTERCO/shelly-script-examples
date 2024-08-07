/**
 * EN:
 * Updates the color of the ring LED depending on the current power consumption. You can specify several power values for which a specific
 * (interpolated) color should apply.
 * The list of colors in the CONFIG must be sorted by power value in ascending order.
 * The interval at which the ring LED is updated can be set. The interval should not be set too short, as updates to the ring LED are accompanied by
 * configuration changes to the plug. If your plug is connected to the Shelly cloud, any changes to the configuration are immediately saved in the
 * cloud.
 * Use at your own risk.
 *
 * DE:
 * Aktualisiert die Farbe der Ring-LED abhängig von der aktuellen Leistungsaufnahme. Sie können mehrere Leistungswerte vorgeben, für die eine
 * bestimmte (interpolierte) Farbe gelten soll.
 * Die Liste der Farben in der CONFIG muss nach Leistungswert aufsteigend sortiert sein.
 * Das Intervall der Updates der Ring-LED kann festgelegt werden. Das Intervall sollte nicht zu klein gewählt werden, da Updates der Ring-LED mit
 * Konfigurationsänderung des Steckers einhergehen. Wenn Ihr Stecker mit der Shelly-Cloud verbunden ist, wird jede Änderung der Konfiguration sofort
 * in der Cloud gespeichert.
 * Auf eigene Gefahr verwenden.
 *
 * Version: 1.0.0
 * Author: insel-maz
 */

let CONFIG = {
  switchId: 0,
    // Update at most every 30 seconds.
    ledUpdateInterval: 30 * 1000,
    colors: [
      // power in Watts, ascending order
      // rgb parts in interval [0, 100]
      // brightness in interval [0, 100]
      {power: 0, rgb: [0, 0, 0], brightness: 0}, // Turn LED off
      {power: 10, rgb: [100, 0, 0], brightness: 100},
      {power: 150, rgb: [0, 100, 0], brightness: 100},
      {power: 200, rgb: [0, 0, 100], brightness: 100},
    ]
};

let currentPower = 0;
let updateQueued = false;
let cooldownTimer = null;

function main() {
  Shelly.addEventHandler(onShellyEvent);
  Switch_getStatus(onSwitchGetStatus);
}

function Switch_getStatus(callback) {
  Shelly.call("Switch.GetStatus", {id: CONFIG.switchId}, callback);
}

function PlugsUi_getConfig(callback) {
  Shelly.call("PLUGS_UI.GetConfig", {}, callback);
}

function PlugsUi_setConfig(config, callback) {
  Shelly.call("PLUGS_UI.SetConfig", {config: config}, callback);
}

function onShellyEvent(eventData, userData) {
  // print("onEvent", JSON.stringify(eventData));
  if (eventData.name !== "switch" || eventData.id !== CONFIG.switchId) {
    return;
  }
  let info = eventData.info;
  switch (info.event) {
    case "toggle":
      if (info.state) {
        Switch_getStatus(onGetStatus);
      }
      break;
    case "power_update":
      processPower(info.apower);
      break;
  }
}

function onSwitchGetStatus(result, errorCode, errorMessage, userData) {
  processPower(result.apower);
}

function processPower(power) {
  print("Process power:", power);
  currentPower = power;
  updateQueued = true;
  checkUpdate();
}

function checkUpdate() {
  if (!updateQueued) {
    print("No update queued.");
    return;
  }
  if (cooldownTimer !== null) {
    print("Cooldown timer active.");
    return;
  }

  updateQueued = false;
  cooldownTimer = Timer.set(CONFIG.ledUpdateInterval, false, onLedUpdateTick);
  updateLed();
}

function onLedUpdateTick(userData) {
  cooldownTimer = null;
  checkUpdate();
}

function updateLed() {
  print("Update LED...");
  PlugsUi_getConfig(updateLedConfig);
}

function updateLedConfig(config, errorCode, errorMessage, userData) {
  let rgbAndBrightness = getRgbAndBrightness(currentPower);
  let component = "switch:" + CONFIG.switchId;
  config.leds.mode = "switch";
  config.leds.colors[component].on = rgbAndBrightness;
  config.leds.colors[component].off = rgbAndBrightness;
  // print(JSON.stringify(config));
  PlugsUi_setConfig(config);
}

function getRgbAndBrightness(power) {
  let colors = CONFIG.colors;
  let i = colors.length - 1;
  for (; i >= 0 && power < colors[i].power; --i) ;
  if (i === -1) {
    return {rgb: [0, 0, 0], brightness: 0};
  }
  let color1 = colors[i];
  let color2 = color1;
  let f = 0;
  if (i + 1 < colors.length) {
    color2 = colors[i + 1];
    f = (power - color1.power) / (color2.power - color1.power);
  }

  return {
    rgb: [
      lerp(color1.rgb[0], color2.rgb[0], f),
      lerp(color1.rgb[1], color2.rgb[1], f),
      lerp(color1.rgb[2], color2.rgb[2], f)
    ],
    brightness: lerp(color1.brightness, color2.brightness, f)
  };
}

function lerp(a, b, f) {
  return a * (1. - f) + b * f;
}

main();
