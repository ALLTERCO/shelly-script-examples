# Shelly Script Deploy & Monitor Skill

Step-by-step procedures for uploading `.shelly.js` scripts to a Shelly gen-3
device and reading back its live log output. Synthesised from hands-on testing
with a Shelly Pill (S3SN-0U53X, gen 3, no auth).

---

## Prerequisites

- Python 3 (stdlib only — no pip installs needed)
- Device reachable on the local network
- Auth disabled on the device, or credentials known

---

## 1. Verify device reachability

```bash
curl -s http://<DEVICE_IP>/rpc/Shelly.GetDeviceInfo
```

Expected fields: `id`, `model`, `gen`, `fw_id`, `auth_en`.
If `auth_en` is `true` add `--user admin:<password>` to every subsequent call.

---

## 2. List existing script slots

```bash
curl -s http://<DEVICE_IP>/rpc/Script.List
```

Returns an array of `{id, name, enable, running}` objects.
Note the `id` of the slot you want to use (or create a new one in step 3).

---

## 3. Prepare the script file

### 3a. Check for non-ASCII characters

The Shelly firmware JSON parser rejects non-ASCII bytes inside the `code` field
and returns `HTTP 500: "Missing or bad argument 'code'!"`.
Common offenders in JS source: `deg` signs (`°`), dashes (`--`, `->`), arrows (`->`).

Run this check before every upload:

```python
with open("script.shelly.js") as f:
    code = f.read()

bad = [(i, repr(c)) for i, c in enumerate(code) if ord(c) > 127]
if bad:
    print(f"Non-ASCII chars found: {len(bad)}")
    for pos, ch in bad[:20]:
        line = code[:pos].count('\n') + 1
        print(f"  line {line}: {ch}")
```

### 3b. Replace non-ASCII with ASCII equivalents

```python
replacements = [
    ('\u00b0', 'deg'),   # degree sign
    ('\u2013', '-'),     # en dash
    ('\u2014', '--'),    # em dash
    ('\u2192', '->'),    # rightwards arrow
]
for src, dst in replacements:
    code = code.replace(src, dst)
```

Save the cleaned code back to disk before uploading.

---

## 4. Manage the script slot

### Create a new slot

```bash
curl -s -X POST http://<DEVICE_IP>/rpc/Script.Create \
  -H "Content-Type: application/json" \
  -d '{"name":"my_script"}'
# returns {"id": N}
```

### Delete a slot (to start clean)

```bash
curl -s -X POST http://<DEVICE_IP>/rpc/Script.Delete \
  -H "Content-Type: application/json" \
  -d '{"id": N}'
```

---

## 5. Upload in chunks

### Why chunks?

The device HTTP server rejects bodies larger than ~8 KB (`HTTP 413`).
Real script code contains JSON-special characters (`"`, `\n`, etc.) that inflate
the JSON-encoded payload, so the safe working chunk size is **4000 source chars**
(produces payloads of ~4.3 KB, well under the limit).

### Upload script

```python
import json, urllib.request

DEVICE    = "http://<DEVICE_IP>"
SCRIPT_ID = N        # from Script.Create
CHUNK     = 4000     # safe for real JS code

with open("script.shelly.js") as f:
    code = f.read()

total  = len(code)
offset = 0
chunk_n = 0

while offset < total:
    chunk   = code[offset:offset + CHUNK]
    payload = json.dumps({
        "id":     SCRIPT_ID,
        "code":   chunk,
        "append": offset > 0   # False for first chunk, True for all subsequent
    }).encode()

    req = urllib.request.Request(
        DEVICE + "/rpc/Script.PutCode",
        data    = payload,
        headers = {"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        resp = json.loads(r.read().decode())

    chunk_n += 1
    print(f"Chunk {chunk_n}: offset={offset} -> stored={resp['len']} chars")
    offset += CHUNK

# Verify: stored length must equal source length
stored = resp["len"]
print(f"\nSource: {total} | Stored: {stored} | Match: {stored == total}")
if stored != total:
    raise RuntimeError("Upload truncated — delete slot and retry")
```

### Common upload errors

| HTTP code | Body message | Cause | Fix |
|-----------|-------------|-------|-----|
| 413 | Payload Too Large | Chunk too large | Reduce `CHUNK` |
| 500 | Missing or bad argument 'code'! | Non-ASCII char in chunk | Run step 3a/3b |
| 500 | (other) | Slot ID does not exist | Run Script.Create first |

---

## 6. Start and stop

```bash
# Start
curl -s -X POST http://<DEVICE_IP>/rpc/Script.Start \
  -H "Content-Type: application/json" -d '{"id": N}'

# Stop
curl -s -X POST http://<DEVICE_IP>/rpc/Script.Stop \
  -H "Content-Type: application/json" -d '{"id": N}'
```

---

## 7. Check runtime status

```bash
curl -s "http://<DEVICE_IP>/rpc/Script.GetStatus?id=N"
```

Key fields:

| Field | Meaning |
|-------|---------|
| `running` | `true` / `false` |
| `errors` | List of error type strings, e.g. `["syntax_error"]` |
| `error_msg` | Human-readable error with line/col |
| `mem_used` | Bytes of JS heap in use |
| `mem_peak` | Peak heap usage |
| `mem_free` | Remaining JS heap |
| `cpu` | CPU % used by the script |

If `syntax_error` appears immediately after upload, the most common cause is a
**truncated upload** (stored length did not match source length in step 5).

---

## 8. Stream live log output

The device exposes a streaming HTTP endpoint. Script `print()` calls appear here
alongside firmware messages.

