const aesKey =
  'dd469421e5f4089a1418ea24ba37c61bdd469421e5f4089a1418ea24ba37c61b'; // 256-bit AES key

const CHECKSUM_SIZE = 4;

function toHex(buffer) {
  let s = '';
  for (let i = 0; i < buffer.length; i++) {
    s += (256 + buffer[i]).toString(16).substr(-2);
  }
  return s;
}

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

function onLoRaMessage(encryptedMsg) {
  console.log('[LoRa] input:', encryptedMsg);

  const encryptedBuffer = fromHex(encryptedMsg);

  const key = fromHex(aesKey);
  const plain = AES.decrypt(encryptedBuffer, key, { mode: 'ECB' });

  if (!plain || plain.byteLength === 0) {
    console.log('[LoRa] invalid msg (empty decryption result)');
    return;
  }

  const hex = toHex(plain);
  const msg = hex2a(hex).trim();
  console.log('[LoRa] raw msg:', msg);

  if (msg.length < CHECKSUM_SIZE + 1) {
    console.log('[LoRa] invalid msg (too short)');
    return;
  }

  const receivedChecksum = msg.slice(0, CHECKSUM_SIZE);
  const actualMessage = msg.slice(CHECKSUM_SIZE);

  console.log(
    '[LoRa] ext msg:',
    actualMessage,
    'with checksum:',
    receivedChecksum
  );

  const calculatedChecksum = generateChecksum(actualMessage);
  console.log('[LoRa] expected checksum:', calculatedChecksum);

  if (receivedChecksum !== calculatedChecksum) {
    console.log('[LoRa] checksum mismatch! Possible data corruption.');
    return;
  }

  console.log('[LoRa] received msg:', actualMessage);
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

  console.log('Event:', JSON.stringify(event));

  const encryptedMsg = atob(event.info.data);
  onLoRaMessage(encryptedMsg);
});

// Example usage
// onLoRaMessage(
//   "bd23e329083d2316ad285f30b33ead0d66d994bf37bfaac9f7f6bdb6a3d621cc6f3eaabb7947ebac07eeb2cafa4a82b71868a8fa8cf5e876fccfd1d2c8dffefe"
// );
