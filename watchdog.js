/* Watchdog: Automatically restarts auto-start enabled scripts */

// Console: Notify about restart success
function printSuccess(result, error_code, error_message, userdata) {
  if(error_code === 0) {
    print("[WATCHDOG] OK. Script restarted.")
  } else {
     print("[WATCHDOG] ERROR. Script could not be restarted. " + error_message)
  }
}

// Parse Script config and restart if config is set to "enabled"
function restartIfEnabled(result) {
    if(typeof result === "object" && typeof result.id === "number" && result.enable === true )
   {
      print("[WATCHDOG] Try to restart script: " + JSON.stringify(result.id));
      Shelly.call("Script.Start", {id: result.id}, printSuccess); 
   } 
}


// (Script) event handler
function statusHandler(event, userdata) {
  if(event.name === "script" && !event.delta.running) {
     // Get script config
     Shelly.call("Script.GetConfig", {id: event.delta.id}, restartIfEnabled);
  }   
}

// Main
let statusHandlerHandle = Shelly.addStatusHandler(statusHandler);  
print("[WATCHDOG] Started");
