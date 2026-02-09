// CHANGE HERE
// max 5 IP addresses - Limit of 5 RPC calls
let devicesIp = [
    "192.168.15.164",
    "192.168.15.165",
    "192.168.15.225",
    "192.168.15.250"
];
// END OF CHANGE

let CONFIG = {
    thisDeviceIp:"192.168.33.1",
    thisDeviceOutput:false,
    thisDeviceBrightness:0
};

function onStatusChange(ip){
    // update all IP addresses different than this device
    let target = devicesIp.filter(function (value) {return value!==ip });
    for(let i = 0; i < target.length; i++){
        updateOthers(target[i])
    }
}

function updateOthers(ip){
    let URI = 'http://' + ip + '/rpc/Light.Set?id=0&on=' + CONFIG.thisDeviceOutput + '&brightness=' + CONFIG.thisDeviceBrightness;
    print(URI);
    Shelly.call(
        "HTTP.GET", 
        { url: URI }, 
        function (res, error_code, error_msg){
            //print(res);
            //print(error_code);
            //print(error_msg);
        },
        null
    );
}

// get local IP
Shelly.call("WiFi.GetStatus", null, function (res) {
    if (res.status === "got ip") {
        CONFIG.thisDeviceIp = res.sta_ip;
    }
});

// user toggled switch or changed the brightness
Shelly.addStatusHandler(
    function (event, userData) {
        print(event);
        CONFIG.thisDeviceBrightness = event.delta.brightness;
        CONFIG.thisDeviceOutput = event.delta.output;
        // if the event occurs comes via HTTP, we don't trigger others
        if(event.name === 'light' && event.delta.source !== 'HTTP_in'){
            // update the status of other devices in the list
            onStatusChange(CONFIG.thisDeviceIp)
        }         
    }
);
  