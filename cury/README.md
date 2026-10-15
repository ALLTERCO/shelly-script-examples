# Cury Examples

Cury-specific scripts are grouped by purpose to make selection and testing easier.

## Folder Layout

- `light-language/` - UI/ambient animation engines
- `button-control/` - BLE button listener and test utilities
- `legacy/` - Compact or older variants kept for reference

## Use Case and Persona by Folder

- `light-language/`
  - Use case: Build branded LED behavior for product states (boot, ready, active, warning, error, night).
  - User persona: UX/product engineer prototyping device feedback language.
- `button-control/`
  - Use case: Control Cury animation scripts from a BLU button and validate BLE event payloads.
  - User persona: Field integrator or installer pairing physical controls with scripted behavior.
- `legacy/`
  - Use case: Keep a compact fallback script for quick deployment or regression comparison.
  - User persona: Support engineer troubleshooting behavior differences across script revisions.

## Duplicate and Variant Analysis

- `button-control/cury-btn-listener.shelly.js` and `button-control/cury-btn-listener 1.shelly.js` are near-duplicates.
  - Both map BLU button actions to animation control.
  - `cury-btn-listener 1.shelly.js` adds BLE scanner options (`addr` filter + `active: false`) and extra comments.
- `light-language/cury-light-language-2.shelly.js` and `light-language/cury-light-language-v2.shelly.js` are different implementations, not duplicates.
  - `-2` is a state-machine light language with 9 states.
  - `-v2` is a step-based crossfade animation loop.
- `legacy/cury-mini.shelly.js` is a compact/legacy-style variant close in behavior to `cury-light-language-2.shelly.js`, but includes extra condensed logic and hardware polling.
