let CONFIG = {
  timeout: 15, //in seconds
  eventName: "telegram-bot", //if you have more than once instace of this script, you should set a unique event name for each
  commands: {
    "/test": {
      action: function (args) {
        console.log(args);
      }
    }
  }
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
  onLastMessage: undefined, // (lastMessageId)

  init: function (botKey, messageOffset, onLastMessage) {
    this.botKey = botKey;
    this.messageOffset = messageOffset;
    this.onLastMessage = onLastMessage;

    this.startNewPoll();
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
    console.log(self);
    if(error !== 0) {
      console.log("Poll finishes with error ->", errorMessage);
      return;
    }

    let lastUpdateId = -1;
    let response = JSON.parse(data.body);
    if(response.result.length === 0) {
      console.log("No new messages");
      return;
    }

    for (let res of response.result) {
      console.log(JSON.stringify(res));
      self.handleMessage(res.message);
      lastUpdateId = res.update_id;
    }

    if(typeof self.onLastMessage === "function") {
      self.onLastMessage(lastUpdateId);
    }
  },

  handleMessage: function (message) {
    this.sendMessage(message.chat.id, message.text);
  },

  sendMessage: function(chatId, message) {
    Shelly.call(
      "HTTP.REQUEST",
      { 
        method: "POST",
        url: "https://api.telegram.org/bot" + this.botKey + "/sendMessage", 
        timeout: CONFIG.timeout,
        body: {
          chat_id: chatId,
          text: message
        }
      },
      this.onFinishPoll,
      this
    );
  },

  startNewPoll: function () {
    Shelly.emitEvent(CONFIG.eventName);
  },
};

function onLastMessage (lastUpdateId) {
  console.log(lastUpdateId);

  if (lastUpdateId <= KVS.messageOffset) {
    return;
  }

  KVS.write("messageOffset", lastUpdateId);
}

function init () {
  if(typeof KVS.botKey !== "string" || typeof KVS.messageOffset !== "number") {
    console.log("Waiting for the data to be loaded.");
    return;
  }

  console.log("Data is loaded");
  Shelly.addEventHandler(function(data) {
    if(
      typeof data === "undefined" || 
      typeof data.info === "undefined" ||
      data.info.event !== CONFIG.eventName
    ) {
      return;
    }

    TelegramBot.onEvent();
  });

  TelegramBot.init(KVS.botKey, KVS.messageOffset, onLastMessage);
}

KVS.load("botKey", init);
KVS.load("messageOffset", init);