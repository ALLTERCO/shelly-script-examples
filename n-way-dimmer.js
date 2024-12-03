// Allows between 2 and 5 Shelly Plus, Pro, and Gen3 dimming products to work in a N-Way Dimmer group. A change at any dimmer is sent to all devices in the group. 

//This script allows multiple configurations - here is a list of some potential examples:

//Combine 2 Plus Wall Dimmer switches on a 3 way circuit or 3 Plus Wall Dimmers on a 4 way circuit. 
//One switch controls the load while output for other switches is capped off making them input-only.

//Combine Plus Wall Dimmer and three Plus 0-10v Dimmers (wired at fixtures) to eliminate the requirement 
//to pull low voltage wire to a switch. Plus Wall Dimmer controls dimming for the 0-10v dimmers

//Combine 5 lighting circuits into one group, with on/off/dim/bright for the entire group set from 
//any Shelly in the group



// *******************************************************************
// *************************  Global Config  *************************
// *******************************************************************

// Note - you should set static IP address and matching DHCP reservations for all Shelly devices in the group

// Update the "Group" setting to include IP address for all the switches in the group
const CONFIG = {
  dimmerGroup: ["192.168.0.106", "192.168.0.122"],  // Change these to reflect your dimmer group
  wifiIP: "", // You do not need to fill in this line, the script will fill it in
};

const KVS_KEY = "nwayOn"; // unify KVS key

// get local IP
function setWifiIP() {
  const wifiStatus = Shelly.getComponentStatus("Wifi");
  if (wifiStatus.status === "got ip") {
    CONFIG.wifiIP = wifiStatus.sta_ip;
  }
}

//  You should not need to modify anything past here

// ***************************************************************************
// *************************  Remote device control  *************************
// ***************************************************************************

// Remote control device method
// @param {string} ip Device's ip address
// @param {string} method Control method
// @param {object} body 
function remoteControl(ip, method, body, cb) {
  const postData = {
    url: "http://" + ip + "/rpc/" + method,
    body: JSON.stringify(body),
  };

  Shelly.call("HTTP.POST", postData, cb);
}

// ***********************************************************************
// *************************  Key-Value Methods  *************************
// ***********************************************************************

function createLightValue(deviceData) {
  return {
    on: deviceData.on,
    brightness: deviceData.brightness
  }
}

// Get the local KVS value, if it is different from the switch change the value of the KVS
// Where `currentState` is the device data,
// and `cb` is a callback function when the request is finished.
function updateLocalKVS(currentState, cb) {
  let kvpData = {
    key: KVS_KEY,
    value: createLightValue(currentState),
  }

  Shelly.call("KVS.Set", kvpData, cb);
}


// Sync the local KVS value (hopefully in sync with the switch)
function getLocalKVS(cb, userData) {
  Shelly.call("KVS.Get", { key: KVS_KEY }, cb, userData);
}

// ******************************************************************
// *************************  Sync Dimmer Methods  *************************
// ******************************************************************

// Sync the local KVS setting with a remote dimmer KVS 
// function syncKVSToDimmer(item, on, brightness) {
function syncKVSToDimmer(currentItem) {
  console.log("Sending state ", currentItem.on, currentItem.brightness, " to ", currentItem.ip);

  let jkvp = {
    key: KVS_KEY,
    value: createLightValue(currentItem),
  }

  // To control the light remotely
  remoteControl(currentItem.ip, "KVS.Set", jkvp, function (result, errCode, errMsg) {
    if (result === null) {
      console.log("rpc call failed to ", currentItem.ip);
      console.log("rpc call failed msg ", errCode, errMsg);
      return;
    }

    console.log("myFunction callback results");
    console.log(JSON.stringify(result));
  })
}

// Loop through all the dimmers and send the KVS update
// This should only be called once a value has changed
function syncKVSToAll(currentStatus) {
  for (let i = 0; i < CONFIG.dimmerGroup.length; i++) {
    // Send data to all remote (skip the local IP)
    if (CONFIG.dimmerGroup[i] !== CONFIG.wifiIP) {
      currentStatus.ip = CONFIG.dimmerGroup[i];
      syncKVSToDimmer(currentStatus);
    }
  }
}

