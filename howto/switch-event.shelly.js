/**
 * @title Example - Switch events
 * @description Example showing how to work with Switch component's events.
 */

Shelly.addEventHandler(function (event) {
  //check if the event source is a switch
  //and if the id of the input is 0
  if (event.name === "switch" && event.id === 0) {
    if (event.info.output) {
      print("Switch ", event.id, " is on");
    } else {
      print("Switch ", event.id, " is off");
    }
  }
});
