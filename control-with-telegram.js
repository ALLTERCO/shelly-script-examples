let CONFIG = {
  timeout: 5, //in seconds
  timer: 500, //in miliseconds
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
            if(value === "test") { 
              return value; 
            }

            sendMessage("test");
            return undefined;
          }, 
          missingMessage: "Missing device ID"
        }
      ],
      handler: function(params, sendMessage) {
        sendMessage("Thanks for the " + params.deviceId);
      },
      waitForAllParams: true, //if true, the script will wait for all params to be entered (can be in different messagegs)
      abortAfter: 3, //abort after 3 unsuccessfull tries
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
    this[key] = value;
    Shelly.call("KVS.Set", { key: key, value: value } );
  }
};

let TelegramBot = {
  init: function () {
    Shelly.emitEvent(CONFIG.eventName);
  },
  
  onEvent: function () {
    console.log("Poll started");
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + KVS.botKey + "/getUpdates", 
        timeout: CONFIG.timeout,
        body: {
          offset: KVS.messageOffset + 1
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
    }

    let lastUpdateId = -1;
    for (let res of response.result) {
      console.log("New message", res.message.text);
      self.handleMessage(res.message);
      lastUpdateId = res.update_id;
    }

    if (lastUpdateId > KVS.messageOffset) {
      KVS.write("messageOffset", lastUpdateId);
    }

    Timer.set(CONFIG.timer, false, function() {
      Shelly.emitEvent(CONFIG.eventName);
    });
  },

  handleMessage: function (message) {
    let words = message.text.trim().split(" ");

    function sendMessage(textMsg) {
      console.log(textMsg, message.chat.id);
      Shelly.call(
        "HTTP.REQUEST",
        { 
          method: "POST",
          url: "https://api.telegram.org/bot" + KVS.botKey + "/sendMessage", 
          timeout: 5,
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: textMsg
          })
        },
        function(_, error, msg) {
          console.log(error, msg);
        }
      );
    }

    if(
      this.lastCommand && 
      typeof CONFIG.commands[this.lastCommand.key].abortAfter === "number" &&
      this.lastCommand.tries >= CONFIG.commands[this.lastCommand.key].abortAfter
    ) {
      sendMessage("Max ties exceeded, aborting...");
    }
    else {
      if(CONFIG.commands) {
        let params = {};

        if(words.length > 0 && (words[0].trim() in CONFIG.commands || this.lastCommand)) {
          let commandKey = words[0].trim();
          let paramScanStartId = 0;
          let offsetParams = 1;

          if(this.lastCommand) {
            commandKey = this.lastCommand.key;
            params = this.lastCommand.params;
            paramScanStartId = this.lastCommand.waitingParamId;
            offsetParams = 0;
          }

          let command = CONFIG.commands[commandKey];

          if(command.waitForAllParams && typeof this.lastCommand === "undefined") {
            this.lastCommand = {
              key: words[0].trim(),
              params: {},
              waitingParamId: 0,
              tries: 0
            };
          }

          for (let i = paramScanStartId; i < command.params.length; i++) {
            if(words.length <= i + offsetParams) {
              sendMessage(command.params[i].missingMessage);

              if(this.lastCommand) {
                this.lastCommand.waitingParamId = i;
                this.lastCommand.tries += 1;
              }

              return;
            }
            else {
              if(typeof command.params[i].parser !== "function") {
                params[command.params[i].key] = words[i + offsetParams];
                if(this.lastCommand) {
                  this.lastCommand.params = params;
                }

                continue;
              }

              let value = command.params[i].parser(words[i + offsetParams], sendMessage);
              if(typeof value === "undefined") {
                if(this.lastCommand) {
                  this.lastCommand.waitingParamId = i;
                  this.lastCommand.tries += 1;
                }

                return;
              }
              params[command.params[i].key] = value;
              if(this.lastCommand) {
                this.lastCommand.params = params;
              }
            }
          }

          command.handler(params, sendMessage);
        }
        else { //no matching command
          sendMessage("Not recognized command");
        }
      }
      else { //no defined commands
        CONFIG.onMessage(message.text, sendMessage);
      }
    }

    this.lastCommand = undefined;
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