### Stream and filter with Python

```python
import urllib.request, threading, time, json

DEVICE = "http://<DEVICE_IP>"
TAG    = "[MY_SCRIPT]"   # prefix used in your print() calls

lines = []
done  = threading.Event()

def stream():
    try:
        with urllib.request.urlopen(DEVICE + "/debug/log", timeout=30) as r:
            while not done.is_set():
                line = r.readline()
                if not line:
                    break
                lines.append(line.decode("utf-8", errors="replace").rstrip())
    except Exception as e:
        lines.append(f"[stream ended: {e}]")

# 1. Start the log stream first
t = threading.Thread(target=stream, daemon=True)
t.start()
time.sleep(0.4)   # give the stream time to connect

# 2. Restart the script so init() output is captured
for method in ("Script.Stop", "Script.Start"):
    payload = json.dumps({"id": N}).encode()
    req = urllib.request.Request(
        DEVICE + f"/rpc/{method}",
        data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass
    time.sleep(0.4)

# 3. Collect for as long as needed
time.sleep(15)
done.set()

# 4. Print results, highlighting script lines
for l in lines:
    marker = ">>>" if TAG in l else "   "
    print(marker, l)
```

### Notes on the log stream

- The stream is a persistent HTTP connection; it blocks until the device closes it.
- Only **one** external client can stream at a time — if another client is already
  connected (e.g. the Shelly app at another IP), the new connection still receives
  new events but may show a "Streaming logs to X.X.X.X" notice first.
- Script `print()` output appears as: `<seq> [timestamp] I   <your text>`
- Firmware messages appear as: `<seq> [timestamp] I I <source>:<line>   <text>`

---

## 9. Full deploy-and-monitor workflow (one script)

```python
#!/usr/bin/env python3
"""
Deploy a Shelly script and monitor its startup output.
Usage: python deploy.py <device_ip> <slot_id> <script_file>
"""
import json, sys, time, threading, urllib.request

DEVICE    = "http://" + sys.argv[1]
SLOT      = int(sys.argv[2])
SCRIPT    = sys.argv[3]
CHUNK     = 4000
LOG_SEC   = 15

# -- load & sanitise --
with open(SCRIPT) as f:
    code = f.read()

for src, dst in [('\u00b0','deg'),('\u2013','-'),('\u2014','--'),('\u2192','->')]:
    code = code.replace(src, dst)

bad = [c for c in code if ord(c) > 127]
if bad:
    sys.exit(f"Non-ASCII chars remaining: {set(bad)}")

# -- helpers --
def rpc(method, params):
    payload = json.dumps(params).encode()
    req = urllib.request.Request(
        DEVICE + "/rpc/" + method,
        data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method}: {e.read().decode()}")

# -- log stream --
log_lines = []
log_done  = threading.Event()

def _stream():
    try:
        with urllib.request.urlopen(DEVICE + "/debug/log", timeout=LOG_SEC+5) as r:
            while not log_done.is_set():
                l = r.readline()
                if not l:
                    break
                log_lines.append(l.decode("utf-8", errors="replace").rstrip())
    except Exception:
        pass

log_thread = threading.Thread(target=_stream, daemon=True)
log_thread.start()
time.sleep(0.4)

# -- stop existing --
try: rpc("Script.Stop", {"id": SLOT})
except SystemExit: pass
time.sleep(0.3)

# -- upload --
total, offset, last_resp = len(code), 0, {}
print(f"Uploading {total} chars to slot {SLOT}...")
while offset < total:
    chunk = code[offset:offset+CHUNK]
    last_resp = rpc("Script.PutCode", {"id": SLOT, "code": chunk, "append": offset > 0})
    print(f"  {offset+len(chunk)}/{total}", end="\r")
    offset += CHUNK
print()

stored = last_resp.get("len", -1)
if stored != total:
    sys.exit(f"Upload mismatch: source={total} stored={stored}")
print(f"Upload verified: {stored} chars stored.")

# -- start --
rpc("Script.Start", {"id": SLOT})
print(f"Script started. Collecting log for {LOG_SEC}s...\n")
time.sleep(LOG_SEC)
log_done.set()

# -- print log --
print("--- Log output ---")
for l in log_lines:
    print(l)

# -- final status --
status = rpc("Script.GetStatus", {"id": SLOT})
print(f"\n--- Script status ---")
print(f"  running  : {status.get('running')}")
print(f"  errors   : {status.get('errors')}")
print(f"  error_msg: {status.get('error_msg')}")
print(f"  mem_used : {status.get('mem_used')} B")
print(f"  mem_free : {status.get('mem_free')} B")
```

---

## Quick-reference cheatsheet

```bash
# Device info
curl -s http://DEVICE/rpc/Shelly.GetDeviceInfo

# List scripts
curl -s http://DEVICE/rpc/Script.List

# Create slot
curl -s -X POST http://DEVICE/rpc/Script.Create \
  -H "Content-Type: application/json" -d '{"name":"my_script"}'

# Delete slot
curl -s -X POST http://DEVICE/rpc/Script.Delete \
  -H "Content-Type: application/json" -d '{"id":N}'

# Start / Stop
curl -s -X POST http://DEVICE/rpc/Script.Start  -H "Content-Type: application/json" -d '{"id":N}'
curl -s -X POST http://DEVICE/rpc/Script.Stop   -H "Content-Type: application/json" -d '{"id":N}'

# Status
curl -s "http://DEVICE/rpc/Script.GetStatus?id=N"

# Stream log (Ctrl+C to stop)
curl -s -N http://DEVICE/debug/log
```
