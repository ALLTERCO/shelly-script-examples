# LoRa Gateway for a Shelly with No Network

## Short description

One script, two roles, for a pair of Shelly devices with LoRa add-ons. One
device keeps its network and acts as the gateway; the other has its WiFi station
switched off, so LoRa is its only link. The gateway mirrors that device into ten
virtual components and turns a write to one of them into a LoRa command going
back, confirming every command against the node's own report rather than hoping
it arrived.

The virtual components are ordinary components, so whatever already reads the
gateway device sees the remote one through them with no extra work.

The other LoRa examples in this folder are one-way and fire-and-forget: send a
command, or send one value. This one keeps a whole device in step and does not
drop a command silently.

## Requirements

- Two Shelly devices with LoRa add-ons (tested on two Shelly 1 PM Gen4,
  `S4SW-001P16EU`, device firmware 2.0.0, add-on firmware 2.0.1, add-on
  hardware 1.4.0/2520)
- The LoRa add-on enabled on both. It does not appear until you set the add-on
  type and reboot - until then there is no `lora:100` component and no `LoRa.*`
  RPC at all
- A shared SheLr AES key, and `user` in `lora.shelr.accept` on both devices
- Nothing wired to the node's relay while you test, unless you mean it

### Generate the AES key

```bash
openssl rand -base64 16
```

## Addressing

SheLr addresses are 8 hex characters: the upper 16 bits are a group, the lower
16 a device. This example uses group `0001`:

| device | address | numeric |
|--------|---------|---------|
| gateway | `00010001` | 65537 |
| node | `00010002` | 65538 |

`0001FFFF` is multicast to the group and `FFFFFFFF` is broadcast, so a third
device would be `00010003`.

Each device's `peerAddr` is the *other* one's address. The script converts it
with `parseInt(hex, 16)` to match incoming frames, because in a script event
`event.info.sender` arrives as a **number**, not as a hex string.

## Configuration

Both roles share one `CONFIG` block. Set `role` and `peerAddr`; the rest has
working defaults.

| Parameter | Role | Description | Default |
|-----------|------|-------------|---------|
| `role` | both | `'gateway'` or `'node'` | `'gateway'` |
| `loraId` | both | LoRa component id | `100` |
| `peerAddr` | both | the other device's SheLr address | `'00010002'` |
| `switchId` | node | switch to report and control | `0` |
| `heartbeatMs` | node | unconditional report interval | `120000` |
| `debounceMs` | node | collapse a burst of triggers into one frame | `800` |
| `minGapMs` | node | never transmit two frames closer than this | `3000` |
| `vcBaseId` | gateway | first virtual component id | `200` |
| `offlineMs` | gateway | quiet for this long and the link reads down | `320000` |
| `watchMs` | gateway | how often the link is re-checked | `15000` |
| `settleMs` | gateway | ignore writes for this long after start | `5000` |
| `retryMs` | gateway | resend an unconfirmed command after this long | `4000` |
| `retries` | gateway | how many resends before giving up | `3` |
| `tickMs` | gateway | retry timer granularity | `1000` |

`offlineMs` must span more than two heartbeats, or one missed frame reads as a
dead link. Raise it if you raise `heartbeatMs`.

## Virtual components created on the gateway

| key | name | type | unit |
|-----|------|------|------|
| `boolean:200` | Node Output | writable toggle | - |
| `boolean:201` | Node Link | read-only | - |
| `number:200` | Node Power | read-only | W |
| `number:201` | Node Voltage | read-only | V |
| `number:202` | Node Current | read-only | A |
| `number:203` | Node Energy | read-only | Wh |
| `number:204` | Node Temperature | read-only | °C |
| `number:205` | Node RSSI | read-only | dBm |
| `number:206` | Node SNR | read-only | dB |
| `number:207` | Node Seq | read-only | - |

The script creates them on first start and binds to them on every start after
that, so restarting it does not duplicate anything. They are deliberately left
behind when the script is removed - delete them by hand if you do not want
them.

