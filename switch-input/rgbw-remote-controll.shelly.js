/**
 * @title RGBW Remote Toggle with Day/Night Brightness
 * @description Toggle an RGBW output via HTTP endpoint with automatic brightness
 *   adjustment based on time of day. Requires firmware 1.0+.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/switch-input/rgbw-remote-controll.shelly.js
 */

/**
 * RGBW Remote Control Toggle
 *
 * Registers an HTTP endpoint at /script/<id>/toggle that toggles the RGBW
 * output on and off. When turning on, brightness is set based on the current
 * time of day: higher during daytime, lower at night.
 *
 * Endpoint: http://<ip>/script/<id>/toggle
 *
 * Configuration:
 * - ID: RGBW component instance (default 0)
 * - SUNRISE_HOUR / SUNSET_HOUR: define the daytime window
 * - DAY_BRIGHTNESS: brightness percentage when sun is up (0-100)
 * - NIGHT_BRIGHTNESS: brightness percentage when sun is down (0-100)
 *
 * Supported devices: Shelly Plus RGBW PM, Shelly Pro RGBWW PM
 */

var ID = 0;
var isOn = false;

var SUNRISE_HOUR = 5;
var SUNSET_HOUR = 19;
var DAY_BRIGHTNESS = 60;
var NIGHT_BRIGHTNESS = 10;

function getBrightness() {
  var sysStatus = Shelly.getComponentStatus('sys');
  var hour = Number(sysStatus.time.split(':')[0]);
  if (hour >= SUNRISE_HOUR && hour < SUNSET_HOUR) {
    return DAY_BRIGHTNESS;
  }
  return NIGHT_BRIGHTNESS;
}

HTTPServer.registerEndpoint("toggle", function (req, res) {
    Shelly.call("RGBW.GetStatus", { id: ID }, function (status) {
      isOn = status.output;
      var params = { id: ID, on: !isOn };
      if (!isOn) {
        params.brightness = getBrightness();
      }
      Shelly.call("RGBW.Set", params, function () {
        isOn = !isOn;
        res.code = 200;
        res.headers = [["Content-Type", "application/json"]];
        res.body = JSON.stringify({ ok: true, on: isOn, brightness: params.brightness });
        res.send();
        print("toggle -> " + JSON.stringify(isOn));
      });
    });
});
