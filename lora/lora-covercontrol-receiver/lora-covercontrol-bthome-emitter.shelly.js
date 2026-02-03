/**
 * @title Receive cover control commands over LoRa and send BTHome sensor data
 * @description Example how to handle commands over LoRa to control Cover device and
 *   data from BTHome sensors. Check README.md before use. (Requires
 *   firmware version: 1.6 or newer and LoRa Add-on hardware installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-covercontrol-receiver/lora-covercontrol-bthome-emitter.shelly.js
 */

//AES key is only for example, generate unique key!!
const aesKey = 'TNSFmcJnYzU+F4P9hlT4G7eQNXDTKeoB3bzdRCiTSLCACD/SlB0+/CSBZF7l7klM';
const CHECKSUM_SIZE = 4;

const MSG_PREFIX = 'snr-';
const DOOR_COMPONENT = 'bthomesensor:203'; //window sensor to listen for
const TEMP_COMPONENT = 'bthomesensor:202'; //temp sensor to listen for
const HUMIDITY_COMPONENT = 'bthomesensor:201'; //humidity sensor to listen for
const HUMIDITY_LIMIT = 50; //humidity threshold
const TEMP_LIMIT = 25; //temp threshold
const HUMIDITY_STEP = 2;
const TEMP_STEP = 0.5;

let _temperature = null;
let _humidity = null;

function encryptMessage(msg, keyHex) {
  function fromHex(hex) {
    const arr = new ArrayBuffer(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return arr;
  }

  function padRight(msg, blockSize) {
    const paddingSize = (blockSize - msg.length % blockSize) % blockSize;;

    for (let i = 0; i < paddingSize; i++) {
      msg += ' ';
    }

    return msg;
  }

  msg = msg.trim();
  const formattedMsg = padRight(msg, 16);
  const key = fromHex(keyHex);
  const encMsg = AES.encrypt(formattedMsg, key, { mode: 'ECB' });
  return encMsg;
}

function generateChecksum(msg) {
  let checksum = 0;
  for (let i = 0; i < msg.length; i++) {
    checksum ^= msg.charCodeAt(i);
  }
  let hexChecksum = checksum.toString(16);

  while (hexChecksum.length < CHECKSUM_SIZE) {
    hexChecksum = '0' + hexChecksum;
  }

  return hexChecksum.slice(-CHECKSUM_SIZE);
}

function sendMessage(message) {
  const checkSumMessage = generateChecksum(message) + message;
  const encryptedMessage = encryptMessage(checkSumMessage, aesKey);

  Shelly.call(
    'Lora.SendBytes',
    { id: 100, data: btoa(encryptedMessage) },
    function (_, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
      }
    }
  );
}

function stepVerify(previous, current, limit, step) {
  //first value exceeding limit
  if (previous === null && current > limit) {
    return true;
  }

  //value exceed limit and is bigger/lesser than step variable
  return current >= limit && (current <= (previous - step) || current >= (previous + step));
}

function statusHandler(status) {
  const component = status.component;
  const value = status.delta.value;
  const id = status.id;
  
  if (component === DOOR_COMPONENT) {
    sendMessage(MSG_PREFIX + 'dw' + id + ':' + (value ^ 0));
    return;
  };

  if (component === HUMIDITY_COMPONENT && stepVerify(_humidity, value, HUMIDITY_LIMIT, HUMIDITY_STEP)) {
    sendMessage(MSG_PREFIX + 'hm' + id + ':' + value);
    _humidity = value;
    return;
  }

  if (component === TEMP_COMPONENT && stepVerify(_temperature, value, TEMP_LIMIT, TEMP_STEP)) {
    sendMessage(MSG_PREFIX + 'tm' + id + ':' + value);
    _temperature = value;
    return;
  }
}

Shelly.addStatusHandler(
  function(status) {
    if (
      status.component === DOOR_COMPONENT ||
      status.component === TEMP_COMPONENT ||
      status.component === HUMIDITY_COMPONENT
    ) {
      statusHandler(status);
    }
  }
)