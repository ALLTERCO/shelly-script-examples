# What it does?
# > This script synchronizes examples-manifest.json with the actual .shelly.js files:
# >   1. Finds all .shelly.js files in the repository
# >   2. Adds new files to the manifest with placeholder title/description
# >   3. Optionally removes entries for deleted files
# >   4. Preserves existing metadata for known files

# How to run it?
# > Run from anywhere (uses default paths):
# > python tools/sync-manifest.py
# > Or specify options:
# > python tools/sync-manifest.py --dry-run
# > python tools/sync-manifest.py --remove-missing

from argparse import ArgumentParser
import os
import json
import sys
import re

# Default paths (relative to this script's location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REPO_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_MANIFEST = os.path.join(DEFAULT_REPO_ROOT, "examples-manifest.json")

# Directories to exclude from scanning
EXCLUDE_DIRS = {"node_modules", ".git", "tools", "_backup"}


def find_shelly_scripts(repo_root):
    """Find all .shelly.js files in the repository."""
    scripts = []
    for root, dirs, files in os.walk(repo_root):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            if file.endswith(".shelly.js"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, repo_root)
                # Normalize path separators to forward slashes
                rel_path = rel_path.replace("\\", "/")
                scripts.append(rel_path)

    return sorted(scripts)


def extract_metadata_from_file(file_path):
    """Try to extract title and description from file comments."""
    title = ""
    description = ""

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read(2000)  # Read first 2000 chars

        # Look for common comment patterns
        # Pattern 1: JSDoc-style @title and @description (preferred)
        title_match = re.search(r"@title\s+(.+)", content)
        if title_match:
            title = title_match.group(1).strip()

        desc_match = re.search(r"@description\s+(.+)", content)
        if desc_match:
            description = desc_match.group(1).strip()

        # Pattern 2: // Title: ... or // Description: ...
        if not title:
            title_match = re.search(r"//\s*(?:Title|Name):\s*(.+)", content, re.IGNORECASE)
            if title_match:
                title = title_match.group(1).strip()

        if not description:
            desc_match = re.search(r"//\s*Description:\s*(.+)", content, re.IGNORECASE)
            if desc_match:
                description = desc_match.group(1).strip()

        # Pattern 3: First comment block as fallback for title
        if not title:
            first_comment = re.search(r"^//\s*(.+?)$", content, re.MULTILINE)
            if first_comment:
                title = first_comment.group(1).strip()

    except Exception:
        pass

    return title, description


def main():
    argparser = ArgumentParser(description="Synchronize examples-manifest.json with .shelly.js files")
    argparser.add_argument(
        "file",
        nargs="?",
        default=DEFAULT_MANIFEST,
        help=f"Path to the examples-manifest.json file (default: {DEFAULT_MANIFEST})"
    )
    argparser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    argparser.add_argument(
        "--remove-missing",
        action="store_true",
        help="Remove manifest entries for files that no longer exist"
    )
    argparser.add_argument(
        "--extract-metadata",
        action="store_true",
        help="Try to extract title/description from file comments for new entries"
    )

    args = argparser.parse_args()

    # Get the base directory
    base_dir = os.path.dirname(os.path.abspath(args.file))

    # Load existing manifest
    existing_entries = {}
    if os.path.isfile(args.file):
        try:
            with open(args.file, mode="r", encoding="utf-8") as f:
                json_data = json.loads(f.read())
            for entry in json_data:
                fname = entry.get("fname", "")
                if fname:
                    existing_entries[fname] = entry
        except Exception as e:
            print(f"ERROR: Failed to read manifest: {e}")
            return 1
    else:
        json_data = []

    # Find all .shelly.js files
    scripts = find_shelly_scripts(base_dir)

    # Track changes
    added = []
    removed = []
    unchanged = []

    # Build new manifest
    new_entries = []
    existing_fnames = set(existing_entries.keys())
    found_fnames = set(scripts)

    # Process found scripts
    for fname in scripts:
        if fname in existing_entries:
            # Keep existing entry
            new_entries.append(existing_entries[fname])
            unchanged.append(fname)
        else:
            # New file - create placeholder entry
            title = "TODO: Add title"
            description = "TODO: Add description"

            if args.extract_metadata:
                file_path = os.path.join(base_dir, fname)
                extracted_title, extracted_desc = extract_metadata_from_file(file_path)
                if extracted_title:
                    title = extracted_title
                if extracted_desc:
                    description = extracted_desc

            new_entry = {
                "fname": fname,
                "title": title,
                "description": description
            }
            new_entries.append(new_entry)
            added.append(fname)

    # Handle missing files
    missing = existing_fnames - found_fnames
    if missing:
        if args.remove_missing:
            removed = list(missing)
        else:
            # Keep entries for missing files
            for fname in missing:
                new_entries.append(existing_entries[fname])

    # Sort entries by fname
    new_entries.sort(key=lambda x: x.get("fname", ""))

    # Print summary
    print(f"\nManifest Sync: {args.file}")
    print("=" * 60)
    print(f"Scripts found: {len(scripts)}")
    print(f"Existing entries: {len(existing_entries)}")

    if added:
        print(f"\nNEW ({len(added)}):")
        for fname in added:
            print(f"  [+] {fname}")

    if removed:
        print(f"\nREMOVED ({len(removed)}):")
        for fname in removed:
            print(f"  [-] {fname}")

    if missing and not args.remove_missing:
        print(f"\nMISSING FILES ({len(missing)}) - kept in manifest:")
        for fname in sorted(missing):
            print(f"  [?] {fname}")
        print("  (use --remove-missing to remove these entries)")

    if not added and not removed:
        print("\n[OK] Manifest is already in sync.")
        return 0

    # Write changes
    if args.dry_run:
        print("\n[DRY-RUN] No changes written.")
    else:
        try:
            with open(args.file, mode="w", encoding="utf-8") as f:
                json.dump(new_entries, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"\n[OK] Manifest updated: {len(new_entries)} entries")
        except Exception as e:
            print(f"\nERROR: Failed to write manifest: {e}")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
