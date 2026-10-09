# Local Network Messaging

Local Network Messaging (LNM) examples for direct communication between Shelly devices over UDP multicast. LNM automations run entirely on the local network without a cloud service, hub, or fixed device IP addresses.

> LNM is a preview feature and requires firmware 2.0.0 or newer. Its API may change in future firmware releases.

## Scripts

| File | Description |
|------|-------------|
| [`input-group-switch-control.shelly.js`](input-group-switch-control.shelly.js) | Sends multicast switch commands to every RPC-enabled group member from a local physical input. |
| [`message-monitor.shelly.js`](message-monitor.shelly.js) | Logs received status and event messages for installation, discovery, and troubleshooting. |
| [`received-button-switch-control.shelly.js`](received-button-switch-control.shelly.js) | Maps button gestures received from a remote input onto a local switch output. |
| [`switch-state-follower.shelly.js`](switch-state-follower.shelly.js) | Mirrors a remote switch output onto a local switch output, with optional inversion. |
| [`tv-power-av-follower.shelly.js`](tv-power-av-follower.shelly.js) | Receives a TV's measured power over LNM and switches selected local AV outputs using hysteresis and a delayed OFF decision. |

## Example Overview

| Example | Runs on | Required LNM settings |
|---------|---------|-----------------------|
| Message monitor | Receiver | RX enabled |
| Switch state follower | Receiver | Sender TX enabled; receiver RX enabled |
| Received button control | Receiver | Sender TX enabled for the input; receiver RX enabled |
| Input group switch control | Input device | RPC enabled on sender and receivers |
| TV power to AV outputs | Receiver | Sender TX enabled for the meter; receiver RX enabled |

Use [`message-monitor.shelly.js`](message-monitor.shelly.js) first when commissioning a group. It shows sender IDs, component keys, status fields, and button event names exactly as the receiver sees them.

## Switch State Follower

Use [`switch-state-follower.shelly.js`](switch-state-follower.shelly.js) when one local relay must mirror a relay on another Shelly device.

1. Add the source switch, such as `switch:0`, to the sender's TX components.
2. Enable RX on the receiving device.
3. Set `senderId`, `sourceComponent`, and `targetSwitchId` in the script.
4. Set `invert: true` if the local output must use the opposite state.

The script compares the requested state with the local switch status before calling `Switch.Set`, avoiding redundant relay commands while correcting local manual changes on the next received source update.

## Received Button Control

Use [`received-button-switch-control.shelly.js`](received-button-switch-control.shelly.js) to control a local relay from a button input on another Shelly device.

1. Add the remote input, such as `input:0`, to the sender's TX components.
2. Enable RX on the receiving device.
3. Configure the sender device ID, source input ID, and local target switch ID.

The default gesture mapping is:

| Gesture | Local action |
|---------|--------------|
| Single push | Toggle |
| Double push | Switch on |
| Long push | Switch off |

Lower-level `btn_down` and `btn_up` messages are ignored.

## Input to Group Switch Control

Use [`input-group-switch-control.shelly.js`](input-group-switch-control.shelly.js) when one physical input must control the same switch ID on multiple Shelly devices.

1. Create an LNM instance with the same multicast address on the sender and receivers.
2. Enable RPC on that instance on every participating device.
3. Configure `lnmId`, `sourceInputId`, and `targetSwitchId` on the sender script.

TX and RX are not required for `LNM.Call`. The default mapping is single push to toggle, double push to switch on, and long push to switch off. Commands are fire-and-forget; the sender receives confirmation that the group command was accepted locally, not a result from each receiver.

## TV Power to AV Outputs

This example uses two Shelly devices:

- **Sender:** a power-metering Shelly connected to the TV.
- **Receiver:** a Shelly with Scripts and switch outputs connected to the audio equipment.

The sender broadcasts the TV's power component. The receiver script turns the configured AV outputs on when power rises above the ON threshold and turns them off after power remains below the OFF threshold for the configured delay.

