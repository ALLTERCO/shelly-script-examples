# LoRa Door/Window Sensor State Communication

## Short description

Scripts for sending door/window sensor state over LoRa between Shelly devices. The sender monitors an input connected to a DW sensor and transmits state changes (via status handler) and/or periodically (via timer) to a receiver, which displays the result in a virtual boolean component.

## Requirements

- Two Shelly devices with LoRa addons (e.g., Shelly i4DC Gen4, Shelly 1PM Gen4)
- Door/Window sensor connected to an input on the sender device
- Virtual boolean component configured on the receiver device (ID: 200)
- AES 128-bit base64 encryption key for secure communication

### Generate AES Key

```bash
openssl rand -base64 16
```

## Configuration

### Sender Configuration (lora-wired-dw-sender.js)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `loraComponentKey` | ID of the LoRa component instance | `"lora:100"` |
| `tx_key_id` | Encryption key index [1,2,3] | `1` |
| `lr_addr` | Recipient LoRa address (hex string) | `"000000BB"` |
| `doorWindowComponent` | Input where DW sensor is connected | `"input:1"` |
| `useStatusHandler` | Enable sending on state change | `true` |
| `useTimer` | Enable periodic sending via timer | `true` |
| `interval` | Timer interval in milliseconds | `3000` |

### Receiver Configuration (lora-wired-dw-reciever.js)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `doorWindowComponent` | Input key from sender to match | `"input:1"` |
| `doorWindowVirtualComponent` | Virtual component type | `"boolean"` |
| `doorWindowVirtualComponentId` | Virtual component ID | `200` |
| `lr_addr` | LoRa address | `"000000BB"` |
| `key1` | Encryption key (same as sender's key1) | - |

**Note:** User LoRa calls must be set to `true` on both devices in LoRa transport layer config settings.

## Installation

1. Wire up your Shelly devices
2. Attach LoRa addons to both devices
3. Power up the devices
4. In the web interface, go to Add-on submenu and enable LoRa add-on
5. Enable "User LoRa calls" in LoRa transport layer config on both devices
6. Configure matching encryption key (key1) on both sender and receiver

### Sender Setup

1. Create a script from `lora-wired-dw-sender.js` on the sender device
2. Configure the `doorWindowComponent` to match your DW sensor input
3. Set `lr_addr` to the receiver's LoRa address
4. Save and run the script

### Receiver Setup

1. Create a virtual boolean component (ID: 200) on the receiver device
2. Create a script from `lora-wired-dw-reciever.js` on the receiver device
3. Configure `doorWindowComponent` to match the sender's configuration
4. Save and run the script

## How It Works

### Sender

The sender supports two modes (can be enabled independently via CONFIG):

**Status Handler Mode** (`useStatusHandler: true`):
- Listens for status changes on the configured input
- When the DW sensor state changes (open/close), immediately sends a JSON message over LoRa

**Timer Mode** (`useTimer: true`):
- Periodically sends the current state every `interval` milliseconds (default: 3000ms)
- Useful as a heartbeat or to ensure receiver stays in sync

Message format:
```json
{"component": "input:1", "value": true}
```

### Receiver

- Listens for LoRa events with `event.info.event === "user_rx"`
- Decodes and parses the received message
- Compares received value with current virtual component value
- Only updates the virtual boolean component if the value has changed (reduces unnecessary RPC calls)
