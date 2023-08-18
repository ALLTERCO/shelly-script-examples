/**
 * This script provides a framework for creating a basic Telegram bot using the 
 * scriping functionalities of the Gen2 devices. It allows you to define custom commands, 
 * validate parameters, and perform actions based on user messages. 
 * The bot interacts with the Telegram API to receive and send messages. 
 * 
 * The script will take advantage of the KVS to store the messages offset value. The key 
 * for it is the script's ident name from the configuration
 * 
 * Please check TELEGRAM-BOT.md for instructions how to setup the telegram bot and 
 * further instructions of how to configure the commands
 */

let CONFIG = {
  // the bot api key taken from the BotFather
  botKey: "64XXXXXX33:AAH24shXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

  // timeout value for HTTP requests in seconds.
  timeout: 5,

  // timer interval in milliseconds for polling updates from Telegram API.
  timer: 500, 

  // unique name used for communication between different parts of this script and KVS.
  identName: "telegram-bot", 

  // if set to true, the script will print debug messages in the console
  debug: false,

  // object defining custom commands that the bot can understand and respond to.
  commands: {

    // command identifier, e.g. /toggle on|off
    "/toggle": {

      // list of params, parsed in the same order as in the list
      params: [
        {
          // value key, later can be used to get the parsed value
          key: "state",

          /**
           * Validates and processes the parameter's value
           * @param {String} value the passed value
           * @param {Function} sendMessage function to send a message back
           * @returns {Any} return the value, or undefined|null in case of validation failure.
           */
          transform: function(value, sendMessage) {
            if(value === "on" || value === "off") {
              return value === "on";
            }

            sendMessage("Unknown state");
            return undefined;
          }
        }
      ],
      
      /**
       * To be executed when the command is successfully parsed and all parameters are validated.
       * @param {Object} params all passed parameters, each value is maped to its key
       * @param {Function} sendMessage function to send a message back
       */
      handler: function(params, sendMessage) {
        Shelly.call("Switch.Set", { id: 0, on: params.state });

        sendMessage("Ok, the ouput was switched");
      },

      // if true, the script waits for all parameters to be entered (can be in separate messages).
      waitForAllParams: false, 

      // specifies the maximum number of unsuccessful tries before the command is aborted.
      abortAfter: 3, 
    },
    "/ping": {
      params: [
        {
          key: "deviceIp", 
          transform: function(value, sendMessage) {
            if(value.split(".").length === 4) {
              return value;
            }

            sendMessage("Invalid IP");
          }, 
          missingMessage: "Send me an local IP"
        },
        {
          key: "timeout", 
          transform: function(value, sendMessage) {
            value = Number(value);

            if(!isNaN(value)) {
              return value;
            }

            sendMessage("Invalid timeout value");
          }, 
          missingMessage: "Send me the timeout"
        }
      ],
      handler: function(params, sendMessage) {
        sendMessage("Thanks for the " + JSON.stringify(params));
      },
    }
  },
};

