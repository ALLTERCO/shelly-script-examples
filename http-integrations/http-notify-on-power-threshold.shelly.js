// Shelly Script example: Shelly Plus 1PM - Notify within active hours when power
// passes a threshold

let CONFIG = {
  // Make sure that start precedes end in activeTime, the script does not test for valid interval
  activeTime: {
    start: "00:00",
    end: "05:00",
  },
  // Notify only once or every time the threshold is passed
  notifyOnce: false,
  // Which of the device switches to monitor
  outputId: 0,
  // Power threshold in Watts
  outputPowerThreshold: 4,
  // Which http endpoint to ping
  httpEndpoint: 'https://world.news/powerishigh'
};

function timeStrToMinutes(timeStr) {
  let hours = JSON.parse(timeStr.slice(0,2));
  let minutes = JSON.parse(timeStr.slice(3));
  return hours * 60 + minutes;
}

function notify() {
  Shelly.call(
    'HTTP.GET',
    {url:CONFIG.httpEndpoint}
  )
}

let outputStringId = "switch:" + JSON.stringify(CONFIG.outputId);
let startMinutes = timeStrToMinutes(CONFIG.activeTime.start);
let endMinutes = timeStrToMinutes(CONFIG.activeTime.end);
let lastNotifyMinutes = null;

Shelly.addStatusHandler(function (statusNtf) {
  if (statusNtf.component !== outputStringId) return;
  if (typeof statusNtf.delta.apower === "undefined") return;
  if (statusNtf.delta.apower < CONFIG.outputPowerThreshold) return;
  let sysStatus = Shelly.getComponentStatus('sys');
  let currentMinutes = timeStrToMinutes(sysStatus.time);
  if(currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    if(!CONFIG.notifyOnce || (CONFIG.notifyOnce && lastNotifyMinutes === null)) {
      notify();
      lastNotifyMinutes = currentMinutes;
    }
  }
  if(currentMinutes > endMinutes) {
    lastNotifyMinutes = null;
  }
});
