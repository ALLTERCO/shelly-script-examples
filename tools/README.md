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

## check-manifest-integrity.py

Validate the integrity of `examples-manifest.json` and maintain script headers.

Usage:
```
python tools/check-manifest-integrity.py
python tools/check-manifest-integrity.py --check-headers
python tools/check-manifest-integrity.py --update-headers
python tools/check-manifest-integrity.py --update-headers --dry-run
```

Defaults:
- Manifest file: `examples-manifest.json` in the repository root
- Base directory: directory containing the manifest file

Options:
- `--base-dir <path>` — Override the base directory for script file lookups
- `--check-docs` — Also verify that `doc` files exist (if specified in entries)
- `--check-index` — Also verify that `SHELLY_MJS.md` is in sync with the manifest
- `--check-headers` — Check scripts for standard metadata headers
- `--update-headers` — Update scripts with standard headers from manifest
- `--check-indent` — Check scripts for proper 2-space indentation (detects tabs and odd spaces)
- `--fix-indent` — Fix indentation by converting tabs to 2 spaces
- `--dry-run` — Show what would be done without making changes

Note: Odd indentation (1, 3, 5 spaces) is often intentional alignment in
multi-line statements and is not automatically fixed. Review manually if needed.

Checks performed:
- All `fname` script files exist on disk
- All entries have non-empty `title` field
- All entries have non-empty `description` field
- (Optional) All `doc` files exist
- (Optional) `SHELLY_MJS.md` matches expected content from manifest
- (Optional) Script files have standard `@title`/`@description` headers

Standard header format (first block in file):
```javascript
/**
 * @title Script Title Here
 * @description Description of what the script does.
 */
```

**Important:** The `--update-headers` option only updates/adds the standard
`@title`/`@description` header. It preserves any existing detailed documentation
block that follows. Scripts should use a **two-header pattern**:

1. Standard header (`@title`, `@description`) - for manifest/index
2. Detailed documentation block - hardware connections, protocol info, etc.

See `AGENTS.md` for the complete file structure standard.

## sync-manifest.py

Synchronize `examples-manifest.json` with the actual `.shelly.js` files in the
repository. Finds new scripts and adds them to the manifest with placeholder
metadata.

Usage:
```
python tools/sync-manifest.py
python tools/sync-manifest.py --dry-run
python tools/sync-manifest.py --remove-missing
```

Options:
- `--dry-run` — Show what would be done without making changes
- `--remove-missing` — Remove manifest entries for files that no longer exist
- `--extract-metadata` — Try to extract title/description from file comments

Workflow:
1. Run with `--dry-run` to see what changes would be made
2. Run without flags to update the manifest
3. Edit the manifest to fill in proper titles and descriptions for new entries
4. Run `json-to-md.py` to regenerate `SHELLY_MJS.md`
