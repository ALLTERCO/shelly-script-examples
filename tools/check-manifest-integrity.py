# What it does?
# > This script checks and maintains the integrity of the examples-manifest.json:
# >   1. Verifying that all script files referenced in 'fname' exist
# >   2. Checking that all entries have non-empty descriptions
# >   3. Checking that all entries have non-empty titles
# >   4. Optionally verifying that doc files exist (if specified)
# >   5. Optionally verifying that SHELLY_MJS.md is in sync with the manifest
# >   6. Optionally checking/updating standardized headers in script files
# >   7. Optionally checking/fixing 2-space indentation in script files

# How to run it?
# > Run from anywhere (uses default paths):
# > python tools/check-manifest-integrity.py
# > Check headers: python tools/check-manifest-integrity.py --check-headers
# > Update headers: python tools/check-manifest-integrity.py --update-headers
# > Check indentation: python tools/check-manifest-integrity.py --check-indent
# > Fix indentation: python tools/check-manifest-integrity.py --fix-indent

# Standard header format:
# /**
#  * @title Script Title Here
#  * @description Description of what the script does.
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
DEFAULT_INDEX_MD = os.path.join(DEFAULT_REPO_ROOT, "SHELLY_MJS.md")

# Header pattern to match existing standard headers
HEADER_PATTERN = re.compile(
    r'^/\*\*\s*\n'
    r'\s*\*\s*@title\s+(.+?)\n'
    r'\s*\*\s*@description\s+(.+?)\n'
    r'\s*\*/\s*\n',
    re.MULTILINE | re.DOTALL
)

# Pattern to match any block comment at the start
BLOCK_COMMENT_PATTERN = re.compile(
    r'^/\*\*?\s*\n(.*?)\*/\s*\n',
    re.MULTILINE | re.DOTALL
)


def generate_index_content(json_data):
    """Generate the expected SHELLY_MJS.md content from manifest data."""
    lines = []
    for data in json_data:
        lines.append(data["fname"] + ": " + data["title"] + "\n===\n" + data["description"] + "\n\n")
    return "".join(lines)


def generate_header(title, description):
    """Generate a standardized header block."""
    desc_lines = []
    words = description.split()
    current_line = ""
    for word in words:
        if len(current_line) + len(word) + 1 > 70:
            desc_lines.append(current_line)
            current_line = word
        else:
            current_line = current_line + " " + word if current_line else word
    if current_line:
        desc_lines.append(current_line)

    if len(desc_lines) == 1:
        desc_part = f" * @description {desc_lines[0]}\n"
    else:
        desc_part = f" * @description {desc_lines[0]}\n"
        for line in desc_lines[1:]:
            desc_part += f" *   {line}\n"

    header = f"""/**
 * @title {title}
{desc_part} */

"""
    return header


def check_header(content):
    """Check if file has a standard header. Returns (has_header, title, description)."""
    match = HEADER_PATTERN.match(content)
    if match:
        title = match.group(1).strip()
        description = match.group(2).strip()
        description = re.sub(r'\n\s*\*\s*', ' ', description)
        return True, title, description
    return False, None, None


def update_file_header(file_path, title, description, dry_run=False):
    """Update or add a standard header to a file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return False, f"Failed to read: {e}"

    new_header = generate_header(title, description)

    if HEADER_PATTERN.match(content):
        new_content = HEADER_PATTERN.sub(new_header, content, count=1)
    elif BLOCK_COMMENT_PATTERN.match(content):
        new_content = BLOCK_COMMENT_PATTERN.sub(new_header, content, count=1)
    else:
        new_content = new_header + content

    if dry_run:
        return True, "Would update header"

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True, "Updated"
    except Exception as e:
        return False, f"Failed to write: {e}"


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


def fix_indentation(content):
    """Fix indentation issues.

    - Converts tabs to 2 spaces

    Note: Odd indentation (1, 3, 5 spaces) may be intentional alignment
    and is not automatically fixed. Review manually if needed.

    Returns the fixed content.
    """
    lines = content.split('\n')
    fixed_lines = []

    for line in lines:
        if not line:
            fixed_lines.append(line)
            continue

        # Get leading whitespace
        stripped = line.lstrip()
        leading = line[:len(line) - len(stripped)]

        # Convert tabs to 2 spaces
        if '\t' in leading:
            leading = leading.replace('\t', '  ')
            fixed_lines.append(leading + stripped)
        else:
            fixed_lines.append(line)

    return '\n'.join(fixed_lines)


def fix_file_indentation(file_path, dry_run=False):
    """Fix indentation in a file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return False, f"Failed to read: {e}"

    is_valid, _ = check_indentation(content)
    if is_valid:
        return True, "Already valid"

    fixed_content = fix_indentation(content)

    if content == fixed_content:
        return True, "No changes needed"

    if dry_run:
        return True, "Would fix indentation"

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(fixed_content)
        return True, "Fixed"
    except Exception as e:
        return False, f"Failed to write: {e}"


