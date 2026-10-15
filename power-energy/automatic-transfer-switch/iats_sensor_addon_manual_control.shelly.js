/**
 * @title iATS Sensor Add-on manual control helper
 * @description Companion script for the iATS controller, running on the Shelly Pro Sensor Add-on.
 *   DIN0 (input:100) selects AUTO vs MANUAL mode; DIN1 (input:101) selects GRID vs PV target.
 *   Publishes the current selection to KVS at a configurable interval. Does not touch relay
 *   outputs — iats_grid_backup_controller.shelly.js remains the sole owner of switch:0/1
 *   and validates source availability before acting on any manual request.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/automatic-transfer-switch/iats_sensor_addon_manual_control.shelly.js
 */

var INPUT_AUTO_MANUAL = 100;
var INPUT_GRID_PV = 101;

var DIN0_HIGH_IS_MANUAL = true;
var DIN1_HIGH_IS_PV = true;
var PUBLISH_MS = 1000;
var CONTROL_KVS_KEY = "iats.manual_control";

var sequence = 0;
var publishInProgress = false;

function log(message) {
  print("[iATS-manual] " + message);
}

function boolFromStatus(status) {
  if (!status) return false;
  if (typeof status.state === "boolean") return status.state;
  if (typeof status.input === "boolean") return status.input;
  return false;
}

function readInput(id, done) {
  Shelly.call(
    "Input.GetStatus",
    { id: id },
    function (status, errorCode, errorMessage) {
      if (errorCode !== 0) {
        log(
          "Input.GetStatus failed input:" +
            id +
            " error=" +
            errorCode +
            " message=" +
            errorMessage
        );
        done(null);
        return;
      }

      done(boolFromStatus(status));
    }
  );
}

function publishControl() {
  if (publishInProgress) return;
  publishInProgress = true;

  readInput(INPUT_AUTO_MANUAL, function (din0) {
    if (din0 === null) {
      publishInProgress = false;
      return;
    }

    readInput(INPUT_GRID_PV, function (din1) {
      if (din1 === null) {
        publishInProgress = false;
        return;
      }

      var manual = DIN0_HIGH_IS_MANUAL ? din0 : !din0;
      var pv = DIN1_HIGH_IS_PV ? din1 : !din1;
      var value = {
        mode: manual ? "MANUAL" : "AUTO",
        target: pv ? "PV" : "GRID",
        sequence: sequence++
      };

      Shelly.call(
        "KVS.Set",
        { key: CONTROL_KVS_KEY, value: value },
        function (result, errorCode, errorMessage) {
          publishInProgress = false;

          if (errorCode !== 0) {
            log(
              "KVS.Set failed error=" +
                errorCode +
                " message=" +
                errorMessage
            );
            return;
          }

          log(value.mode + (manual ? " target=" + value.target : ""));
        }
      );
    });
  });
}

log("starting; DIN0=input:100 DIN1=input:101");
publishControl();
Timer.set(PUBLISH_MS, true, publishControl);
