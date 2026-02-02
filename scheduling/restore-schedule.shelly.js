/**
 * @title After boot scan schedules and run active one
 * @description When device boots and there is a schedule that has to be active at the
 *   moment it won't be executed. This script walks through the configured
 *   schedules and runs the one that should be active at that moment of
 *   time.
 */

// This script will run once after device boot
// will scan schedules that are set up for every day of the week
// and will ensure that the scheduled task that was to be run
// just before device booted is executed


const sysStatus = Shelly.getComponentStatus('sys');

const CONFIG = {
  scheduleSpecMatch: '* * SUN,MON,TUE,WED,THU,FRI,SAT',
};

const hour = JSON.parse(sysStatus.time.slice(0, 2));
const minutes = JSON.parse(sysStatus.time.slice(3, 5));

function restoreSchedule() {
  if (hour === null || minutes === null) return;
  //States - 0 - seconds, 1 - minutes, 2 - hours
  Shelly.call('Schedule.List', {}, function (result) {
    let best_diff = 1440;
    let scheduledRPC = null;
    for (let id in result.jobs) {
      if (result.jobs[id].timespec.indexOf(CONFIG.scheduleSpecMatch)) {
        let buf = '';
        let s_seconds = 0,
          s_minutes = 0,
          s_hour = 0;
        let state = 0;
        for (let i = 0; i < result.jobs[id].timespec.length; i++) {
          if (result.jobs[id].timespec[i] !== ' ') {
            buf = buf + result.jobs[id].timespec[i];
          } else {
            if (state === 0) {
              s_seconds = JSON.parse(buf);
              buf = '';
              state = 1;
            } else if (state === 1) {
              s_minutes = JSON.parse(buf);
              buf = '';
              state = 2;
            } else if (state === 2) {
              s_hour = JSON.parse(buf);
              break;
            }
          }
        }
        let c_diff = (hour - s_hour) * 60 + (minutes - s_minutes);
        if (c_diff > 0 && c_diff < best_diff && result.jobs[id].enable) {
          best_diff = c_diff;
          scheduledRPC = result.jobs[id].calls[0];
        }
      }
    }
    if (scheduledRPC !== null) {
      console.log('Executing last active schedule before now...', JSON.stringify(scheduledRPC));
      Shelly.call(scheduledRPC.method, scheduledRPC.params);
    }
  });
}


restoreSchedule();

