# Receive Encrypted Message, Decode It, and Control Light Component

## Short Description

This script receives an encrypted message via LoRa, decrypts and parses it into a `Boolean` and a `Number`.  
The decoded message consists of two parts:
- The **first character** is either `0` or `1`, which is parsed as a `Boolean`
- The **second part** is a numeric string (0 to 3 characters long) representing a value from `0` to `100`

## Requirements

- One **Shelly Dimmer 0/1-10V** device  
- A **unique AES key** for encrypting messages  
  - The provided key is only an example  
  - Generate your own [here](https://generate-random.org/encryption-key-generator)

## Installation

1. Wire up your Shelly Dimmer  
2. Attach the LoRa add-on to the device  
3. Power on the device  
4. In the embedded web interface, open the **Add-on** submenu and enable the **LoRa add-on**

---

### Receive Message and Trigger RPC Call

1. Create a script named `lora-lightcontrol-receiver.js`  
2. The script will:
   - Listen for messages sent from another LoRa-enabled device  
   - Parse the message and convert the values  
   - Trigger an RPC call to control the light accordingly