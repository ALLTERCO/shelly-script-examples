/**
 * @title CWT-MB308V MODBUS example
 * @description Example integration for the ComWinTop MB308V IO module over MODBUS-RTU.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/mb308v.shelly.js
 */

/* === CONFIG === */
var CONFIG = {
    BAUD_RATE: 9600,
    MODE: "8N1",
    RESPONSE_TIMEOUT: 1000,
    POLL_INTERVAL: 5000,
    DEBUG: true
};

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
    var VC_HELPER_DELAY_MS = 150;
    var state2 = {
        existing: [],
        ids: {},
        keys: {},
        handles: {},
        ok: true
    };

    function log(msg) {
        print('[VC] ' + msg);
    }

    function componentKey(type, id) {
        return type + ':' + String(id);
    }

    function shallowConfigMatches(desired, current) {
        var k;

        if (!desired || !current) return false;

        for (k in desired) {
            if (k === 'meta') {
                if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
            } else if (typeof desired[k] === 'object' && desired[k] !== null) {
                if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
            } else if (desired[k] !== current[k]) {
                return false;
            }
        }

        return true;
    }

    function normalizeComponent(spec) {
        if (!spec.config) spec.config = {};
        if (!spec.config.name) spec.config.name = spec.key;
        return spec;
    }

    function findExistingByName(type, name) {
        var i;
        var c;

        for (i = 0; i < state2.existing.length; i++) {
            c = state2.existing[i];
            if (c.type === type && c.name === name) return c;
        }

        return null;
    }

    function remember(spec, id) {
        var key = componentKey(spec.type, id);
        state2.ids[spec.key] = id;
        state2.keys[spec.key] = key;
        state2.handles[spec.key] = Virtual.getHandle(key);
    }

    function getConfig(type, id) {
        return Shelly.getComponentConfig(type, id);
    }

    function deleteComponent(key, cb) {
        Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
            if (errCode !== 0) {
                log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
            }
            Timer.set(VC_HELPER_DELAY_MS, false, cb);
        });
    }

    function addComponent(spec, cb) {
        var params = { type: spec.type, config: spec.config };
        var id;

        if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

        Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
            if (errCode !== 0) {
                log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
                state2.ok = false;
                cb(false);
                return;
            }

            id = spec.id;
            if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
            if (id === undefined || id === null) {
                log('Virtual.Add did not return id for ' + spec.key);
                state2.ok = false;
                cb(false);
                return;
            }

            remember(spec, id);
            log('Created ' + state2.keys[spec.key] + ' ' + spec.config.name);
            Timer.set(VC_HELPER_DELAY_MS, false, function() {
                cb(true);
            });
        });
    }

    function ensureOne(spec, cb) {
        var current;
        var existing;
        var key;

        spec = normalizeComponent(spec);

        if (spec.id !== undefined && spec.id !== null) {
            current = getConfig(spec.type, spec.id);
            key = componentKey(spec.type, spec.id);

            if (current) {
                if (shallowConfigMatches(spec.config, current)) {
                    remember(spec, spec.id);
                    cb(true);
                    return;
                }

                log('Recreating mismatched ' + key + ' ' + spec.config.name);
                deleteComponent(key, function() {
                    addComponent(spec, cb);
                });
                return;
            }

            addComponent(spec, cb);
            return;
        }

        existing = findExistingByName(spec.type, spec.config.name);
        if (existing && shallowConfigMatches(spec.config, existing.config)) {
            remember(spec, existing.id);
            cb(true);
            return;
        }

        if (existing) {
            log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
        }
        addComponent(spec, cb);
    }

    function ensureList(index, cb) {
        var list = manifest.components || [];
        if (index >= list.length) {
            cb();
            return;
        }

        ensureOne(list[index], function() {
            Timer.set(VC_HELPER_DELAY_MS, false, function() {
                ensureList(index + 1, cb);
            });
        });
    }

    function createGroupConfig(name) {
        return { name: name, meta: { ui: { view: 'group' } } };
    }

    function groupMembers(group) {
        var members = [];
        var i;
        var logicalKey;

        for (i = 0; i < group.components.length; i++) {
            logicalKey = group.components[i];
            if (state2.keys[logicalKey]) members.push(state2.keys[logicalKey]);
        }

        return members;
    }

    function ensureGroup(index, cb) {
        var groups = manifest.groups || [];
        var group;
        var cfg;
        var current;
        var key;

        if (index >= groups.length) {
            cb();
            return;
        }

        group = groups[index];
        cfg = createGroupConfig(group.name);
        key = componentKey('group', group.id);
        current = getConfig('group', group.id);

        function setMembersAndContinue() {
            Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
                if (errCode !== 0) {
                    log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
                    state2.ok = false;
                }
                Timer.set(VC_HELPER_DELAY_MS, false, function() {
                    ensureGroup(index + 1, cb);
                });
            });
        }

        function addGroup() {
            Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
                if (errCode !== 0) {
                    log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
                    state2.ok = false;
                    Timer.set(VC_HELPER_DELAY_MS, false, function() {
                        ensureGroup(index + 1, cb);
                    });
                    return;
                }
                setMembersAndContinue();
            });
        }

        if (current && shallowConfigMatches(cfg, current)) {
            setMembersAndContinue();
            return;
        }

        if (current) {
            deleteComponent(key, addGroup);
        } else {
            addGroup();
        }
    }

    function readExistingPage(offset, cb) {
        Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
            var raw;
            var total;
            var i;
            var c;
            var cfg;
            var keyParts;

            if (errCode !== 0) {
                log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg));
                state2.ok = false;
                cb();
                return;
            }

            raw = (res && res.components) ? res.components : [];
            total = res ? (res.total || raw.length) : raw.length;

            for (i = 0; i < raw.length; i++) {
                c = raw[i];
                cfg = c.config || {};
                keyParts = (c.key || '').split(':');
                state2.existing.push({
                    key: c.key || componentKey(c.type || keyParts[0], cfg.id),
                    type: c.type || keyParts[0],
                    id: cfg.id,
                    name: cfg.name,
                    config: cfg
                });
            }

            if (offset + raw.length < total && raw.length > 0) {
                readExistingPage(offset + raw.length, cb);
            } else {
                cb();
            }
        });
    }

    readExistingPage(0, function() {
        ensureList(0, function() {
            ensureGroup(0, function() {
                done(state2.ok, {
                    ids: state2.ids,
                    keys: state2.keys,
                    handles: state2.handles
                });
            });
        });
    });
}

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.
//
// This device does not respond to a fixed default: init() auto-scans slave
// IDs 1-4 at startup, writing each candidate straight into the Virtual
// Component (so getSlaveId() reflects the ID actually being probed) and
// keeping whichever one responds.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 2;
var slaveIdHandle = null;

