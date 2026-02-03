# What it does?
# > This script checks the integrity of the examples-manifest.json for CI/CD:
# >   1. Verifying that all script files referenced in 'fname' exist
# >   2. Checking that all entries have non-empty descriptions
# >   3. Checking that all entries have non-empty titles
# >   4. Checking that all .shelly.js files are listed in the manifest
# >   5. Optionally verifying that doc files exist (if specified)
# >   6. Optionally verifying that SHELLY_MJS.md is in sync with the manifest
# >   7. Optionally checking standardized headers in script files
# >   8. Optionally checking 2-space indentation in script files

# How to run it?
# > Run from anywhere (uses default paths):
# > python tools/check-manifest-integrity.py
# > Full CI check: python tools/check-manifest-integrity.py --check-headers --check-indent --check-index --check-sync
# > Exit code 0 = all checks passed, exit code 1 = errors found

# Standard header format:
# /**
#  * @title Script Title Here
#  * @description Description of what the script does.
#  * @status production
#  * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/path/to/file.shelly.js
#  */

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

# Header pattern to match standard headers (with optional @status and @link)
HEADER_PATTERN = re.compile(
    r'^/\*\*\s*\n'
    r'\s*\*\s*@title\s+(.+?)\n'
    r'(\s*\*\s*@description\s+.+?\n(?:\s*\*\s{2,}.+\n)*)'
    r'(\s*\*\s*@status\s+.+\n)?'
    r'(\s*\*\s*@link\s+.+\n)?'
    r'\s*\*/\s*\n',
    re.MULTILINE
)

# Valid @status values
VALID_STATUSES = {"production", "under development"}


