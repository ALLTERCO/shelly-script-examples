/**
 * @title Send message over lora without encryption
 * @description This script demonstrates how to send unencrypted LoRa messages using
 *   Shelly scripting. (Requires firmware version: 1.6 or newer and LoRa
 *   Add-on hardware installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-send-no-encryption.shelly.js
 */

// LoRa Sender
let id = 0;

function sendMessage(msg) {
  Shelly.call(
    'Lora.SendBytes',
    {
      id: 100,
      data: btoa(msg),
    },
    function (data, err, errmsg) {
      if (err) {
        console.log('Error:', err, errmsg);
        return;
      }
    }
  );
}

function send() {
  id++;

  let msg = 'ID:' + id;

  console.log('Sending message:', msg);
  sendMessage(msg);
}

Timer.set(
  7000, // Interval in milliseconds
  true, // Repeat
  send // Callback function
);
