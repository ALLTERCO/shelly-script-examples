/**
 * @title PROC-CBs - Multi-Device Circuit Breaker Control
 * @description Automatically toggles circuit breakers on/off on each listed
 *   device at independent random intervals between MIN_INTERVAL and
 *   MAX_INTERVAL seconds. Also exposes an HTTP endpoint for manual control.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/pro_cb/proc_cbs.shelly.js
 */

/**
 * PROC-CBs Multi-Device Circuit Breaker Control
 *
 * Each device in CB_DEVICES gets its own independent auto-toggle loop.
 * CB id 0 on every device is toggled ON/OFF at a random interval between
 * MIN_INTERVAL and MAX_INTERVAL seconds (each device picks its own delay).
 *
 * HTTP endpoint for manual control (targets a specific device by index):
 *   GET  http://<SHELLY-IP>/script/<ID>/cb?dev=<n>&id=<cbid>&output=<true|false>
 *   POST http://<SHELLY-IP>/script/<ID>/cb
 *        Body (JSON): {"dev": <n>, "id": <cbid>, "output": <true|false>}
 *
 * Parameters:
 *   dev    - Device index in CB_DEVICES list (0-based); defaults to 0
 *   id     - Circuit breaker index on that device (0 .. CB_COUNT-1)
 *   output - true to switch ON, false to switch OFF
 *
 * Response on success:
 *   {"dev": <n>, "host": "<ip>", "id": <cbid>, "output": <bool>}
 * Response on error:
 *   {"error": "<message>"}
 *
 * Example:
 *   GET .../cb?dev=0&id=0&output=true   -> turn ON  CB 0 on device 0
 *   GET .../cb?dev=1&id=0&output=false  -> turn OFF CB 0 on device 1
 */

/* === CONFIG === */
var CONFIG = {
    CB_DEVICES: [
        "192.168.33.1"
    ],
    CB_COUNT:     4,   // number of circuit breakers per device (IDs 0 .. CB_COUNT-1)
    CB_AUTO_ID:   0,   // circuit breaker ID toggled by the auto loop on each device
    MIN_INTERVAL: 2,   // minimum random interval in seconds
    MAX_INTERVAL: 4,   // maximum random interval in seconds
    TIMEOUT:      5000, // HTTP request timeout in ms
    DEBUG:        true
};

/* === STATE === */
// One entry per device: { output: bool, countdown: seconds remaining }
// A single repeating 1-second tick drives all devices.
var devices = [];
var tickTimer = null;

/* === HELPERS === */

function debug(msg) {
    if (CONFIG.DEBUG) {
        print("[CB] " + msg);
    }
}

function randSeconds() {
    var range = CONFIG.MAX_INTERVAL - CONFIG.MIN_INTERVAL + 1;
    return CONFIG.MIN_INTERVAL + Math.floor(Math.random() * range);
}

function sendError(response, code, msg) {
    response.code = code;
    response.body = JSON.stringify({ error: msg });
    response.send();
}

function parseQS(qs) {
    var params = {};
    if (!qs || qs.length === 0) return params;
    var parts = qs.split("&");
    for (var i = 0; i < parts.length; i++) {
        var eqIdx = parts[i].indexOf("=");
        if (eqIdx < 0) {
            params[parts[i]] = null;
        } else {
            params[parts[i].substring(0, eqIdx)] = parts[i].substring(eqIdx + 1);
        }
    }
    return params;
}

/* === CB CONTROL === */

function setCB(host, id, output, callback) {
    var url = "http://" + host + "/rpc/CB.Set?id=" + id + "&output=" + output;
    debug("-> " + url);
    Shelly.call("HTTP.GET", { url: url, timeout: CONFIG.TIMEOUT }, function(res, err) {
        if (err || !res) {
            debug("HTTP error on " + host + ": " + JSON.stringify(err));
            if (callback) callback(false);
            return;
        }
        debug("<- " + host + " " + res.code + " " + res.body);
        if (callback) callback(true);
    });
}

/* === AUTO TOGGLE (single shared tick timer) === */

function tick() {
    for (var i = 0; i < devices.length; i++) {
        devices[i].countdown--;
        if (devices[i].countdown <= 0) {
            devices[i].output = !devices[i].output;
            devices[i].countdown = randSeconds();
            debug("Device " + i + " (" + CONFIG.CB_DEVICES[i] + ") -> " +
                  devices[i].output + ", next in " + devices[i].countdown + "s");
            // Capture index for async callback
            (function(idx) {
                setCB(CONFIG.CB_DEVICES[idx], CONFIG.CB_AUTO_ID, devices[idx].output, null);
            }(i));
        }
    }
}

/* === HTTP HANDLER === */

function httpHandler(request, response) {
    var devIdx = 0;
    var id = 0;
    var output = null;

    if (request.method === "POST" && request.body && request.body.length > 0) {
        var body;
        try {
            body = JSON.parse(request.body);
        } catch (e) {
            sendError(response, 400, "Invalid JSON body: " + e);
            return;
        }
        if (body.dev !== undefined) devIdx = parseInt(body.dev, 10);
        if (body.id  !== undefined) id     = parseInt(body.id, 10);
        if (body.output !== undefined) {
            output = body.output === true || body.output === "true" || body.output === 1;
        }
    } else {
        var params = parseQS(request.query);
        if (params.dev    !== undefined && params.dev    !== null) devIdx = parseInt(params.dev, 10);
        if (params.id     !== undefined && params.id     !== null) id     = parseInt(params.id, 10);
        if (params.output !== undefined && params.output !== null) {
            output = params.output === "true" || params.output === "1";
        }
    }

    if (output === null) {
        sendError(response, 400, "Missing 'output' parameter (true or false)");
        return;
    }
    if (isNaN(devIdx) || devIdx < 0 || devIdx >= CONFIG.CB_DEVICES.length) {
        sendError(response, 400, "Invalid 'dev': must be 0.." + (CONFIG.CB_DEVICES.length - 1));
        return;
    }
    if (isNaN(id) || id < 0 || id >= CONFIG.CB_COUNT) {
        sendError(response, 400, "Invalid 'id': must be 0.." + (CONFIG.CB_COUNT - 1));
        return;
    }

    var host = CONFIG.CB_DEVICES[devIdx];
    setCB(host, id, output, function(ok) {
        if (!ok) {
            sendError(response, 502, "CB request failed for " + host);
            return;
        }
        response.code = 200;
        response.body = JSON.stringify({ dev: devIdx, host: host, id: id, output: output });
        response.send();
    });
}

/* === INIT === */

function init() {
    print("PROC-CBs Multi-Device Circuit Breaker Control");
    print("==============================================");

    // Build per-device state with a staggered initial countdown
    for (var i = 0; i < CONFIG.CB_DEVICES.length; i++) {
        devices.push({ output: false, countdown: randSeconds() });
        print("Device " + i + ": " + CONFIG.CB_DEVICES[i] +
              " (first toggle in " + devices[i].countdown + "s)");
    }

    // Single 1-second repeating timer drives all devices
    tickTimer = Timer.set(1000, true, tick);

    print("");
    print("Endpoint: GET/POST /script/<ID>/cb");
    print("  GET .../cb?dev=0&id=0&output=true");
    print("  POST .../cb  {\"dev\":1, \"id\":0, \"output\":false}");

    HTTPServer.registerEndpoint("cb", httpHandler);
}

init();