`Node Seq` is the node's frame counter, wrapping at 256. It only moves when a
frame is actually transmitted, so a gap in it is a lost frame - useful when
judging a link.

## Installation

1. Attach a LoRa add-on to both devices and power them up.
2. Enable the add-on on each device - web interface, Add-on submenu - and
   reboot. Check that `lora:100` exists afterwards:

   ```bash
   curl -s "http://<device>/rpc/Shelly.GetComponents?dynamic_only=false"
   ```

3. Put the same radio settings and the same key on both. 868.1 MHz with SF9 is
   a reasonable starting point; see the air time note below before changing it.

   ```bash
   KEY=$(openssl rand -base64 16)

   curl -s -X POST "http://<gateway>/rpc" -H 'Content-Type: application/json' -d '{
     "id":1,"method":"LoRa.SetConfig","params":{"id":100,"config":{
       "band_plan":"EU868","freq":868100000,"bw":125,"dr":9,"cr":5,
       "plen":10,"txp":14,"rx_enable":true,
       "shelr":{"lr_addr":"00010001","tx_key_id":1,"key1":"'"$KEY"'","accept":["user"]}}}}'

   curl -s -X POST "http://<node>/rpc" -H 'Content-Type: application/json' -d '{
     "id":1,"method":"LoRa.SetConfig","params":{"id":100,"config":{
       "band_plan":"EU868","freq":868100000,"bw":125,"dr":9,"cr":5,
       "plen":10,"txp":14,"rx_enable":true,
       "shelr":{"lr_addr":"00010002","tx_key_id":1,"key1":"'"$KEY"'","accept":["user"]}}}}'
   ```

   `LoRa.GetStatus` reports the key slots as booleans - check that `key1` came
   out `true` on both. Without `user` in `accept`, `LoRa.Send` fails with
   `-109`.

4. Create a script from `lora-gateway.shelly.js` on the **node**, set
   `role: 'node'` and `peerAddr` to the gateway's address, enable it so it
   starts on boot, and run it.
5. Create a script from the same file on the **gateway**, leave
   `role: 'gateway'`, set `peerAddr` to the node's address, enable and run it.
6. Confirm the link before cutting anything: the ten components should fill in
   within a few seconds, and `Node Link` should go true.
7. Give the node's access point a password, then disable its WiFi station. On
   Gen4 firmware the AP will not enable without a password.

   ```bash
   curl -s -X POST "http://<node>/rpc" -H 'Content-Type: application/json' \
     -d '{"id":1,"method":"Wifi.SetConfig","params":{"config":{"ap":{"enable":true,"pass":"<choose one>"}}}}'

   curl -s -X POST "http://<node>/rpc" -H 'Content-Type: application/json' \
     -d '{"id":1,"method":"Wifi.SetConfig","params":{"config":{"sta":{"enable":false}}}}'
   ```

The node is now off the network. Everything about it goes through the gateway.

## Getting the node back

Over LoRa, from the gateway, with no physical access - this is what the `C|w|`
command is for. `Q3x3fA==` is base64 for `C|w|`:

```bash
curl -s -X POST "http://<gateway>/rpc" -H 'Content-Type: application/json' \
  -d '{"id":1,"method":"LoRa.Send","params":{"id":100,"lr_addr":"00010002","data":"Q3x3fA=="}}'
```

Measured: back on the network in about 9 seconds, script running again after
the reboot. A partial `Wifi.SetConfig` merges, so the stored SSID and password
survive being disabled.

The node's own access point is the manual fallback.

## Protocol

Pipe-separated ASCII, base64 on the wire, carried as a SheLr `user` payload.
SheLr handles the addressing and the AES-CCM encryption, which is why this
example does not layer its own crypto on top.

```
node -> gateway   S|<on>|<apower>|<voltage>|<current>|<energy_wh>|<tC>|<seq>
gateway -> node   C|<cmd>|<arg>
```

