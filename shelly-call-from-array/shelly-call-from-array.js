// CALL  ONE AFTER THE OTHER AS SOON AS THE CALL RETURNS A VALUE

// This is how you can call a external variable inside the Shelly.call(method, params[, callback[, userdata]]) -> undefined

// let externalVariableA, externalVariableB = 0;
//
// Shelly.call(
//     "HTTP.GET", 
//     { url: "http://..." }, 
//     function (res, error_code, error_msg, self){
//         print(externalVariableA, externalVariableB)
//     }, 
//     this
// );


let array = ["192.168.20.184","192.168.20.9","192.168.20.140","192.168.20.89","192.168.20.114","192.168.20.55","192.168.20.27","192.168.20.200","192.168.20.25","192.168.20.208","192.168.20.194","192.168.20.242","192.168.20.21","192.168.20.37","192.168.20.68","192.168.20.81","192.168.20.120","192.168.20.218","192.168.20.193","192.168.20.135","192.168.20.141","192.168.20.143","192.168.20.197","192.168.20.220","192.168.20.131","192.168.20.164","192.168.20.138","192.168.20.29","192.168.20.88","192.168.20.132","192.168.20.136","192.168.20.201","192.168.20.24","192.168.20.26","192.168.20.57","192.168.20.102","192.168.20.152","192.168.20.28","192.168.20.23","192.168.20.186","192.168.20.63","192.168.20.137","192.168.20.145","192.168.20.167","192.168.20.245","192.168.20.133","192.168.20.8","192.168.20.44"];
let action = "/settings/light/0?brightness=15";

let timer_handle = null;
let index = 0;
Timer.clear(timer_handle);


function executeAction(){
  print("Calling ip: "+array[index]);
  Shelly.call(
    "HTTP.GET", 
    { url: "http://" + array[index] + action }, 
    function (res, error_code, error_msg, self){
      print(index,array.length);
      if(error_code !== 0){
        print(JSON.stringify(res));
        print(JSON.stringify(error_code));
        print(JSON.stringify(error_msg));
      } else {
        print('Command executed for ip: '+array[index]);
      }
      if (index < array.length) {
        index++;
        executeAction();   // recursive call
      } else {
        print("Auto-stop script in 5 seconds");
        timer_handle = Timer.set(5000,false,function stopScript(){Shelly.call("Script.Stop",{"id":1})},null);
        print('End of script');      
      }
    }, 
    this
  );
}

executeAction();