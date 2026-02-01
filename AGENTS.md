# Shelly Script Examples - Agent Guidelines

## Overview

This repository contains JavaScript examples for Shelly smart home devices. Scripts run on Shelly Gen1/Gen2/Gen3 devices using their embedded scripting engine (mJS - restricted JavaScript).

## Project Structure

```
shelly-script-examples/
├── *.js                        # Root-level example scripts (87+ files)
├── examples-manifest.json      # Central registry of all examples (IMPORTANT)
├── blu-assistant-scripts/      # Shelly BLU Assistant device management
├── howto/                      # Basic tutorials and minimal examples
├── lora-*/                     # LoRa communication examples (5 directories)
├── snippets/                   # Reusable code snippets (JSON format)
├── tools/                      # Upload utilities (Python/Bash)
└── .github/                    # CI/CD workflows and issue templates
```

## Script Categories

| Category | Examples | Description |
|----------|----------|-------------|
| **BLE/Bluetooth** | aranet4, ruuvi, bparasite, shelly-blu-* | BTHome protocol, sensor reading |
| **MQTT** | mqtt-discovery, mqtt-announce | Home Assistant integration |
| **Home Automation** | hue-lights, load-shedding | Scene control, power management |
| **LoRa** | lora-encrypted-*, lora-unencrypted-* | Long-range communication |
| **Utilities** | power-*, scheduler-*, weather-* | Monitoring, scheduling |
| **Blu Assistant** | blu-assistant-scripts/*.js | Virtual component management |

---

## Coding Standards

### Single File Application
- **Each script is standalone**: Every `.js` file is a complete, self-contained application
- **No imports or includes**: Shelly mJS does not support importing code from other files
- **No shared dependencies**: Each script must contain all the code it needs

### File Naming
- Use descriptive kebab-case names: `ble-shelly-motion.js`, `mqtt-discovery.js`
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

```javascript
// Copyright 2021 Allterco Robotics EOOD
// Licensed under the Apache License, Version 2.0

/**
 * Script description and purpose
 * Firmware requirements: X.X+
 * Device compatibility: Gen2/Gen3
 */

// === CONFIGURATION ===
let CONFIG = {
  // User-configurable options at top
  deviceId: 0,
  timeout: 5000,
};

// === STATE ===
let state = {
  lastUpdate: null,
  isRunning: false,
};

// === HELPER FUNCTIONS ===
function helperFunction(param) {
  // Implementation
}

// === MAIN LOGIC ===
function main() {
  // Core logic
}

// === EVENT HANDLERS ===
Shelly.addEventHandler(function(ev) {
  // Handle events
});

// === INITIALIZATION ===
main();
```

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

The `examples-manifest.json` is the central registry for all scripts. **Every new script MUST be added here.**

### Manifest Entry Format
```json
{
  "fname": "script-name.js",
  "title": "Human-Readable Title",
  "description": "What the script does and its requirements",
  "doc": "subdirectory/README.md"  // Optional: path to additional docs
}
```

### After Adding a Script
1. Add entry to `examples-manifest.json`
2. CI/CD automatically regenerates `SHELLY_MJS.md` on merge

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

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
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
- `tools/put_script.py` - Python uploader with chunked transfer
- `tools/upload-script.sh` - Bash uploader for Linux/Mac

### Documentation
- `tools/json-to-md.py` - Generates SHELLY_MJS.md from manifest

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
