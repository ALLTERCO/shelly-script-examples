# Shelly Script Examples - Agent Guidelines

## Overview

This repository contains JavaScript examples for Shelly smart home devices. Scripts run on Shelly Gen1/Gen2/Gen3 devices using their embedded scripting engine (mJS - restricted JavaScript).

## Project Structure

```
shelly-script-examples/
|-- ble/                        # BLE/BLU sensor and button examples
|-- lora/                       # LoRa communication and device control
|-- mqtt/                       # MQTT and Home Assistant integrations
|-- power-energy/               # Power monitoring and load management
|-- switch-input/               # Input, switch, and cover control scripts
|-- weather-env/                # Weather and environmental integrations
|-- http-integrations/          # HTTP endpoints and external services
|-- networking/                 # Provisioning and watchdog scripts
|-- scheduling/                 # Scheduling, scenes, and orchestration
|-- blu-assistant/              # Shelly BLU Assistant device management
|-- examples-manifest.json      # Central registry of all examples (IMPORTANT)
|-- howto/                      # Basic tutorials and minimal examples
|-- snippets/                   # Reusable code snippets (JSON format)
|-- tools/                      # Upload utilities (Python/Bash)
`-- .github/                    # CI/CD workflows and issue templates
```

## Script Categories

| Category | Examples | Description |
|----------|----------|-------------|
| **BLE/Bluetooth** | aranet4, ruuvi, bparasite, shelly-blu-* | BTHome protocol, sensor reading |
| **MQTT** | mqtt-discovery, mqtt-announce | Home Assistant integration |
| **Home Automation** | hue-lights, load-shedding | Scene control, power management |
| **LoRa** | lora/* | Long-range communication |
| **Utilities** | power-*, scheduler-*, weather-* | Monitoring, scheduling |
| **Blu Assistant** | blu-assistant/*.shelly.js | Virtual component management |

---

## Coding Standards

### Single File Application
- **Each script is standalone**: Every `.shelly.js` file is a complete, self-contained application
- **No imports or includes**: Shelly mJS does not support importing code from other files
- **No shared dependencies**: Each script must contain all the code it needs

### File Naming
- Use descriptive kebab-case names: `ble-shelly-motion.shelly.js`, `mqtt-discovery.shelly.js`
- Reflect the script's purpose in the filename

### Code Style (Enforced via .editorconfig/.prettierrc)
- **2-space indentation** (not tabs)
- **Single quotes** for strings
- **Semicolons required**
- **LF line endings**
- **UTF-8 charset**

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `lastTime`, `switchStatus` |
| Constants | UPPER_SNAKE_CASE | `CONFIG`, `DEVICE_ID` |
| Functions | camelCase | `turnOff`, `handleEvent` |
| Event handlers | prefix with `on` | `onButtonPress`, `onStatusChange` |
| Boolean functions | prefix with `is`/`has` | `isValidMac`, `hasPermission` |

### Code Structure Pattern

Scripts follow a **two-header pattern** for documentation:

1. **Standard Header** - Machine-readable metadata for manifest/index generation
2. **Detailed Documentation** - Human-readable technical details (hardware, protocol, etc.)

```javascript
/**
 * @title Human-Readable Title
 * @description Brief description of what the script does. Keep it concise
 *   (1-2 sentences). Mention firmware requirements if applicable.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/path/to/file.shelly.js
 */

