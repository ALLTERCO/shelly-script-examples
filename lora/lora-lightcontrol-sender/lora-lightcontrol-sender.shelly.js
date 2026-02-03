/**
 * @title Remote Light control over LoRa
 * @description Example how to control remote light device over LoRa with Shelly
 *   Scripting. Check README.md before use. (Requires firmware version: 1.6
 *   or newer and LoRa Add-on hardware installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-lightcontrol-sender/lora-lightcontrol-sender.shelly.js
 */

//AES key is only for example, generate unique key!!
const aesKey = 'dd469421e5f4089a1418ea24ba37c61bdd469421e5f4089a1418ea24ba37c61b';
const CHECKSUM_SIZE = 4;

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
  if (typeof message !== 'string') {
    console.log('Message is not string!');
    return;
  }
  const checkSumMessage = generateChecksum(message) + message;
  const encryptedMessage = encryptMessage(checkSumMessage, aesKey);

  Shelly.call(
    'Lora.SendBytes',
    {
      id: 100,
      data: btoa(encryptedMessage)
    },
    function (_, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
      }
    }
  );
}

Shelly.addEventHandler(
  function(event) {
    if (
      !event ||
      !event.info ||
      !event.info.event ||
      !event.info.data ||
      !event.info.data.message ||
      event.info.event !== 'lora_send_message'
    ) {
      return;
    }
    
    sendMessage(event.info.data.message);
  }
);