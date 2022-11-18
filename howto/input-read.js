Shelly.call(
  "input.getstatus",
  {
    //for more than one input devices use the respective id
    id: 0,
  },
  function (result, error_code, error_message) {
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
  }
);
