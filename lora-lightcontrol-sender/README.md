# Send Scheduled Messages to Shelly 0/1-10V DimmerG3

## Short Description

This setup involves two scripts:

- The **initiator script** creates a schedule that executes a function and emits an event.
- The **sender script** listens for this event and sends an encrypted message to one or more `Shelly 0/1-10V DimmerG3` devices, controlling their state and brightness.

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

### Script: Initiator

1. Create a script named `lora-lightcontrol-initiator.js`  
2. This script uses:

- `TIME_ENUM` to define scheduled entries, including:
  - Hour of execution
  - Desired on/off state
  - Brightness level
- `TIMESPEC` to define cron-like execution timing, which aligns with the `TIME_ENUM` values

> **Note:** After saving and running the script for the first time, modifying `TIME_ENUM` will also require updating the associated schedule.

---

### Script: Sender

1. Create a script named `lora-lightcontrol-sender.js`  
2. This script listens for events emitted by the initiator and sends encrypted messages to target DimmerG3 devices to update their state and brightness
