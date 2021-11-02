// status of switch can be power consumption change, apower is watts
// {
//     "delta": { "apower": 5.12, "id": 0 },
//     "id": 0,
//     "name": "switch",
//     "component": "switch:0"
// }
// consumed energy report in milliwatts
// {
//     "delta": {
//       "aenergy": {
//         "total": 0.308,
//         "minute_ts": 1632614938,
//         "by_minute": [73.478, 74.428, 26.548]
//       },
//       "id": 0
//     },
//     "id": 0,
//     "name": "switch",
//     "component": "switch:0"
// }

Shelly.addStatusHandler(
    function (status) {
        //check if the event source is a switch
        //and if the id of the input is 0
        if (status.name === "switch" && status.id === 0) {
            if (typeof status.delta.apower === 'undefined') {
                return;
            }
            if (status.delta.apower > 4) {
                print("Using more than 4W power");
            }
        }
    }
);