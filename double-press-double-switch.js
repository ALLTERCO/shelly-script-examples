// the script show how perform mutliple action with a double classic switch
// it support simple press and double press on each switch and press on both button at the same time 

let timer = undefined;
let previouHitButtonId = undefined;

let simpleClickAction1 = 'http://shelly1-ip/rpc/Switch.Toggle?id=0';
let doubleClickAction1 = 'http://shelly1-ip/rpc/Switch.Toggle?id=1';
let simpleClickAction2 = 'http://shelly2-ip/rpc/Switch.Toggle?id=0';
let doubleClickAction2 = 'http://shelly2-ip/rpc/Switch.Toggle?id=1';

let simpleClickAction1FullOff = 'http://shelly1-ip/rpc/Switch.Set?id=0&on=false';
let doubleClickAction1FullOff = 'http://shelly1-ip/rpc/Switch.Set?id=1&on=false';
let simpleClickAction2FullOff = 'http://shelly2-ip/rpc/Switch.Set?id=0&on=false';
let doubleClickAction2FullOff = 'http://shelly2-ip/rpc/Switch.Set?id=1&on=false';

let doubleClickDelay = 250;

let buttonId1 = 0;
let buttonId2 = 1;

function reset() {
    Timer.clear(timer);
    timer = undefined;
    previouHitButtonId = undefined;
}

function toggleLight(action) {
    reset();

    Shelly.call(
        "http.get", {
            url: action
        },
        function (response, error_code, error_message, ud) {
        },
        null
    );
}

Shelly.addEventHandler(
    function (event, user_data) {
        //print(JSON.stringify(event));
        if (typeof event.info.event !== 'undefined' && event.info.event === 'toggle') {

            if (timer === undefined && event.info.id === buttonId1) {
                
                timer = Timer.set(doubleClickDelay, 0, toggleLight, simpleClickAction1);
                previouHitButtonId = buttonId1;

            } else if (timer === undefined && event.info.id === buttonId2) {
                
                timer = Timer.set(doubleClickDelay, 0, toggleLight, simpleClickAction2);
                previouHitButtonId = buttonId2;

            } else if (timer !== undefined && event.info.id === previouHitButtonId) {
                if (event.info.id === buttonId1) {

                    reset();

                    toggleLight(doubleClickAction1);
                } else if (event.info.id === buttonId2) {

                    reset();

                    toggleLight(doubleClickAction2);
                }
            } else if (timer !== undefined && event.info.id !== previouHitButtonId) {

                reset();

                toggleLight(simpleClickAction1FullOff);
                toggleLight(doubleClickAction1FullOff);
                toggleLight(simpleClickAction2FullOff);
                toggleLight(doubleClickAction2FullOff);
            }
        }
    }
)
