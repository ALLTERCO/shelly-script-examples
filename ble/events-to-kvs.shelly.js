/**
 * @title Store select events from "ble-shelly-blu.shelly.js" in KVS
 * @description Use KVS to persist measurements made by ble devices,
 *   emitted by "ble-shelly-blu.shelly.js" script. (Requires firmware 
 *   version: 1.0.0-beta or newer.) KVS is stored in flash memory which 
 *   can degrade with too frequent writes. Don't use this script for
 *   measurements you need near realtime.
 */

/**
 * Event name for the `ble-shelly-blu.shelly.js` example is `shelly-blu`.
 */

// Config is specified in KVS. Create entries that start with "events-to-kvs"
// Each can be an array (though might be hard to fit more than one entry 
// per with the 253 char limit). The keys are abbreviated to save space.
// 
// prop: a list of properties to take from an event and store in KVS
// has:  properties that must be present, or event is ignored
// mch:  property/value pairs that must match in event
// par:  parent record in KVS, to accumulate properties
// pre:  prefix added to propery names
// mac:  prefix mac address of the sending ble device
// who:  write hold-off, in minutes, default 60

// The write hold-off defaults to limiting writes to 60 minutes apart to save
// your shelly from damage. Read about flash write and erase vs. lifeftime 
// before lowering the write delay.

// [{"has":["wind speed"],"mch":[{"address":"nn:nn:nn:nn:nn:nn"}],
//   "prop":["wind speed"],"pre":"weather","mac":true,"par":"x"}]

/****************** START CHANGE ******************/
let CONFIG = {
  debug: true,
};
/****************** STOP CHANGE ******************/

let RULES = [];
let objects = {};
let holdoffs = {};

function init_rules(cb) {
  RULES = [];

  Shelly.call(
    "KVS.GetMany",
    {
      match: "events-to-kvs*",   // prefix match
      offset: 0,
      limit: 100                 // increase if needed
    },
    function (res, err) {
      if (err) {
        print("KVS.GetMany failed:", JSON.stringify(err));
        if (cb) cb(err);
        return;
      }

      for (let i = 0; i < res.items.length; i++) {
        let item = res.items[i];
        if (!item || !item.value) continue;

        let parsed;
        try {
          parsed = JSON.parse(item.value);
        } catch (e) {
          print("Invalid JSON in KVS:", item.key);
          continue;
        }

        let arr = Array.isArray(parsed) ? parsed : [parsed];

        for (let j = 0; j < arr.length; j++) {
          let r = arr[j];
          if (typeof r !== "object" || r === null) continue;

          let rule = {
            enabled: (r.en !== undefined) ? !!r.en : true,
            has: Array.isArray(r.has) ? r.has : null,
            matches: Array.isArray(r.mch) ? r.mch : null,
            properties: Array.isArray(r.prop) ? r.prop: null,
            prefix: (typeof r.pre=== "string") ? r.pre: "",
            hold_off: (typeof r.who=== "number") ? r.who: 60,
            prefix_mac: !!r.mac,
            parent:
              (typeof r.par === "string")
                ? r.par
                : null
          };

          if (rule.enabled) {
            RULES.push(rule);
            if (rule.parent) {
              objects[rule.parent] = {}
            }
          }
        }
      }

      print("Loaded rules:", RULES.length);
      if (cb) cb(null, RULES);
      for (let key in objects) {
        Shelly.call(
          "KVS.Get",
          { key: key },
          (function (k) {
            return function (res, err) {
              if (err || !res || res.value === undefined) {
                // no existing value → leave empty
                return;
              }
      
              let parsed;
              try {
                parsed = JSON.parse(res.value);
              } catch (e) {
                // invalid JSON → ignore
                return;
              }
      
              if (typeof parsed === "object" && parsed !== null) {
                print("Loaded ", k);
                for (let p in parsed) {
                  objects[k][p] = parsed[p];
                }
              }
            };
          })(key)
        );
      }
    }
  );
}

function sanitize_name(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    let c = s.charAt(i);

    // space → underscore
    if (c === " ") {
      out += "_";
      continue;
    }

    // drop dots
    if (c === ".") continue;

    // allow A-Z a-z 0-9 _
    let code = c.charCodeAt(0);
    if (
      (code >= 48 && code <= 57) ||   // 0-9
      (code >= 65 && code <= 90) ||   // A-Z
      (code >= 97 && code <= 122) ||  // a-z
      c === "_"
    ) {
      out += c;
    }
    // everything else dropped
  }
  return out;
}

