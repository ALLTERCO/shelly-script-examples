/**
 * @title Load monitoring and alerting in Shelly Gen2
 * @description This script listens for events when power changes to 0 and if the
 *   switch is still on then it alerts that something might have happened
 *   to the load.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/failure-monitor.shelly.js
 */

// Shelly Script example: Load monitoring and alerting in Shelly Gen2
//
// This script listens for events when power changes to 0 and if the switch is
// still on then it alerts that something might have happened to the load

let CONFIG = {
  notifyEndpoint: "http://push-notification-endpoint-url",
};

let notifications = [];

Shelly.addEventHandler(function (event, user_data) {
  if (typeof event.info.apower === "undefined") {
    return;
  }
  if (event.info.apower !== 0) {
    return;
  }
  Shelly.call(
    "switch.getstatus",
    { id: 0 },
    function (result, error_code, error_message, user_data) {
      if (result.output) {
        notifications.push("load might have failed");
      }
    },
    null
  );
}, null);

function _simple_encode(str) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    if (str.at(i) === 0x20) {
      res = res + "%20";
    } else {
      res = res + chr(str.at(i));
    }
  }
  return res;
}

Timer.set(1000, true, function () {
  if (notifications.length) {
    let message = notifications[0];
    notifications.splice(0, 1);
    print("ALERT: ", message);
    let nEndpoint = CONFIG.notifyEndpoint + _simple_encode(message);
    Shelly.call(
      "http.get",
      { url: nEndpoint },
      function (result, error_code, error_message) {
        print(JSON.stringify(result));
      },
      null
    );
  }
});
