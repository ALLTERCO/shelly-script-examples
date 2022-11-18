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
// template for Shelly Plus device APs and if found, will connect to that AP
// and provision wifi credentials

let CONFIG = {
  scanSSID: [
    {
      gen: 1,
      apn: ["shelly1", "shelly1pm"],
    },
    {
      gen: 2,
      apn: ["ShellyPlus"],
    },
  ],
  provisionAP: {
    ssid: "YourWiFiSSID",
    pass: "YourPassword",
    enable: false,
  },
  shellyAPAddress: "192.168.33.1",
  //disable the AP once set up
  disableShellyAP: false,
  runPeriod: 5 * 1000,
};

function shallowCopy(dst, src) {
  for (let k in src) {
    if (typeof dst[k] === "undefined" && typeof dst[k] !== "object") {
      dst[k] = src[k];
    }
  }
}

let Scanner = {
  scanning: false,
  provisionining: false,
  scanCache: [],
  targetCache: [],
  eventHandlerId: null,
  scanTimer: null,

  addToTargetCache: function (ssid) {
    this.targetCache.push(ssid);
  },

  popScanCacheItem: function () {
    this.scanCache.splice(0, 1);
  },

  startScanning: function () {
    print("Starting scanning...");
    if (this.scanTimer !== null) return;
    if (typeof CONFIG.runPeriod !== undefined) {
      this.scanTimer = Timer.set(
        CONFIG.runPeriod,
        true,
        function (self) {
          self.scan();
        },
        this
      );
    }
  },

  stopScanning: function () {
    if (this.scanTimer !== null) {
      Timer.clear(this.scanTimer);
      this.scanTimer = null;
    }
  },

  initEventListener: function () {
    this.eventHandlerId = Shelly.addEventHandler(function (event, self) {
      if (typeof event.info.ssid === "undefined") return;
      if (typeof event.info.status === "undefined") return;
      if (event.info.status.indexOf("got ip") === -1) return;

      let ssid = self.scanCache[0];
      if (event.info.ssid.indexOf(ssid) !== -1) {
        self.provision();
      }
    }, this);
  },

  clearEventListener: function () {
    Shelly.removeEventHandler(this.eventHandlerId);
  },

  clearTargetCache: function () {
    this.targetCache.splice(0, this.targetCache.length);
  },

  /**
   * Looks for access point name match with prefixes from CONFIG.scanSSID
   * @param {string} apName
   * @returns {number|false} generation number or false if not found
   */
  matchAP: function (ssid) {
    for (let gi in CONFIG.scanSSID) {
      for (let api in CONFIG.scanSSID[gi].apn) {
        if (ssid.indexOf(CONFIG.scanSSID[gi].apn[api]) === -1) continue;
        return CONFIG.scanSSID[gi].gen;
      }
    }
    return false;
  },

  isInCache: function (ssid) {
    for (let papk in self.targetCache) {
      let tSSID = self.targetCache[papk];
      if (tSSID.indexOf(ssid) !== -1) {
        return true;
      }
    }
    return false;
  },

  scan: function () {
    //prevent reentry
    if (this.scanning || this.provisionining) {
      print("Already scanning. Abort.");
      return;
    }
    print("Scanning for wifi networks");
    this.scanning = true;
    this.stopScanning();
    this.scanCache.splice(0, this.scanCache.length);
    Shelly.call(
      "WiFi.Scan",
      {},
      function (result, error_code, error_message, self) {
        if (error_code !== 0) {
          print("WiFi scan failed", error_message);
          self.startScanning();
          return;
        }
        let wifiAPs = result.results;
        //walk through all the found ssids and look for starting
        //with shelly with no auth enabled
        for (let apk in wifiAPs) {
          let cSSID = wifiAPs[apk].ssid;
          if (wifiAPs[apk].auth !== 0) continue;
          if (self.matchAP(cSSID) === false) continue;
          if (self.isInCache(cSSID) === false) {
            print("This AP is a target: ", cSSID);
            self.scanCache.push(cSSID);
          }
        }
        self.scanning = false;
        if (self.scanCache.length) {
          print("Found ", self.scanCache.length, " APs. Start provisioning");
          self.startProvision();
        } else {
          print("APs not found or already provisioned");
          self.startScanning();
        }
      },
      this
    );
  },

  startProvision: function () {
    this.initEventListener();
    Shelly.call(
      "wifi.setconfig",
      { config: { sta: { enable: false } } },
      function (res, error_code, error_msg) {
        print("Disabled station on device");
      }
    );
    this.doNextProvision();
  },

  doNextProvision: function () {
    if (this.scanCache.length === 0) {
      this.endProvision();
      return;
    }
    let ssid = this.scanCache[0];
    Shelly.call(
      "wifi.setconfig",
      { config: { sta1: { ssid: ssid, pass: "", enable: true } } },
      function (res, error_code, error_msg, ssid) {
        print("Enable sta1 configured to connect to: ", ssid);
      },
      ssid
    );
  },

  endProvision: function () {
    print("End provisioning");
    this.clearEventListener();
    this.startScanning();
    Shelly.call(
      "wifi.setconfig",
      { config: { sta1: { enable: false } } },
      function (res, error_code, error_msg) {
        print("Disable sta1");
      }
    );
    Shelly.call(
      "wifi.setconfig",
      { config: { sta: { enable: true } } },
      function (res, error_code, error_msg) {
        print("Enable sta ");
      }
    );
  },

  composeStaEndpoint: function (gen) {
    let url = "http://" + CONFIG.shellyAPAddress;
    if (gen === 2) {
      url += "/rpc/wifi.setconfig";
    } else {
      url += "/settings/sta?";
    }
    return url;
  },

  provision: function () {
    print("Will provision ", this.scanCache[0]);
    this.provisionining = true;
    let gen = this.matchAP(this.scanCache[0]);
    let url = this.composeStaEndpoint(gen);
    if (gen === 2) {
      let wifiData = {};
      shallowCopy(wifiData, CONFIG.provisionAP);
      let postData = {
        url: url,
        body: {
          config: {
            sta1: wifiData,
            ap: {
              enable: !CONFIG.disableShellyAP,
            },
          },
        },
      };
      print(JSON.stringify(postData));
      Shelly.call(
        "HTTP.POST",
        postData,
        function (response, error_code, error_message, self) {
          let rpcCode = response.code;
          // if (rpcCode === 200) {
          print("Success provisioning: ", self.scanCache[0]);
          self.addToTargetCache(self.scanCache[0]);
          self.popScanCacheItem();
          // };
          self.provisionining = false;
          self.doNextProvision();
        },
        this
      );
    } else if (gen === 1) {
      url =
        url +
        "ssid=" +
        CONFIG.provisionAP.ssid +
        "&key=" +
        CONFIG.provisionAP.pass +
        "&enabled=1";
      Shelly.call(
        "HTTP.GET",
        { url: url },
        function (response, error_code, error_message, self) {
          let rpcCode = response.code;
          // if (rpcCode === 200) {
          print("Success provisioning: ", self.scanCache[0]);
          self.addToTargetCache(self.scanCache[0]);
          self.popScanCacheItem();
          // };
          self.provisionining = false;
          self.doNextProvision();
        },
        this
      );
    }
  },
};

Scanner.startScanning();
