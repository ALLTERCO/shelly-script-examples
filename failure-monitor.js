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

// Shelly Script example: Load monitoring and alerting in Shelly Gen2
//
// This script listens for events when power changes to 0 and if the switch is
// still on then it alerts that something might have happened to the load

let CONFIG = {
    notifyEndpoint: "http://push-notification-endpoint-url"
};

let notifications = [];

Shelly.addEventHandler(
    function (event, user_data) {
        if (typeof event.info.apower === 'undefined') {
            return;
        };
        if (event.info.apower !== 0) {
            return;
        };
        Shelly.call(
            "switch.getstatus",
            { id: 0 },
            function (result, error_code, error_message, user_data) {
                if (result.output) {
                    notifications.push("load might have failed");
                };
            },
            null
        );
    },
    null
);

function _simple_encode(str) {
    let res = '';
    for (let i = 0; i < str.length; i++) {
        if (str.at(i) === 0x20) {
            res = res + '%20';
        } else {
            res = res + chr(str.at(i));
        };
    };
    return res;
}

Timer.set(
    1000,
    true,
    function () {
        if (notifications.length) {
            let message = notifications[0];
            notifications.splice(0, 1);
            print("ALERT: ", message);
            let nEndpoint = CONFIG.notifyEndpoint + _simple_encode(message);
            Shelly.call(
                "http.get",
                { url: nEndpoint },
                function (result, error_code, error_message) {
                    print(JSON.stringify(result));
                },
                null
            );
        };
    }
);
