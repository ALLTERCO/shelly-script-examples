# Modbus Device Script Template

Canonical skeleton for writing a new Modbus RTU device driver that runs either
as a standalone Shelly script (Shelly API) or as plain JavaScript (software-only
mode with no hardware dependency).

---

## Concepts

| Term | Meaning |
|------|---------|
| `ENTITIES` | Table of every register the driver reads or writes |
| `CONFIG` | All tuneable parameters in one place at the top of the file |
| `vcId` | Shelly virtual-component identifier (`"number:200"`, `"boolean:0"`, …) |
| `handle` | Opaque timer / request handle returned by the poll loop |
| `vcHandle` | Opaque handle returned by `Shelly.addVirtualComponent` |
| `REGTYPE_INPUT` | Modbus Function Code 0x04 — Read Input Registers |
| `REGTYPE_HOLDING` | Modbus Function Code 0x03 — Read Holding Registers |
| `BE` / `LE` | Big-endian / little-endian byte order for 32-bit register pairs |

---

## 1. File header

Every driver file starts with a JSDoc block that identifies it in the manifest.

```js
/**
 * @title  <Device manufacturer + model, e.g. "Acme EM3000 Energy Meter">
 * @description  <One-sentence summary of what the script monitors or controls>
 * @status  under development | testing | production
 * @link  <URL to this file in the repo>
 */
```

---

## 2. CONFIG block

All user-tuneable values in one object, at the very top of the script body.

```js
var CONFIG = {
  // --- Modbus transport ---
  SLAVE_ID:          1,       // Modbus slave address (1-247)
  BAUD_RATE:         9600,    // Serial baud rate
  UART_MODE:         "8N1",   // Frame format: "8N1" | "8E1" | "8O1"

  // --- Polling ---
  POLL_INTERVAL_MS:  5000,    // How often to read all entities (ms)
  RESPONSE_TIMEOUT:  1000,    // Max time to wait for a slave reply (ms)
  INTER_FRAME_DELAY: 50,      // Silence between frames (ms)

  // --- Behaviour flags ---
  DEBUG:             false,   // Print raw frames to the log
  DRY_RUN:           false,   // Parse registers but skip virtual-component writes
};
```

---

## 3. ENTITIES table

One entry per logical value the driver exposes. The array drives both the poll
loop and the virtual-component registration — no other code needs to be edited
when adding or removing a register.

```js
// ModbusController constants (defined by the shared library or inline below)
//
//   ModbusController.REGTYPE_INPUT   = 0x04  (Read Input Registers)
//   ModbusController.REGTYPE_HOLDING = 0x03  (Read Holding Registers)
//   ModbusController.BE              = "BE"  (big-endian word order)
//   ModbusController.LE              = "LE"  (little-endian word order)

var ENTITIES = [
  //
  // --- <Group label, e.g. "AC Output"> ---
  //
  {
    // Human-readable name shown in the Shelly app / logs
    name: "<Entity Name>",

    // SI unit string displayed alongside the value
    units: "<unit>",           // e.g. "W", "V", "A", "Hz", "%", "degC"

    // Register descriptor
    reg: {
      addr:  0,                // Zero-based register address from the device datasheet

      rtype: ModbusController.REGTYPE_INPUT,
      //      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      //      REGTYPE_INPUT   -> FC 0x04 (read-only process values)
      //      REGTYPE_HOLDING -> FC 0x03 (read/write configuration registers)

      itype: "u16",
      //      ^^^^
      //      "u16"  -> unsigned 16-bit  (1 register)
      //      "i16"  -> signed 16-bit    (1 register, two's complement)
      //      "u32"  -> unsigned 32-bit  (2 consecutive registers)
      //      "i32"  -> signed 32-bit    (2 consecutive registers)

      bo: ModbusController.BE, // byte order within each 16-bit register
      wo: ModbusController.BE, // word order for 32-bit pairs (high word first = BE)
    },

    // Multiply the raw integer by this factor to obtain the physical value.
    // Example: raw = 2350, scale = 0.1  ->  displayed = 235.0 V
    scale: 1,

    // Access rights exported to callers
    rights: "R",               // "R" | "W" | "RW"

    // Shelly virtual-component slot that receives the scaled value.
    // Format: "<type>:<id>"  where type is number | boolean | text | enum
    // Set to null to poll the register without publishing it.
    vcId: "number:<id>",       // e.g. "number:200"

    // Runtime handles — always null in the static definition.
    handle:   null,            // filled by the poll loop
    vcHandle: null,            // filled by Shelly.addVirtualComponent (Shelly mode)
  },

  // --- repeat for every register ---
];
```

### Entity field quick-reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `units` | string | Physical unit |
| `reg.addr` | number | Register start address (0-based) |
| `reg.rtype` | const | `REGTYPE_INPUT` or `REGTYPE_HOLDING` |
| `reg.itype` | string | `"u16"` `"i16"` `"u32"` `"i32"` |
| `reg.bo` | const | Byte order inside a 16-bit word |
| `reg.wo` | const | Word order for 32-bit values |
| `scale` | number | Raw-to-physical multiplier |
| `rights` | string | `"R"` `"W"` `"RW"` |
| `vcId` | string\|null | Virtual component slot |
| `handle` | null | Populated at runtime |
| `vcHandle` | null | Populated at runtime |

---

