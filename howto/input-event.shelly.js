Shelly.addEventHandler(function (event) {
  //check if the event source is an input
  //and if the id of the input is 0
  if (event.name === "input" && event.id === 0) {
    //use event.info.state to determine the input state
    //true - input on
    //false - input off
    print("Input ", event.id, " is ", event.info.state ? "on" : "off");
  }
});
