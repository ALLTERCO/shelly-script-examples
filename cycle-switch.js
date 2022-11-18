let CONFIG = {
  /**
   * Pick your desired Input to be used for triggering the cycling (note: this input would be changed
   * to detached!)
   */
  INPUT_ID: 0,

  /**
   * List (in the expected order) the operations that you want this script to cycle through.
   * E.g. [switchId, "on" or "off"]
   */
  CYCLES: [
    [0, "on"],
    [1, "on"],
    [0, "off"],
    [1, "off"],
  ],
};

let currentCycle = 0;

let runCycle = function () {
  let currentOperation = CONFIG.CYCLES[currentCycle];

  if (!currentOperation) {
    currentCycle = 0;
    currentOperation = CONFIG.CYCLES[currentCycle];
  }
  currentCycle++;

  Shelly.call("switch.set", {
    id: JSON.stringify(currentOperation[0]),
    on: currentOperation[1] === "on",
  });
};

let setup = function () {
  Shelly.call(
    "switch.setconfig",
    { id: JSON.stringify(CONFIG.INPUT_ID), config: { in_mode: "detached" } },
    function () {
      Shelly.addEventHandler(function (event) {
        if (event.component === "input:" + JSON.stringify(CONFIG.INPUT_ID)) {
          if (
            event.info.state !== false &&
            event.info.event !== "btn_up" &&
            event.info.event !== "btn_down"
          ) {
            runCycle();
          }
        }
      }, null);
    }
  );
};

setup();
