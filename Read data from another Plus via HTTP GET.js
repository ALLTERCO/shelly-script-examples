// Read values from another Shelly Plus (Shelly call them also 'Gen2') via HTTP GET.

// Settings
let ip = 'ip';
let username = 'admin'; // do not change, it is always admin
let password = 'password';

// Send HTTP get request with authentication
Shelly.call(
  "HTTP.GET", {
    "url": "http://" + username + ":" + password + "@" + ip + "/rpc/Switch.GetStatus?id=0",
  }, 
  function(result) { 
//    print(result.body); // Uncomment to see all available values.
    let totalwh = JSON.parse(result.body).aenergy.total; // Reminder: On a Plus device energy total is in Watt-hours. On Gen1 device it is Watt-minutes. 
    let totalkwh = JSON.parse(result.body).aenergy.total / 1000; 
    let tempe = JSON.parse(result.body).temperature.tC; // tC is in celsius, tF is in Fahrenheit.
    print(totalwh);
    print(totalkwh);
    print(tempe);
  }
);
