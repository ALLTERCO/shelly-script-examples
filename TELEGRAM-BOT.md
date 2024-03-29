# Telegram Bot

### This file includes instructions of how to setup a telegram bot and how to configure commands for [telegram-interaction.js](/telegram-interaction.js) example.

### How to setup the bot
Setting up a Telegram bot involves a few steps, including creating a bot by messaging the Telegram BotFather account.

1. Open the Telegram app and search for "BotFather";
2. Start a chat with BotFather by sending the command: `/start`;
3. Follow the instructions to create a new bot by sending the command: `/newbot`;
4. BotFather will ask for a name for your bot. Provide a unique name (Example: "ShellyBot");
5. Once you have provided all needed information, BotFather will give you the token. This token is essential for authenticating your bot with the Telegram API;

**Keep this token safe and do not share it publicly.**
Copy the the token and paste it in the `CONFIG.botKey` field. 

Example: 
```javascript
let CONFIG = {
  botKey: "64XXXXXX33:AAH24shXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
};
```

### Command configuration
* commands are saved as {command name}:{body} pairs in the `CONFIG.commands` list
* command's parameters are seperated by spaces
* the command name is the first word in the message, usually it starts with slash (`/`)
* paramemeters are validated and parsed in the same order as typed in the list
* supported fields:

|Property|Type|Description|Required|
|---|---|---|---|
|params|Array|List of objects, each represents a single parameter. [See more](#params-configuration)|No|
|handler|Function|Called when all params are validated to handle the action. [See more](#handler)|Yes|
|waitForAllParams|Boolean|When `true` (default is `false`), the script will wait for all parameters to be entered (can be in separate messages).|No|
|abortAfter|Number|Maximum number of unsuccessful tries before the command is aborted (Default is infinity).|No|

### Params configurations
* supported fields:

|Property|Type|Description|Required|
|---|---|---|---|
|key|String|Used to identify the value|Yes|
|transform|Function|Validate and return the value. [See more](#transform).|No|
|missingMessage|String|Message to be returned if value is missing.|No|

### Supported functions
#### handler:
To be executed when the command is successfully parsed and all parameters are validated.

Supplied params:
|Property|Type|Description|Required|
|---|---|---|---|
|params|Object|Contains all passed parameters, each value is maped to its key.|
|sendMessage|Function|Function to send a message back to the chat. [See more](#sendmessage)|

Returns:
- Does not return a value.

Example: 
```javascript
function(params, sendMessage) {
  Shelly.call(
    "Switch.Set", 
    { id: 0, on: params.state },
    function(_, error_code, error_message) {
      // the request is successfull
      if(error_code === 0) {
        sendMessage("Ok, the ouput was switched");
      }
      else {
        sendMessage(error_message);
      }
    }
  );
}
```

#### transform
Validates and processes the parameter's value.

Supplied params:
|Property|Type|Description|
|---|---|---|
|value|String|the passed value|
|sendMessage|Function|Function to send a message back to the chat. [See more](#sendmessage)|

Returns:
- The parsed/transformed value or `undefined`/`null` if the value is invalid.

Example: 
```javascript
function(value, sendMessage) {
  if(value === "on" || value === "off") {
    return value === "on";
  }

  sendMessage("Unknown state");
  return undefined;
}
```

#### sendMessage
To send a message back to the chat.

Supplied params:
|Property|Type|Description|
|---|---|---|
|message|String|Message to be sent|

Returns:
- Does not return a value.


Example: 
```javascript
sendMessage("Unknown state");
```
More examples can be seen in [transform](#transform) and [handler](#handler) functions.