function sanitize_mac(mac) {
  let out = "";
  for (let i = 0; i < mac.length; i++) {
    let c = mac.charAt(i);
    if (c !== ":") out += c;
  }
  return out;
}

function rule_matches_event(rule, event) {
  // has[]
  if (rule.has && rule.has.length) {
    let ok = false;
    for (let i = 0; i < rule.has.length; i++) {
      if (event.hasOwnProperty(rule.has[i])) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }

  // matches[]
  if (rule.matches && rule.matches.length) {
    let matched = false;
    for (let i = 0; i < rule.matches.length; i++) {
      let m = rule.matches[i];
      let m_ok = true;
      for (let k in m) {
        if (event[k] !== m[k]) {
          m_ok = false;
          break;
        }
      }
      if (m_ok) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }

  return true;
}

function check_rules(event) {
  let now = Date.now();
  let items = [];
  let parents = {};

  for (let r = 0; r < RULES.length; r++) {
    let rule = RULES[r];

    if (!rule_matches_event(rule, event)) continue;

    let props;
    if (!rule.properties || rule.properties.length === 0) {
      props = [];
      for (let k in event) props.push(k);
    } else {
      props = rule.properties;
    }

    let base_prefix = "";
    if (rule.prefix) {
      base_prefix += sanitize_name(rule.prefix);
    }

    if (rule.prefix_mac && event.address) {
      if (base_prefix) base_prefix += "_";
      base_prefix += sanitize_mac(event.address);
    }

    if (rule.parent) {
      for (let i = 0; i < props.length; i++) {
        let p = props[i];
        if (!event.hasOwnProperty(p)) continue;

        let key = base_prefix;
        if (key) key += "_";
        key += sanitize_name(p);

        if ( !(key in holdoffs) || holdoffs[ key ] < now ) {
          objects[rule.parent][key] = {
            v: event[p],
            t: now
          }
          holdoffs[ key ] = now + rule.hold_off * 60 * 1000;
        }
      }
      parents[rule.parent] = 1
    } else {
      for (let i = 0; i < props.length; i++) {
        let p = props[i];
        if (!event.hasOwnProperty(p)) continue;

        let key = base_prefix;
        if (key) key += "_";
        key += sanitize_name(p);

        if ( !(key in holdoffs) || holdoffs[ key ] < now ) {
          items.push({
            key: key,
            value: JSON.stringify({
              v: event[p],
              t: now
            })
          });
          holdoffs[ key ] = now + rule.hold_off * 60 * 1000;
        }
      }
    }
    for (let p in parents) {
      if (Object.keys(objects[p]).length > 0) {
        items.push({
          key: p,
          value: JSON.stringify(objects[p])
        });
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    Shelly.call("KVS.Set", {
      key: items[i].key,
      value: items[i].value
    });
  }
}

// Logs the provided message with an optional prefix to the console
function logger(message, prefix) {
  //exit if the debug isn't enabled
  if (!CONFIG.debug) {
    return;
  }

  let finalText = "";

  //if the message is list loop over it
  if (Array.isArray(message)) {
    for (let i = 0; i < message.length; i++) {
      finalText = finalText + " " + JSON.stringify(message[i]);
    }
  } else {
    finalText = JSON.stringify(message);
  }

  //the prefix must be string
  if (typeof prefix !== "string") {
    prefix = "";
  } else {
    prefix = prefix + ":";
  }

  //log the result
  console.log(prefix, finalText);
}

let KVSManager = {
  init: function () {
      init_rules();
  },

  // Process new data and check if any scenes should be executed
  onNewData: function (data) {
    //logger(["New data received", JSON.stringify(data)], "Info");
    check_rules(data);
  },

  // Event handler for handling events from the device
  eventHandler: function (eventData, kvsEventObject) {
    let info = eventData.info;
    if (typeof info !== "object") {
      console.log("ERROR: ");
      logger("Can't find the info object", "Error");

      return;
    }

    if (typeof info.data === "object") {
      for (let key in info.data) {
        info[key] = info.data[key];
      }

      info.data = undefined;
    }
    kvsEventObject.onNewData(info);
  },
};

// Initialize function for the scene manager and register the event handler
function init() {
  KVSManager.init();
  Shelly.addEventHandler(KVSManager.eventHandler, KVSManager);
  logger("KVS Manager successfully started", "Info");
}

init();
