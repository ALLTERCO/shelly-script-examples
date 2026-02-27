/**
 * Script with status handler that listens for DW sensor status changes - state: true/false
 * connected to one of the inptuts of I4DC Gen4
 * 1. Using the command "openssl rand -base64 16" generate AES 128 bits base64 key
 * 2. Put previously generated key to at least one of the keys of the sender and the reciever
 * 3. At least one of the keys in the receiver should be the same as tx_key of the sender
 */

const CONFIG = {
  //ID of the LoRa component instance
  loraComponentKey: "lora:100",
  //The encryption key index, possible values: [1,2,3]
  //Optional - If not provided when calling the one from the config will be used for encryption
  tx_key_id: 1,
  //The address of recipient in LoRa network as hexadecimal string
  lr_addr: "000000BB",
  //Input key on which the DW sensor is connected
  doorWindowComponent: "input:1",
  //Enable/disable status handler (send on state change)
  useStatusHandler: true,
  //Enable/disable timer (send periodically)
  useTimer: true,
  //Timer interval in milliseconds
  interval: 3000,
};

let statusHandler = null;
let timerHandler = null;

function sendMessage(message) {
  Shelly.call(
    'LoRa.Send',
    {
      id: 100,
      lr_addr: CONFIG.lr_addr,
      tx_key_id: CONFIG.tx_key_id,
      data: btoa(message)
    },
    function (data, err, errmsg) {
      if (err) {
        console.log('Error:', err, errmsg);
        return;
      }
    }
  );
}

function handleSensorStatus(eventData) {
  if (
    eventData.component !== "undefined" &&
    eventData.component.indexOf(CONFIG.doorWindowComponent) !== -1 &&
    eventData.delta !== "undefined" &&
    eventData.delta.state !== "undefined"
  ) {
    const component = eventData.component;
    const state = eventData.delta.state;

    console.log("eventData: ", JSON.stringify(eventData));

    const data = {
      component: component,
      value: state
    };

    sendMessage(JSON.stringify(data));
  }
}

function send() {
  const status = Shelly.getComponentStatus(CONFIG.doorWindowComponent);
  const state = status.state;

  const data = {
    component: CONFIG.doorWindowComponent,
    value: state
  };

  sendMessage(JSON.stringify(data));
}

// Status handler setup
if (CONFIG.useStatusHandler) {
  if (statusHandler) {
    Shelly.removeStatusHandler(statusHandler);
  }
  statusHandler = Shelly.addStatusHandler(handleSensorStatus);
}

// Timer setup
if (CONFIG.useTimer) {
  if (timerHandler) {
    Timer.clear(timerHandler);
  }
  timerHandler = Timer.set(CONFIG.interval, true, send);
}
