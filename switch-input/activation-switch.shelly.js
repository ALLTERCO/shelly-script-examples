/**
 * @title Activation switch
 * @description Replicate activation_switch profile from Gen1 devices.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/switch-input/activation-switch.shelly.js
 */

// Shelly Script example: Replicate activation_switch profile
// Gen1 behavior replicated with scripting

let CONFIG = {
  toggleTimeout: 5,
  inputId: 0,
  switchId: 0,
};

Shelly.call("Switch.SetConfig", {
  id: CONFIG.switchId,
  config: {
    in_mode: "detached",
  },
});

Shelly.addEventHandler(function (event) {
  if (typeof event.info.event === "undefined") return;
  if (event.info.component === "input:" + JSON.stringify(CONFIG.inputId)) {
    //ignore single_push and double_push events
    if (event.info.event.indexOf("push") >= 0) return;
    let swParams = {
      id: CONFIG.switchId,
      on: true,
    };
    if (event.info.event === "btn_up") {
      swParams.toggle_after = CONFIG.toggleTimeout;
    }
    Shelly.call("Switch.Set", swParams);
  }
});
