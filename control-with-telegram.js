let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot",
  newPollSubfix: "new-poll", //if you have more than once instace of this script, you should set a unique event name for each,
  updateIdSubfix: "update-id", // ^^^

  //if commands: null the script will emit event with the message without any validation
  commands: {
    "/test": {
      success: "Ok, thanks",
      params: [
        {
          key: "deviceId", //required
          error: "Sorry, I need the device ID",
        }
      ]
    }
  },
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
    let words = message.text.split(" ");
    let text = "Ok.";
    let hasError = false;

    let readyParams = {};

    if(CONFIG.commands) {
      if(words.length > 0 && words[0] in CONFIG.commands) {
        let params = CONFIG.commands[words[0]].params;
        text = CONFIG.commands[words[0]].success;

        for (let i = 0; i < params.length; i++) {
          if(words.length <= i + 1) {
            text = params[i].error;
            hasError = true;
            break;
          }
          else {
            readyParams[params[i].key] = words[i + 1];
          }
        }
      }
    }

    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + this.botKey + "/sendMessage", 
        timeout: CONFIG.timeout,
        body: {
          chat_id: message.chat.id,
          text: text
        }
      }
    );

    if(!hasError) {
      Shelly.emitEvent(
        CONFIG.eventName, 
        { 
          message: message.text,
          params: readyParams
        }
      );
    }
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