/**
 * @title Example - Reading Input status
 * @description Example showing how to read Input component's status.
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