function getSlaveId() {
    var value = DEFAULT_SLAVE_ID;

    if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
    if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
    value = Math.round(value);
    if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
    if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

    if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
        slaveIdHandle.setValue(value);
    }

    return value;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// This script prints all values to the console; only the Modbus Slave ID is
// backed by a Virtual Component (it is configuration, not sensor data).

var VIRTUAL_COMPONENTS = {
    components: [
        {
            key: 'slaveId',
            type: 'number',
            id: 299,
            config: {
                name: 'Modbus Slave ID',
                min: MIN_SLAVE_ID,
                max: MAX_SLAVE_ID,
                default_value: DEFAULT_SLAVE_ID,
                persisted: true,
                meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
            }
        }
    ],
    groups: [
        { id: 299, name: 'CWT-MB308V Slave ID', components: ['slaveId'] }
    ]
};

var vcHandles = null;

/* === REGISTER MAP (all start at address 0) === */
var DI_COUNT = 8;   // FC 0x02
var DO_COUNT = 12;  // FC 0x01
var AI_COUNT = 8;   // FC 0x04
var AO_COUNT = 4;   // FC 0x03

var AI_MAX_VALUE = 10216;
var AO_MAX_VALUE = 24000;

/* === STATE === */
var state = {
    uart: null,
    rxBuffer: [],
    isReady: false,
    pendingRequest: null,
    responseTimer: null,
    pollTimer: null
};

/* === HELPERS === */

function toHex(n) {
    n = n & 0xFF;
    return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        s += toHex(bytes[i]);
        if (i < bytes.length - 1) s += " ";
    }
    return s;
}

function debug(msg) {
    if (CONFIG.DEBUG) print("[MB308V] " + msg);
}

