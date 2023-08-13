let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot",
  newPollSubfix: "new-poll", //if you have more than once instace of this script, you should set a unique event name for each,
  updateIdSubfix: "update-id", // ^^^
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
  botKey: undefined,
  messageOffset: undefined,

  init: function (botKey, messageOffset) {
    this.botKey = botKey;
    this.messageOffset = messageOffset;

    Shelly.emitEvent(CONFIG.eventName + "-" + CONFIG.newPollSubfix, { test: true });
  },
  
  onEvent: function () {
    console.log("Poll started");
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + this.botKey + "/getUpdates", 
        timeout: CONFIG.timeout,
        body: {
          offset: this.messageOffset + 1
        }
      },
      this.onFinishPoll,
      this
    );
  },

  /* callback */
  onFinishPoll: function (data, error, errorMessage, self) {
    if(error !== 0) {
      console.log("Poll finishes with error ->", errorMessage);
      return;
    }

    let response = JSON.parse(data.body);
    if(response.result.length === 0) {
      console.log("No new messages");
      return;
    }

    let lastUpdateId = -1;
    for (let res of response.result) {
      console.log("New message", res.message.text);
      self.handleMessage(res.message);
      lastUpdateId = res.update_id;
    }

    Shelly.emitEvent(CONFIG.eventName + "-" + CONFIG.updateIdSubfix, { lastUpdateId: lastUpdateId });
  },

  handleMessage: function (message) {
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + this.botKey + "/sendMessage", 
        timeout: CONFIG.timeout,
        body: {
          chat_id: message.chat.id,
          text: "Ok."
        }
      }
    );

    Shelly.emitEvent(
      CONFIG.eventName, 
      { 
        message: message.text
      }
    );
  },
};

function init () {
  if(typeof KVS.botKey !== "string" || typeof KVS.messageOffset !== "number") {
    console.log("Waiting for the data to be loaded.");
    return;
  }

  console.log("Data is loaded");
  Shelly.addEventHandler(function(data) {
    if (
      typeof data === "undefined" || 
      typeof data.info === "undefined"
    ) {
      return;
    }

    if (data.info.event === CONFIG.eventName + "-" + CONFIG.newPollSubfix) {
      TelegramBot.onEvent();
    }
    else if (data.info.event === CONFIG.eventName + "-" + CONFIG.updateIdSubfix) {
      if (data.info.data.lastUpdateId <= KVS.messageOffset) {
        console.log(data.info.data.lastUpdateId, "<", KVS.messageOffset, ", so nothing to save..");
        return;
      }
    
      KVS.write("messageOffset", data.info.data.lastUpdateId);
    }
  });

  TelegramBot.init(KVS.botKey, KVS.messageOffset);
}

KVS.load("botKey", init);
KVS.load("messageOffset", init);