/**
 * EN:
 * Switch off the plug if the power falls below a threshold value for a certain period of time.
 * For example, it can be used to stop charging the smartphone if the power consumption is less than 10 watts.
 * The behavior of this script can also be configured via a scene in the Shelly Smart Control app, but this script works completely offline on the plug.
 *
 * DE:
 * Schalte den Stecker aus, wenn ein Leistungs-Schwellwert für einen bestimmten Zeitraum unterschritten wird.
 * Z.B. kann damit das Laden des Smartphones beendet werden, wenn die Leistungsaufnahme weniger als 10 Watt erreicht.
 * Das Verhalten dieses Skripts lässt sich ebenfalls per Szene in der Shelly Smart Control-App konfigurieren, jedoch funktioniert dieses Skript komplett offline auf dem Stecker.
 *
 * Version: 1.0.0
 * Author: insel-maz
 */

let CONFIG = {
  activePower: 10.0, // in Watts
  turnOffTimeout: 30 * 1000, // in millis
  switchId: 0,
  coldRun: false
};

let timer = null;

function main() {
  Shelly.addEventHandler(Shelly_onEvent);
  Switch_getStatus();
}

function Switch_getStatus() {
  Shelly.call("Switch.GetStatus", {id: CONFIG.switchId}, Switch_onGetStatus);
}

function Switch_setStatus(on) {
  Shelly.call("Switch.Set", {id: CONFIG.switchId, on: on});
}

function Switch_onGetStatus(result, errorCode, errorMessage, userData) {
  processPower(result.apower);
}

function Shelly_onEvent(eventData, userData) {
  // print("Shelly_onEvent", JSON.stringify(eventData));
  if (eventData.name !== "switch" || eventData.id !== CONFIG.switchId) {
    return;
  }
  let info = eventData.info;
  switch (info.event) {
    case "toggle":
      if (info.state) {
        Switch_getStatus();
      }
      break;
    case "power_update":
      processPower(info.apower);
      break;
  }
}

function processPower(apower) {
  print("Current power: " + apower);
  if (apower <= CONFIG.activePower) {
    if (timer === null) {
      print("Schedule turning off the plug...");
      timer = Timer.set(CONFIG.turnOffTimeout, false, onTurnOffTimeout);
    }
  } else {
    if (timer !== null) {
      print("Cancel turning off the plug...");
      Timer.clear(timer);
      timer = null;
    }
  }
}

function onTurnOffTimeout() {
  timer = null;
  turnOff();
}

function turnOff() {
  print("Turn off the plug...");
  if (CONFIG.coldRun) {
    return;
  }
  Switch_setStatus(false);
}

main();
