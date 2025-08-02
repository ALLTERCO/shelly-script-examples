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
