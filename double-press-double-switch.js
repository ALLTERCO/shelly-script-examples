// the script show how perform mutliple action with a double classic switch used to toggle light.
// They keep their state once pressed, it usefull when the switch directly control the light.
// However it complicate double press actions when paired with a shelly. This script aim to solve this issue
// This version is designed for double switch, check double press switch if you have a simple one or don't plan 
// to use to bonus action full off action to turn all light off when pressing the two button at the same time.


let CONFIG = {
    simpleClickAction1: 'http://shelly1-ip/rpc/Switch.Toggle?id=0',
    doubleClickAction1: 'http://shelly1-ip/rpc/Switch.Toggle?id=1',
    simpleClickAction2: 'http://shelly2-ip/rpc/Switch.Toggle?id=0',
    doubleClickAction2: 'http://shelly2-ip/rpc/Switch.Toggle?id=1',

    simpleClickAction1FullOff: 'http://shelly1-ip/rpc/Switch.Set?id=0&on=false',
    doubleClickAction1FullOff: 'http://shelly1-ip/rpc/Switch.Set?id=1&on=false',
    simpleClickAction2FullOff: 'http://shelly2-ip/rpc/Switch.Set?id=0&on=false',
    doubleClickAction2FullOff: 'http://shelly2-ip/rpc/Switch.Set?id=1&on=false',

    doubleClickDelay: 250,

    buttonId1: 0,
    buttonId2: 1
};

let previouHitButtonId = undefined;
let timer = undefined;

function resetTimer() {
    Timer.clear(timer);
    timer = undefined;
    previouHitButtonId = undefined;
}

function toggleLight(action) {
    resetTimer();

    Shelly.call("http.get", {url: action});
}

Shelly.addEventHandler(
    function (event, user_data) {
        if (typeof event.info.event !== 'undefined' && event.info.event === 'toggle') {

            if (timer === undefined && event.info.id === CONFIG.buttonId1) {
                
                timer = Timer.set(CONFIG.doubleClickDelay, 0, toggleLight, CONFIG.simpleClickAction1);
                previouHitButtonId = CONFIG.buttonId1;

            } else if (timer === undefined && event.info.id === CONFIG.buttonId2) {
                
                timer = Timer.set(CONFIG.doubleClickDelay, 0, toggleLight, CONFIG.simpleClickAction2);
                previouHitButtonId = CONFIG.buttonId2;

            } else if (timer !== undefined && event.info.id === previouHitButtonId) {
                if (event.info.id === CONFIG.buttonId1) {

                    resetTimer();

                    toggleLight(CONFIG.doubleClickAction1);
                } else if (event.info.id === CONFIG.buttonId2) {

                    resetTimer();

                    toggleLight(CONFIG.doubleClickAction2);
                }
            } else if (timer !== undefined && event.info.id !== previouHitButtonId) {

                resetTimer();

                toggleLight(CONFIG.simpleClickAction1FullOff);
                toggleLight(CONFIG.doubleClickAction1FullOff);
                toggleLight(CONFIG.simpleClickAction2FullOff);
                toggleLight(CONFIG.doubleClickAction2FullOff);
            }
        }
    }
)