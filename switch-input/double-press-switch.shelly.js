/**
 * @title Double-press handler for single switch
 * @description Detects single and double press on a toggle switch to trigger different actions.
 */

// the script show how perform mutliple action with a double classic switch used to toggle light.
// They keep their state once pressed, it usefull when the switch directly control the light.
// However it complicate double press actions when paired with a shelly. This script aim to solve this issue

let CONFIG = {
  simpleClickAction: "http://shelly-ip/rpc/Switch.Toggle?id=0",
  doubleClickAction: "http://shelly-ip/rpc/Switch.Toggle?id=1",

  doubleClickDelay: 400,

  buttonId: 0,
};

let timer = undefined;

function toggleLight(action) {
  timer = undefined;

  return Shelly.call("http.get", { url: action });
}

Shelly.addEventHandler(function (event, user_data) {
  if (
    typeof event.info.event !== "undefined" &&
    event.info.event === "toggle" &&
    event.info.id === CONFIG.buttonId
  ) {
    if (timer === undefined) {
      timer = Timer.set(
        CONFIG.doubleClickDelay,
        0,
        toggleLight,
        CONFIG.simpleClickAction
      );
    } else {
      Timer.clear(timer);
      timer = undefined;
      toggleLight(CONFIG.doubleClickAction);
    }
  }
});
