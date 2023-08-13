let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot", //if you have more than once instace of this script, you should set a unique event name for each
};

let KVS = {
  load: function (key, callback) {
    Shelly.call(
      "KVS.Get", 
      { key: key },
      function (data, error, message, self) {
        if(error !== 0) {
          console.log("Cannot read the value for the provided key, reason:", message);
          return;
        }
        self[key] = data.value;
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
  
  onEvent: function () {
    console.log("Poll started");
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "GET",
        url: "https://api.telegram.org/bot" + this.botKey + "/getUpdates", 
        timeout: CONFIG.timeout 
      },
      this.onFinishPoll,
      this
    );
  },

  onFinishPoll: function (data, error, message, self) {
    console.log("Received", data);
    if(error !== 0) {
      console.log("Poll finishes with error ->", message);
      return;
    }

    let response = JSON.parse(data.body);
    for (let res of response.result) {
      console.log(res);
    }

    console.log("hnn");
  },

  startNewPoll: function () {
    Shelly.emitEvent(CONFIG.eventName);
  },
};

function init () {
  if(typeof KVS.botKey !== "string" || typeof KVS.messageOffset !== "number") {
    console.log("Waiting for the data to be loaded.");
    return;
  }

  console.log("Data is loaded");
  Shelly.addEventHandler(function(data) {
    console.log("new event", data.info.event);
    if(
      typeof data === "undefined" || 
      typeof data.info === "undefined" ||
      data.info.event !== CONFIG.eventName
    ) {
      return;
    }

    TelegramBot.onEvent();
  });

  TelegramBot.init(KVS.botKey, KVS.messageOffset);
}

KVS.load("botKey", init);
KVS.load("messageOffset", init);