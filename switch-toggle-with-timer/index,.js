// Toggle the switch after a specific time

const waitForXSeconds = 1000 * 60;

function timerCode() {
    Shelly.call("Switch.Toggle", {"id": 0});
};

timerCode()
Timer.set(waitForXSeconds, false, timerCode);