The gap between the ON and OFF thresholds prevents rapid switching when power fluctuates. A manual or voice change to an AV output remains in effect until the automation's next state transition.

### Requirements

- Both devices run firmware 2.0.0 or newer.
- Both devices are on the same network segment without client isolation.
- The sender supports power metering and LNM.
- The receiver supports LNM, Scripts, and the required number of switch outputs.
- Controlled AV equipment resumes operation automatically when mains power returns.

The reference installation uses a Shelly Plug S Gen3 as the sender and a Shelly Power Strip Gen4 as the receiver. The workflow was tested on firmware 2.0.1.

### Configure LNM

Create an LNM instance on both devices with the same multicast address, for example `239.255.0.1:3333`.

On the sender:

1. Enable TX.
2. Select the component measuring the TV, normally `switch:0`.
3. Leave RX disabled unless another automation needs it.

On the receiver:

1. Enable RX.
2. Leave TX disabled unless another automation needs it.

The equivalent RPC requests are:

```text
# Sender
http://<SENDER-IP>/rpc/LNM.Create?config={"addr":"239.255.0.1:3333"}
http://<SENDER-IP>/rpc/LNM.SetConfig?id=200&config={"tx":{"enable":true,"components":["switch:0"]}}

# Receiver
http://<RECEIVER-IP>/rpc/LNM.Create?config={"addr":"239.255.0.1:3333"}
http://<RECEIVER-IP>/rpc/LNM.SetConfig?id=200&config={"rx":{"enable":true}}
```

Confirm that the receiver's `rx_msgs` counter increases:

```text
http://<RECEIVER-IP>/rpc/LNM.GetStatus?id=200
```

### Configure the Script

Edit `CONFIG` at the top of the script:

| Setting | Purpose |
|---------|---------|
| `senderId` | Sender device ID from `Shelly.GetDeviceInfo`. An empty string accepts any sender. |
| `sourceComponent` | Power component sent over LNM, normally `switch:0`. |
| `sourcePowerField` | Power field to read. Use `apower` for switches/PM1 or `act_power` for EM1. |
| `targetSwitchIds` | Local receiver switch IDs controlling the AV equipment. |
| `onAboveW` | Turn the targets on when power rises above this value. |
| `offBelowW` | Start the OFF delay when power falls below this value. |
| `offDelayMs` | Required continuous low-power duration before switching off. |
| `logEnabled` | Print decisions and RPC errors to the script console. |

`onAboveW` must be greater than `offBelowW`. Values between the thresholds preserve the current automation state.

### Measure the Thresholds

Do not assume the example values match your TV:

1. Measure the lowest power while the TV displays dark content.
2. Measure power immediately after standby and again after 10-15 minutes.
3. Set `onAboveW` above the highest standby value but below normal ON power.
4. Set `offBelowW` below the lowest ON value.
5. Increase `offDelayMs` if short power dips switch the audio off.

### Network Troubleshooting

If no messages arrive:

- Confirm both LNM instances use the same multicast address and port.
- Keep both devices on the same LAN or Wi-Fi segment.
- Disable AP/client isolation for that network.
- If IGMP snooping is enabled, ensure the network has an active IGMP querier.
- Check `LNM.GetStatus` and verify that `rx_msgs` increases.

LNM uses fire-and-forget UDP multicast, so occasional packet loss is expected. Later status broadcasts correct the receiver state.

### Safety

- Verify that the AV equipment is designed to have its mains supply switched.
- Keep every connected load within the Shelly device's rated limits.
- Exclude devices that must remain powered from `targetSwitchIds`.

## References

- [Automatic TV Sound System Control with Shelly Plug, Power Strip Gen4 and LNM](https://kb.shelly.cloud/knowledge-base/automatic-tv-sound-system-control-with-shelly-plug-power-strip-gen4-and-local-network-messaging-lnm)
- [Local Network Messaging setup guide](https://shelly-api-docs.shelly.cloud/gen2/General/LocalNetworkMessaging/)
- [LNM component reference](https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/LNM/)
