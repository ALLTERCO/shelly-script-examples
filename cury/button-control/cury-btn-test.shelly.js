/**
 * @title Cury Button Test Scanner
 * @description Scans BTHome BLE advertisements, logs nearby devices, and prints decoded events for the target BLU button.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/cury/button-control/cury-btn-test.shelly.js
 */

// MAC must be lowercase to match res.addr from BLE scanner.

var BLU_ADDR = "bc:02:6e:c3:a3:0e";  // lowercase!
var lastPid = -1;

function parseByte(svc, objId) {
  var i = 1; // skip device info byte at pos 0
  while (i + 1 < svc.length) {
    if (svc.charCodeAt(i) === objId) return svc.charCodeAt(i + 1);
    i += 2;
  }
  return -1;
}

BLE.Scanner.Subscribe(function(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  if (!res || !res.addr) return;

  var svc = res.service_data && res.service_data["fcd2"];
  if (!svc) return; // not a BTHome device

  // Print ALL BTHome devices seen (to discover what's in range)
  if (res.addr !== BLU_ADDR) {
    print("[SCAN] BTHome device: " + res.addr);
    return;
  }

  // Our target button
  var pid = parseByte(svc, 0x00);
  var btn = parseByte(svc, 0x3A);

  if (pid === lastPid) return;
  lastPid = pid;

  print("[BTN] pid=" + pid + " btn=" + btn);

  if (btn === 1) print("[BTN] SINGLE PRESS");
  if (btn === 2) print("[BTN] DOUBLE PRESS");
  if (btn === 3) print("[BTN] TRIPLE PRESS");
  if (btn === 4) print("[BTN] LONG PRESS");
});

print("[BTN] Listening... target=" + BLU_ADDR);
