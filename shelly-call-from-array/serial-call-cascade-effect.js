// CHANGE HERE

// these IP addresses will be called in order - No limit
let array = [
    "192.168.15.251",
    "192.168.15.224",
    "192.168.15.166",
    "192.168.15.80",
    "192.168.15.242",
    "192.168.15.76",
    "192.168.15.249",
    "192.168.15.129",
    "192.168.15.92",
    "192.168.15.94",
    "192.168.15.70",
    "192.168.15.216",
    "192.168.15.195",
    "192.168.15.56",
    "192.168.15.209"
];

// Delay can't be less than 500 ms, the script will crash. 
// Ideal effect with 1000 ms.
// Network traffic will interfere with the effect.
let delay = 1000;   

let action = "/light/0?turn=toggle";

// END CHANGE

let timer_handle = null;
let index = 0;
Timer.clear(timer_handle);
    

function executeAction(){
    //print("Calling ip: " + array[index]);
    Shelly.call(
    "HTTP.GET", 
    { url: "http://" + array[index] + action }, 
    function (res, error_code, error_msg, self){
        //print(index,array.length);
        if(error_code !== 0){
        print(JSON.stringify(res));
        print(JSON.stringify(error_code));
        print(JSON.stringify(error_msg));
        } else {
        print('Command executed for ip: ' + array[index]);
        }
        if (index < array.length-1) {
        index++;      
        executeAction();   // recursive call      
        } else {
        print("Auto-stop script in 1 second");
        timer_handle = Timer.set(delay,false,function stopScript(){Shelly.call("Script.Stop",{"id":2})},null);
        print('End of script');      
        }
    }, 
    this
    );
}

executeAction();