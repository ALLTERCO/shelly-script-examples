# Skill: Manifest Verify Tools Workflow

## Description
Use this skill when working with repository-generated files managed by scripts in `tools/`, especially:
- `examples-manifest.json`

This skill enforces a strict rule:
- **Never manually edit generated files.**
- **Always use the `tools/` scripts to regenerate and validate.**

---

## Trigger Cases
Use this workflow when the user asks to:
- verify/check manifest consistency
- sync production script metadata from headers
- fix CI failures related to manifest/header/sync checks

---

## Canonical Pipeline (Run in Order)

### 1) Sync manifest from script headers
```bash
python3 tools/sync-manifest-md.py --extract-metadata
```

### 2) Run integrity checks (same gate used in CI)
```bash
python3 tools/check-manifest-integrity.py --check-headers --check-sync
```

---

## Auto-Fix Rules

If step 2 fails, apply targeted fixes, then rerun step 1 and step 2.

### Missing files referenced by manifest
Use:
```bash
python3 tools/sync-manifest-md.py --remove-missing
```

### File on disk but not in manifest
Use:
```bash
python3 tools/sync-manifest-md.py --extract-metadata
```

### Header problems
Fix script header fields (`@title`, `@description`, `@status`, `@link`) in source script, then rerun the pipeline.

---

## Guardrails
- Do not hand-edit `examples-manifest.json`.
- Report exact files added/removed/fixed after each run.

---

## Output Report Template
After execution, report:
- total manifest entries
- files added/removed/fixed
- final pass/fail of integrity check
- remaining blockers (if any)

Short example:
- `Manifest entries: 102`
- `Removed stale entries: 3`
- `Integrity check: PASS`
