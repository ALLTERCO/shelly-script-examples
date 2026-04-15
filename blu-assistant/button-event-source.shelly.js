/**
 * @title BLU Assistant physical button event source
 * @description Routes press events from the two physical buttons ("one" and "two")
 *   on the BLU Assistant device. Button ONE triggers the WiFi provisioning script
 *   via Script.Eval. Button TWO is a placeholder for a second action.
 * @status production
 * @link https://github.com/orlin369/shelly-script-examples/blob/main/blu-assistant/button-event-source.shelly.js
 */

// ===================== CONFIG =====================
var CONFIG = {
  // Script slot ID of wifi-provisioning.shelly.js (set after uploading it)
  PROV_SCRIPT_ID: 2
};

// ===================== ACTIONS ====================
function onButton1Press() {
  print("Button ONE -> trigger provisioning (script " + CONFIG.PROV_SCRIPT_ID + ")");
  Shelly.call("Script.Eval", {
    id: CONFIG.PROV_SCRIPT_ID,
    code: "startProvisioning()"
  }, function(res, err_code, err_msg) {
    if (err_code !== 0) {
      print("Failed to call provisioning script: " + err_msg);
    }
  });
}

function onButton2Press() {
  print("Button TWO pressed");
  // TODO: add your second action here
}

// ===================== EVENT HANDLER ==============
Shelly.addEventHandler(function(ev) {
  if (ev.component !== "sys") return;
  var info = ev.info;
  if (!info || info.event !== "brief_btn_down") return;

  if (info.name === "one")      onButton1Press();
  else if (info.name === "two") onButton2Press();
});

// ===================== INIT =======================
print("Button event source ready");
print("  Button ONE -> Script.Eval startProvisioning() on script " + CONFIG.PROV_SCRIPT_ID);
print("  Button TWO -> (placeholder)");
