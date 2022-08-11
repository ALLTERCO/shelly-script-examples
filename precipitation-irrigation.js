// With this script you can stop or limit watering your garden according to the rain
// that has fallen in the last 24 hours
// You can use any Shelly Plus 1/Pro1 ot Pro2 to control your irrigation system
// Dont forger to add AutoOFF for max Irrigation time and set a Schedule which start irrigation in device webUI.
// Configure Accuweather APIKEY and end points
let CONFIG = {
    accuWeatherAPIKEY: "YourACCUWEATHERKeyGoesHere",
    weatherCurrentEndpoint: "http://dataservice.accuweather.com/currentconditions/v1/",
    switchId: 0,
    // turn off, if rain in the last 24h was > 4.5mm
    rainMmValue: 4.5,
//  List of locations
    locations: {
        "Sofia": 51097,
        "Test": 318900
    },
};
// Choose which location
let here = "Sofia";
let location_id = CONFIG.locations[here];

function getWeatherURLForLocation(location_name) {
    return CONFIG.weatherCurrentEndpoint +
        JSON.stringify(CONFIG.locations[location_name]) +
        "?apikey=" +
        CONFIG.accuWeatherAPIKEY +
        "&details=true";
};

// This function read rain value in last 24h
function ReadRainHistory() {
    print("Check and Decide");
    Shelly.call(
        "http.get",
        {url: getWeatherURLForLocation(here)},
        function (response, error_code, error_message) {
            if (error_code !== 0) {
                // HTTP call to error service failed
                // TODO: retry logic
                return;
            }
            let weatherData = JSON.parse(response.body);
            let RainValue = weatherData[0].PrecipitationSummary.Past24Hours.Metric.Value;
            print("RainValue", RainValue);
            decideIfToIrrigate(RainValue);
        }
    );
};

// This function check are the rain in enought and switch off the valve
function decideIfToIrrigate(RainValue) {
    print(here, " Rain Last 24h - ", RainValue, " mm ");
    if (RainValue > CONFIG.rainMmValue) {
//        Can be use to caluculate irrigration time base of amount the Rain last 24h
//        let seconds_to_irrigate = (10 - RainValue) * 30;
//        Shelly.call("Switch.Set", {"id": 0, "on": true, "toggle_after": seconds_to_irrigate});
        Shelly.call("Switch.Set", {"id": CONFIG.switchId, "on": false}); // Disable if you calculate irrigration time
        print("Irrigration not needed");
    }
}

Shelly.addStatusHandler(function (e) {
    if (e.component === "switch:0") {
        if (e.delta.output === true) {
            print("Switch is on, triggered source:", e.delta.source);
            ReadRainHistory();
        }
    }
});
