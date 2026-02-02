/**
 * @title Remote Cover control over LoRa
 * @description Example how to send commands over LoRa to control Cover device. Check
 *   README.md before use. (Requires firmware version: 1.6 or newer and
 *   LoRa Add-on hardware installed)
 */

//AES key is only for example, generate unique key!!
const aesKey = 'dd469421e5f4089a1418ea24ba37c61bdd469421e5f4089a1418ea24ba37c61b';
const CHECKSUM_SIZE = 4;
const OPEN_MSG = 'c0:100';
const CLOSE_MSG = 'c0:0';

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

//Close cover
//sendMessage(CLOSE_MSG);

//Open cover
//sendMessage(OPEN_MSG);