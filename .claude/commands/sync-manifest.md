Synchronize examples-manifest.json with .shelly.js files in the repo using tools/sync-manifest-md.py.

Only files with @status production in their JSDoc header are included. Files with other statuses are skipped and removed from the manifest if previously listed.

Usage: /sync-manifest [options]

Options:
  (none)               Update the manifest (adds new production files, skips non-production)
  --dry-run            Preview changes without writing anything
  --remove-missing     Also remove manifest entries for files that no longer exist on disk
  --extract-metadata   Try to extract title/description from @title/@description JSDoc tags

Recommended workflow:
1. /sync-manifest --dry-run        — preview what would change
2. /sync-manifest --extract-metadata  — apply and auto-fill metadata from headers
3. Edit examples-manifest.json to fill in any remaining TODO titles/descriptions
4. /gen-index                       — regenerate SHELLY_MJS.md

Run this command from the repo root:

```
python tools/sync-manifest-md.py $ARGUMENTS
```
