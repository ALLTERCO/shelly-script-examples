let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot", //if you have more than once instace of this script, you should set a unique event name for each
};

let KVS = {
  load: function (key, callback) {
    Shelly.call(
      "KVS.Get", 
      { key: key },
      function (data, error, message, kvsObject) {
        if(error !== 0) {
          console.log("Cannot read the value for the provided key, reason:", message);
          return;
        }
        kvsObject[key] = data.value;
        if(callback) {
          callback();
        }
      },
      this
    );
  },

  write: function (key, value) {
    Shelly.call("KVS.Set", { key: key, value: value } );
  }
};

let TelegramBot = {
  init: function (botKey, messageOffset) {
    this.botKey = botKey;
    this.messageOffset = messageOffset;

    this.startNewPoll();
  },
  
  onEvent: function (data) {
    if(
      typeof data === "undefined" || 
      typeof data.info === "undefined" ||
      data.info.event !== CONFIG.eventName
    ) {
      return;
    }


  },

  startNewPoll: function () {
    Shelly.emitEvent(CONFIG.eventName);
  },

  getUpdatesUrl: function () { 
    return "https://api.telegram.org/bot" + this.botKey + "/getUpdates"; 
  }
};

// Shelly.call("HTTP.GET", {
//   url: url
// }, function(d, r) {
//   if(r !== 0) {
//     return;
//   }
  
//   let data = JSON.parse(d.body);
//   //offset = d.body.result[0].update_id + 1;
//   //console.log(offset, d.body.result[0].text);
// });

function init () {
  if(typeof KVS.botKey !== "string" || typeof KVS.messageOffset !== "number") {
    console.log("Waiting for the data to be loaded.");
    return;
  }

  Shelly.addEventHandler(TelegramBot.onEvent);
  TelegramBot.init();
}

KVS.load("botKey", init);
KVS.load("messageOffset", init);