/**
 * Detailed Documentation Block
 *
 * Extended explanation of the script's purpose and functionality.
 *
 * Hardware Connection: (for hardware-interfacing scripts)
 * - Device TX -> Shelly RX (GPIO)
 * - Device RX -> Shelly TX (GPIO)
 * - VCC -> 3.3V or 5V
 * - GND -> GND
 *
 * Protocol: (for communication scripts)
 * - Baud rate: 9600
 * - Frame format: [Header] [Length] [Data] [Checksum]
 *
 * Components Created: (for setup scripts)
 * - Text:200    - Status display
 * - Number:200  - Value display
 * - Button:200  - Control button
 *
 * @see https://link-to-reference-documentation
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  // User-configurable options at top
  deviceId: 0,
  timeout: 5000,
};

// ============================================================================
// STATE
// ============================================================================

let state = {
  lastUpdate: null,
  isRunning: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function helperFunction(param) {
  // Implementation
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function main() {
  // Core logic
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

Shelly.addEventHandler(function(ev) {
  // Handle events
});

// ============================================================================
// INITIALIZATION
// ============================================================================

main();
```

### Header Guidelines

| Header Type | Purpose | Required |
|-------------|---------|----------|
| `@title` | Short name for manifest/index | Yes |
| `@description` | Brief description (1-2 sentences) | Yes |
| `@status` | `production` or `under development` | Yes |
| `@link` | URL to file on ALLTERCO GitHub repo | Yes |
| Detailed block | Hardware, protocol, components | For hardware/complex scripts |

**Note:** Only files with `@status production` are included in the manifest
(`examples-manifest.json`) and the index (`SHELLY_MJS.md`). Files with
`@status under development` are excluded from both.

**When to include detailed documentation:**
- Hardware interfacing scripts (UART, SPI, I2C devices)
- Setup scripts that create virtual components
- Protocol implementations (MODBUS, IR, RFID)
- Scripts with complex configuration options

**Simple scripts** (basic examples, utilities) may only need the standard header.

---

## Common Patterns

### Event Handler
```javascript
Shelly.addEventHandler(function(ev) {
  if (ev.component === 'input:0') {
    if (ev.info && ev.info.event === 'single_push') {
      // Handle single push
    }
  }
});
```

### Status Handler
```javascript
Shelly.addStatusHandler(function(status) {
  if (status.component === 'switch:0') {
    print('Switch state:', status.delta.output);
  }
});
```

### RPC Call
```javascript
Shelly.call('Switch.Set', { id: 0, on: true }, function(result, error_code, error_message) {
  if (error_code !== 0) {
    print('Error:', error_message);
    return;
  }
  print('Success:', JSON.stringify(result));
});
```

### Timer
```javascript
Timer.set(5000, true, function() {
  // Runs every 5 seconds
});
```

### HTTP Request
```javascript
Shelly.call('HTTP.GET', { url: 'http://example.com/api' }, function(result, error_code) {
  if (error_code === 0 && result && result.code === 200) {
    let data = JSON.parse(result.body);
    // Process data
  }
});
```

### MQTT Publish
```javascript
MQTT.publish('shelly/status', JSON.stringify({ state: 'on' }), 0, false);
```

### BLE Scanner
```javascript
BLE.Scanner.Start({ duration_ms: BLE.Scanner.INFINITE_SCAN });
BLE.Scanner.Subscribe(function(ev, result) {
  if (ev === BLE.Scanner.SCAN_RESULT) {
    // Process scan result
  }
});
```

---

## Shelly API Reference

### Core APIs
| API | Purpose |
|-----|---------|
| `Shelly.call(method, params, callback)` | RPC calls |
| `Shelly.addEventHandler(callback)` | Subscribe to events |
| `Shelly.addStatusHandler(callback)` | Subscribe to status changes |
| `Shelly.getComponentConfig(type, id)` | Get component configuration |
| `Shelly.getComponentStatus(type, id)` | Get component status |
| `Shelly.emitEvent(name, data)` | Emit custom event |

### Components
- `Switch` - Relay control
- `Input` - Button/switch inputs
- `Light` - Dimmer control
- `Cover` - Roller shutter control
- `BLE.Scanner` - Bluetooth scanning
- `MQTT` - MQTT client
- `HTTP` - HTTP client
- `Timer` - Timers and delays
- `Virtual` - Virtual components
- `KVS` - Key-Value Store

---

## Manifest File (CRITICAL)

The `examples-manifest.json` is the central registry for all production scripts. Only files with `@status production` in their JSDoc header are included.

### Manifest Entry Format
```json
{
  "fname": "script-name.shelly.js",
  "title": "Human-Readable Title",
  "description": "What the script does and its requirements",
  "doc": "subdirectory/README.md"  // Optional: path to additional docs
}
```

### After Adding a Script
1. Add the standard JSDoc header with `@status production`
2. CI/CD checks run on PR: headers, sync, and status validation
3. After merge: `sync-manifest-md.py` syncs the manifest, `sync-manifest-json.py` regenerates `SHELLY_MJS.md`

---

## Git Workflow

### Branching Strategy
- **main**: Production-ready code, only receives merges from dev
- **dev**: Development/integration branch, receives merges from feature branches
- **feature branches**: `feature/<short-description>` - created from dev
- **bug fixes**: `fix/<short-description>` - created from dev

```
main ←── dev ←── feature/xyz
              ←── fix/abc
```

### IMPORTANT: Always Ask Before Git Operations

**NEVER perform these actions without explicit user approval:**
- `git commit` - Always ask before committing
- `git merge` - Always ask before merging
- `git push` - Always ask before pushing
- Every commit request must follow the rules in this `AGENTS.md` file.

Example prompts:
- "Changes are ready. May I commit them?"
- "Feature branch is complete. May I merge to dev?"
- "Tests passed. May I merge dev to main and push?"

### Commit Workflow (Step by Step)

1. **Checkout dev branch:**
   ```bash
   git checkout dev
   ```

2. **Create feature branch from dev:**
   ```bash
   git checkout -b feature/<short-description>
   ```

3. **Make changes, then ASK before committing:**
   ```
   "I've made the following changes: [summary]. May I commit them?"
   ```

   After approval:
   ```bash
   git add <specific-files>
   git commit -m "$(cat <<'EOF'
   Short summary (imperative mood, max 50 chars)

   - Detailed bullet point 1
   - Detailed bullet point 2

   EOF
   )"
   ```

4. **Test the feature:**
   - For software-only changes: Verify logic and syntax
   - For hardware-dependent changes: **ASK the user to test manually**
   - Never merge untested code

5. **ASK before merging feature to dev:**
   ```
   "Feature is ready and tested. May I merge to dev?"
   ```

   After approval:
   ```bash
   git checkout dev
   git merge feature/<short-description> --no-ff -m "Merge feature/<short-description> into dev"
   ```

6. **ASK before merging dev to main (only after tests pass):**
   ```
   "All tests passed on dev. May I merge dev to main?"
   ```

   After approval:
   ```bash
   git checkout main
   git merge dev --no-ff -m "Merge dev into main"
   ```

7. **ASK before pushing:**
   ```
   "Ready to push. May I push main and dev to origin?"
   ```

   After approval:
   ```bash
   git push origin main
   git push origin dev
   git branch -d feature/<short-description>
   git push origin --delete feature/<short-description>
   ```

### Important: Always Use --no-ff

Always use `--no-ff` (no fast-forward) when merging to create merge commits. This preserves the branch topology and makes the history clear:

```
*   Merge dev into main
|\
| *   Merge feature/xyz into dev
| |\
| | * Actual commit message
| |/
```

### Commit Message Format
```
Short summary (imperative mood)

- Bullet point describing change 1
- Bullet point describing change 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Keep the Changelog Up to Date

**ALWAYS update `CHANGELOG.md` when adding or modifying scripts.**

The changelog is in a dedicated file: `CHANGELOG.md`. Format:

```markdown
## YYYY-MM
- Description of what was added or changed
```

**Rules:**
- Add entries at the TOP of the changelog (newest first)
- Use the current year-month format: `## 2026-02`
- Keep descriptions concise but informative
- Group related changes under the same month header
- If the current month already exists, add to it; don't create a duplicate

**Example:**
```markdown
## 2026-02
- Add precipitation-based irrigation control script
- Fix BLE scanner timeout issue
```

### Keep Documentation Up to Date

**ALWAYS update relevant documentation when making changes.**

Documentation files to consider:
- `README.md` - Project overview and links
- `CHANGELOG.md` - Record of changes (see above)
- `examples-manifest.json` - Script registry with descriptions
- Subdirectory `README.md` files - For scripts in folders (e.g., `lora-*/README.md`)
- Script header comments - Purpose, firmware requirements, device compatibility

**Rules:**
- When adding a new script: Add entry to `examples-manifest.json` with clear title and description
- When modifying a script: Update the script's header comments if behavior changes
- When adding scripts to a subdirectory: Ensure the subdirectory has a README.md
- When changing API usage: Update code comments to reflect new patterns
- Keep descriptions accurate - don't leave outdated information

**What to document in script headers:**
```javascript
/**
 * Script name and purpose
 *
 * Firmware requirements: X.X+
 * Device compatibility: Gen2/Gen3, Plus/Pro series
 * External hardware: (if applicable)
 *
 * Configuration:
 * - PARAM_1: Description of what it does
 * - PARAM_2: Description of what it does
 */
