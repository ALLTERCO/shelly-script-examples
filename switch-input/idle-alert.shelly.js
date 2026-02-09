/**
 * @title Alert on inactivity
 * @description Script that will monitor the inputs of a Shelly and if there was no
 *   user interaction with the input(s) It will call an URL with a
 *   predefined message
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/switch-input/idle-alert.shelly.js
 */

// Shelly Script example: Alert on inactivity
//
// Script that will monitor the inputs of a Shelly and if there was no user
// interaction with the input(s) It will call an URL with a predefined message

let CONFIG = {
  timeoutBeforeAlert: 12 * 60 * 60 * 1000,
  inputID: "", // string
  inputEvent: -1, // int
  alertEndpoint: "http://myalert.bot/?message=${message}",
};

let alertTimer = null;

function replace(origin, substr, replace) {
  return (
    origin.slice(0, origin.indexOf(substr)) +
    replace +
    origin.slice(origin.indexOf(substr) + substr.length, origin.length)
  );
}

function startTimer() {
  alertTimer = Timer.set(
    CONFIG.timeoutBeforAlert,
    true,
    function (ud) {
      let alertURL = replace(
        CONFIG.alertEndpoint,
        "${message}",
        "Grandpa:_No_activity_for_12_hours!"
      );
      Shelly.call(
        "HTTP.GET",
        { url: alertURL },
        function (res, error_code, error_msg, ud) {
          if (res.code === 200) {
            print("Successfully transmitted a message");
          }
        },
        null
      );
    },
    null
  );
}

function stopTimer() {
  Timer.clear(alertTimer);
}

Shelly.addEventHandler(function (event, ud) {
  // while we don't have better selectivity for event source
  if (typeof event.info.state !== "undefined") {
    stopTimer();
    startTimer();
    print("TIMER WAS RESET");
  }
}, null);
