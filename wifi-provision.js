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

// Shelly Script example: Provisioning of new Shelly Plus gen 2 devices
//
// This scripts periodically scans for access points with SSID matching the
// template for Shelly Plus device APs and if found, will connect to that AP and
// provision wifi credentials

let CONFIG = {
    provisionAP: {
        ssid: 'YourWifiAP',
        pass: 'Password'
    },
    //should I disable the AP of the slave once I have them set up?
    disableShellyAP: false
};

function shallowCopy(dst, src) {
    for (let k in src) {
        if (typeof dst[k] === 'undefined' && typeof dst[k] !== 'object') {
            dst[k] = src[k];
        }
    }
};

let Scanner = {
    apPattern: "ShellyPlus",
    scanning: false,
    provisionining: false,
    scanCache: [],
    targetCache: ["uno"],
    pTimerTimeout: 10,
    pTimer: null,
    eventHandlerId: null,
    initEventListener: function () {
        this.eventHandlerId = Shelly.addEventHandler(
            function (event, self) {
                let ssid = self.scanCache[0];
                if (typeof event.info.status !== 'undefined' &&
                    event.info.status.indexOf("got ip") !== -1 &&
                    typeof event.info.ssid !== 'undefined' &&
                    event.info.ssid.indexOf(ssid) !== -1) {
                    self.provisionining = true;
                    self.provision();
                };
            },
            this
        );
    },
    clearEventListener: function () {
        Shelly.removeEventHandler(this.eventHandlerId);
    },
    clearTargetCache: function () {
        this.targetCache.splice(0, this.targetCache.length);
    },
    scan: function () {
        if (this.scanning || this.provisionining) {
            print("We are working!");
            return;
        };
        this.scanCache.splice(0, this.scanCache.length);
        Shelly.call(
            "wifi.scan",
            {},
            function (result, error_code, error_message, self) {
                if (error_code === 0) {
                    let wifiAPs = result.results;
                    //walk through all the found ssids and look for starting
                    //with shelly with no auth enabled
                    for (let apk in wifiAPs) {
                        let cSSID = wifiAPs[apk].ssid;
                        if (cSSID.indexOf(self.apPattern) !== -1 && wifiAPs[apk].auth === 0) {
                            let usable = true;
                            for (let papk in self.targetCache) {
                                let tSSID = self.targetCache[papk];
                                if (tSSID.indexOf(cSSID) !== -1) {
                                    usable = false;
                                };
                            };
                            if (usable) {
                                print("This AP is a target: ", cSSID, self.scanCache);
                                self.scanCache.push(cSSID);
                            };
                        };
                    };
                }
                else {
                    print("Error scanning WiFi ", error_message);
                };
                self.scanning = false;
                if (self.scanCache.length) {
                    self.start();
                }
            },
            this
        );
    },
    start: function () {
        this.initEventListener();
        Shelly.call(
            "wifi.setconfig",
            { "config": { "sta": { "enable": false } } },
            function (res, error_code, error_msg, ud) {
                print("Disabling sta ", JSON.stringify(res));
            },
            null
        );
        this.next();
    },
    next: function () {
        if (this.scanCache.length > 0) {
            let ssid = this.scanCache[0];
            Shelly.call(
                "wifi.setconfig",
                { "config": { "sta1": { "ssid": ssid, "pass": "", "enable": true } } },
                function (res, error_code, error_msg, ud) {
                    print("Enable sta1 ", JSON.stringify(res));
                },
                null
            );
        } else {
            this.end();
        }
    },
    end: function () {
        this.clearEventListener();
        Shelly.call(
            "wifi.setconfig",
            { "config": { "sta1": { "enable": false } } },
            function (res, error_code, error_msg, ud) {
                print("Disabling sta1 ", JSON.stringify(res));
            },
            null);
        Shelly.call(
            "wifi.setconfig",
            { "config": { "sta": { "enable": true } } },
            function (res, error_code, error_msg, ud) {
                print("Enabling sta ", JSON.stringify(res));
            },
            null);
    },
    composeEndpoint: function (address, method) {
        return "http://" + address + "/rpc/" + method;
    },
    provision: function () {
        let wifiData = {
            enable: true
        };
        shallowCopy(wifiData, CONFIG.provisionAP);
        let postData = {
            url: this.composeEndpoint("192.168.33.1", "wifi.setconfig"),
            body: {
                config: {
                    sta1: wifiData
                }
            }
        };
        Shelly.call(
            "HTTP.POST",
            postData,
            function (response, error_code, error_message, self) {
                let rpcResult = JSON.parse(response.body);
                let rpcCode = response.code;
                let rpcMessage = response.message;
                if (rpcCode === 200) {
                    print("Success ", self.scanCache[0]);
                    self.targetCache.push(self.scanCache[0]);
                    self.scanCache.splice(0, 1);
                };
                self.provisionining = false;
                self.next();
            },
            this
        );
    }
};

// Either enable next line, or call with eval from the outside to start the
// provisioning
// Scanner.scan();