let TelegramBot = {

  /**
   * Initializes the bot by emitting the specified event to start polling for updates.
   */
  init: function () {
    Shelly.call(
      "KVS.Get", 
      { key: CONFIG.identName },
      (function (data, error) {
        let value = 0;
        if(error !== 0) {
          console.log("Cannot read the value for the provided key, reason, using default value.");
        }
        else {
          value = data.value;
        }
        this.messageOffset = value;
        Shelly.emitEvent(CONFIG.identName);
      }.bind(this))
    );
  },
  
  /**
   * Called when the event specified in the CONFIG is emitted
   */
  onEvent: function () {
    if(CONFIG.debug) {
      console.log("Poll started");
    }
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + CONFIG.botKey + "/getUpdates", 
        timeout: CONFIG.timeout,
        body: {
          offset: this.messageOffset + 1,
          limit: 1
        }
      },
      this.onFinishPoll.bind(this),
      this
    );
  },

  /**
   * Callback function after finishing polling updates from the Telegram API. See https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#shellycall
   * @param {Object|null|undefined} data the received data from the request  
   * @param {Number} error the id of the error 
   * @param {*} errorMessage the error message if has
   * @returns 
   */
  onFinishPoll: function (data, error, errorMessage) {
    if(error !== 0) {
      console.log("Poll finishes with error ->", errorMessage);
      console.log("Aborting...");
      return;
    }

    let response = JSON.parse(data.body);

    if(!response.ok) {
      console.log("Something is wrong with the config. Error:", response.description);
      return;
    }

    if(response.result.length === 0 && CONFIG.debug) {
      console.log("No new messages");
    }

    let lastUpdateId = -1;
    for (let res of response.result) {
      if(CONFIG.debug) {
        console.log("New message", res.message.text);
      }
      this.handleMessage(res.message);
      lastUpdateId = res.update_id;
    }

    if (lastUpdateId > this.messageOffset) {
      this.messageOffset = lastUpdateId;
      Shelly.call("KVS.Set", { key: CONFIG.identName, value: this.messageOffset } );
    }

    Timer.set(CONFIG.timer, false, function() {
      Shelly.emitEvent(CONFIG.identName);
    });
  },

  /**
   * Processes received messages
   * @param {Object} message received message object from the API
   */
  handleMessage: function (message) {
    if(CONFIG.debug) {
      console.log("MSG", JSON.stringify(message.text));
    }
    let words = message.text.trim().split(" ");

    function sendMessage(textMsg) {
      if(CONFIG.debug) {
        console.log("SENDING", textMsg, message.chat.id);
      }

      Shelly.call(
        "HTTP.GET",
        { 
          url: "https://api.telegram.org/bot" + CONFIG.botKey + "/sendMessage?chat_id=" + message.chat.id + "&text=" + textMsg, 
          timeout: 1,
        },
        function(d, r, m) {
          if(CONFIG.debug) {
            console.log("MSG SENT", JSON.stringify(d), r, m);
          }
        }
      );
    }

    if(CONFIG.debug) {
      console.log("COMMAND", JSON.stringify(this.lastCommand));
    }

    if(
      this.lastCommand && 
      typeof CONFIG.commands[this.lastCommand.key].abortAfter === "number" &&
      this.lastCommand.tries > CONFIG.commands[this.lastCommand.key].abortAfter
    ) {
      sendMessage("Max tries exceeded, aborting...");
    }
    else {
      if(CONFIG.commands) {
        let params = {};

        if(words.length > 0 && (words[0] in CONFIG.commands || this.lastCommand)) {
          let commandKey = words[0];
          let paramScanStartId = 0;
          let wordCounter = 1;

          if(this.lastCommand) {
            commandKey = this.lastCommand.key;
            params = this.lastCommand.params;
            paramScanStartId = this.lastCommand.waitingParamId;
            wordCounter = 0;
          }

          let command = CONFIG.commands[commandKey];

          if(command.waitForAllParams && typeof this.lastCommand === "undefined") {
            this.lastCommand = {
              key: commandKey,
              params: {},
              waitingParamId: 0,
              tries: 0
            };
          }

          for (let i = paramScanStartId; i < command.params.length; i++) {
            if(wordCounter >= words.length) {
              sendMessage(command.params[i].missingMessage || "Missing \'" + command.params[i].key + "\' param");

              if(this.lastCommand) {
                this.lastCommand.waitingParamId = i;
                this.lastCommand.tries += 1;
              }

              return;
            }
            else {
              let value = words[wordCounter++];

              if(typeof command.params[i].transform === "function") {
                value = command.params[i].transform(value, sendMessage);
              }
              
              if(typeof value === "undefined" || value === null) {
                if(this.lastCommand) {
                  this.lastCommand.waitingParamId = i;
                  this.lastCommand.tries += 1;
                }

                return;
              }

              params[command.params[i].key] = value;
              if(this.lastCommand) {
                this.lastCommand.params = params;
                this.lastCommand.tries = 0; 

                if(CONFIG.debug) {
                  console.log("RESET COUNTER");
                }
              }
            }
          }

          command.handler(params, sendMessage);
        }
        else { //no matching command
          sendMessage("Not recognized command");
        }
      }
    }

    this.lastCommand = undefined;
  },
};

/**
 * initializes the bot and setting up event listeners.
 */
function init () {
  Shelly.addEventHandler(function(data) {
    if (
      typeof data === "undefined" || 
      typeof data.info === "undefined" ||
      data.info.event !== CONFIG.identName
    ) {
      return;
    }

    TelegramBot.onEvent();
  });

  TelegramBot.init();
}

init();