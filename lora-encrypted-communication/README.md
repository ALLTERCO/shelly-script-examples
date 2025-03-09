# Send and Receive LoRa Messages Boilerplate

## Short Description

Example scripts for encrypted communication between devices using the LoRa add-on.

## Requirements

- At least two Shelly devices that support the **LoRa add-on**  
  - One will act as the **sender**, the other as the **receiver**  
- A **unique AES key** is required for encrypting messages  
  - The provided key is only an example  
  - Generate your own [here](https://generate-random.org/encryption-key-generator)

## Installation

1. Wire up your Shelly devices  
2. Attach the LoRa add-ons to the devices  
3. Power on the devices  
4. In the embedded web interface, open the **Add-on** submenu and enable the **LoRa add-on**

---

### To Send Messages

1. On the **sender** device, create a script from `lora-send-encrypted-msg.js`, then save and run it  
2. Use the `sendMessage(STRING)` function to send encrypted messages

---

### To Receive Messages

1. On the **receiver** device, create a script from `lora-receive-encrypted-msg.js`, then save and run it  
2. Use the `Shelly.addEventHandler()` callback to listen for and handle incoming messages
