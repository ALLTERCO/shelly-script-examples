// this script how a classic switch (not a push switch) can be used to to perform different action simple and double 
press

let timer = undefined;

let simpleClickAction = 'http://shelly-ip/rpc/Switch.Toggle?id=0';
let doubleClickAction = 'http://shelly-ip/rpc/Switch.Toggle?id=1';

let doubleClickDelay = 400;

let buttonId = 0;

function toggleLight(action) {
    timer = undefined;

    return Shelly.call(
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
        if (typeof event.info.event !== 'undefined' && event.info.event === 'toggle' && event.info.id === buttonId) {

            if (timer === undefined) {
                
                timer = Timer.set(doubleClickDelay, 0, toggleLight, simpleClickAction);
            } else {
                
                Timer.clear(timer);
                timer = undefined;
                toggleLight(doubleClickAction);
            }
        }
    }
)
