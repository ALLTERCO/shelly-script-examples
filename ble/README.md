# Ble

BLE/BLU sensors, buttons, and event-handling examples.


Use these examples to connect Shelly devices to nearby BLE/BLU sensors and buttons, so events can trigger local automations without a hub.
## Scripts

- `ble-aranet2.shelly.js`
- `ble-aranet4.shelly.js`
- `ble-bparasite.shelly.js`
- `ble-events-handler.shelly.js`
- `ble_btn_in_range.shelly.js`
- `ble-blu-button-presence_vc.shelly.js`
- `ble-miflora-xiaomi-hhccjcy01.shelly.js`
- `ble-mopeka.shelly.js`
- `ble-pasv-mqtt-gw.shelly.js`
- `ble-PTM215B-button.shelly.js`
- `ble-ruuvi.shelly.js`
- `ble-shelly-blu.shelly.js`
- `ble-shelly-blu-remote-control-cover.shelly.js`
- `ble-shelly-btn.shelly.js`
- `ble-shelly-btn-gateway-for-other-devices.shelly.js`
- `ble-shelly-dw.shelly.js`
- `ble-shelly-motion.shelly.js`
- `ble-shelly-scanner.shelly.js`
- `ble-open-windows_vc.shelly.js`
- `hue-lights-control.shelly.js`
- `universal-blu-to-mqtt.shelly.js`

## Presence VC Watcher

`ble-blu-button-presence_vc.shelly.js` watches one or more paired
`bthomedevice:*` BLU buttons and keeps a Boolean Virtual Component in sync with
whether any tracked button is nearby (e.g. a "Master Key" carried by whoever
is home). The script is fully self-contained: it creates its own Virtual
Components on first run and never needs a pre-existing setup.

### Concept

1. **Detect** - the device already has one or more Shelly BLU buttons paired
   as `bthomedevice:*` components (standard BLE pairing via the Shelly app).
   The script scans a configurable `bthomedevice` ID range
   (`DEVICE_ID_SCAN_START`/`DEVICE_ID_SCAN_END`) and binds each entry in
   `BUTTONS` to the matching component by MAC address.
2. **Track** - every beacon/status update or button-press event refreshes a
   `lastSeenAt` timestamp per button. A button counts as present while
   `now() - lastSeenAt < PRESENCE_TIMEOUT_SEC`.
3. **Aggregate** - presence is the logical OR of all tracked buttons: at least
   one button in range keeps the aggregate value `true`; only when every
   tracked button times out does it flip to `false`. A 1-second ticker
   (`TICK_SEC`) re-evaluates this continuously, independent of new events.
4. **Publish** - the aggregate value is written to a self-created Boolean
   Virtual Component (`boolean:210`, grouped under `group:211`), so any other
   script, the Shelly app, scenes, or dashboards can react to it.

The script itself makes **no outbound HTTP calls**. It only owns the presence
logic and the Virtual Component value - reacting to "away" is left entirely to
device-native automations (see below), so the published script stays generic
and safe to run on any device without embedding site-specific URLs.

### Step-by-step setup

1. Pair your BLU button(s) to the target Shelly device as usual (Shelly app ->
   Bluetooth -> add BLU device), so each shows up as a `bthomedevice:*`
   component.
2. Edit `BUTTONS` in the script and replace the sample `expectedAddr` values
   with your buttons' real MAC addresses (one entry per key/button you want
   to track).
3. Adjust `PRESENCE_TIMEOUT_SEC` if you need a longer/shorter grace period
   before a button is considered gone, and `DEVICE_ID_SCAN_START` /
   `DEVICE_ID_SCAN_END` if your `bthomedevice` components live outside the
   default `200-210` range.
4. Upload and start the script (see [Tools](../tools/README.md) or
   `tools/put_script.py <device-ip> <script-id> ble/ble-blu-button-presence_vc.shelly.js`).
5. On first run the script creates `boolean:210` ("Master Key Present") and
   `group:211` ("Presence") if they don't already exist, then starts tracking.
   Watch the script log (`[blu-presence-vc]`) to confirm bindings and presence
   changes.

### Local "away" actions (native device Webhooks)

Because the repo script never hardcodes local URLs, wire up any "when away"
automation (turning off lights, sending a local notification, etc.) as a
native Shelly [Webhook](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Webhook)
on the device itself, triggered by the Boolean component's `boolean.change`
event:

1. Confirm the Boolean component id (`210` by default) via
   `Boolean.GetStatus?id=210`.
2. Create a webhook that fires only on the present -> away transition, using
   the `!ev.value` condition on `boolean.change`:
   ```json
   {
     "method": "Webhook.Create",
     "params": {
       "cid": 210,
       "enable": true,
       "event": "boolean.change",
       "condition": "!ev.value",
       "name": "Master Key Away - lights off",
       "urls": [
         "http://<light-1-ip>/light/0?turn=off",
         "http://<light-2-ip>/light/0?turn=off"
       ]
     }
   }
   ```
3. Verify with `Webhook.List` and test by letting the tracked button(s) time
   out (or temporarily lowering `PRESENCE_TIMEOUT_SEC`).

This keeps site-specific URLs and MAC addresses local to each device's own
configuration (Webhooks and the script's `BUTTONS` list), while the version in
this repository stays a clean, shareable template.