| command | effect |
|---------|--------|
| `C\|o\|0`, `C\|o\|1` | set the node's switch |
| `C\|t\|` | toggle it |
| `C\|r\|` | report now |
| `C\|w\|` | re-enable the WiFi station, then reboot |
| `C\|b\|` | reboot |

## How it works

### The node

Reports on three triggers: an actual output change, a command, and the
heartbeat. `switch:0` emits a `power_measurement` event about every second, and
those are ignored on purpose - only `delta.output` being present means
something worth air time happened.

Every trigger goes through a deferred slot rather than transmitting straight
away. A single command produces two triggers, the `Switch.Set` callback and the
output status change, and without the debounce each cost its own frame.
`minGapMs` on top keeps a burst from eating air time.

### The gateway

Writes the node's report into the components through
`Virtual.getHandle(key).setValue(value)` rather than `Shelly.call`. That matters:
**a script may only have five `Shelly.call` requests in flight at once.** The
sixth throws `Too many calls in progress`, and an uncaught error stops a Shelly
script dead - an earlier version of this script issued eight `Number.Set` calls
per report, died half way through, and left the last three components frozen
with no sign of a problem anywhere. The handle path is in-process and has no
such cap. The ten `Virtual.Add` calls that create the components are chained
one per callback for the same reason.

It tells its own writes from somebody else's by `delta.source`: a handle write
comes back as `sys`, a write from outside as `rpc`. Only `rpc` is treated as a
command, which removes the need for a suppression flag and the race that comes
with one.

### Confirming a command

A SheLr frame is fire and forget - no acknowledgement, no retransmission - and
the radio is half duplex, so a command sent while the node happens to be
transmitting is simply lost. The node's state report doubles as the
acknowledgement:

- the commanded value is remembered and resent every `retryMs`, up to
  `retries` times
- a report carrying the commanded value clears it
- while it is unconfirmed, incoming reports are **not** mirrored onto the
  output component - they still carry the old value, and writing it would bounce
  the switch back mid-flight
- if it never lands, the node's real state is written back, so the mirror stops
  showing something that never happened

Measured over 12 commands on a bench pair at RSSI -25 dBm: all 12 confirmed,
median 2.5 s, worst case 6.4 s after one retry. Frame loss on an idle link was
0 in 20, but once both ends are talking, the occasional command does need the
retry.

## Air time and duty cycle

Air time is the scarce resource here, not CPU.

A report frame measures about 317 ms at SF9, from the add-on's own `tx_time`.
868.1 MHz sits in an EU868 1% duty cycle sub-band, which allows 36 seconds of
transmission per hour.

| heartbeat | frames/hour | air time/hour | duty |
|-----------|-------------|---------------|------|
| 120 s (default) | 30 | 9.5 s | 0.26% |
| 60 s | 60 | 19.0 s | 0.53% |

A 60 second heartbeat spends over half the legal budget on its own and leaves
little for commands and retries, which is why the default is 120. If you want a
faster heartbeat, lower the spreading factor at the same time - `dr: 7` is
roughly a quarter of the air time of `dr: 9`. Watch `air_time_hr_ms` in
`LoRa.GetStatus`; the firmware tracks it for you.

## Notes and limits

- On this firmware there is no separate `shelr:2xx` component and no `SheLr.*`
  RPC namespace. The whole SheLr layer lives inside `lora:100`'s config under
  `shelr`, and `shelr.accept` only accepts the value `user` - there is no `rpc`
  payload type, so RPC over LoRa is not available and this hand-rolled frame
  format is the way across.
- Only the node's switch is controllable. Its inputs, schedules and everything
  else are not mirrored.
- `aenergy.total` is sent as whole watt-hours.
- One node per gateway. Supporting several would mean one set of components per
  node and a sender check per set.
- `Timer.set` takes milliseconds; seconds silently never fire.
- `Shelly.GetComponents` paginates - follow `offset` and `total`, or components
  past the first page look like they are missing.
