/**
 * @title EcoFlow STREAM Ultra Load Balancing (static config)
 * @description Polls Shelly EM / Plug S Gen3 devices and controls an EcoFlow
 *   STREAM Ultra via the EcoFlow cloud API. Switches between discharge, charge,
 *   and idle modes based on total load and a configurable night-charging window.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/ecoflow/stream-ultra/load_balancing_static.shelly.js
 */

/*
 * Modes:
 *   discharge : sum of all device readings > threshold (day hours)
 *   charge    : night window (configurable hours)
 *   idle      : day + load below threshold — battery neither charges nor discharges
 *
 * All configuration is embedded below in CONFIG / DEVICES_CFG.
 * No KVS setup required — edit the values directly and upload the script.
 * HMAC-SHA256 adapted from ecoflow_api.js reference.
 */

/* === CONFIG === */
// Edit these values before uploading the script to the Shelly device.

var CONFIG = {
    // EcoFlow API credentials
    accessKey : "YOUR_ACCESS_KEY",
    secretKey : "YOUR_SECRET_KEY",
    serial    : "YOUR_DEVICE_SERIAL",
    region    : "eu",           // "eu" or "us"

    // EcoFlow command routing (STREAM Ultra defaults — change only if needed)
    cmdId     : 17,
    cmdFunc   : 254,
    dirDest   : 1,
    dirSrc    : 1,
    dest      : 2,

    // Night-charging window (local device hours, 0–23)
    nightStart : 23,            // hour charging begins (inclusive)
    nightEnd   :  6,            // hour charging ends   (exclusive, wraps midnight)
    nightSoc   : 95,            // backup-reserve % during night charging

    // Day operation
    threshold  : 600,           // W — above this the battery discharges
    pollMs     : 5000           // polling interval in milliseconds
};

/* === DEVICES === */
// List of Shelly devices to measure.
//   type    : "em"   — Shelly EM Gen4, reads EM1.GetStatus  -> act_power
//           : "plug" — Shelly Plug S Gen3, reads Switch.GetStatus -> apower
//   host    : IP address or hostname of the Shelly device
//   channel : EM channel index (usually 0 or 1) / Switch id (usually 0)
//   name    : friendly label used in log output only

var DEVICES_CFG = [
    { type: "em",   host: "192.168.1.10", channel: 0, name: "Main EM ch0" },
    { type: "em",   host: "192.168.1.10", channel: 1, name: "Main EM ch1" },
    { type: "plug", host: "192.168.1.20", channel: 0, name: "Plug South"  }
];

/* === STATE === */

var CFG = null;
var DEVICES = [];
var lastMode = "";
var busy = false;
var LOG_METERS = false;

/* === SHA-256 === */

var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

// Encode UTF-8 string to byte array.
function strToBytes(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c < 0x80) {
            b.push(c);
        } else if (c < 0x800) {
            b.push(0xC0 | (c >> 6));
            b.push(0x80 | (c & 0x3F));
        } else {
            b.push(0xE0 | (c >> 12));
            b.push(0x80 | ((c >> 6) & 0x3F));
            b.push(0x80 | (c & 0x3F));
        }
    }
    return b;
}

// Parse one hex byte from a hex string at position i (avoids slice()).
function hexByte(hex, i) {
    var hi = hex.charCodeAt(i);
    var lo = hex.charCodeAt(i + 1);
    hi = hi <= 57 ? hi - 48 : hi - 87;
    lo = lo <= 57 ? lo - 48 : lo - 87;
    return (hi << 4) | lo;
}

