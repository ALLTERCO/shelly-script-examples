# Send Open/Close Message to S2PMG3 or Listen for Sensor Messages

## Short Description

This setup includes:
- A script to **send open/close commands** to an S2PMG3 device in Cover Mode  
- A script to **listen for messages** from BTHome sensors such as D/W (door/window) open/close or HT (humidity/temperature) changes

## Requirements

- One Shelly device that supports the **LoRa add-on**  
- A **unique AES key** for encrypting messages  
  - The provided key is only an example  
  - Generate your own [here](https://generate-random.org/encryption-key-generator)

## Installation

1. Wire up your Shelly devices  
2. Attach the LoRa add-ons to the Shelly device  
3. Power on the device  
4. In the embedded web interface, open the **Add-on** submenu and enable the **LoRa add-on**

---

### To Send Commands

1. Create a script named `lora-covercontrol-sender.js`  
2. Use the following commands:
   - For open: `sendMessage(OPEN_MSG);`  
   - For close: `sendMessage(CLOSE_MSG);`

---

### To Receive Messages from BTHome Sensors

1. Create a script named `lora-covercontrol-listener.js`