def main():
    argparser = ArgumentParser(description="Check and maintain integrity of examples-manifest.json")
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
    argparser.add_argument("--check-docs", action="store_true", help="Also verify doc files exist")
    argparser.add_argument("--check-index", action="store_true", help="Also verify SHELLY_MJS.md is in sync")
    argparser.add_argument("--check-headers", action="store_true", help="Check scripts for standard headers")
    argparser.add_argument("--update-headers", action="store_true", help="Update scripts with standard headers from manifest")
    argparser.add_argument("--check-indent", action="store_true", help="Check scripts for 2-space indentation")
    argparser.add_argument("--fix-indent", action="store_true", help="Fix indentation to use 2 spaces")
    argparser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")

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
    header_results = {"has_header": [], "missing_header": [], "updated": []}
    indent_results = {"valid": [], "invalid": [], "fixed": []}

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

        # Header checking/updating
        if args.check_headers or args.update_headers:
            try:
                with open(script_path, "r", encoding="utf-8") as f:
                    content = f.read()
                has_std_header, _, _ = check_header(content)

                if args.check_headers:
                    if has_std_header:
                        header_results["has_header"].append(fname)
                    else:
                        header_results["missing_header"].append(fname)

                if args.update_headers:
                    if title and not title.startswith("TODO") and description and not description.startswith("TODO"):
                        success, msg = update_file_header(script_path, title, description, args.dry_run)
                        if success:
                            header_results["updated"].append(fname)
                        else:
                            errors.append(f"{entry_id}: {msg}")
            except Exception as e:
                errors.append(f"{entry_id}: Failed to process header: {e}")

        # Indentation checking/fixing
        if args.check_indent or args.fix_indent:
            try:
                with open(script_path, "r", encoding="utf-8") as f:
                    content = f.read()
                is_valid, issues = check_indentation(content)

                if args.check_indent:
                    if is_valid:
                        indent_results["valid"].append(fname)
                    else:
                        indent_results["invalid"].append((fname, issues))

                if args.fix_indent and not is_valid:
                    success, msg = fix_file_indentation(script_path, args.dry_run)
                    if success and msg != "Already valid":
                        indent_results["fixed"].append(fname)
                    elif not success:
                        errors.append(f"{entry_id}: {msg}")
            except Exception as e:
                errors.append(f"{entry_id}: Failed to process indentation: {e}")

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
                    errors.append("SHELLY_MJS.md is out of sync with manifest (run: python tools/json-to-md.py ./examples-manifest.json)")
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
            print(f"\n  MISSING HEADER ({len(header_results['missing_header'])}):")
            for fname in sorted(header_results["missing_header"]):
                print(f"    [ ] {fname}")

    if args.update_headers:
        action = "Would update" if args.dry_run else "Updated"
        print(f"\nHeader Update:")
        print(f"  {action}: {len(header_results['updated'])} files")
        if header_results["updated"]:
            print(f"\n  {action.upper()} ({len(header_results['updated'])}):")
            for fname in sorted(header_results["updated"]):
                print(f"    [+] {fname}")

    # Indentation results
    if args.check_indent:
        print(f"\nIndentation Check (2-space):")
        print(f"  Files with valid indentation: {len(indent_results['valid'])}")
        print(f"  Files with invalid indentation: {len(indent_results['invalid'])}")
        if indent_results["invalid"]:
            print(f"\n  INVALID INDENTATION ({len(indent_results['invalid'])}):")
            for fname, issues in sorted(indent_results["invalid"], key=lambda x: x[0]):
                print(f"    [ ] {fname} ({len(issues)} issues)")

    if args.fix_indent:
        action = "Would fix" if args.dry_run else "Fixed"
        print(f"\nIndentation Fix:")
        print(f"  {action}: {len(indent_results['fixed'])} files")
        if indent_results["fixed"]:
            print(f"\n  {action.upper()} ({len(indent_results['fixed'])}):")
            for fname in sorted(indent_results["fixed"]):
                print(f"    [+] {fname}")

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for error in errors:
            print(f"  [X] {error}")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for warning in warnings:
            print(f"  [!] {warning}")

    if not errors and not warnings:
        if args.check_headers and header_results["missing_header"]:
            print(f"\n[WARN] {len(header_results['missing_header'])} files missing headers")
            return 0
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
