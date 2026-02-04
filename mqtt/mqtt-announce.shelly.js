/**
 * @title Backward compatibility with Gen1 MQTT format (announce only)
 * @description Use MQTT in scripting to provide backwards compatibility with Gen1
 *   MQTT topics shellies/announce and shellies/command
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/mqtt/mqtt-announce.shelly.js
 */

// Shelly Script example: Use MQTT in scripting to provide backwards compatibility
// with Gen1 MQTT topics shellies/announce and shellies/command

const deviceInfo = Shelly.getDeviceInfo();

MQTT.subscribe(
  "shellies/command",
  function (topic, message, ud) {
    if (deviceInfo === null) return;
    if (message === "announce") {
      MQTT.publish("shellies/announce", JSON.stringify(deviceInfo), 0, false);
    }
    print(message);
  },
  null
);
