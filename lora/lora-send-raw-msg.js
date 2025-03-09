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

function padRight(msg, blockSize) {
  const paddingSize = blockSize - (msg.length % blockSize);

  for (let i = 0; i < paddingSize; i++) {
    msg += ' ';
  }

  return msg;
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

function encryptMessage(msg, keyHex) {
  msg = msg.trim();
  console.log('[LoRa] org msg:', msg, 'size:', msg.length);

  const checksum = generateChecksum(msg);
  msg = checksum + msg;
  const formattedMsg = padRight(msg, 16);

  console.log(
    '[LoRa] formatted msg:',
    formattedMsg,
    'size:',
    formattedMsg.length,
    'checksum:',
    checksum
  );

  const key = fromHex(keyHex);
  const encMsg = AES.encrypt(formattedMsg, key, { mode: 'ECB' });
  console.log('[LoRa] encrypted msg:', toHex(encMsg));

  return encMsg;
}

function sendMessage(msg) {
  const encMsg = encryptMessage(msg, aesKey);

  Shelly.call(
    'Lora.SendBytes',
    {
      id: 100,
      data: btoa(encMsg),
    },
    function (data, err_code, err_msg) {
      if (err_code !== 0) {
        console.log('Error:', err_code, err_msg);
      }
    }
  );
}

// Example usage
// sendMessage("Send message to another Shelly device over the LoRa network");
