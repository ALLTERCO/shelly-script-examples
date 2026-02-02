/**
 * @title BTHome sensor webhook trigger
 * @description Sends HTTP webhooks when BTHome sensor state changes (e.g. window open/close).
 */

// === CONFIGURATION ===
const WINDOW_SENSOR_ID       = 200;
// explicit On/Off URLs
const WINDOW_OPEN_WEBHOOK    = "http://YOUR_DEVICE_IP/rpc/Switch.Set?id=0&on=true";
const WINDOW_CLOSE_WEBHOOK   = "http://YOUR_DEVICE_IP/rpc/Switch.Set?id=0&on=false";

// helper: send a GET webhook to the given URL
function sendWebhook(url) {
  Shelly.call("HTTP.Request", {
    url:     url,
    method:  "GET",
    timeout: 5
  }, function(res, err) {
    if (err) {
      print("❌ Window webhook error:", err);
    } else {
      print("✅ Window webhook OK, code:", res.code);
    }
  });
}

// Listen for every status‐frame…
Shelly.addStatusHandler(function(ev) {
  const target = "bthomesensor:" + WINDOW_SENSOR_ID;
  if (ev.component !== target) return;

  // parse ev.delta if string
  let info = ev.delta;
  if (typeof info === "string") {
    try { info = JSON.parse(info); }
    catch (e) {
      print("⚠️ parse error on delta:", info);
      return;
    }
  }

  // open (true) = ON webhook, close (false) = OFF webhook
  if (info.value === true) {
    print("🟢 Window is OPEN → sending ON webhook");
    sendWebhook(WINDOW_OPEN_WEBHOOK);
  }
  else if (info.value === false) {
    print("🔴 Window is CLOSED → sending OFF webhook");
    sendWebhook(WINDOW_CLOSE_WEBHOOK);
  }
});

print("Listening for open/close on bthomesensor:" + WINDOW_SENSOR_ID);