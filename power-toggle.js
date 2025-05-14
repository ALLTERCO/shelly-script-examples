/*
* This script saves your last recorded state and restores its inverse
* after power is lost.
*
* IMPORTANT!
* REQUIRES the following settings:
* 1. Toggle "Run on startup"
* 2. Home > Output > Input/Output settings > Turn Off
* 
*
* Tested on versions 1.4.5 through 1.5.1.
*/

/************************  code  ************************/

let kvs_key = "last_state"; // most recent state for KVS

// update KVS on state value change
function updateKVS(state) {
    let newState = state ? "on" : "off";
    Shelly.call("KVS.Set", { key: kvs_key, value: newState });
}

// toggle the relay based on state
function toggleRelay() {
    // get kvs
    // event.value = the state before the init
    Shelly.call("KVS.Get", { key: kvs_key }, function (event) {
        // invert its value
        if (event) {
            if (event.value === "on") {
                // turn off
                Shelly.call("Switch.Set", { id: 0, on: false });
                Shelly.call("KVS.Set", { key: kvs_key, value: "off" });
            } else {
                // turn on
                Shelly.call("Switch.Set", { id: 0, on: true });
                Shelly.call("KVS.Set", { key: kvs_key, value: "on" });
            }
        } else {
            // output
            Shelly.call("Switch.GetStatus", { id: 0 }, function (result, error_code, error_msg, ud) {
                if (result.output) {
                    Shelly.call("KVS.Set", { key: kvs_key, value: "on" });
                } else {
                    Shelly.call("KVS.Set", { key: kvs_key, value: "off" });
                }
            })
        }
        addStatus();
    })

}

// monitor state changes
function addStatus() {
    Shelly.addStatusHandler(function (event) {
        if (event.component === "switch:0" && event.delta.output !== undefined) {
            updateKVS(event.delta.output);
        }
    });
}

// pull switch config
Shelly.call("Switch.GetConfig", { id: 0 }, function (result, error_code, error_msg, ud) {
    if (error_code !== 0) {
        print("Error retrieving switch status: " + error_msg);
        return;
    }

    let initial_state = result.initial_state;
});

toggleRelay();
