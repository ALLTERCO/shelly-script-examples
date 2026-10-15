Upload a Shelly script to a device using tools/put_script.py.

Usage: /upload <host> <script-id> <file>

Example: /upload 192.168.1.100 1 power-energy/automatic-transfer-switch/iats_grid_backup_controller.shelly.js

Run this command from the repo root:

```
python tools/put_script.py $ARGUMENTS
```

The tool will stop the script in the given slot, upload the new code in 1024-byte chunks, then start it. The script slot must already exist on the device.
