/**
 * @title Remote Cover control over LoRa and receive BTHome sensor data
 * @description Example how to send commands over LoRa to control Cover device and
 *   receive data from BTHome sensors. Check README.md before use.
 *   (Requires firmware version: 1.6 or newer and LoRa Add-on hardware
 *   installed)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/lora/lora-covercontrol-receiver/lora-covercontrol-receiver.shelly.js
 */

//AES key is only for example, generate unique key!!
const aesKey = 'dd469421e5f4089a1418ea24ba37c61bdd469421e5f4089a1418ea24ba37c61b';
const CHECKSUM_SIZE = 4;
const PREFIX_ENUM = {
  'c': 'cover'
};

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

function verifyMessage(message) {
  if (message.length < CHECKSUM_SIZE + 1) {
    console.log('[LoRa] invalid message (too short)');
    return;
  }

  const receivedCheckSum = message.slice(0, CHECKSUM_SIZE);
  const _message = message.slice(CHECKSUM_SIZE);
  const expectedChecksum = generateChecksum(_message);

  if (receivedCheckSum !== expectedChecksum) {
    console.log('[LoRa] invalid message (checksum corrupted)');
    return;
  }

  return _message;
}

function decryptMessage(buffer, keyHex) {
  function fromHex(hex) {
    const arr = new ArrayBuffer(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return arr;
  }

  function hex2a(hex) {
    hex = hex.toString();
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  function toHex(buffer) {
    let s = '';
    for (let i = 0; i < buffer.length; i++) {
      s += (256 + buffer[i]).toString(16).substr(-2);
    }
    return s;
  }

  const key = fromHex(keyHex);
  const decrypted = AES.decrypt(buffer, key, { mode: 'ECB' });

  if (!decrypted || decrypted.byteLength === 0) {
    console.log('[LoRa] invalid msg (empty decryption result)');
    return;
  }

  const hex = toHex(decrypted);
  const checksumMessage = hex2a(hex).trim();
  const finalMessage = verifyMessage(checksumMessage);
  
  return finalMessage;
}

function coverPositionHandler(message) {
  if (typeof message !== 'string' || message.split(':').length !== 2) {
    console.log('Message in wrong format!');
    return;
  }

  const id = parseInt(message.split(':')[0].split('')[1]);
  const pos = message.split(':')[1];

  Shelly.call(
    'Cover.GoToPosition',
    {
      id: id,
      pos: pos
    },
    function(_, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error: ', err_msg);
      }
    }
  );
}

Shelly.addEventHandler(function (event) {
  if (
    typeof event !== 'object' ||
    event.name !== 'lora' ||
    !event.info ||
    !event.info.data
  ) {
    return;
  }

  const encryptedMsg = atob(event.info.data);
  const decryptedMessage = decryptMessage(encryptedMsg, aesKey);

  //do nothing, message is not encrypted or AES key mismatch
  if (typeof decryptedMessage === "undefined") {
    return;
  }

  coverPositionHandler(decryptedMessage);
});