// SHA-256 over a pre-built byte array.
// rotr32 and add32 are fully inlined — no helper calls inside the loop
// to avoid mJS stack overflow.
function sha256bytes(b) {
    var msgLen = b.length;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0x00);
    var bitLen = msgLen * 8;
    b.push(0); b.push(0); b.push(0); b.push(0);
    b.push((bitLen >>> 24) & 0xFF);
    b.push((bitLen >>> 16) & 0xFF);
    b.push((bitLen >>> 8)  & 0xFF);
    b.push( bitLen         & 0xFF);
    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = [];
    var x, s0, s1, tmp1, tmp2, a, bb, c, d, e, f, g, h, ch, maj, S0, S1;
    for (var blk = 0; blk < b.length; blk += 64) {
        for (var t = 0; t < 16; t++) {
            W[t] = ((b[blk + t*4] << 24) | (b[blk + t*4 + 1] << 16) | (b[blk + t*4 + 2] << 8) | b[blk + t*4 + 3]) >>> 0;
        }
        for (var t = 16; t < 64; t++) {
            x = W[t - 15]; s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
            x = W[t - 2];  s1 = (((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10)) >>> 0;
            W[t] = ((W[t - 16] + s0 + W[t - 7] + s1) | 0) >>> 0;
        }
        a = H0; bb = H1; c = H2; d = H3; e = H4; f = H5; g = H6; h = H7;
        for (var t = 0; t < 64; t++) {
            S1  = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
            ch  = ((e & f) ^ (~e & g)) >>> 0;
            tmp1 = ((h + S1 + ch + K256[t] + W[t]) | 0) >>> 0;
            S0  = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
            maj  = ((a & bb) ^ (a & c) ^ (bb & c)) >>> 0;
            tmp2 = ((S0 + maj) | 0) >>> 0;
            h = g; g = f; f = e;
            e = ((d + tmp1) | 0) >>> 0;
            d = c; c = bb; bb = a;
            a = ((tmp1 + tmp2) | 0) >>> 0;
        }
        H0 = ((H0 + a)  | 0) >>> 0;  H1 = ((H1 + bb) | 0) >>> 0;
        H2 = ((H2 + c)  | 0) >>> 0;  H3 = ((H3 + d)  | 0) >>> 0;
        H4 = ((H4 + e)  | 0) >>> 0;  H5 = ((H5 + f)  | 0) >>> 0;
        H6 = ((H6 + g)  | 0) >>> 0;  H7 = ((H7 + h)  | 0) >>> 0;
    }
    var hx  = "0123456789abcdef";
    var hex = "";
    var arr = [H0, H1, H2, H3, H4, H5, H6, H7];
    for (var i = 0; i < 8; i++) {
        var v = arr[i];
        for (var s = 28; s >= 0; s -= 4) hex += hx[(v >>> s) & 0xF];
    }
    return hex;
}

// HMAC-SHA256 — operates on byte arrays throughout, never calls bytesToStr.
function hmacSha256(key, message) {
    var keyBytes = strToBytes(key);
    if (keyBytes.length > 64) {
        var kh = sha256bytes(keyBytes);
        keyBytes = [];
        for (var i = 0; i < 64; i += 2) keyBytes.push(hexByte(kh, i));
    }
    while (keyBytes.length < 64) keyBytes.push(0x00);

    var opad = [], ipad = [];
    for (var i = 0; i < 64; i++) {
        opad.push(keyBytes[i] ^ 0x5C);
        ipad.push(keyBytes[i] ^ 0x36);
    }

    var msgBytes = strToBytes(message);
    for (var i = 0; i < msgBytes.length; i++) ipad.push(msgBytes[i]);
    var innerHex = sha256bytes(ipad);

    for (var i = 0; i < 64; i += 2) opad.push(hexByte(innerHex, i));
    return sha256bytes(opad);
}

/* === ECOFLOW SIGNING === */

function addSignParts(obj, prefix, out) {
    prefix = prefix || "";
    for (var k in obj) {
        var fk = prefix ? (prefix + "." + k) : k;
        var v = obj[k];
        if (typeof v === "boolean") {
            out.push(fk + "=" + (v ? "true" : "false"));
        } else if (typeof v === "object" && v !== null) {
            addSignParts(v, fk, out);
        } else {
            out.push(fk + "=" + String(v));
        }
    }
}

function sortStrings(arr) {
    var n = arr.length;
    for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
            if (arr[i] > arr[j]) { var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
        }
    }
    return arr;
}

function buildAuth(paramsToSign) {
    var nonce = String(Math.floor(100000 + Math.random() * 900000));
    var ts    = String(Math.floor(Date.now()));
    var parts = [];
    addSignParts(paramsToSign, "", parts);
    sortStrings(parts);
    parts.push("accessKey=" + CFG.accessKey);
    parts.push("nonce=" + nonce);
    parts.push("timestamp=" + ts);
    return { sign: hmacSha256(CFG.secretKey, parts.join("&")), nonce: nonce, ts: ts };
}

function makeHeaders(paramsToSign, includeContentType) {
    var auth = buildAuth(paramsToSign);
    var headers = {
        "accessKey" : CFG.accessKey,
        "nonce"     : auth.nonce,
        "timestamp" : auth.ts,
        "sign"      : auth.sign
    };
    if (includeContentType) headers["Content-Type"] = "application/json;charset=UTF-8";
    return headers;
}

/* === ECOFLOW API === */

var ECO_HOSTS = { eu: "https://api-e.ecoflow.com", us: "https://api-a.ecoflow.com" };

