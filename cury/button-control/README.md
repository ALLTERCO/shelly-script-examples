# Cury Button Control

BLE button listeners and validation helpers.

## Files

- `cury-btn-listener.shelly.js`
  - Use case: Primary BLU button integration to start/stop animation and cycle colors.
  - User persona: Smart-home installer deploying a single reliable control script.
- `cury-btn-listener 1.shelly.js`
  - Use case: Same control flow as primary listener, but optimized BLE subscription (`addr` filter, passive scan).
  - User persona: Performance-focused developer reducing BLE processing noise in dense RF environments.
- `cury-btn-test.shelly.js`
  - Use case: Discovery and validation of BTHome button events before production mapping.
  - User persona: QA/test engineer verifying button packet content and debouncing behavior.

## Duplicate Note

`cury-btn-listener.shelly.js` and `cury-btn-listener 1.shelly.js` are functionally similar; keep one active for production usage.
