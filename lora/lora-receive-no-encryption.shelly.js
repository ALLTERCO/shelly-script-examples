/**
 * @title Receive message over lora without encryption
 * @description This script demonstrates how to receive unencrypted LoRa messages
 *   using Shelly scripting. (Requires firmware version: 1.6 or newer and
 *   LoRa Add-on hardware installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-receive-no-encryption.shelly.js
 */

//LoRa Receiver
Shelly.addEventHandler(function (event) {
  if (
    !event ||
    event.name !== 'lora' ||
    event.id !== 100 ||
    !event.info ||
    !event.info.data
  ) {
    return;
  }

  console.log(
    'Event:',
    JSON.stringify({
      info: event.info,
    })
  );

  let message = atob(event.info.data);
  console.log('Received message:', message);

  Shelly.call('Switch.toggle', { id: 0 });
});
