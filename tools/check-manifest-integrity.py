# What it does?
# > This script checks the integrity of the examples-manifest.json file by:
# >   1. Verifying that all script files referenced in 'fname' exist
# >   2. Checking that all entries have non-empty descriptions
# >   3. Checking that all entries have non-empty titles
# >   4. Optionally verifying that doc files exist (if specified)

# How to run it?
# > Run from anywhere (uses default paths):
# > python tools/check-manifest-integrity.py
# > Or specify a custom manifest file:
# > python tools/check-manifest-integrity.py path/to/examples-manifest.json

from argparse import ArgumentParser
import os
import json
import sys

# Default paths (relative to this script's location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REPO_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_MANIFEST = os.path.join(DEFAULT_REPO_ROOT, "examples-manifest.json")


def main():
    argparser = ArgumentParser(description="Check integrity of examples-manifest.json")
    argparser.add_argument(
        "file",
        nargs="?",
        default=DEFAULT_MANIFEST,
        help=f"Path to the examples-manifest.json file (default: {DEFAULT_MANIFEST})"
    )
    argparser.add_argument(
        "--base-dir",
        default=None,
        help=f"Base directory for script files (default: directory containing manifest)"
    )
    argparser.add_argument("--check-docs", action="store_true", help="Also verify doc files exist")

    args = argparser.parse_args()

    if not os.path.isfile(args.file):
        print(f"ERROR: Cannot find the file: {args.file}")
        return 1

    # Get the base directory (where scripts are located)
    if args.base_dir:
        base_dir = os.path.abspath(args.base_dir)
    else:
        base_dir = os.path.dirname(os.path.abspath(args.file))

    try:
        with open(args.file, mode="r", encoding="utf-8") as file:
            json_data = json.loads(file.read())
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in manifest file: {e}")
        return 1
    except Exception as e:
        print(f"ERROR: Failed to read manifest file: {e}")
        return 1

    if not isinstance(json_data, list):
        print("ERROR: Manifest must be a JSON array")
        return 1

    errors = []
    warnings = []

    for idx, entry in enumerate(json_data):
        entry_id = f"Entry {idx + 1}"

        # Check required fields exist
        if "fname" not in entry:
            errors.append(f"{entry_id}: Missing 'fname' field")
            continue

        fname = entry.get("fname", "")
        entry_id = f"[{fname}]" if fname else entry_id

        # Check fname is not empty
        if not fname or not fname.strip():
            errors.append(f"{entry_id}: Empty 'fname' field")
            continue

        # Check script file exists
        script_path = os.path.join(base_dir, fname)
        if not os.path.isfile(script_path):
            errors.append(f"{entry_id}: Script file not found: {fname}")

        # Check title exists and is not empty
        title = entry.get("title", "")
        if not title or not title.strip():
            errors.append(f"{entry_id}: Missing or empty 'title' field")

        # Check description exists and is not empty
        description = entry.get("description", "")
        if not description or not description.strip():
            errors.append(f"{entry_id}: Missing or empty 'description' field")

        # Check doc file exists (if specified and --check-docs flag is set)
        if args.check_docs and "doc" in entry:
            doc = entry.get("doc", "")
            if doc and doc.strip():
                doc_path = os.path.join(base_dir, doc)
                if not os.path.isfile(doc_path):
                    warnings.append(f"{entry_id}: Doc file not found: {doc}")

    # Print results
    print(f"\nManifest Integrity Check: {args.file}")
    print("=" * 60)
    print(f"Total entries: {len(json_data)}")

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for error in errors:
            print(f"  [X] {error}")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for warning in warnings:
            print(f"  [!] {warning}")

    if not errors and not warnings:
        print("\n[OK] All checks passed! Manifest is valid.")
        return 0

    if errors:
        print(f"\n[FAIL] Found {len(errors)} error(s)")
        return 1
    else:
        print(f"\n[WARN] Found {len(warnings)} warning(s), no errors")
        return 0


if __name__ == "__main__":
    sys.exit(main())
