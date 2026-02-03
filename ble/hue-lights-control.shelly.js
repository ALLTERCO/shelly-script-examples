/**
 * @title Controlling hue lights with Shelly BLU Button or virtual buttons
 * @description This script allows you to control your hue lights with a Shelly BLU
 *   Button or virtual buttons. You can turn on/off lights, change
 *   brightness and color temperature. (Requires firmware version: 1.3 or
 *   newer)
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/hue-lights-control.shelly.js
 */

const CONFIG = {
  ip: '', // Hue bridge IP
  user: '', // Hue bridge user
  lights: [1, 2, 3], // Light bulb IDs

  handlers: {
    // bthomesensor:201 - first button
    'bthomesensor:201': {
      // on single push
      single_push: [
        {
          // by omitting the id, the request is sent to all bulb from the config
          on: true,
          bri: 20,
          hue: 3500
        }
      ]
    },
    // bthomesensor:202 - second button
    'bthomesensor:202': {
      single_push: [
        {
          on: true,
          hue: 200,
          bri: 60
        },
        {
          id: 2, // specifying the bulb ID will send request only to this device 
          on: true,
          hue: 6000,
          bri: 20
        }
      ],
      double_push: [
        {
          on: false,
        }
      ]
    },
    // button:201 - virtual button 
    'button:201': {
      single_push: [
        {
          id: 1,
          on: true,
          hue: 5124,
          bri: 250
        }
      ]
    }
  }
};

/**
 * Bulk set the state of all light bulbs
 * @param {*} on bulb id
 * @param {*} bri brightness
 * @param {*} hue hue value
 * @param {*} sat saturation
 */
function SetAll(on, bri, hue, sat) {
  for (const id of CONFIG.lights) {
    Set(id, on, bri, hue, sat);
  }
}

/**
 * Set the light bulb state
 * @param {*} id bulb id
 * @param {*} on on/off state
 * @param {*} bri brightness
 * @param {*} hue hue value
 * @param {*} sat saturation
 */
function Set(id, on, bri, hue, sat) {
  let body = {};

  if (typeof on === 'boolean') {
    body.on = on;
  }

  if (typeof bri === 'number') {
    body.bri = bri;
  }

  if (typeof hue === 'number') {
    body.hue = hue;
  }

  if (typeof sat === 'number') {
    body.sat = sat;
  }

  const uri =
    'http://' + CONFIG.ip + '/api/' + CONFIG.user + '/lights/' + id + '/state';

  Shelly.call('http.request', {
    method: 'PUT',
    url: uri,
    body: body,
  });
}

function onEvent(event_data) {
  const component = event_data.component;
  const info = event_data.info;

  if (!info) {
    return;
  }

  const handlers = CONFIG.handlers[component];

  if (!handlers) {
    console.log('no handler for ', sensorId);
    return;
  }

  const event = info.event;

  const handler = handlers[event];

  if (!Array.isArray(handler)) {
    console.log('no handler for', event);
    return;
  }

  for (const obj of handler) {
    let bulbId = obj.id;
    let hue = obj.hue;
    let bri = obj.bri;
    let on = obj.on;
    let sat = obj.sat;

    if (typeof bulbId === 'number') {
      Set(bulbId, on, bri, hue, sat);
    } 
    else {
      SetAll(on, bri, hue, sat);
    }
  }
}

Shelly.addEventHandler(onEvent);