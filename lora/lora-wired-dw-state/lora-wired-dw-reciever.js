/**
 * Script with event handler that listens for lora messages with "user" payload type
 * If doorWindowComponent is in the recieved data - show the result in virtual boolean component
 */

const CONFIG = {
  //Input key on which the DW sensor is connected in the sender
  doorWindowComponent: "input:1",
  //Virtual component type boolean - to output the result
  doorWindowVirtualComponent: "boolean",
  //Virtual component id
  doorWindowVirtualComponentId: 200,
};

Shelly.addEventHandler(function (event) {
  if (
    typeof event !== 'object' ||
    event.name !== 'lora' ||
    event.id !== 100 ||
    !event.info ||
    event.info.event !== "user_rx" ||
    !event.info.data
  ) {
    return;
  }

  const decodedMessage = atob(event.info.data);
  console.log("Message received: ", decodedMessage);

  const data = JSON.parse(decodedMessage);
  const value = data.value;

  if (data.component === CONFIG.doorWindowComponent) {
    const currentStatus = Shelly.getComponentStatus(
      CONFIG.doorWindowVirtualComponent + ":" + CONFIG.doorWindowVirtualComponentId
    );
    const currentValue = currentStatus.value;

    if (value !== currentValue) {
      Shelly.call(
        CONFIG.doorWindowVirtualComponent + ".Set",
        {
          id: CONFIG.doorWindowVirtualComponentId,
          value: value
        }
      );
    }
  }
});
