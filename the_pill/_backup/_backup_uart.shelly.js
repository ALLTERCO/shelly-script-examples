/**
 * @title Backup: early YS-IRTM UART script (deprecated)
 * @description Deprecated backup script with basic YS-IRTM UART handling and known
 *   issues.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/_backup/_backup_uart.shelly.js
 */

// The Pill + YS-IRTM (no RegEx) – minimal mapping script + RX printed as JS array

const BAUD = 9600;
const ADDR = 0xfa; // universal address (recommended)
const uart = UART.get();

const VC_RX = Virtual.getHandle('text:200'); // optional: shows last RX
const VC_TX = Virtual.getHandle('text:201'); // input command
const VC_BTN = Virtual.getHandle('button:200'); // POWER btn

VC_BTN.on('single_push', function (ev) {
   sendFrameFor('POWER');
});

// Map: set your codes here (3 bytes: user_hi user_lo cmd)
const MAP = {  
    POWER: [0x00, 0xbf, 0x0d], //[0x38, 0x30, 0xCF],  
    'VOL+': [0xDF, 0xFF, 0x64], //[0x10, 0xe7, 0x4c], 
    'VOL-': [0x49, 0x7F, 0xA7], //[0x10, 0xe7, 0x17],
    MUTE: [0x00, 0x5F, 0xC7], //[0x10, 0xe7, 0x40],
};

function toHexByte(n) {
   n = n & 0xff;
   return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToStr(bytes) {
   let s = '';
   for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xff);
   return s;
}

function buildFrame(triple) {
 dFrame(triple) {
   return [ADDR, 0xf1, triple[0] & 0xff, triple[1] & 0xff, triple[2] & 0xff];
}

// RX formatting helpers
function toHexLine(data) {
    let hex = '';
    for (let i = 0; i < data.length; i++) {
        const b = data.charCodeAt(i) & 0xff;
        hex += (i ? ' ' : '') + toHexByte(b);
    }
    return hex;
}

function toJsArray(data) {
   let arr = '[';
   for (let i = 0; i < data.length; i++) {
      const b = data.charCodeAt(i) & 0xff;
      arr += (i ? ', ' : '') + '0x' + toHexByte(b);
   }
   arr += ']';
   return arr;
}

// UART init
if (!uart.configure({ baud: BAUD, mode: '8N1' })){
    die();
}

print('YS-IRTM ready @', BAUD, '8N1');
print('Commands: POWER | VOL+ | VOL- | MUTE');

// RX debug: print HEX + JS array
uart.recv(
    function (data) {
        if (!data || !data.length) return;
        // Optional: ignore ACK F1
        if (data.length === 1 && (data.charCodeAt(0) & 0xff) === 0xf1)
        {
            return;
        }
        VC_RX.setValue(
            toHexLine(data) + ' -> ' + toJsArray(data));
    });

function sendFrameFor(cmd) {
   const command = MAP[cmd];
   if (!command) {
      print('Unknown cmd:', cmd);
      return;
   }
   const frame = buildFrame(command);
   let txHex = '';
   for (let i = 0; i < frame.length; i++) {
      txHex += (i ? ' ' : '') + toHexByte(frame[i]);
   }
   uart.write(bytesToStr(frame));
}

function sendCmd() {
   const raw = VC_TX.getValue();
   if (raw === null || raw === undefined) return;
   const cmd = ('' + raw).trim().toUpperCase();
   if (!cmd.length) return;
   sendFrameFor(cmd);
   VC_TX.setValue('');
}

VC_TX.on('change', sendCmd);