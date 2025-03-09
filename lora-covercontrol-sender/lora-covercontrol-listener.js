//AES key is only for example, generate unique key!!
const aesKey = 'TNSFmcJnYzU+F4P9hlT4G7eQNXDTKeoB3bzdRCiTSLCACD/SlB0+/CSBZF7l7klM';
const CHECKSUM_SIZE = 4;
const COMPONENT_ENUM = {
  'dw': 'Door/window sensor',
  'tm': 'Temperature sensor',
  'hm': 'Humidity sensor'
};
const DW_ENUM = { '0': 'close event', '1': 'open event' };

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

function messageHandler(message) {
  if (message.slice(0, 4) !== 'snr-') {
    console.log('Message prefix error!');
  }

  const _message = message.slice(4);
  const value = _message.split(':')[1];
  const component = _message.split(':')[0];
  const name = component.slice(0, 2);
  const namePrettified = COMPONENT_ENUM[name];
  const id = component.slice(2);

  if (name === 'dw') {
    console.log([namePrettified, id, 'registered', DW_ENUM[value]].join(' '));
    return;
  }

  if (name === 'tm') {
    console.log([namePrettified, id, 'registered', value, '°C', 'temperature change'].join(' '));
    return;
  }

  if (name === 'hm') {
    console.log([namePrettified, id, 'registered', (value + '%'), 'humidity change'].join(' '));
    return;
  }
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

  messageHandler(decryptedMessage);
});