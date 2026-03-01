# Skill: Standardize JS to Shelly Script

## Description
Use this skill when a script exists as `*.js` (or non-standard name) and must be converted to repository-compliant `*.shelly.js` format with proper metadata headers.

---

## Goal
- Rename script to kebab-case `*.shelly.js`
- Add required header fields: `@title`, `@description`, `@status`, `@link`
- Align code style with repository standards
- Update related documentation references

---

## Workflow

### 1) Rename the file
Use kebab-case and `.shelly.js` extension.

Example:
```bash
mv path/old_name.js path/new-name.shelly.js
```

### 2) Add standard metadata header (required)
Use this block at the top of the script:

```javascript
/**
 * @title Human-readable title
 * @description One or two sentences describing what the script does and key requirements.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/path/to/new-name.shelly.js
 */
```

### 3) Add optional detailed documentation block
Add a second block when script behavior is non-trivial (hardware/protocol/components):

```javascript
/**
 * Short technical details
 *
 * Hardware/protocol/components:
 * - Item 1
 * - Item 2
 */
```

### 4) Standardize code style
- 2-space indentation
- single quotes
- semicolons
- LF line endings
- UTF-8 text
- no imports/includes (standalone Shelly script)

### 5) Standardize structure (recommended)
Organize into sections when practical:
- `CONFIGURATION`
- `STATE`
- `HELPERS`
- `MAIN LOGIC`
- `EVENT HANDLERS`
- `INITIALIZATION` with `init();`

### 6) Update docs (required before commit)
- Add/update nearest folder `README.md` entries for renamed/new script file
- Update category/root `README.md` indexes if needed
- Add `CHANGELOG.md` entry in current `YYYY-MM` section
- If `@status production`, ensure manifest/index workflow is run via tools

---

## Guardrails
- Do not manually edit generated files (`examples-manifest.json`, `SHELLY_MJS.md`)
- If script path changes, always update `@link`
- Keep behavior unchanged unless user explicitly asks for functional refactor
