// report for switch status
// {
//     "temperature": { "tF": 121.1, "tC": 49.5 },
//     "aenergy": {
//       "minute_ts": 1632600459,
//       "by_minute": [0, 0, 0],
//       "total": 0.134
//     },
//     "current": 0,
//     "voltage": 238.215,
//     "apower": 0,
//     "output": false,
//     "source": "switch",
//     "id": 0
// }

const result = Shelly.getComponentStatus("Switch:0");

print(JSON.stringify(result));
//if we need to check the state of the switch
//peek into result.output
if (result.output === true) {
  print("Switch is on");
}
