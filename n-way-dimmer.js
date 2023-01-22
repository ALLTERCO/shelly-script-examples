// Allow the Shelly Wall Dimmer work in a N-Way Dimmer group
// A change at any dimmer will be sent to all the others in the group
// The one with the load connected to the light will make or get the update
// and adjust the light accordingly

// BUG - the adjustment of the brightness setting on the dimmer does not trigger an even
//       as a result the script is not currently synchronizing the dimmer value until
//       the swith is turned off. The brightness value of that is synced is the value
//       of the dimmer where the button was pressed.

// Update the Group to reflect all the switches in the group
// TODO - Dynamically create list based on what is on the network
//        OR move to bluetooth and avoid the need for a network
let CONFIG = {
  Group: ["192.168.99.163","192.168.99.101"],
  wifi_ip: "",
};

// get local IP
Shelly.call("WiFi.GetStatus", null, function (status) {
  print("Saving Wifi IP: ",status.sta_ip)
  if (status.status === "got ip") {
    CONFIG.wifi_ip = status.sta_ip;
    removeLocalFromGroup();
  }
});

// Code to help with remote calls to other shelly devices
let RemoteShelly = {
  _cb: function (result, error_code, error_message, callback) {
    if (result === null){
      print("rpc call failed to ", callback.endpoint);
    } else {
      print(result)
      let rpcResult = JSON.parse(result.body);
      let rpcCode = result.code;
      let rpcMessage = result.message;
      callback.callbackfunction(rpcResult, rpcCode, rpcMessage);
    }
  },
  composeEndpoint: function (method) {
    return "http://" + this.address + "/rpc/" + method;
  },
  call: function (rpc, data, callback) {
    print("  Running RemoteShelly.call");
    let postData = {
      url: this.composeEndpoint(rpc),
      body: data,
    };
    print("Calling ",JSON.stringify(postData))
    Shelly.call("HTTP.POST", postData, RemoteShelly._cb, callback);
  },
  getInstance: function (address) {
    let rs = Object.create(this);
    // remove static method
    rs.getInstance = null;
    rs.address = address;
    return rs;
  },
};

// Update light state, keeps the swith vlaues in sync with the KVS values
function UpdateLightState() {
  print("Running UpdateLightState: ")
  
  // get current state
  let currentstatus = GetLocalDimmerCurrentStatus();
  
  // Get the Key Value store values for the state (on/off)
  Shelly.call(
    "KVS.Get",
    {"key":"nwayOn"},
    function (result, error_code, message, currentstatus) {
      let kvsval = JSON.parse(result.value);
      print("UpdateLightState callback results");
      print("switchOn  : ", currentstatus.on);
      print("KVSOn     : ", kvsval.on);
      print("switchBrightness  : ", currentstatus.brightness);
      print("KVSBrightness     : ", kvsval.brightness);
      
      if (currentstatus.on !== kvsval.on || currentstatus.brightness !== kvsval.brightness) {
      //if (currentstatus.brightness !== kvsval.brightness) {
        setLocalDimmerStatus(kvsval)
      }
    }, currentstatus
  );
}

// Set the state of the local dimmer switch
function setLocalDimmerStatus(value){
  print("Running setLocalDimmerStatus");
  let svalue = JSON.stringify(value);
  print(svalue);
  Shelly.call(
    "Light.Set",
    {"id":0, "on":value.on, "brightness":value.brightness},
    null
   );
}

// Get the local switch status
function GetLocalDimmerCurrentStatus() {
  let on = Shelly.getComponentStatus("light",0);
  print("current state ", on.output)
  print("current dimmer ", on.brightness)
  let proto = {foo: 1}; let rs = Object.create(proto);
  // remove static method
  rs.on = on.output;
  rs.brightness = on.brightness;
  return rs;
}

// Send KVS data to a remote dimmer
function syncKVSToDimmer(item, on, brightness) {
  print("Sending state ",  on, brightness," to ", item);
  let dimmer = RemoteShelly.getInstance(item);
  let sdimmer = JSON.stringify(dimmer);
  print(sdimmer);

  let kvp = '{key:"nwayOn", value: "{on: ' + JSON.stringify(on) + ', brightness: ' + JSON.stringify(brightness) + '}"}';
  print("key value pair: ",kvp);
  let jkvp = JSON.parse(kvp);
  
  dimmer.call(
    "KVS.Set",
    jkvp,
    {
      endpoint: item,
      callbackfunction: function (result, error_code, message) {
        print("myFunction Callback results");
        print(JSON.stringify(result), error_message, message);
      }
    }
  );
}

// Loop through the list of remote dimmers, so we can send them updated KSV values
function syncKVSToAll() {
  let currentstatus = GetLocalDimmerCurrentStatus();
  for (let i=0; i<CONFIG.Group.length; i++) {
    // Send data to all remote (skip the local IP)
    if(CONFIG.Group[i] !== CONFIG.wifi_ip) {
      syncKVSToDimmer(CONFIG.Group[i],currentstatus.on,currentstatus.brightness);
    }
  }
}

print("Starting ...")

// Define event handlers

//  Someone pressed the local light switch
Shelly.addEventHandler(
  function (event, userData) {
    print("Event Handler intercept :",JSON.stringify(event));
    if(event.name === 'light'){
      print("Someone pressed the light switch");
      print("Syncing with the other switches");
      syncKVSToAll()
    }         
  }
);

// the local key value store was updated, update the local switch settings
Shelly.addStatusHandler(
  function (event, userData) {
    print("Status Handler intercept :",JSON.stringify(event));
    if(event.name === 'sys' && event.component === 'sys' && event.delta.kvs_rev > 0 ) {
      print("Key Value Store has been updated");
      print("Update local setting");
      UpdateLightState();
    }
  }
);
