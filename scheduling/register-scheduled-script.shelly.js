// This script will register itself to be called by the schedule service
// on the Shelly it is running on.
// Change SCHEDULE_TIMESPEC according to your needs
// Function that will be executed is scheduledTask()

let CONFIG = {
  KVS_KEY: "Script-Schedule-" + JSON.stringify(Shelly.getCurrentScriptId()),
  SCHEDULE_TIMESPEC: "0 46 13 * * SUN,MON,TUE,WED,THU,FRI,SAT",
  SCHEDULE_ID: -1,
};

function registerIfNotRegistered() {
  print("Reading from ", CONFIG.KVS_KEY);
  Shelly.call(
    "KVS.Get",
    {
      key: CONFIG.KVS_KEY,
    },
    function (result, error_code, error_message) {
      print("Read from KVS", JSON.stringify(error_code));
      //we are not registered yet
      if (error_code !== 0) {
        installSchedule();
        return;
      }
      CONFIG.SCHEDULE_ID = result.value;
      //check if the schedule was deleted and reinstall
      Shelly.call("Schedule.List", {}, function (result) {
        let i = 0;
        for (i = 0; i < result.jobs.length; i++) {
          if (result.jobs[i].id === CONFIG.SCHEDULE_ID) return;
        }
        installSchedule();
      });
    }
  );
}

function saveScheduleIDInKVS(scheduleId) {
  Shelly.call("KVS.Set", {
    key: CONFIG.KVS_KEY,
    value: scheduleId,
  });
}

function installSchedule() {
  Shelly.call(
    "Schedule.Create",
    {
      enable: true,
      timespec: CONFIG.SCHEDULE_TIMESPEC,
      calls: [
        {
          method: "script.eval",
          params: {
            id: Shelly.getCurrentScriptId(),
            code: "scheduledTask()",
          },
        },
      ],
    },
    function (result) {
      //save a record that we are registered
      saveScheduleIDInKVS(result.id);
    }
  );
}

registerIfNotRegistered();

//Actual task that is to be run on a schedule
function scheduledTask() {
  console.log("I am being called by a schedule");
}