## 4. Runtime state

```js
var STATE = {
  uart:        null,   // UART handle (Shelly mode only)
  rxBuffer:    [],     // Raw bytes accumulated from the serial port
  pollTimer:   null,   // Repeating timer handle
  entityIndex: 0,      // Pointer to the entity currently being queried
  ready:       false,  // True after init() completes
};
```

---

## 5. Script skeleton

```js
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function debug(msg) {
  if (CONFIG.DEBUG) { print("[DBG] " + msg); }
}

function applyScale(raw, entity) {
  return raw * entity.scale;
}

// ---------------------------------------------------------------------------
// Register read (software mode — replace with real Modbus call)
// ---------------------------------------------------------------------------

function readEntity(entity, callback) {
  // TODO: call ModbusController.read(entity.reg, function(err, raw) { ... })
  // Invoke callback(err, scaledValue) when done.
  callback("not implemented", null);
}

// ---------------------------------------------------------------------------
// Virtual component update (Shelly mode only)
// ---------------------------------------------------------------------------

function publishToVC(entity, value) {
  if (!CONFIG.DRY_RUN && entity.vcHandle !== null) {
    // Shelly.setVirtualComponentValue(entity.vcHandle, value);
  }
  debug(entity.name + " = " + value + " " + entity.units);
}

// ---------------------------------------------------------------------------
// Poll loop — walks ENTITIES one at a time, respecting INTER_FRAME_DELAY
// ---------------------------------------------------------------------------

function pollNext() {
  var entity = ENTITIES[STATE.entityIndex];

  readEntity(entity, function(err, value) {
    if (err) {
      print("[ERR] " + entity.name + ": " + err);
    } else {
      publishToVC(entity, value);
    }

    // Advance to next entity, then schedule the next poll or restart
    STATE.entityIndex = (STATE.entityIndex + 1) % ENTITIES.length;

    if (STATE.entityIndex === 0) {
      // Full cycle done — wait POLL_INTERVAL_MS before starting again
      Timer.set(CONFIG.POLL_INTERVAL_MS, false, pollNext, null);
    } else {
      // Read next register after the inter-frame silence
      Timer.set(CONFIG.INTER_FRAME_DELAY, false, pollNext, null);
    }
  });
}

// ---------------------------------------------------------------------------
// Virtual component registration (Shelly mode only)
// ---------------------------------------------------------------------------

function registerVirtualComponents(callback) {
  var i = 0;
  function next() {
    if (i >= ENTITIES.length) { callback(); return; }
    var e = ENTITIES[i];
    if (e.vcId === null) { i++; next(); return; }
    // Shelly.addVirtualComponent(e.vcId, { name: e.name }, function(handle) {
    //   e.vcHandle = handle;
    //   i++;
    //   next();
    // });
    i++;
    next(); // remove this line when Shelly API is wired in
  }
  next();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  print("[INIT] Starting " + "<Device Name>" + " driver");
  print("[INIT] Slave ID: " + CONFIG.SLAVE_ID);
  print("[INIT] Poll interval: " + CONFIG.POLL_INTERVAL_MS + " ms");

  // 1. Open UART (Shelly mode)
  // STATE.uart = Shelly.openUART({ baud: CONFIG.BAUD_RATE, mode: CONFIG.UART_MODE });

  // 2. Register virtual components, then start polling
  registerVirtualComponents(function() {
    STATE.ready = true;
    STATE.entityIndex = 0;
    print("[INIT] Ready. Polling " + ENTITIES.length + " entities.");
    pollNext();
  });
}

init();
```

---

## 6. Mode selection (Shelly vs software)

The same skeleton runs in both contexts by conditionally branching at the
places marked with `// Shelly mode` comments.

| Feature | Shelly mode | Software mode |
|---------|-------------|---------------|
| UART open | `Shelly.openUART(...)` | Node.js / system serial port |
| Timer | `Timer.set(...)` | `setTimeout(...)` |
| Virtual component | `Shelly.addVirtualComponent(...)` | omit / log only |
| Logging | `print(...)` | `console.log(...)` |

To support both in one file, wrap the platform-specific calls:

```js
var Platform = (typeof Shelly !== "undefined")
  ? {
      setTimer: function(ms, cb) { Timer.set(ms, false, cb, null); },
      log:      function(msg)    { print(msg); },
    }
  : {
      setTimer: function(ms, cb) { setTimeout(cb, ms); },
      log:      function(msg)    { console.log(msg); },
    };
```

---

## 7. Checklist for a new device

- [ ] Fill in the JSDoc header (`@title`, `@description`, `@status`, `@link`)
- [ ] Set `CONFIG.SLAVE_ID` and serial parameters for the target device
- [ ] Populate `ENTITIES` from the device datasheet — one entry per register
- [ ] Choose `reg.itype` and `reg.bo`/`reg.wo` carefully for 32-bit registers
- [ ] Assign non-overlapping `vcId` values (`"number:200"` upward by convention)
- [ ] Wire `ModbusController.read` into `readEntity()`
- [ ] Wire `Shelly.addVirtualComponent` into `registerVirtualComponents()` (Shelly mode)
- [ ] Set `CONFIG.DEBUG: true` during bring-up, `false` in production
- [ ] Verify scaled values match expected physical readings
- [ ] Update `@status` to `production` and add an entry to `CHANGELOG.md`
