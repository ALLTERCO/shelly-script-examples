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

## sync-manifest-json.py

Generate `SHELLY_MJS.md` from `examples-manifest.json`.

Usage:
```
python tools/sync-manifest-json.py ./examples-manifest.json
```

Output:
- Writes `SHELLY_MJS.md` next to the manifest file.

## check-manifest-integrity.py

Validate the integrity of `examples-manifest.json` for CI/CD. This script is
check-only and does not modify any files. Exit code 0 means all checks passed,
exit code 1 means errors were found.

Usage:
```
python tools/check-manifest-integrity.py
python tools/check-manifest-integrity.py --check-headers --check-indent --check-sync
```

Defaults:
- Manifest file: `examples-manifest.json` in the repository root
- Base directory: directory containing the manifest file

Options:
- `--base-dir <path>` — Override the base directory for script file lookups
- `--check-docs` — Verify that `doc` files exist (if specified in entries)
- `--check-index` — Verify that `SHELLY_MJS.md` is in sync with the manifest
- `--check-headers` — Check scripts for standard headers (`@title`, `@description`, `@status`, `@link`)
- `--check-indent` — Check scripts for proper 2-space indentation (detects tabs and odd spaces)
- `--check-sync` — Check that all `.shelly.js` files on disk are in the manifest and vice versa

Checks performed:
- All `fname` script files exist on disk
- All entries have non-empty `title` field
- All entries have non-empty `description` field
- (Optional) All `doc` files exist
- (Optional) `SHELLY_MJS.md` matches expected content from manifest
- (Optional) Script files have standard headers with valid `@status` and `@link` tags
- (Optional) Script files use 2-space indentation
- (Optional) Manifest and disk files are in sync

Standard header format (first block in file):
```javascript
/**
 * @title Script Title Here
 * @description Description of what the script does.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/path/to/file.shelly.js
 */
```

## sync-manifest-md.py

Synchronize `examples-manifest.json` with the actual `.shelly.js` files in the
repository. Finds new scripts and adds them to the manifest with placeholder
metadata.

Usage:
```
python tools/sync-manifest-md.py
python tools/sync-manifest-md.py --dry-run
python tools/sync-manifest-md.py --remove-missing
```

Options:
- `--dry-run` — Show what would be done without making changes
- `--remove-missing` — Remove manifest entries for files that no longer exist
- `--extract-metadata` — Try to extract title/description from file comments

Workflow:
1. Run with `--dry-run` to see what changes would be made
2. Run without flags to update the manifest
3. Edit the manifest to fill in proper titles and descriptions for new entries
4. Run `sync-manifest-json.py` to regenerate `SHELLY_MJS.md`
