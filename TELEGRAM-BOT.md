# Telegram Bot

### This file includes instructions of how to setup a telegram bot and how to configure commands for [Telegram commnds example](/control-with-telegram.js)

* [How to setup the bot](#how-to-setup-the-bot)

### How to setup the bot

Setting up a Telegram bot involves a few steps, including creating a bot by messaging the Telegram BotFather account.

1. Open the Telegram app and search for "BotFather".
2. Start a chat with BotFather by sending the command: `/start`.
3. Follow the instructions to create a new bot by sending the command: `/newbot`.
4. BotFather will ask for a name for your bot. Provide a unique name (Example: "ShellyBot").
4. Once you have provided all needed information, BotFather will give you the token. This token is essential for authenticating your bot with the Telegram API. 

**Keep this token safe and do not share it publicly.**

Copy the the token and paste it in the CONFIG -> botKey field. 

Example: 
```javascript
let CONFIG = {
  botKey: "64XXXXXX33:AAH24shXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
};
```