// CRC-16/MODBUS — bitwise (no lookup table)
function calcCRC(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
        crc ^= bytes[i] & 0xFF;
        for (var b = 0; b < 8; b++) {
            crc = (crc & 1) ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
        }
    }
    return crc;
}

function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
    return s;
}

var buildFrame = function(fc, data) {
    var frame = [getSlaveId() & 0xFF, fc & 0xFF];
    for (var i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
    var crc = calcCRC(frame);
    frame.push(crc & 0xFF);
    frame.push((crc >> 8) & 0xFF);
    return frame;
}

/* === MODBUS CORE === */

var sendRequest = function(fc, data, callback) {
    if (!state.isReady)        { callback("not ready", null); return; }
    if (state.pendingRequest)  { callback("busy", null); return; }

    var frame = buildFrame(fc, data);
    debug("TX: " + bytesToHex(frame));

    state.pendingRequest = { fc: fc, callback: callback };
    state.rxBuffer = [];

    state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
        if (state.pendingRequest) {
            var cb = state.pendingRequest.callback;
            state.pendingRequest = null;
            debug("Timeout");
            cb("timeout", null);
        }
    });

    state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
    if (!data || data.length === 0) return;
    for (var i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
    processResponse();
}

function processResponse() {
    if (!state.pendingRequest || state.rxBuffer.length < 4) return;

    var fc = state.rxBuffer[1];

    if (fc & 0x80) {
        if (state.rxBuffer.length >= 5) {
            var exc = state.rxBuffer[2];
            var crc = calcCRC(state.rxBuffer.slice(0, 3));
            var rcrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
            if (crc === rcrc) {
                Timer.clear(state.responseTimer); state.responseTimer = null;
                var cb = state.pendingRequest.callback;
                state.pendingRequest = null; state.rxBuffer = [];
                cb("exception 0x" + toHex(exc), null);
            }
        }
        return;
    }

    var expLen = 0;
    if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) {
        if (state.rxBuffer.length >= 3) expLen = 3 + state.rxBuffer[2] + 2;
    } else if (fc === 0x05 || fc === 0x06) {
        expLen = 8;
    }

    if (expLen === 0 || state.rxBuffer.length < expLen) return;

    var frame = state.rxBuffer.slice(0, expLen);
    var crc = calcCRC(frame.slice(0, expLen - 2));
    var rcrc = frame[expLen - 2] | (frame[expLen - 1] << 8);

    if (crc !== rcrc) { debug("CRC error"); return; }

    debug("RX: " + bytesToHex(frame));
    Timer.clear(state.responseTimer); state.responseTimer = null;

    var payload = frame.slice(2, expLen - 2);
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null; state.rxBuffer = [];
    cb(null, payload);
}

/* === MB308V API === */

function readDigitalInputs(callback) {
    sendRequest(0x02, [0x00, 0x00, 0x00, DI_COUNT], function(err, r) {
        if (err) { callback(err, null); return; }
        var out = [];
        for (var i = 0; i < DI_COUNT; i++)
            out.push((r[1 + Math.floor(i / 8)] >> (i % 8)) & 1);
        callback(null, out);
    });
}

function readDigitalOutputs(callback) {
    sendRequest(0x01, [0x00, 0x00, 0x00, DO_COUNT], function(err, r) {
        if (err) { callback(err, null); return; }
        var out = [];
        for (var i = 0; i < DO_COUNT; i++)
            out.push((r[1 + Math.floor(i / 8)] >> (i % 8)) & 1);
        callback(null, out);
    });
}

function writeDigitalOutput(ch, val, callback) {
    if (ch < 0 || ch >= DO_COUNT) { callback("invalid ch", false); return; }
    sendRequest(0x05, [0x00, ch & 0xFF, val ? 0xFF : 0x00, 0x00], function(err, r) {
        callback(err, !err);
    });
}

function readAnalogInputs(callback) {
    sendRequest(0x04, [0x00, 0x00, 0x00, AI_COUNT], function(err, r) {
        if (err) { callback(err, null); return; }
        var out = [];
        for (var i = 0; i < AI_COUNT; i++) out.push((r[1 + i * 2] << 8) | r[2 + i * 2]);
        callback(null, out);
    });
}

function readAnalogOutputs(callback) {
    sendRequest(0x03, [0x00, 0x00, 0x00, AO_COUNT], function(err, r) {
        if (err) { callback(err, null); return; }
        var out = [];
        for (var i = 0; i < AO_COUNT; i++) out.push((r[1 + i * 2] << 8) | r[2 + i * 2]);
        callback(null, out);
    });
}

