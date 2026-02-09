/**
 * @title Converts NTC thermal resistor output to temperature and execute actions
 * @description Reads voltage data from the Shelly Plus Add-on, calculate the
 *   corresponding temperature using the Steinhart-Hart equation, and take
 *   action based on the temperature reading
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/weather-env/ntc-conversion.shelly.js
 */

// SH Coefficient Calculator
// https://rusefi.com/Steinhart-Hart.html
//
// Thermistor wiki page
// https://en.wikipedia.org/wiki/Thermistor

/**************** START CHANGE HERE ****************/
let CONFIG = {
  scanInterval: 30, //secs, this will run a timer for every 30 seconds, that will fetch the voltage
  voltmeterID: 100, //the ID of the voltmeter - When we install the add on, the device will define this number

  /**
   * Applies some math on the voltage and returns the result. This function is called every time the voltage is measured
   * @param {Number} voltage The current measured voltage
   * @returns The temperature based on the voltage
   */
  calcTemp: function (voltage) {
    const constVoltage = 10;
    const R1 = 10000;
    const A = 0.0011252791214670555;
    const B = 0.00023471763897744966;
    const C = 8.563489971304025e-8;

    const R2 = R1 * (voltage / (constVoltage - voltage));
    const logR2 = Math.log(R2);
    let T = 1.0 / (A + (B + C * logR2 * logR2) * logR2);
    T = T - 273.15; // Celcius
    //T = (T - 273.15) * 9/5 + 32; // Fahrenheit

    return T;
  },

  /**
   * This function is called every time when a temperature is read
   * @param {Number} temperature The current calculated temperature
   */
  onTempReading: function (temperature) {
    //if the temperature is greater than 20.5 turn the first output off
    if (temperature > 20.5) {
      // Shelly.call("Switch.Set", {
      //     id: 0,
      //     on: false
      // });
    }
    //if the temperature is less than 15, turn the first output on
    else if (temperature < 15) {
      // Shelly.call("Switch.Set", {
      //     id: 0,
      //     on: true
      // });
    }
  },
};
/**************** STOP CHANGE HERE ****************/

function fetchVoltage() {
  //Fetch the voltmeter component
  const voltmeter = Shelly.getComponentStatus(
    "voltmeter:" + JSON.stringify(CONFIG.voltmeterID)
  );

  //exit if can't find the component
  if (typeof voltmeter === "undefined" || voltmeter === null) {
    console.log("Can't find the voltmeter component");
    return;
  }

  const voltage = voltmeter["voltage"];

  //exit if can't read the voltage
  if (typeof voltage !== "number") {
    console.log("can't read the voltage or it is NaN");
    return;
  }

  //get the temperature based on the voltage
  const temp = CONFIG.calcTemp(voltage);

  //exit if the temp isn't calculated correctly
  if (typeof temp !== "number") {
    console.log("Something went wrong when calculating the temperature");
    return;
  }

  if (typeof CONFIG.onTempReading === "function") {
    CONFIG.onTempReading(temp);
  }
}

//init the script
function init() {
  //start the timer
  Timer.set(CONFIG.scanInterval * 1000, true, fetchVoltage);

  //fetch the voltage at run
  fetchVoltage();
}

init();
