# Tools

Helper utilities for uploading scripts to Shelly devices and generating the
script index.

## put_script.py

Upload a script to a Shelly device using chunked RPC calls.

Requirements:
- Python 3
- `requests` (`pip install requests`)

Usage:
```
python tools/put_script.py <device-ip> <script-id> <script-file>
```

Example:
```
python tools/put_script.py 192.168.33.1 1 ble/ble-shelly-motion.shelly.js
```

Notes:
- The script slot (`script-id`) must already exist on the device.
- The script is uploaded in 1024-byte chunks.

## upload-script.sh

Shell uploader that stops, deletes, and re-uploads a script via RPC.

Requirements:
- `curl`
- `jq`
- `split` (or `gsplit` on macOS)
- Optional: `dialog` (interactive file picker)

Usage:
```
tools/upload-script.sh -s <device-ip> -i <script-id> -f <script-file>
```

Examples:
```
tools/upload-script.sh -s 192.168.33.1 -i 1 -f mqtt/mqtt-discovery.shelly.js
```

Environment variables:
- `SHELLY` (device IP, default `192.168.33.1`)
- `SCRIPT_ID` (script slot, default `1`)
- `SCRIPT_FILE` (path to script file)

## json-to-md.py

Generate `SHELLY_MJS.md` from `examples-manifest.json`.

Usage:
```
python tools/json-to-md.py ./examples-manifest.json
```

Output:
- Writes `SHELLY_MJS.md` next to the manifest file.
