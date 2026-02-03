/**
 * @title Example - Reading Input status
 * @description Example showing how to read Input component's status.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/howto/input-read.shelly.js
 */

const result = Shelly.getComponentStatus("Input:0");

print(JSON.stringify(result));
//result
// {
//     "state": false,
//     "id": 0
// }

//if we need to check the state of the input
//peek into result.state
if (result.state === true) {
  print("Input is on");
}