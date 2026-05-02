/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher
 * @description Polls all currently known readable holding and input registers
 *   from the V-TAC VT-66036103 and compares them against embedded baseline
 *   values captured from local discovery.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/V-TAC/vtac_baseline_watch.shelly.js
 */

/**
 * Latest working hypotheses from live testing:
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1200,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60,
};

var BLOCKS = [
  '3,4096,1,',
  '3,4161,2,0=36|1=1282',
  '3,4164,1,',
  '3,4194,1,',
  '3,4196,3,',
  '3,4608,1,',
  '3,4628,9,1=10052|2=10143|3=2048|4=11|5=10707|6=10038|7=10138|8=19251',
  '3,4656,1,',
  '3,4658,3,2=17968',
  '3,4676,1,0=12288',
  '3,4678,2,0=7',
  '3,4682,28,',
  '3,4714,3,',
  '3,4736,1,',
  '3,4756,1,',
  '3,4761,29,',
  '3,4864,7,',
  '3,4886,1,',
  '3,4889,9,',
  '3,5632,1,',
  '3,5634,1,',
  '3,5636,1,',
  '3,5638,1,',
  '3,5640,1,',
  '3,5642,1,',
  '3,5644,1,',
  '3,5646,1,',
  '3,5648,1,',
  '3,5650,1,',
  '3,5652,1,',
  '3,5654,1,',
  '3,5664,1,',
  '3,5674,1,',
  '3,5684,1,',
  '3,5694,1,',
  '3,5704,1,',
  '3,5714,1,',
  '3,5724,1,',
  '3,5734,1,',
  '3,5744,1,0=4',
  '3,5752,1,0=6405',
  '3,5756,3,0=7',
  '3,5760,2,',
  '3,5774,1,',
  '3,5776,19,0=130|2=120|8=2377|10=2306|11=1|12=10|13=1|14=2884|16=4998|17=100',
  '3,5796,1,',
  '3,5798,4,0=240|1=540|2=240',
  '3,5804,1,',
  '3,5810,1,',
  '3,5824,8,0=7|2=9|4=7|6=10',
  '3,5873,2,',
  '3,5936,1,',
  '3,5960,1,',
  '3,6032,1,',
  '3,6034,1,',
  '3,6036,1,',
  '3,6038,1,',
  '3,6040,1,',
  '3,6144,1,',
  '3,6152,1,',
  '3,6160,1,',
  '3,6168,1,',
  '3,6176,1,',
  '3,6184,1,',
  '3,6192,1,',
  '3,6200,1,',
  '3,6208,1,',
  '3,6216,1,',
  '3,6224,1,',
  '3,6232,1,',
  '3,6240,1,',
  '3,6248,1,',
  '3,6256,1,',
  '3,6264,1,',
  '3,6272,1,',
  '3,6280,1,',
  '3,6288,1,',
  '3,6296,1,',
  '3,6304,1,',
  '3,6312,1,',
  '3,6320,1,',
  '3,6328,1,',
  '3,6336,1,',
  '3,6344,1,',
  '3,6352,1,',
  '3,6360,1,',
  '3,6368,1,',
  '3,6376,1,',
  '3,6384,1,',
  '3,6392,1,',
  '3,8704,97,0=940|1=970|2=1030|3=1060|4=440|7=440|8=1000|9=160|10=160|11=106|12=110|13=1000|14=6200|15=6120|16=4705|17=4650|18=1|19=40|20=10|21=3000|22=1200|23=500|24=500|25=130|26=200|27=20|28=1|29=1000|30=500|31=50|32=50|33=36|34=50|35=50|36=40|37=30|38=1200|39=800|40=6700|41=4500|42=1|43=1300|44=1',
  '3,8810,1,',
  '3,8820,1,',
  '3,8830,1,',
  '3,8832,1,',
  '3,8834,1,',
  '3,8836,1,0=65535',
  '3,8838,1,',
  '3,8840,1,',
  '3,8842,1,',
  '3,8844,1,',
  '3,8846,1,',
  '3,8848,3,',
  '3,8852,13,4=100',
  '3,8988,8,0=200|1=50|2=100|3=100|4=5050|5=4700|6=1100|7=850',
  '4,999,64,'
];

var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0,
};

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function toHex16(n) {
  return toHex((n >> 8) & 0xFF) + toHex(n & 0xFF);
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return crc;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var i;
  for (i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function fcLabel(fc) {
  return fc === 3 ? 'HOLDING' : 'INPUT';
}

function makeKey(fc, addr) {
  return fc + ':' + addr;
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function parseBlock(s) {
  var parts = s.split(',');
  return {
    fc: JSON.parse(parts[0]),
    start: JSON.parse(parts[1]),
    len: JSON.parse(parts[2]),
    nz: parts.length > 3 ? parts[3] : '',
  };
}

function baselineAt(block, offset) {
  if (block.nz === '') return 0;
  var items = block.nz.split('|');
  var i;
  for (i = 0; i < items.length; i++) {
    var kv = items[i].split('=');
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function sendRead(fc, addr, qty, callback) {
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var data = [(addr >> 8) & 0xFF, addr & 0xFF, (qty >> 8) & 0xFF, qty & 0xFF];
  var frame = buildFrame(CONFIG.SLAVE_ID, fc, data);
  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var done = state.pendingRequest.callback;
      state.pendingRequest = null;
      done('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!state.pendingRequest || !data || data.length === 0) return;

  var i;
  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];
  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
      var excFrame = state.rxBuffer.slice(0, 5);
      var excCrc = calcCRC(excFrame.slice(0, 3));
      var excRecvCrc = excFrame[3] | (excFrame[4] << 8);
      if (excCrc === excRecvCrc) {
        clearResponseTimeout();
        var exCode = state.rxBuffer[2];
        var exDone = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        exDone('Exception: 0x' + toHex(exCode), null);
      }
    }
    return;
  }

  if (state.rxBuffer.length < 3) return;
  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimeout();

  var byteCount = frame[2];
  var values = [];
  var i;
  for (i = 0; i < byteCount; i += 2) values.push((frame[3 + i] << 8) | frame[4 + i]);

  var done = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  done(null, values);
}

function handleValue(fc, addr, baseline, raw) {
  var key = makeKey(fc, addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print('[' + fcLabel(fc) + '] CHANGED addr=' + addr + ' (0x' + toHex16(addr) + ') default=' + baseline + ' current=' + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print('[' + fcLabel(fc) + '] RESTORED addr=' + addr + ' (0x' + toHex16(addr) + ') value=' + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.fc, block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print('[V-TAC] Previous cycle still running; skipping this interval');
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    if (index >= BLOCKS.length) {
      print('[V-TAC] Cycle done: blocks=' + BLOCKS.length + ' deviations=' + state.cycleDeviations + ' errors=' + state.cycleErrors);
      print('');
      state.cycleRunning = false;
      return;
    }

    var block = parseBlock(BLOCKS[index]);
    sendRead(block.fc, block.start, block.len, function(err, values) {
      if (err) {
        state.cycleErrors++;
        print('[' + fcLabel(block.fc) + '] ERROR addr=' + block.start + ' qty=' + block.len + ' (' + err + ')');
      } else {
        processBlock(block, values);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print('[V-TAC] Starting baseline comparison cycle');
  readNext(0);
}

function init() {
  print('V-TAC VT-66036103 baseline MODBUS watcher');
  print('==========================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);

  print('Baseline blocks: ' + BLOCKS.length);
  print('Polling every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, runCycle);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);
}

init();
