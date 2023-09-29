// Shelly GEN2 script: HTTP POST - Send energy meter watts to Thingspeak cloud

// Settings
let tsapikey = "YOURAPIKEY"; // Copy from Thingspeak.com > Channels > Channel > API Keys > Write API key
let tsjsonurl = "https://api.thingspeak.com/update.json";

// Assign watts to variable
let status = Shelly.getComponentStatus("switch", 0);
let watts = status.apower;
// let tempe = status.temperature.tC; // uncomment if you want to send temperature too
print(watts);

// Define timespan: minutes * 60 sec * 1000 milliseconds
let interval = 5 * 60 * 1000;

// Create JSON
let tsjson = {
	"api_key": tsapikey,
	"field1": watts // Change the field number as needed.
  // "field2": tempe // <- this can be used to send temperature too, just add comma to end of previous line
};

// Set timer which send the HTTP POST
Timer.set(
  interval,
  true,
  function () {Shelly.call("HTTP.POST", {"url": tsjsonurl, "body": tsjson, "timeout": 5});}
);
