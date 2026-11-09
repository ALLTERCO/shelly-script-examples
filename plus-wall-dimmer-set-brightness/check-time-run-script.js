// When you start the script, it will check every minute if the current minute correspond to the CONFIG.testTime number
// This means that if the script started at 08:53 and the testTime is 00, when the current minute changes to 00, at 09:00
// The script will loop every hour or the time defined at loopInterval, starting from the next hour or the loopInterval. 
// If loopInterval is 60*60*1 then the next hour, i.e. 10:00, this script will start the script 1
// In our case, Script 1 will set the brightness of the light accordingly to the specifications


let CONFIG = {
  loopInterval: 60*60*1,   // 60 seconds * 60 minutes * 1 hours
  runInterval: 60*1,       // One minute until reaches the right test time
  testTime: "00",          // Define the minute the test will happen in a 00 format
};

// End of changes 

let t0, t1, t2 = null;
let sysTime = "19:00";

function runScript(){
    // print("Trigger Script");
    Shelly.call( "Script.Stop", { id: 1 } );    
    Shelly.call( "Script.Start", { id: 1 } );
};

function runTopHour(){
    Timer.clear(t0);
    Timer.clear(t1);
    t0 = Timer.set(CONFIG.loopInterval * 1000, true, runScript);
  }

function runNextTime(){
  Shelly.call(
      "Shelly.GetStatus",
      {  },
      function (res) {
        sysTime = res.sys.time[3] + res.sys.time[4];
        // print('Minute now:',sysTime);
        if(sysTime === CONFIG.testTime){
          // print('run');
          Timer.clear(t1);
          Timer.clear(t2);
          t1 = Timer.set(CONFIG.loopInterval * 1000, true, runTopHour);
        };
      },
      null
  );
}

// print('Start Script');
Timer.clear(t2);
t2 = Timer.set(CONFIG.runInterval * 1000, true, runNextTime);