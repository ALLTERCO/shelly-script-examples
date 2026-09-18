/*
 * Air Consumption Logger for Compressed Air Systems
 * --------------------------------------------------
 * 
 * Purpose:
 * This script monitors the power consumption of a device (e.g. an air compressor)
 * via Shelly's energy meter ("em" event). When the power consumption drops below
 * a defined threshold, it assumes the compressor has stopped.
 * 
 * The script then calculates the air flow rate based on pressure drop and tank volume,
 * assuming that air was consumed from a pressure vessel during this low-power period.
 * 
 * Use Case:
 * - Track the air consumption (in m³ and L/min) of a machine or process that consumes
 *   compressed air when the compressor is off.
 * - Estimate flowrate and total used volume without needing inline flow sensors.
 * 
 * Additions:
 * - If you write these statistics into virtual components you can create a virtual device
 *   in the cloud dashboard that keeps track of these statistics.
 * 
 * How it works:
 * - Monitors power via Shelly EM.
 * - When power < THRESHOLD, it starts a timer.
 * - When power rises above THRESHOLD again, it calculates:
 *     - Duration in minutes
 *     - Normalized volume based on pressure drop (p1 - p2)
 *     - Flow rate in L/min
 *     - Accumulated air used in m³
 * 
 * Known Limitations:
 * - This is not very accurate
 * - Air used while the compressor is running is not calculated
 * 
 * Requirements:
 * - Known tank volume (better use whole system volume) and pressure levels (p1, p2)[aircompressor shutdown pressure|aircompressor start pressure].
 */

let THRESHOLD = 100;        // Power threshold in watts
let belowThresholdSince = null;
let timerRunning = false;
let flowrate = 0;
let airUsed = 0;            // Total air used in m³

// Pressure values in bar
let p1 = 10;                // aircompressor shutdown pressure
let p2 = 8;                 // aircompressor start pressure
let volume = 1000;          // Tank volume in liters

print("Starting script...");

// Handle energy meter ("em") status events
function emHandler(status) {
  let totalPower = status.delta.total_act_power;

  if (totalPower < THRESHOLD) {
    if (!timerRunning) {
      belowThresholdSince = Shelly.getUptimeMs();
      timerRunning = true;
      print("Power below threshold:", totalPower, "W");
    }
  } else {
    if (timerRunning) {
      let now = Shelly.getUptimeMs();
      let durationMin = (now - belowThresholdSince) / 60000; // Duration in minutes

      // Normalize volume based on pressure difference and atmospheric pressure
      // V_norm = V_tank * ((p1 - p2) / p_atm), assuming p_atm = 1 bar
      let volumeNorm = volume * (p1 - p2);

      // Calculate flow rate in L/min, rounded to 2 decimal places
      let flow = Math.round((volumeNorm / durationMin) * 100) / 100;

      flowrate = flow;
      airUsed += volumeNorm / 1000; // Convert to m³

      print("Power was below", THRESHOLD, "W for", durationMin.toFixed(2),
            "minutes →", flow, "L/min");

      // Reset timer
      timerRunning = false;
      belowThresholdSince = null;
    }
  }
}

// Register status handler
Shelly.addStatusHandler(function(status) {
  if (status.name === "em" && typeof status.delta.total_act_power === 'number') {
    emHandler(status);
  }
});