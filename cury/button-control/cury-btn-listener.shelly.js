/**
 * @title Cury Button Listener
 * @description Listens for BLU button events and controls the paired Cury animation script.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/cury/button-control/cury-btn-listener.shelly.js
 */

var ANIM_ID  = 1;
var BLU_ADDR = "bc:02:6e:c3:a3:0e";
var lastPid  = -1;

function bthomeParseByte(svc, objId) {
  var i = 1;
  while (i + 1 < svc.length) {
    if (svc.charCodeAt(i) === objId) return svc.charCodeAt(i + 1);
    i += 2;
  }
  return -1;
}

function onTap() {
  print("[Cury] BTN: next color");
  Shelly.call("Script.Eval", { id: ANIM_ID, code: "nextColor();" });
}

function onDoubleTap() {
  print("[Cury] BTN: stop animation");
  Shelly.call("Script.Stop",    { id: ANIM_ID });
  Shelly.call("Cury.Set",       { id: 0, slot: "right", on: false });
  Shelly.call("Cury.Set",       { id: 0, slot: "left",  on: false });
  Shelly.call("Cury.SetConfig", { id: 0, config: {
    ambient: { enable: false, brightness: 0 },
    ui:      { mode: "level", brightness: 100 }
  }});
}

function onLongPress() {
  print("[Cury] BTN: start animation");
  Shelly.call("Script.Start", { id: ANIM_ID });
}

BLE.Scanner.Subscribe(function(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
  if (!res || res.addr !== BLU_ADDR) return;
  var svc = res.service_data && res.service_data["fcd2"];
  if (!svc) return;
  var pid = bthomeParseByte(svc, 0x00);
  var btn = bthomeParseByte(svc, 0x3A);
  if (pid >= 0 && pid === lastPid) return;
  lastPid = pid;
  if (btn <= 0) return;
  if (btn === 1) { onTap();       return; }
  if (btn === 2) { onDoubleTap(); return; }
  if (btn === 4) { onLongPress(); return; }
});
