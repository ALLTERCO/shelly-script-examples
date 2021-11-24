// Copyright 2021 Allterco Robotics EOOD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Shelly is a Trademark of Allterco Robotics

// Shelly Script example: Turn on when temperature is below CONFIG.tempBelowTurnOn
// Turn off when temperature is above CONFIG.tempAboveTurnOff
// For getting an API-KEY from Accuweather follow the instructions on their site
// for registering a new application, copy the key and paste it here

let CONFIG = {
  accuWeatherAPIKEY: "YOUR-ACCUWEATHER-API-KEY",
  weatherForecastEndpoint:
    "http://dataservice.accuweather.com/forecasts/v1/daily/1day/",
  weatherCurrentEndpoint:
    "http://dataservice.accuweather.com/currentconditions/v1/",
  locations: {
    Sofia: 51097,
    Chicago: 348308,
    Miami: 347936,
    Mosfellsbaer: 190395,
  },
  //check every 60 seconds
  checkInterval: 60 * 1000,
  tempBelowTurnOn: -1,
  tempAboveTurnOff: 0,
};

function getWeatherURLForLocation(location) {
  return (
    CONFIG.weatherCurrentEndpoint +
    JSON.stringify(CONFIG.locations[location]) +
    "?apikey=" +
    CONFIG.accuWeatherAPIKEY +
    "&details=false"
  );
}

function activateSwitch(activate) {
  Shelly.call(
    "Switch.Set",
    { id: 0, on: activate },
    function (response, error_code, error_message) {}
  );
}

function TemperatureControlLocation(location) {
  Shelly.call(
    "http.get",
    { url: getWeatherURLForLocation(location) },
    function (response, error_code, error_message, location) {
      let weatherData = JSON.parse(response.body);
      if (weatherData[0].Temperature.Metric.Value <= CONFIG.tempBelowTurnOn) {
        activateSwitch(true);
      }
      if (weatherData[0].Temperature.Metric.Value >= CONFIG.tempAboveTurnOff) {
        activateSwitch(false);
      }
      print(
        location,
        " Temperature - ",
        weatherData[0].Temperature.Metric.Value,
        "deg C"
      );
    },
    location
  );
}

//TemperatureControlLocation("Mosfellsbaer");

Timer.set(CONFIG.checkInterval, true, function () {
  console.log("Checking weather");
  TemperatureControlLocation("Mosfellsbaer");
});
