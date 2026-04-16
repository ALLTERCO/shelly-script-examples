# MODBUS-RTU HTTP Bridge

Expose any MODBUS RTU slave device over HTTP using The Pill's UART (RS485). A single HTTP endpoint accepts a register descriptor as JSON, talks to the slave over MODBUS RTU, and returns the result as JSON.

## Problem (The Story)

Many MODBUS RTU devices are buried on an RS485 bus with no network access. External systems (dashboards, PLCs, scripts, home automation platforms) need a simple, technology-agnostic way to read or write individual registers without implementing the full RTU stack. This bridge makes any register on any connected slave reachable over plain HTTP.

## Persona

- Integrator connecting RS485 devices to HTTP-based home automation
- Developer prototyping MODBUS reads without writing embedded code
- Engineer commissioning a slave device register-by-register over the network

## Files

- [`modbus_http_bridge.shelly.js`](modbus_http_bridge.shelly.js): HTTP bridge script

## RS485 Wiring (The Pill 5-Terminal Add-on)

```
                        |=============|              |==============|
                   /====|         VCC |              |              |
                   |    | GND     GND |              | SLAVE DEVICE |
/========\         |    | TX      +5V |              |              |
|The Pill|-----=||||    | RX        A |------\/------| A            |
\========/         |    | RE/DE     B |------/\------| B            |
                   |    | +5V       A |              |              |
                   \====|           B |              |              |
                        |=============|              |==============|
```

Default UART: `9600 baud`, `8N1`.

## Configuration

Edit `CONFIG` at the top of the script:

```js
var CONFIG = {
    BAUD_RATE: 9600,      // baud rate for the RS485 bus
    MODE: "8N1",          // frame format: "8N1", "8E1", "8O1"
    DEFAULT_SLAVE: 1,     // MODBUS slave address used when not specified in request
    RESPONSE_TIMEOUT: 1000, // ms - how long to wait for the slave to reply
    DEBUG: true           // print TX/RX frames to the console log
};
```

## Endpoint

After uploading and running the script, the endpoint is available at:

```
http://<SHELLY-IP>/script/<SCRIPT-ID>/modbus
```

Both **GET** and **POST** are supported.

## Register Descriptor

Every request carries a **register descriptor** — a JSON object that describes the register to access:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | no | Human-friendly register name |
| `units` | string | no | Physical unit (e.g. `"W"`, `"°C"`) |
| `scale` | number | no | Multiplier applied to raw value for `human_readable`. Default `1`. |
| `rights` | string | no | `"R"` read-only, `"RW"` read-write. Default `"R"`. |
| `reg.addr` | number | **yes** | Register address (0–65535) |
| `reg.rtype` | string | **yes** | Register type — see table below |
| `reg.itype` | string | no | Data type — see table below. Default `"u16"`. |
| `reg.bo` | string | no | Byte order within each 16-bit register: `"BE"` or `"LE"`. Default `"BE"`. |
| `reg.wo` | string | no | Word order for 32-bit types: `"BE"` (high word first) or `"LE"`. Default `"BE"`. |
| `value` | number\|null | no | `null` → read operation. A number + `"rights":"RW"` → write operation (raw register value). |
| `human_readable` | number\|null | — | Filled in the response (`value × scale`). |

### Register types (`rtype`)

| Value | MODBUS FC (read) | Description |
|---|---|---|
| `"holding"` | FC 03 | Holding registers (read/write) |
| `"input"` | FC 04 | Input registers (read-only) |
| `"coil"` | FC 01 | Coils / output bits (read/write) |
| `"discrete"` | FC 02 | Discrete inputs / input bits (read-only) |

### Data types (`itype`)

