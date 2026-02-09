// CHANGE HERE

let targetIp = "192.168.15.225";

// END CHANGE

let CONFIG = {
    currentBrightness:0,
    event:[],
};

let t0 = null;

function getCurrentBrightness(ip){
    let URI = 'http://' + ip + '/rpc/Light.GetStatus?id=0';  
    Shelly.call(
        "HTTP.GET", 
        { url: URI }, 
        function (res, error_code, error_msg, ud){
            let data = JSON.parse(res.body);
            CONFIG.currentBrightness = data.brightness;
            //print(error_code);
            //print(error_msg);
        },
        null
    );
}


function shellyCall(URI){
  //print(URI);
  Shelly.call(
      "HTTP.REQUEST", 
      { 
          method: "GET",
          url: URI,
      },
      function (res, error_code, error_msg, self){
        if(error_code !== 0){
          print(JSON.stringify(res));
          print(JSON.stringify(error_code));
          print(JSON.stringify(error_msg));
        }
      }, 
      this
    );    
}


function updateTarget(){
    let action = '';
    for(let i=0; i < CONFIG.event.length; i++){
      if(CONFIG.event[i][0] !== 'b')
        action = CONFIG.event[i]
    }
        
    let URI = 'http://' + targetIp ;
    // when input is in Switch mode
    if(action === 'toggle'){
        URI += '/rpc/Light.Toggle?id=0';
    }
    // when input is in Button mode
    if(action === 'single_push'){
        URI += '/rpc/Light.Set?id=0&on=true&brightness=' + JSON.stringify(CONFIG.currentBrightness + 10);
    }
    if(action === 'double_push'){
        URI += '/rpc/Light.Set?id=0&on=true&brightness=100';
    }
    if(action === 'triple_push'){
        URI += '/rpc/Light.Set?id=0&on=true&brightness=' + JSON.stringify(CONFIG.currentBrightness - 10);
    }
    if(action === 'long_push'){
        URI += '/rpc/Light.Set?id=0&on=false&brightness=0';
    }
    //print(URI);
    shellyCall(URI);
};

Shelly.addEventHandler(
    function (event) {
        //print(JSON.stringify(event));
        CONFIG.event.push(event.info.event);
        getCurrentBrightness(targetIp);
        Timer.clear(t0);
        t0 = Timer.set(1*1000, false, updateTarget);
    }
);
