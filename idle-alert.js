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


// Shelly Script example: Alert on inactivity
//
// Script that will monitor the inputs of a Shelly and if there was no user
// interaction with the input(s) It will call an URL with a predefined message

let CONFIG = {
    timeoutBeforeAlert: 12 * 60 * 60 * 1000,
    inputID: "",       // string
    inputEvent: -1,    // int
    alertEndpoint: "http://myalert.bot/?message=${message}"
};

let alertTimer = null;

function replace(origin, substr, replace) {
    return origin.slice(0, origin.indexOf(substr))
        + replace
        + origin.slice(origin.indexOf(substr)
            + substr.length, origin.length)
}

function startTimer() {
    alertTimer = Timer.set(CONFIG.timeoutBeforAlert,
        true,
        function (ud) {
            let alertURL = replace(CONFIG.alertEndpoint,
                "${message}",
                "Grandpa:_No_activity_for_12_hours!");
            Shelly.call("HTTP.GET",
                { url: alertURL },
                function (res, error_code, error_msg, ud) {
                    if (res.code === 200) {
                        print("Successfully transmitted a message");
                    };
                },
                null);
        },
        null
    );
}

function stopTimer() {
    Timer.clear(alertTimer);
}

Shelly.addEventHandler(
    function (event, ud) {
        // while we don't have better selectivity for event source
        if (typeof (event.info.state) !== 'undefined') {
            stopTimer();
            startTimer();
            print("TIMER WAS RESET");
        }
    },
    null
);