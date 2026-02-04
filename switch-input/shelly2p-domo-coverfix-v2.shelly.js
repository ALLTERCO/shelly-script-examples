/**
 * @title Shelly Plus 2PM cover fix for Domoticz MQTTAD v2
 * @description Simple fix for outgoing Domoticz MQTTAD command 'GoToPosition'. Only
 *   Shelly firmware >= 1.x supported. Developed for ShellyTeacher4Domo.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/switch-input/shelly2p-domo-coverfix-v2.shelly.js
 */

// ShellyPlus2 Cover device SetPosition helper for Domoticz MQTTAD control
// Domoticz rpc control JSON is malformed, this script will interpret it anyway

// original author: enesbcs
// enhanced by: Xavier82

// Extension for ShellyTeacher4Domo
// https://github.com/enesbcs/shellyteacher4domo

const deviceInfo = Shelly.getDeviceInfo();

const CONFIG = {
  shelly_id: deviceInfo.id,
};

MQTT.subscribe(
  buildMQTTStateCmdTopics("rpc"),
  DecodeDomoticzFaultyJSON
);

console.log("Subscribed to RPC");

/**
 * @param {string} topic
 */
function buildMQTTStateCmdTopics(topic) {
  let _t = topic || "";
  return CONFIG.shelly_id + "/" + _t;
}

/**
 * @param {string} topic
 * @param {string} message
 */
function DecodeDomoticzFaultyJSON(topic, message) {
  try {
    let trimmedMessage = message.trim();
    if (trimmedMessage) {
      if (trimmedMessage.indexOf("GoToPosition") !== -1) {
        let req = JSON.parse(trimmedMessage);
        for (let r in req) {
          if (r.indexOf("GoToPosition") !== -1) { // Check if "GoToPosition" is present in the key
            SetCoverPosition(req[r]);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.log("Error parsing JSON:", error);
  }
}

/**
 * @param {integer} position 0..100
 */
function SetCoverPosition(position) {
  Shelly.call("Cover.GoToPosition", {
    id: 0,
    pos: position,
  });
}
