Validate the integrity of examples-manifest.json using tools/check-manifest-integrity.py.

Usage: /check-manifest [options]

Common options:
  (none)               Basic checks: files exist, titles and descriptions non-empty
  --check-headers      Verify @title, @description, @status, @link JSDoc headers
  --check-indent       Verify 2-space indentation (no tabs, no odd spaces)
  --check-index        Verify SHELLY_MJS.md is in sync with the manifest
  --check-sync         Verify all production .shelly.js files are listed in the manifest
  --check-docs         Verify doc files exist (if referenced in entries)

Full CI check: /check-manifest --check-headers --check-indent --check-index --check-sync

Run this command from the repo root:

```
python tools/check-manifest-integrity.py $ARGUMENTS
```

Exit code 0 means all checks passed. Exit code 1 means errors were found.
