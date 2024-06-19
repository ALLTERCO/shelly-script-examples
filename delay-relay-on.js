const CONFIG = {
    /**
     * Choose your device switch ID to be used for turning on the switch after time delay
     */
    ID: 0,
    
    /**
     * Choose DELAY time in seconds after which the switch is turned on
     */
    DELAY: 5
}

let timerID;

function turnSwitchOn() {
    Shelly.call("Switch.Set", {"id": CONFIG.ID, "on": true});
    if (timerID) {
        Timer.clear(timerID);
    }
}

timerID = Timer.set(1000 * CONFIG.DELAY, false, turnSwitchOn);