function ecoHost() { return ECO_HOSTS[CFG.region] || ECO_HOSTS.eu; }

function ecoGetAll(cb) {
    Timer.set(0, false, function() {
        var signParams = { sn: CFG.serial };
        Shelly.call("HTTP.Request", {
            method  : "GET",
            url     : ecoHost() + "/iot-open/sign/device/quota/all?sn=" + CFG.serial,
            timeout : 10,
            headers : makeHeaders(signParams, false)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoGetAll HTTP error " + String(ec));
                cb("http_error", null); return;
            }
            var body = JSON.parse(res.body);
            if (!body || body.code !== "0") {
                print("[EcoFlow] ecoGetAll API error: " + (body ? body.message : "?"));
                cb("api_error", null); return;
            }
            cb(null, body.data);
        });
    });
}

function ecoSet(params, cb) {
    Timer.set(0, false, function() {
        var body = {
            sn      : CFG.serial,
            cmdId   : CFG.cmdId,
            cmdFunc : CFG.cmdFunc,
            dirDest : CFG.dirDest,
            dirSrc  : CFG.dirSrc,
            dest    : CFG.dest,
            needAck : true,
            params  : params
        };
        Shelly.call("HTTP.Request", {
            method  : "PUT",
            url     : ecoHost() + "/iot-open/sign/device/quota",
            timeout : 10,
            headers : makeHeaders(body, true),
            body    : JSON.stringify(body)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoSet HTTP error " + String(ec));
                if (cb) cb("http_error"); return;
            }
            var resp = JSON.parse(res.body);
            if (!resp || resp.code !== "0") {
                var code = resp ? String(resp.code) : "?";
                print("[EcoFlow] ecoSet API error " + code + ": " + (resp ? resp.message : "?"));
                if (cb) cb(code); return;
            }
            if (cb) cb(null);
        });
    });
}

/* === ECOFLOW COMMANDS === */

function ecoSetGridAndSoc(soc, cb) {
    ecoSet({ cfgFeedGridMode: 1, cfgBackupReverseSoc: soc }, cb);
}

function requestIdle(cb) {
    ecoGetAll(function(err, data) {
        var soc    = (data && data.cmsBattSoc)   ? parseInt(data.cmsBattSoc)   : 50;
        var minDsg = (data && data.cmsMinDsgSoc)  ? parseInt(data.cmsMinDsgSoc) : 30;
        var hold   = (soc > (minDsg + 1)) ? soc : (minDsg + 1);
        print("[Logic] requestIdle holdSoc=" + String(hold));
        ecoSet({ cfgBackupReverseSoc: hold, cfgFeedGridMode: 0 }, cb);
    });
}

function requestDischarge(cb) {
    print("[Logic] requestDischarge");
    ecoSet({ cfgFeedGridMode: 1, cfgBackupReverseSoc: 35 }, function(err) {
        if (err) { if (cb) cb(err); return; }
        Timer.set(200, false, function() {
            ecoSet(
                {
                    cfgEnergyStrategyOperateMode: {
                        operateSelfPoweredOpen: true,
                        operateIntelligentScheduleModeOpen: false
                    }
                },
                cb
            );
        });
    });
}

function requestCharge(cb) {
    print("[Logic] requestCharge");
    ecoSet(
        {
            cfgFeedGridMode: 1,
            cfgBackupReverseSoc: CFG.nightSoc
        },
        function(err) {
            if (err) { if (cb) cb(err); return; }
            Timer.set(200, false, function() {
                ecoSet(
                    {
                        cfgEnergyStrategyOperateMode: {
                            operateSelfPoweredOpen: true,
                            operateIntelligentScheduleModeOpen: false
                        }
                    },
                    cb
                );
            });
        }
    );
}

/* === DEVICE POLLING === */

function pollDevice(dev, cb) {
    var path = (dev.type === "em")
        ? "/rpc/EM1.GetStatus?id="    + String(dev.channel)
        : "/rpc/Switch.GetStatus?id=" + String(dev.channel);
    Shelly.call("HTTP.Request", {
        method  : "GET",
        url     : "http://" + dev.host + path,
        timeout : 5
    }, function(res, ec) {
        if (ec !== 0 || !res || res.code !== 200) {
            print("[Shelly] " + dev.name + " unreachable (ec=" + String(ec) + "), using 0 W");
            cb(0); return;
        }
        var data  = JSON.parse(res.body);
        var watts = (dev.type === "em") ? (data.act_power || 0) : (data.apower || 0);
        if (LOG_METERS) print("[Shelly] " + dev.name + ": " + String(Math.round(watts)) + " W");
        cb(watts);
    });
}

