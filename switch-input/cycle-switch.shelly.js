/**
 * @title Configurable Cycle switch
 * @description Replicate Cycle switch feature from Gen1 devices. Allows for custom
 *   list of operations to cycle through.
 */

const CONFIG = {
  /**
   * Pick your desired Input to be used for triggering the cycling (note: this input would be changed
   * to detached and to type button!)
   */
  INPUT_ID: 0,

  /**
   * List (in the expected order) the operations that you want this script to cycle through.
   * E.g. for 3 outputs - alternating on/off it could be [true, false, false] on the first cycle, 
   * and [false, true, false] for the second cycle and so on ...
   * Value true means that output is enabled.
   * Value false means that output is disabled.
   * When cycle gets to the end of CYCLES array - on the next iteration operations start from beggining.
   * With every single item in the inner arrays with values true/false output state can be managed - on/off. 
   * CYCLES array could be fit to output count of the shelly device.
   * E.g. device with 3 outputs 
   * CYCLES: [
          [true, false, false],
          [false, true, false],
          [false, false, true],
          [false, false, false]
      ]
    * E.g. device with 4 outputs 
    * CYCLES: [
          [true, false, false, false],
          [false, true, false, false],
          [false, false, true, false],
          [false, false, false, true],
          [false, false, false, false]
      ],
      ...
    */

  CYCLES: [
    [true, false, false],
    [false, true, false],
    [false, false, true],
    [false, false, false],
  ],

  /**
   * Define component type 
   */
  COMPONENT_TYPE: 'input'
}
let currentCycle = 0;

function runCycle () {
    if (currentCycle >= CONFIG.CYCLES.length) {
      currentCycle = 0;
    }

    let currentOperation = CONFIG.CYCLES[currentCycle];

    currentCycle++;

    for (let inputId = 0; inputId < currentOperation.length; inputId++) {
      Shelly.call(
          "Switch.Set", 
          {
            id: inputId,
            on: currentOperation[inputId]
          }
          
      );
    }
}

function setup() {
    Shelly.call(
      "Switch.SetConfig", 
      {
        id: JSON.stringify(CONFIG.INPUT_ID), 
        config: {in_mode: "detached" }
      }
    );

    Shelly.call(
      "Input.SetConfig",
      {
        id: JSON.stringify(CONFIG.INPUT_ID),
        config: {type: "button"}
      }
    );

    Shelly.addEventHandler(function (event) {
      if (event.info.event === "single_push" && event.id === CONFIG.INPUT_ID && event.info.component === CONFIG.COMPONENT_TYPE + ":" + JSON.stringify(CONFIG.INPUT_ID)) {
        runCycle();
      }
    });
}

setup();
