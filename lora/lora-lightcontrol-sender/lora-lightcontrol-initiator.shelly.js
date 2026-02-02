/**
 * @title LoRa light control scheduler
 * @description Schedules LoRa light control commands based on time-of-day brightness settings.
 */

const SCRIPT_ID = Shelly.getCurrentScriptId();

//key is time, value is device number,
const TIME_ENUM = {
  "05:00": { enable: true, brightness: 50 },
  "07:00": { enable: false, brightness: 0 },
  "20:00": { enable: true, brightness: 50 },
  "23:00": { enable: true, brightness: 100 }
};

//timespec based on the time enum
const TIMESPEC = '0 0 5,7,20,23 * * *';

//schedule identifier
const ORIGIN = 'script-' + SCRIPT_ID;

function emitMessage() {
  Shelly.call(
    'Sys.GetStatus',
    null,
    function(data, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
        return;
      }

      if (typeof TIME_ENUM[data.time] === 'undefined') {
        console.log('Error: No handler for ', data.time);
      }

      const obj = TIME_ENUM[data.time];
      const string = ((obj.enable | 0) + '' + (obj.brightness));

      Shelly.emitEvent(
        'lora_send_message',
        { message: string }
      );
    }
  );
}

function createSchedule() {
  Shelly.call(
    'Schedule.Create',
    {
      enable: true,
      timespec: TIMESPEC,
      calls: [
        {
          origin: ORIGIN,
          method: 'Script.Eval',
          params: { id: SCRIPT_ID, code: 'emitMessage()' }
        }
      ]
    },
    function(_, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
      }
    }
  );
}

function init() {
  Shelly.call(
    'Schedule.List',
    null,
    function(data, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
        return;
      }

      let hasSchedule = false;

      for (let i = 0; i < data.jobs.length; i++) {
        if (data.jobs[i].calls[0].origin && data.jobs[i].calls[0].origin === ORIGIN) {
          hasSchedule = true;
          break;
        }
      }

      if (!hasSchedule) {
        createSchedule();
      }
    }
  );
}

init();