function pollAll(idx, totalW, cb) {
    if (idx >= DEVICES.length) { cb(totalW); return; }
    pollDevice(DEVICES[idx], function(w) {
        Timer.set(75, false, function() { pollAll(idx + 1, totalW + w, cb); });
    });
}

/* === NIGHT WINDOW === */

function getLocalHour() {
    var sys = Shelly.getComponentStatus("sys");
    if (sys) {
        if (sys.unixtime !== undefined && sys.utc_offset !== undefined) {
            var local = sys.unixtime + sys.utc_offset;
            var hour  = Math.floor((local % 86400) / 3600);
            if (hour >= 0 && hour <= 23) return hour;
        }
        if (sys.time && sys.time.length >= 2) {
            return (sys.time.charCodeAt(0) - 48) * 10 + (sys.time.charCodeAt(1) - 48);
        }
    }
    return Math.floor((Date.now() / 3600000) % 24);
}

function isNight() {
    var h = getLocalHour();
    var s = CFG.nightStart;
    var e = CFG.nightEnd;
    if (s === e) return true;
    if (s < e)   return h >= s && h < e;
    return h >= s || h < e;  // wraps midnight: e.g. 23–06
}

/* === CONTROL LOOP === */

function runOnce() {
    if (!CFG || busy) return;
    busy = true;
    pollAll(0, 0, function(totalW) {
        var night = isNight();
        print("[Logic] total=" + String(Math.round(totalW)) + "W  threshold=" +
              String(CFG.threshold) + "W  night=" + String(night) + "  lastMode=" + lastMode);

        if (night) {
            if (lastMode !== "charge") {
                requestCharge(function(err) { if (!err) lastMode = "charge"; busy = false; });
            } else {
                busy = false;
            }
        } else if (totalW > CFG.threshold) {
            if (lastMode !== "discharge") {
                print("[Logic] " + String(Math.round(totalW)) + " W > " + String(CFG.threshold) + " W → discharge");
                requestDischarge(function(err) { if (!err) lastMode = "discharge"; busy = false; });
            } else {
                busy = false;
            }
        } else {
            var needStop = (lastMode === "discharge" || lastMode === "charge" || lastMode === "");
            if (needStop) {
                print("[Logic] " + String(Math.round(totalW)) + " W <= " + String(CFG.threshold) + " W → idle");
                requestIdle(function(err) { if (!err) lastMode = "idle"; busy = false; });
            } else {
                busy = false;
            }
        }
    });
}

/* === INIT === */
// Config is read directly from the embedded CONFIG and DEVICES_CFG objects
// above — no KVS required.

function init() {
    if (!CONFIG.accessKey || CONFIG.accessKey === "YOUR_ACCESS_KEY" ||
        !CONFIG.secretKey || CONFIG.secretKey === "YOUR_SECRET_KEY" ||
        !CONFIG.serial    || CONFIG.serial    === "YOUR_DEVICE_SERIAL") {
        print("[Init] ERROR: Fill in CONFIG.accessKey, CONFIG.secretKey and CONFIG.serial before running.");
        return;
    }

    CFG = {
        accessKey  : CONFIG.accessKey,
        secretKey  : CONFIG.secretKey,
        serial     : CONFIG.serial,
        region     : CONFIG.region    || "eu",
        cmdId      : CONFIG.cmdId     || 17,
        cmdFunc    : CONFIG.cmdFunc   || 254,
        dirDest    : CONFIG.dirDest   || 1,
        dirSrc     : CONFIG.dirSrc    || 1,
        dest       : CONFIG.dest      || 2,
        nightStart : CONFIG.nightStart !== undefined ? CONFIG.nightStart : 23,
        nightEnd   : CONFIG.nightEnd   !== undefined ? CONFIG.nightEnd   :  6,
        nightSoc   : CONFIG.nightSoc   || 95,
        pollMs     : CONFIG.pollMs     || 5000,
        threshold  : CONFIG.threshold  || 600
    };

    DEVICES = DEVICES_CFG;

    if (DEVICES.length === 0) {
        print("[Init] WARNING: DEVICES_CFG is empty — no meters to poll.");
    }

    print("[Init] " + String(DEVICES.length) + " device(s), " +
          "threshold=" + String(CFG.threshold) + " W, " +
          "poll=" + String(CFG.pollMs) + " ms, " +
          "night=" + String(CFG.nightStart) + ":00-" + String(CFG.nightEnd) + ":00");

    runOnce();
    Timer.set(CFG.pollMs, true, runOnce);
}

init();