| Value | Size | Notes |
|---|---|---|
| `"u16"` | 1 register | Unsigned 16-bit |
| `"i16"` | 1 register | Signed 16-bit (two's complement) |
| `"u32"` | 2 registers | Unsigned 32-bit; uses `wo` for word order |
| `"i32"` | 2 registers | Signed 32-bit; uses `wo` for word order |
| `"f32"` | 2 registers | IEEE 754 single-precision float; uses `wo` |

### Write support

| `rtype` | `itype` | MODBUS FC used |
|---|---|---|
| `"holding"` | `"u16"` / `"i16"` | FC 06 – Write Single Register |
| `"holding"` | `"u32"` / `"i32"` / `"f32"` | FC 16 – Write Multiple Registers |
| `"coil"` | — | FC 05 – Write Single Coil |

> Input registers and discrete inputs are read-only by the MODBUS standard.

## Usage Examples

### Read a holding register (POST)

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "register": {
             "name": "Active Power",
             "units": "W",
             "scale": 1,
             "rights": "R",
             "reg": {"addr": 0, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
             "value": null,
             "human_readable": null
           }
         }'
```

Response:

```json
{
  "name": "Active Power",
  "units": "W",
  "scale": 1,
  "rights": "R",
  "reg": {"addr": 0, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
  "value": 1234,
  "human_readable": 1234
}
```

---

### Read a 32-bit input register with scale (POST)

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "register": {
             "name": "Voltage",
             "units": "V",
             "scale": 0.1,
             "rights": "R",
             "reg": {"addr": 100, "rtype": "input", "itype": "u32", "bo": "BE", "wo": "BE"},
             "value": null,
             "human_readable": null
           }
         }'
```

Response (`value` is raw, `human_readable = value × scale`):

```json
{
  "name": "Voltage",
  "units": "V",
  "scale": 0.1,
  "rights": "R",
  "reg": {"addr": 100, "rtype": "input", "itype": "u32", "bo": "BE", "wo": "BE"},
  "value": 2300,
  "human_readable": 230.0
}
```

---

### Write a holding register (POST)

Set `value` to the raw register value and `rights` to `"RW"`:

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "register": {
             "name": "Setpoint",
             "units": "°C",
             "scale": 0.1,
             "rights": "RW",
             "reg": {"addr": 8, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
             "value": 215,
             "human_readable": null
           }
         }'
```

Response confirms the written value:

```json
{
  "name": "Setpoint",
  "units": "°C",
  "scale": 0.1,
  "rights": "RW",
  "reg": {"addr": 8, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
  "value": 215,
  "human_readable": 21.5
}
```

---

### Read a coil (POST)

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "register": {
             "name": "Relay 1",
             "units": "",
             "scale": 1,
             "rights": "RW",
             "reg": {"addr": 0, "rtype": "coil", "itype": "u16", "bo": "BE", "wo": "BE"},
             "value": null,
             "human_readable": null
           }
         }'
```

---

### Write a coil (POST)

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "register": {
             "name": "Relay 1",
             "units": "",
             "scale": 1,
             "rights": "RW",
             "reg": {"addr": 0, "rtype": "coil", "itype": "u16", "bo": "BE", "wo": "BE"},
             "value": 1,
             "human_readable": null
           }
         }'
```

---

### Specify a slave address (POST)

Add `"slave"` at the top level to override the default slave ID:

```bash
curl -X POST http://<SHELLY-IP>/script/<ID>/modbus \
     -H 'Content-Type: application/json' \
     -d '{
           "slave": 5,
           "register": {
             "name": "Status",
             "units": "",
             "scale": 1,
             "rights": "R",
             "reg": {"addr": 0, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
             "value": null,
             "human_readable": null
           }
         }'
```

---

### Read via GET

For a GET request, URL-encode the descriptor JSON and pass it as the `register` query parameter. The optional `slave` parameter overrides the default slave ID.

```bash
# URL-encode the JSON first, then:
curl 'http://<SHELLY-IP>/script/<ID>/modbus?slave=1&register=<URL-encoded-JSON>'
```

Example with Python to build the URL:

```python
import json, urllib.parse, requests

reg = {
    "name": "W", "units": "W", "scale": 1, "rights": "R",
    "reg": {"addr": 0, "rtype": "holding", "itype": "u16", "bo": "BE", "wo": "BE"},
    "value": None, "human_readable": None
}
url = f"http://<SHELLY-IP>/script/<ID>/modbus?register={urllib.parse.quote(json.dumps(reg))}"
print(requests.get(url).json())
```

---

## Error Responses

All errors return a JSON object with an `error` field:

| HTTP code | Meaning |
|---|---|
| `400` | Bad request — missing or malformed descriptor |
| `500` | MODBUS error — timeout, exception code, CRC, etc. |
| `503` | Bus busy (previous request still pending) or UART not initialized |

```json
{"error": "Timeout"}
{"error": "MODBUS exception 0x02"}
{"error": "Bus busy, try again"}
```
