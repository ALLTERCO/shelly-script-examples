let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot", //if you have more than once instace of this script, you should set a unique event name for each,

  /**
   * Called on each received message
   * @param {String} message the raw received message
   * @param {Function} sendMessage function to send message back
   */
  onMessage: function(message, sendMessage) { 

  },

  //if commands: null the script will emit event with the message without any validation
  commands: {
    "/test": {
      params: [
        {
          key: "deviceId", //required
          //must return a value, return undefined to reject the value
          parser: function(value, sendMessage) { 
            return value; 
          }, 
          missingMessage: "Please enter device ID"
        }
      ],
      handler: function(params, sendMessage) {
        sendMessage("Thanks for the " + params.deviceId);
      }
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

    Shelly.emitEvent(CONFIG.eventName, { test: true });
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

    if (lastUpdateId <= KVS.messageOffset) {
      console.log(lastUpdateId, "<", KVS.messageOffset, ", so nothing to save..");
      return;
    }
  
    KVS.write("messageOffset", lastUpdateId);
  },

  handleMessage: function (message) {
    let words = message.text.trim().split(" ");

    function sendMessage(text) {
      return this.sendMessage(message.chat.id, text);
    }

    if(CONFIG.commands) {
      let params = {};
      words[0] = words[0].trim();

      if(words.length > 0 && words[0] in CONFIG.commands) {
        let cmdParams = CONFIG.commands[words[0]].params;

        for (let i = 0; i < cmdParams.length; i++) {
          if(words.length <= i + 1) {
            sendMessage(cmdParams[i].missingMessage);
            return;
          }
          else {
            if(typeof cmdParams[i].parser !== "function") {
              params[cmdParams[i].key] = words[i + 1];
              continue;
            }

            let value = cmdParams[i].parser(words[i + 1], sendMessage);
            if(typeof value === "undefined") {
              return;
            }
          }
        }

        CONFIG.commands[words[0]].handler(params, sendMessage);
      }
      else { //no matching command
        sendMessage("Not recognized command");
      }
    }
    else { //no defined commands
      CONFIG.onMessage(message.text, sendMessage);
    }
  },

  sendMessage: function (chatId, text) {
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + this.botKey + "/sendMessage", 
        timeout: CONFIG.timeout,
        body: {
          chat_id: chatId,
          text: text
        }
      }
    );
  }
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