function writeAnalogOutput(ch, val, callback) {
    if (ch < 0 || ch >= AO_COUNT) { callback("invalid ch", false); return; }
    val = Math.max(0, Math.min(AO_MAX_VALUE, val));
    sendRequest(0x06, [0x00, ch & 0xFF, (val >> 8) & 0xFF, val & 0xFF], function(err, r) {
        callback(err, !err);
    });
}

function aiToMilliamps(raw) { return 4.0 + (raw / AI_MAX_VALUE) * 16.0; }
function aiToVoltage(raw)   { return (raw / AI_MAX_VALUE) * 10.0; }
function milliampsToAo(mA)  { mA = Math.max(4, Math.min(20, mA)); return Math.round(((mA - 4) / 16.0) * AO_MAX_VALUE); }
function voltageToAo(v)     { return Math.round((Math.max(0, Math.min(10, v)) / 10.0) * AO_MAX_VALUE); }

/* === POLLING === */

var relayToggle = false;

function pollAllInputs() {
    debug("--- poll ---");

    readDigitalInputs(function(err, inputs) {
        if (err) { debug("DI err: " + err); }
        else {
            var s = "";
            for (var i = 0; i < inputs.length; i++) s += "DI" + i + ":" + inputs[i] + " ";
            print("[DI] " + s);
        }

        Timer.set(100, false, function() {
            readAnalogInputs(function(err, vals) {
                if (err) { debug("AI err: " + err); }
                else {
                    var s = "";
                    for (var i = 0; i < vals.length; i++)
                        s += "AI" + i + ":" + aiToMilliamps(vals[i]).toFixed(2) + "mA ";
                    print("[AI] " + s);
                }

                Timer.set(100, false, function() {
                    relayToggle = !relayToggle;
                    writeDigitalOutput(0, relayToggle, function(err, ok) {
                        if (err) { debug("DO err: " + err); return; }
                        print("[DO] relay0=" + (relayToggle ? "ON" : "OFF"));

                        Timer.set(100, false, function() {
                            readDigitalOutputs(function(err, relays) {
                                if (err) { debug("DO read err: " + err); return; }
                                var s = "";
                                for (var i = 0; i < relays.length; i++) s += "DO" + i + ":" + relays[i] + " ";
                                print("[DO] " + s);
                            });
                        });
                    });
                });
            });
        });
    });
}

/* === INIT === */

function init() {
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
        if (!ok) {
            print("ERROR: Virtual component setup failed");
            return;
        }
        vcHandles = readyVc.handles;
        slaveIdHandle = readyVc.handles.slaveId;

        print("CWT-MB308V init");

        state.uart = UART.get();
        if (!state.uart) { print("ERROR: no UART"); return; }
        if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
            print("ERROR: UART configure failed"); return;
        }

        state.uart.recv(onReceive);
        state.isReady = true;
        print("UART ready " + CONFIG.BAUD_RATE + " " + CONFIG.MODE);

        // Scan slave IDs 1-4, use first that responds. Each candidate is written
        // straight into the slave-ID Virtual Component so getSlaveId() (used by
        // buildFrame()) picks it up immediately for that probe.
        var scanIds = [1, 2, 3, 4];
        var scanIdx = 0;

        function scanNext() {
            if (scanIdx >= scanIds.length) {
                print("[SCAN] no slave found - check wiring/baud");
                state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollAllInputs);
                return;
            }
            slaveIdHandle.setValue(scanIds[scanIdx++]);
            print("[SCAN] slave " + getSlaveId() + "...");
            writeDigitalOutput(0, true, function(err, ok) {
                if (err) {
                    print("[SCAN] slave " + getSlaveId() + ": " + err);
                    Timer.set(200, false, scanNext);
                } else {
                    print("[SCAN] slave " + getSlaveId() + " found! relay0=ON");
                    Timer.set(1000, false, function() {
                        writeDigitalOutput(0, false, function(e, o) {
                            print("[SCAN] relay0=OFF " + (e ? "err:" + e : "ok"));
                        });
                    });
                    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, pollAllInputs);
                }
            });
        }

        scanNext();
    });
}

init();
