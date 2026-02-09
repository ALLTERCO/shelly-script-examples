/**
 * @title Send Switch status to a custom MQTT topic
 * @description Use MQTT in scripting to provide switch status updates on a custom
 *   topic
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/mqtt/mqtt-switch-status.shelly.js
 */

// Shelly Script example: Use MQTT in scripting to provide switch status updates on a custom topic

let CONFIG = {
  switchId: 0,
  MQTTPublishTopic: "v1/devices/me/telemetry",
};

// until 0.10.0 event and notifications were emitted by switch
// after that only notification is emitted
Shelly.addStatusHandler(function (notification) {
  if (notification.component !== "switch:" + JSON.stringify(CONFIG.switchId))
    return;
  if (typeof notification.delta.output === "undefined") return;
  MQTTAnnounceSwitch(notification.delta.output);
});

function MQTTAnnounceSwitch(status) {
  let announceObj = {
    SWITCH: status ? "ON" : "OFF",
  };
  MQTT.publish(CONFIG.MQTTPublishTopic, JSON.stringify(announceObj), 0, false);
}
