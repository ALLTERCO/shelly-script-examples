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
