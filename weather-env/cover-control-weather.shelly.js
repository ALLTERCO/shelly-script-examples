/**
 * @title Control a Shelly 2.5 (Gen1) depending on current cloud conditions
 * @description The script, when run, will fetch via REST api from a weather service
 *   the current conditions for a location check if cloud coverage is above
 *   or below certain percentage and respectively open or close window
 *   shades by calling a Shelly 2.5 (Gen1) endpoint.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/weather-env/cover-control-weather.shelly.js
 */

// Shelly Script example: Control a Shelly 2.5 (Gen1) depending on current cloud
// conditions
//
// The script, when run, will fetch via REST api from a weather service the
// current conditions for a location check if cloud coverage is above or below
// certain percentage and respectively open or close window shades by calling a
// Shelly 2.5 (Gen1) endpoint

let CONFIG = {
  accuWeatherAPIKEY: "ACCUWEATHER-API-KEY",
  weatherForecastEndpoint:
    "http://dataservice.accuweather.com/forecasts/v1/daily/1day/",
  weatherCurrentEndpoint:
    "http://dataservice.accuweather.com/currentconditions/v1/",
  locations: {
    Sofia: 51097,
    Chicago: 348308,
    Miami: 347936,
  },
  coverControlDevice: "http://192.168.205.244/",
};

function getWeatherURLForLocation(location) {
  return (
    CONFIG.weatherCurrentEndpoint +
    JSON.stringify(CONFIG.locations[location]) +
    "?apikey=" +
    CONFIG.accuWeatherAPIKEY +
    "&details=true"
  );
}

function cover(position) {
  print("Cover will ", position);
  Shelly.call(
    "http.get",
    { url: CONFIG.coverControlDevice + "roller/0?go=" + position },
    function (response, error_code, error_message, ud) {
      print(JSON.stringify(response));
    },
    null
  );
}

function CoverControlLocation(location) {
  Shelly.call(
    "http.get",
    { url: getWeatherURLForLocation(location) },
    function (response, error_code, error_message, location) {
      let weatherData = JSON.parse(response.body);
      if (weatherData[0].CloudCover > 60) {
        cover("open");
      }
      if (weatherData[0].CloudCover < 40) {
        cover("close");
      }
      print(location, " clouds - ", weatherData[0].CloudCover, "%");
    },
    location
  );
}

//CoverControlLocation("Chicago");
CoverControlLocation("Sofia");
//CoverControlLocation( "Miami" );

//you can also invoke mos call script.eval '{"id":0, "code":
//"CoverControlLocation(\"Miami\")"}' --port http://YOUR-SHELLY-ADDRESS
