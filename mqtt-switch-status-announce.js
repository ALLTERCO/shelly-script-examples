
const mqttConfig = Shelly.getComponentConfig("MQTT"); // Get mqtt config

const CONFIG = {
  switchId: 0,
  interval: 40000,
  MQTTPublishTopic: "/status/switch:",
};

const SHELLY_ID = mqttConfig.topic_prefix;

let notifyTimer = Timer.set(CONFIG.interval, true, function () {
  const res = Shelly.getComponentStatus("Switch:" + CONFIG.switchId)
  if (typeof SHELLY_ID === "undefined") {
    return;
  }
  if (typeof res !== "undefined" || res !== null) {
    MQTT.publish(
      SHELLY_ID + CONFIG.MQTTPublishTopic + JSON.stringify(CONFIG.switchId),
      JSON.stringify(res),
      0,
      false
    );
  }
});