def extract_status_from_file(file_path):
    """Extract the @status value from the JSDoc header."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read(2000)
        status_match = re.search(r"@status\s+(.+)", content)
        if status_match:
            return status_match.group(1).strip()
    except Exception:
        pass
    return None


def find_shelly_scripts(repo_root, production_only=False):
    """Find all .shelly.js files in the repository.

    If production_only is True, only return files with @status production.
    """
    scripts = []
    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            if file.endswith(".shelly.js"):
                full_path = os.path.join(root, file)
                if production_only:
                    status = extract_status_from_file(full_path)
                    if status != "production":
                        continue
                rel_path = os.path.relpath(full_path, repo_root)
                rel_path = rel_path.replace("\\", "/")
                scripts.append(rel_path)
    return sorted(scripts)


def generate_index_content(json_data):
    """Generate the expected SHELLY_MJS.md content from manifest data."""
    lines = []
    for data in json_data:
        lines.append(data["fname"] + ": " + data["title"] + "\n===\n" + data["description"] + "\n\n")
    return "".join(lines)


def check_header(content):
    """Check if file has a standard header.

    Returns (has_header, title, description, status, link).
    """
    match = HEADER_PATTERN.match(content)
    if match:
        title = match.group(1).strip()
        desc_block = match.group(2)
        desc_match = re.match(r'\s*\*\s*@description\s+(.+)', desc_block, re.DOTALL)
        description = desc_match.group(1).strip() if desc_match else ""
        description = re.sub(r'\n\s*\*\s{2,}', ' ', description)

        status = None
        if match.group(3):
            status_match = re.search(r'@status\s+(.+)', match.group(3))
            if status_match:
                status = status_match.group(1).strip()

        link = None
        if match.group(4):
            link_match = re.search(r'@link\s+(.+)', match.group(4))
            if link_match:
                link = link_match.group(1).strip()

        return True, title, description, status, link
    return False, None, None, None, None


def check_indentation(content):
    """Check if file uses proper 2-space indentation.

    Returns (is_valid, issues) where issues is a list of problem descriptions.
    Skips comment lines (lines starting with * inside block comments).
    """
    issues = []
    lines = content.split('\n')
    in_block_comment = False

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()

        # Track block comment state
        if '/*' in line:
            in_block_comment = True
        if '*/' in line:
            in_block_comment = False
            continue

        # Skip lines inside block comments (JSDoc uses 1-space + *)
        if in_block_comment and stripped.startswith('*'):
            continue

        if not line or not line[0].isspace():
            continue

        # Check for tabs
        if '\t' in line:
            leading = len(line) - len(line.lstrip())
            leading_part = line[:leading]
            if '\t' in leading_part:
                issues.append(f"Line {line_num}: Uses tabs for indentation")
                continue

        # Check indentation level (should be multiple of 2)
        leading_spaces = len(line) - len(line.lstrip(' '))
        if leading_spaces > 0 and leading_spaces % 2 != 0:
            issues.append(f"Line {line_num}: Odd indentation ({leading_spaces} spaces)")

    return len(issues) == 0, issues


def main():
    argparser = ArgumentParser(description="Check integrity of examples-manifest.json (CI/CD)")
    argparser.add_argument(
        "file",
        nargs="?",
        default=DEFAULT_MANIFEST,
        help=f"Path to the examples-manifest.json file (default: {DEFAULT_MANIFEST})"
    )
    argparser.add_argument(
        "--base-dir",
        default=None,
        help="Base directory for script files (default: directory containing manifest)"
    )
    argparser.add_argument("--check-docs", action="store_true", help="Verify doc files exist")
    argparser.add_argument("--check-index", action="store_true", help="Verify SHELLY_MJS.md is in sync")
    argparser.add_argument("--check-headers", action="store_true", help="Check scripts for standard headers")
    argparser.add_argument("--check-indent", action="store_true", help="Check scripts for 2-space indentation")
    argparser.add_argument("--check-sync", action="store_true", help="Check that all .shelly.js files are in the manifest")

    args = argparser.parse_args()

    if not os.path.isfile(args.file):
        print(f"ERROR: Cannot find the file: {args.file}")
        return 1

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
    header_results = {"has_header": [], "missing_header": [], "bad_status": [], "missing_link": []}
    indent_results = {"valid": [], "invalid": []}

    for idx, entry in enumerate(json_data):
        entry_id = f"Entry {idx + 1}"

        if "fname" not in entry:
            errors.append(f"{entry_id}: Missing 'fname' field")
            continue

        fname = entry.get("fname", "")
        entry_id = f"[{fname}]" if fname else entry_id

        if not fname or not fname.strip():
            errors.append(f"{entry_id}: Empty 'fname' field")
            continue

        script_path = os.path.join(base_dir, fname)
        if not os.path.isfile(script_path):
            errors.append(f"{entry_id}: Script file not found: {fname}")
            continue

        title = entry.get("title", "")
        if not title or not title.strip():
            errors.append(f"{entry_id}: Missing or empty 'title' field")

        description = entry.get("description", "")
        if not description or not description.strip():
            errors.append(f"{entry_id}: Missing or empty 'description' field")

        if args.check_docs and "doc" in entry:
            doc = entry.get("doc", "")
            if doc and doc.strip():
                doc_path = os.path.join(base_dir, doc)
                if not os.path.isfile(doc_path):
                    warnings.append(f"{entry_id}: Doc file not found: {doc}")

        # Header checking
        if args.check_headers:
            try:
                with open(script_path, "r", encoding="utf-8") as f:
                    content = f.read()
                has_std_header, _, _, status, link = check_header(content)

                if has_std_header:
                    header_results["has_header"].append(fname)

                    if status is None:
                        errors.append(f"{entry_id}: Missing @status tag in header")
                    elif status not in VALID_STATUSES:
                        errors.append(f"{entry_id}: Invalid @status '{status}' (expected: {', '.join(VALID_STATUSES)})")

                    if link is None:
                        errors.append(f"{entry_id}: Missing @link tag in header")
                else:
                    header_results["missing_header"].append(fname)
                    errors.append(f"{entry_id}: Missing standard JSDoc header")
            except Exception as e:
                errors.append(f"{entry_id}: Failed to read file for header check: {e}")

        # Indentation checking
        if args.check_indent:
            try:
                with open(script_path, "r", encoding="utf-8") as f:
                    content = f.read()
                is_valid, issues = check_indentation(content)

                if is_valid:
                    indent_results["valid"].append(fname)
                else:
                    indent_results["invalid"].append((fname, issues))
                    errors.append(f"{entry_id}: Invalid indentation ({len(issues)} issues)")
            except Exception as e:
                errors.append(f"{entry_id}: Failed to read file for indent check: {e}")

    # Check manifest is in sync with production files on disk
    if args.check_sync:
        manifest_fnames = set(entry.get("fname", "") for entry in json_data)
        production_fnames = set(find_shelly_scripts(base_dir, production_only=True))

        missing_from_manifest = production_fnames - manifest_fnames
        if missing_from_manifest:
            for fname in sorted(missing_from_manifest):
                errors.append(f"Production file not in manifest: {fname}")

        non_production_in_manifest = manifest_fnames - production_fnames
        if non_production_in_manifest:
            # Check if the file exists but is not production, vs missing entirely
            all_fnames = set(find_shelly_scripts(base_dir, production_only=False))
            for fname in sorted(non_production_in_manifest):
                if fname in all_fnames:
                    errors.append(f"Non-production file in manifest: {fname}")
                else:
                    errors.append(f"Manifest entry has no file on disk: {fname}")

    # Check SHELLY_MJS.md is in sync
    if args.check_index:
        index_path = os.path.join(base_dir, "SHELLY_MJS.md")
        if not os.path.isfile(index_path):
            errors.append("SHELLY_MJS.md not found")
        else:
            try:
                with open(index_path, mode="r", encoding="utf-8") as f:
                    actual_content = f.read()
                expected_content = generate_index_content(json_data)
                if actual_content != expected_content:
                    errors.append("SHELLY_MJS.md is out of sync with manifest")
            except Exception as e:
                errors.append(f"Failed to read SHELLY_MJS.md: {e}")

    # Print results
    print(f"\nManifest Integrity Check: {args.file}")
    print("=" * 60)
    print(f"Total entries: {len(json_data)}")

    # Header results
    if args.check_headers:
        print(f"\nHeader Check:")
        print(f"  Files with standard header: {len(header_results['has_header'])}")
        print(f"  Files missing standard header: {len(header_results['missing_header'])}")
        if header_results["missing_header"]:
            for fname in sorted(header_results["missing_header"]):
                print(f"    [X] {fname}")

    # Indentation results
    if args.check_indent:
        print(f"\nIndentation Check (2-space):")
        print(f"  Files with valid indentation: {len(indent_results['valid'])}")
        print(f"  Files with invalid indentation: {len(indent_results['invalid'])}")
        if indent_results["invalid"]:
            for fname, issues in sorted(indent_results["invalid"], key=lambda x: x[0]):
                print(f"    [X] {fname} ({len(issues)} issues)")

    # Sync results
    if args.check_sync:
        manifest_fnames = set(entry.get("fname", "") for entry in json_data)
        production_fnames = set(find_shelly_scripts(base_dir, production_only=True))
        if manifest_fnames == production_fnames:
            print(f"\nSync Check: All production files accounted for")
        else:
            print(f"\nSync Check: MISMATCH detected")

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for error in errors:
            print(f"  [X] {error}")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for warning in warnings:
            print(f"  [!] {warning}")

    if not errors and not warnings:
        print("\n[OK] All checks passed!")
        return 0

    if errors:
        print(f"\n[FAIL] Found {len(errors)} error(s)")
        return 1
    else:
        print(f"\n[WARN] Found {len(warnings)} warning(s), no errors")
        return 0


if __name__ == "__main__":
    sys.exit(main())