// ******************************************************************
// *************************  Main Methods  *************************
// ******************************************************************

// Get the current value of the local physical dimmer switch
function getLocalDimmerCurrentStatus() {
  const on = Shelly.getComponentStatus("light", 0);

  return {
    on: on.output,
    brightness: on.brightness,
  };
}

// Get the local KVS value , if differnt from switch change the value of the switch
function updateLightState() {
  console.log("Running UpdateLightState: ")
  // get current state
  const currentStatus = getLocalDimmerCurrentStatus();

  // Get the Key Value store values for the state (on/off)
  getLocalKVS(function (result, errCode, errMsg, currentStatus) {
    const kvsval = result.value;
    console.log("Update Switch State from KVS - switchOn  : ", currentStatus.on,
      "   -   KVSOn     : ", kvsval.on, "   -   switchBrightness  : ", currentStatus.brightness,
      "   -   KVSBrightness     : ", kvsval.brightness,
    );
    if (currentStatus.on !== kvsval.on || currentStatus.brightness !== kvsval.brightness) {
      setLocalDimmerStatus(kvsval);
    }
  }, currentStatus)
}

// Get the local KVS value, if it is different from the switch change the value of the KVS
function updateKVSState() {
  const currentStatus = getLocalDimmerCurrentStatus();

  // Get the Key Value store values for the state (on/off)
  getLocalKVS(function (result, errorCode, errMsg, currentStatus) {

    const kvsval = result.value;
    console.log("Update KVS state from Switch - switchOn : ", currentStatus.on,
      "   -   KVSOn : ", kvsval.on, "   -   switchBrightness : ", currentStatus.brightness,
      "   -   KVSBrightness : ", kvsval.brightness
    );

    // If we have updates, push them to the other dimmers
    if (currentStatus.on !== kvsval.on || currentStatus.brightness !== kvsval.brightness) {
      // update local KVS
      updateLocalKVS(currentStatus);

      // update remote lights
      syncKVSToAll(currentStatus);
    }

  }, currentStatus)
}

// Change the state and brightness for the local dimmer switch
function setLocalDimmerStatus(value) {
  try {
    console.log("Running setLocalDimmerStatus");
    console.log(JSON.stringify(value));

    Shelly.call(
      "Light.Set",
      {
        "id": 0,
        "on": value.on,
        "brightness": value.brightness
      },
      function (_, errCode, errMsg) {
        if (errCode === 0) {
          console.log("Update Light Status Success!");
        } else {
          console.log(errCode, errMsg);
        }
      }
    );
  } catch (err) {
    console.log("Error: Set light status: ", err)
  }
}

// Define event handlers
function createHandler() {
  // the local key value store was updated, update the local switch settings
  Shelly.addStatusHandler(
    function (event) {
      console.log("Status Handler intercept :", JSON.stringify(event));

      if (event.name === 'light' && event.delta && event.delta.brightness !== undefined) {
        console.log("Someone changed the brightness or pressed the light switch, syncing with the other switches");
        updateKVSState()
      }

      // Update dimmer control data
      if (event.name === 'sys' && event.component === 'sys' && event.delta.kvs_rev > 0) {
        console.log("Key Value Store has been updated");
        console.log("Update local setting");
        try {
          updateLightState();
        } catch (err) {
          console.log(err)
        }
      }
    }
  );

}

// Start 

let status = Shelly.getDeviceInfo();
setWifiIP()
console.log("Status: ", JSON.stringify(status));
console.log("Name: ", status.name);
console.log("Starting ...")

// At Startup, initialize KVS to same as dimmer
let curDimStatus = getLocalDimmerCurrentStatus();
console.log("Init dimmer status:", JSON.stringify(curDimStatus))
// When te initial update is finished, create a status handler and a event handler
updateLocalKVS(curDimStatus, createHandler);
