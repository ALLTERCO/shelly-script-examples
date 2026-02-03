/**
 * @title Control Light entity from HA via virtual boolean component
 * @description This script will control a light entity in Home Assistant via a
 *   virtual boolean component in Shelly. The script will listen for
 *   changes in the boolean component and will turn on or off the light
 *   entity in Home Assistant accordingly.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/mqtt/control-ha-light-entity-with-boolean.shelly.js
 */

const CONFIG = {
  ha_ip: "", // Home Assistant IP
  ha_port: 8123, // Home Assistant Port
  ha_token: "", // Home assistant Long-Lived Access Token
  ha_entity_id: "light.shelly1pmminig3_84fce6xxxxxx_switch_0", // Home Assistant Light Entity ID
  boolean_id: 200, // Boolean Component ID to toggle the light entity
};

const HEADERS = {
  Authorization: "Bearer " + CONFIG.ha_token,
  "Content-Type": "application/json",
};

function entityStateResponseHandler(response, err_no, err_msg) {
  if (err_no !== 0) {
    console.log(err_msg);
    return;
  }

  const result = JSON.parse(response.body);
  Shelly.call("boolean.set", {
    id: CONFIG.boolean_id,
    value: result.state === "on",
  });
}

function checkEntityState(entity_id) {
  Shelly.call(
    "http.request",
    {
      method: "GET",
      headers: HEADERS,
      url:
        "http://" +
        CONFIG.ha_ip +
        ":" +
        JSON.stringify(CONFIG.ha_port) +
        "/api/states/" +
        entity_id,
    },
    entityStateResponseHandler
  );
}

/**
 * Sets the light entity state based on the method
 * @param {*} entity_id entity id
 * @param {*} method turn_on | turn_off | toggle
 */
function setLightEntityState(entity_id, method) {
  Shelly.call("http.request", {
    method: "POST",
    headers: HEADERS,
    url:
      "http://" +
      CONFIG.ha_ip +
      ":" +
      JSON.stringify(CONFIG.ha_port) +
      "/api/services/light/" +
      method,
    body: JSON.stringify({
      entity_id: entity_id,
    }),
  });

  checkEntityState(entity_id);
}

Shelly.addStatusHandler(function (status_data) {
  if (status_data.name !== "boolean" || status_data.id !== CONFIG.boolean_id) {
    return;
  }

  const invoke_state = status_data.delta.value ? "turn_on" : "turn_off";
  setLightEntityState(CONFIG.ha_entity_id, invoke_state);
});

// Initial sync with the entity state
checkEntityState(CONFIG.ha_entity_id);