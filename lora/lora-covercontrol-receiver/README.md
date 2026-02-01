# Receive Open/Close Commands or Send Sensor States

## Short Description

This setup allows a Shelly device to either receive open/close commands via LoRa or send messages when a BTHome sensor's state changes.

## Requirements

- One Shelly device that supports the **LoRa add-on** and **Cover mode**  
- For the BTHome sensor script: **Shelly Blu HT** and/or **Shelly Blu Door/Window**  
- A **unique AES key** is required for encrypting messages  
  - The provided key is just an example  
  - You can generate your own [here](https://generate-random.org/encryption-key-generator)

## Installation

1. Wire up your Shelly devices  
2. Attach the LoRa add-ons to the Shelly device  
3. Power on the device  
4. In the embedded web interface, open the **Add-on** submenu and enable the **LoRa add-on**

---

### To Receive Open/Close Commands

1. Create a script named `lora-covercontrol-receiver.shelly.js`  
2. Start the script  

> **Note:** The Shelly device must be in **Cover Mode** and properly calibrated

---

### To Send Sensor States

1. Create a script named `lora-covercontrol-bthome-emitter.shelly.js`  
2. Start the script  
3. Define the components the script should listen to (e.g., `bthomesensor:201`)  
4. Set humidity and temperature thresholds

