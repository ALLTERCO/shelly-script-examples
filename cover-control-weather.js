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

// Shelly Script example: Control a Shelly 2.5 (Gen1) depending on current cloud
// conditions
//
// The script, when run, will fetch via REST api from a weather service the
// current conditions for a location check if cloud coverage is above or below
// certain percentage and respectively open or close window shades by calling a
// Shelly 2.5 (Gen1) endpoint

let CONFIG = {
    accuWeatherAPIKEY: "ACCUWEATHER-API-KEY",
    weatherForecastEndpoint: "http://dataservice.accuweather.com/forecasts/v1/daily/1day/",
    weatherCurrentEndpoint: "http://dataservice.accuweather.com/currentconditions/v1/",
    locations: {
        "Sofia": 51097,
        "Chicago": 348308,
        "Miami": 347936
    },
    coverControlDevice: "http://192.168.205.244/"
};

function getWeatherURLForLocation(location) {
    return CONFIG.weatherCurrentEndpoint +
        JSON.stringify(CONFIG.locations[location]) +
        "?apikey=" +
        CONFIG.accuWeatherAPIKEY +
        "&details=true";
};

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
};

function CoverControlLocation(location) {
    Shelly.call(
        "http.get",
        { url: getWeatherURLForLocation(location) },
        function (response, error_code, error_message, location) {
            let weatherData = JSON.parse(response.body);
            if (weatherData[0].CloudCover > 60) {
                cover("open");
            };
            if (weatherData[0].CloudCover < 40) {
                cover("close");
            };
            print(location, " clouds - ", weatherData[0].CloudCover, "%");
        },
        location
    );
};

//CoverControlLocation("Chicago");
CoverControlLocation("Sofia");
//CoverControlLocation( "Miami" );

//you can also invoke mos call script.eval '{"id":0, "code":
//"CoverControlLocation(\"Miami\")"}' --port http://YOUR-SHELLY-ADDRESS