```

---

## Contributing Guidelines

### Requirements (from CONTRIBUTING.md)
- **100% authorship**: You must be the sole author of contributions
- **Apache 2.0 License**: All contributions must be compatible
- **Bug reports**: Include firmware version, device type, reproduction steps
- **Security issues**: Report directly to support@shelly.com (NOT public)
- **Enhancements**: Must demonstrate broad appeal, not niche features

### Pull Request Checklist
- [ ] Script is self-contained and standalone
- [ ] Configuration options at top of file
- [ ] Comments explain complex logic
- [ ] Script header documents purpose, firmware, and compatibility
- [ ] Entry added to `examples-manifest.json`
- [ ] Changelog updated in `CHANGELOG.md`
- [ ] Related documentation updated (READMEs, comments)
- [ ] Tested on appropriate device/firmware
- [ ] Follows code style (.editorconfig/.prettierrc)
- [ ] Apache 2.0 license header included

---

## Device Compatibility

| Generation | Series | Notes |
|------------|--------|-------|
| Gen1 | Original Shelly | Limited scripting support |
| Gen2 | Plus, Pro | Full mJS scripting |
| Gen3 | Latest | Full mJS scripting, enhanced features |

Always document firmware requirements in script comments.

---

## Error Handling Best Practices

```javascript
Shelly.call('Switch.Set', { id: 0, on: true }, function(result, error_code, error_message) {
  if (error_code !== 0) {
    print('Error [' + error_code + ']: ' + error_message);
    return;
  }
  if (!result) {
    print('No result received');
    return;
  }
  // Success - proceed with result
});
```

### Common Error Codes
- `0` - Success
- `-1` - Generic error
- `-103` - Method not found
- `-104` - Invalid params

---

## Tools

### Script Upload
- `tools/put_script.py` - Upload script to a Shelly device (stop, upload in chunks, start)

### CI/CD & Manifest
- `tools/check-manifest-integrity.py` - Check-only integrity validation (CI gate)
- `tools/sync-manifest-md.py` - Syncs manifest JSON with production files on disk
- `tools/sync-manifest-json.py` - Generates SHELLY_MJS.md from manifest

### Tool Reference

| Tool | Purpose | Usage |
|------|---------|-------|
| `put_script.py` | Upload script to device | `python tools/put_script.py <host> <slot_id> <file>` |
| `check-manifest-integrity.py` | Validate headers and sync (CI gate) | `python tools/check-manifest-integrity.py --check-headers --check-sync` |
| `sync-manifest-md.py` | Add/remove manifest entries from file headers | `python tools/sync-manifest-md.py --extract-metadata` |
| `sync-manifest-json.py` | Regenerate SHELLY_MJS.md from manifest | `python tools/sync-manifest-json.py ./examples-manifest.json` |

---

## Verification Workflow

### Trigger Word: `verify`

When the user says **`verify`** (or `check`, `run verification`), the agent MUST
execute the full verification pipeline described below. The goal is to
synchronize all generated files, validate every production script, and report
or fix any issues found.

### Step-by-Step Pipeline

Run the following steps **in order**. If a step fails, attempt to fix the
issue automatically, then re-run from that step.

#### 1. Sync manifest from file headers

```bash
python tools/sync-manifest-md.py --extract-metadata
```

- Scans every `.shelly.js` file for `@status production`
- Adds new production files to `examples-manifest.json` (with extracted
  `@title` and `@description`)
- Reports removed or skipped files
- **Fix:** If a file is missing its header, add the standard JSDoc header
  to the file and re-run

#### 2. Regenerate SHELLY_MJS.md

```bash
python tools/sync-manifest-json.py ./examples-manifest.json
```

- Reads `examples-manifest.json` and writes `SHELLY_MJS.md`
- **Important:** Use `./examples-manifest.json` (forward-slash relative
  path) to avoid Windows path issues

#### 3. Run integrity checks

```bash
python tools/check-manifest-integrity.py --check-headers --check-sync
```

- `--check-headers` — Verifies every manifest entry has a valid standard
  JSDoc header (`@title`, `@description`, `@status`, `@link`)
- `--check-sync` — Verifies every `@status production` file on disk has
  a corresponding manifest entry and vice-versa
- **This is the same check that CI runs on pull requests**

#### 4. Report results

After all steps complete, report to the user:
- Total number of manifest entries
- Any files added, removed, or fixed
- Final pass/fail status from the integrity check
- If any issues remain that cannot be auto-fixed, list them clearly

### Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `TODO: Add title` in manifest | `sync-manifest-md.py` ran without `--extract-metadata` | Change `@status` to `draft`, re-sync, change back to `production`, re-sync with `--extract-metadata` |
| Missing header | New script without JSDoc | Add the standard two-header block to the file |
| Sync mismatch | File on disk but not in manifest | Run `sync-manifest-md.py --extract-metadata` |
| Manifest entry but no file | File was deleted or renamed | Run `sync-manifest-md.py --remove-missing` |
| Windows path error in `sync-manifest-json.py` | Backslash path passed as argument | Use `./examples-manifest.json` (forward slashes) |

---

## Resources

### Official Documentation
- [Shelly Scripting Tutorial](https://shelly-api-docs.shelly.cloud/gen2/Scripts/Tutorial)
- [Shelly API Reference](https://shelly-api-docs.shelly.cloud/gen2/)
- [Virtual Components](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Virtual)

### Protocols
- [BTHome Protocol](https://bthome.io/format/)
- [MQTT Specification](https://mqtt.org/)

### Community
- [Shelly Support Forum](https://www.shelly-support.eu/)
- [GitHub Issues](https://github.com/ALLTERCO/shelly-script-examples/issues)

