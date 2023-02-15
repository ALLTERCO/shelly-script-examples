// Allow the Shelly Wall Dimmer work in a N-Way Dimmer group
// A change at any dimmer will be sent to all the others in the group
// The one with the load connected to the light will make or get the update
// and adjust the light accordingly

// BUG - the adjustment of the brightness setting on the dimmer does not trigger an even
//       as a result the script is not currently synchronizing the dimmer value until
//       the swith is turned off. The brightness value of that is synced is the value
//       of the dimmer where the button was pressed.

// TODO - Dynamically create list based on what is on the network
//        OR move to bluetooth and avoid the need for a network

// Update the Group to reflect all the switches in the group
let CONFIG = {
  Group: ["192.168.99.163","192.168.99.113","192.168.99.116"],  // Change these to reflect your dimmer group
  wifi_ip: "", // You do not need to fill in this line, the script will fill it in
};

//  You should not need to modifiy anything past here

// get local IP
Shelly.call("WiFi.GetStatus", null, function (status) {
  print("Saving Wifi IP: ",status.sta_ip)
  if (status.status === "got ip") {
    CONFIG.wifi_ip = status.sta_ip;
  }
});

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

// Get the local KVS value , if differnt from switch change the value of the switch
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
      print("Update Switch State from KVS - switchOn  : ", currentstatus.on, "   -   KVSOn     : ", kvsval.on, "   -   switchBrightness  : ", currentstatus.brightness, "   -   KVSBrightness     : ", kvsval.brightness);

      if (currentstatus.on !== kvsval.on || currentstatus.brightness !== kvsval.brightness) {
        setLocalDimmerStatus(kvsval);
      }
    }, currentstatus
  );
}

// Change the state and brightness for the local dimmer switch
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

// Get the local KVS value, if it is different from the switch change the value of the KVS
function UpdateKVSState() {
  // get current state
  let currentstatus = GetLocalDimmerCurrentStatus();
  
  // Get the Key Value store values for the state (on/off)
  Shelly.call(
    "KVS.Get",
    {"key":"nwayOn"},
    function (result, error_code, message, currentstatus) {
      print(result.value);
      let kvsval = JSON.parse(result.value);
      //print("UpdateKVSState callback results");
      print("Update KVS state from Switch - switchOn : ", currentstatus.on, "   -   KVSOn : ", kvsval.on, "   -   switchBrightness : ", currentstatus.brightness, "   -   KVSBrightness : ", kvsval.brightness);
      
      // If we have updates, push them to the other dimmers
      if (currentstatus.on !== kvsval.on || currentstatus.brightness !== kvsval.brightness) {
        // update local KVS
        updateLocalKVS(currentstatus);
        // update remote lights
        syncKVSToAll(currentstatus);
      }
    }, currentstatus
  );
}


// Get the current value of the local physical dimmer switch
function GetLocalDimmerCurrentStatus() {
  let on = Shelly.getComponentStatus("light",0);
  //print("current state ", on.output)
  //print("current dimmer ", on.brightness)
  let proto = {foo: 1}; let rs = Object.create(proto);
  // remove static method
  rs.on = on.output;
  rs.brightness = on.brightness;
  return rs;
}

// Sync the local KVS value (hopefully in sync with the switch)
function updateLocalKVS(cs) {
  //let timestamp = Date.now();
  let kvp = '{key:"nwayOn", value: "{on: ' + JSON.stringify(cs.on) + ', brightness: ' + JSON.stringify(cs.brightness) + '}"}';
  print("key value pair: ",kvp);
  let jkvp = JSON.parse(kvp);
  
  Shelly.call(
    "KVS.Set",
    jkvp
  );
}

// Sync the local KVS setting with a remote dimmer KVS 
//function syncKVSToDimmer(item, on, brightness) {
function syncKVSToDimmer(cs) {
  print("Sending state ",  cs.on, cs.brightness," to ", cs.item);
  let dimmer = RemoteShelly.getInstance(cs.item);
  let sdimmer = JSON.stringify(dimmer);
  print(sdimmer);

  //let kvp = '{key:"nwayOn", value: "{on: ' + JSON.stringify(cs.on) + ', brightness: ' + JSON.stringify(cs.brightness) + '}"}';
  let kvp = '{key:"nwayOn", value: "{on: ' + JSON.stringify(cs.on) + ', brightness: ' + JSON.stringify(cs.brightness) + '}"}';
  print("key value pair: ",kvp);
  let jkvp = JSON.parse(kvp);
  
  dimmer.call(
    "KVS.Set",
    jkvp,
    {
      endpoint: cs.item,
      callbackfunction: function (result, error_code, message) {
        print("myFunction Callback results");
        print(JSON.stringify(result), error_message, message);
      }
    }
  );
}

// Loop through all the dimmers and send the KVS update
// This should only be called once a value has changed
function syncKVSToAll(currentstatus) {
  let temp_timer_inc = 100;
  for (let i=0; i<CONFIG.Group.length; i++) {
    // Send data to all remote (skip the local IP)
    if(CONFIG.Group[i] !== CONFIG.wifi_ip) {
      let temp_timer = i * temp_timer_inc;
      currentstatus.item = CONFIG.Group[i];
      //Timer.set(temp_timer,false,syncKVSToDimmer,currentstatus);
      //syncKVSToDimmer(CONFIG.Group[i],currentstatus.on,currentstatus.brightness);
      syncKVSToDimmer(currentstatus);
    }
  }
}

function getLocalName() {
  let status = Shelly.getDeviceInfo();
  let sstatus = JSON.stringify(status);
  print("Status: ", sstatus);
  print("Name: ", status.name);
}
getLocalName()

print("Starting ...")

// At Startup, initialize KVS to same as dimmer
let tds = GetLocalDimmerCurrentStatus();
updateLocalKVS(tds);

// Define event handlers

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

//  Someone pressed the local light switch
Shelly.addEventHandler(
  function (event, userData) {
    print("Event Handler intercept :",JSON.stringify(event));
    if(event.name === 'light'){
      print("Someone pressed the light switch");
      print("Syncing with the other switches");
      UpdateKVSState()
    }         
  }
);

/*
 // Poling attemp, did not work, will need some event handler to deal with dimmer changes
 function main_loop () {
   UpdateKVSState();
   //UpdateLightState();
 }
 
 Timer.set(1000,true,main_loop)
 */