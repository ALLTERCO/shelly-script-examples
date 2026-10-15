# ModbusController API

The `ModbusController` class provides an interface for interacting with Modbus RTU devices from Espruino JavaScript.

## Static Properties

| Property                      | Type | Description                       |
|-------------------------------|------|-----------------------------------|
| `ModbusController.BE`         | int  | Byte order identifier: Big Endian |
| `ModbusController.LE`         | int  | Byte order identifier: Little Endian |
| `ModbusController.REGTYPE_COIL`           | int  | Register type identifier for Coils |
| `ModbusController.REGTYPE_DISCRETEINPUT`  | int  | Register type identifier for Discrete Inputs |
| `ModbusController.REGTYPE_HOLDING`        | int  | Register type identifier for Holding Registers |
| `ModbusController.REGTYPE_INPUT`          | int  | Register type identifier for Input Registers |
| `ModbusController.POLL_FASTEST`           | int  | How often to poll: as often as possible |
| `ModbusController.POLL_ONCE`              | int  | How often to poll: (once) |
| `ModbusController.POLL_NEVER`             | int  | How often to poll: (never) |

---

## Static Methods

### `ModbusController.get(server_id, opts)`

- **Parameters:**
  - `server_id` (int): Modbus server address.
  - `opts` (object): Server-wide settings.
- **Returns:** `ModbusController` instance for the given server.

---

## Controller Options

The `opts` object accepted by `ModbusController.get(server_id, opts)` and `setOptions(opts)` can include the following fields:

### Top-level options

| Option      | Type    | Default | Description |
|-------------|---------|---------|-------------|
| `pause_ms`  | int     | 100     | Minimum time in milliseconds between Modbus requests. |
| `serial`    | object  |         | Serial port configuration (see below). |

### `serial` object options

| Option      | Type    | Default | Description |
|-------------|---------|---------|-------------|
| `baud`      | int     | 9600    | Baud rate for the serial port (e.g., 9600, 19200, 38400, 115200, etc.). |
| `mode`      | string  | "8N1"  | UART mode string, specifying data bits, parity, and stop bits. |

#### UART `mode` string
- Format: `<data bits><parity><stop bits>` (e.g., `8N1`, `8E1`, `8O2`)
  - **Data bits:** `7`, `8`, or `9`
  - **Parity:** `N` (None), `E` (Even), `O` (Odd)
  - **Stop bits:** `1`, `2`, or `x` (for 1.5 stop bits)
- **Examples:**
  - `8N1` (8 data bits, no parity, 1 stop bit)
  - `8E1` (8 data bits, even parity, 1 stop bit)
  - `8O2` (8 data bits, odd parity, 2 stop bits)
  - `7E1` (7 data bits, even parity, 1 stop bit)

If an invalid mode string is provided, an exception will be thrown.

---

## Instance Methods

### `setOptions(opts)`

Set or update options for the controller.

- **Parameters:**
  - `opts` (object): Server-wide settings.
- **Returns:** None

### `addEntity(desc)`

Add a Modbus entity (register, coil, etc.) to the controller.

- **Parameters:**
  - `desc` (object): Item descriptor (e.g., `{ addr, rtype, itype, bo, wo, ...`).
- **Returns:** `MbEntity` handle.

### `readRegisters(desc, cb)`

Read registers from the Modbus server.

- **Parameters:**
  - `desc` (object): `{ rtype, addr, qty }` - Register type, address, and quantity.
  - `cb` (function): Callback with signature `(result: array | undefined, error: {code: int, message: str} | undefined)`.
- **Returns:** None (result is provided via callback)

### `writeRegisters(desc, values, cb)`

Write registers to the Modbus server.

- **Parameters:**
  - `desc` (object): `{ rtype, addr, qty }` - Register type, address, and quantity.
  - `values` (array): Values to write.
  - `cb` (function): Callback with signature `(success: bool, error: {code: int, message: str} | undefined)`.
- **Returns:** None (result is provided via callback)

---

# MbEntity API

The `MbEntity` class represents a single Modbus entity (a data view on registers) managed by the controller.

## Instance Methods

### `value()`

Get the last known value of the entity.

- **Parameters:** None
- **Returns:** Last known value of the entity.

### `getValue()`

Get the last known value of the entity. (Alias for `value()`.)

- **Parameters:** None
- **Returns:** Last known value of the entity.

### `lastPoll()`

Get the uptime (ms) of the last read.

- **Parameters:** None
- **Returns:** Uptime (ms) of the last read.

### `readOnce()`

Force a single read of the entity.

- **Parameters:** None
- **Returns:** None

### `write(value, cb)`

Write a value to the entity.

- **Parameters:**
  - `value`: Value to write.
  - `cb` (function): Callback with signature `(success: bool, error: {code: int, message: str} | undefined)`.
- **Returns:** None (result is provided via callback)

### `on(event, cb)`

Subscribe to entity events.

- **Parameters:**
  - `event` (string): Event to attach to.
  - `cb` (function): Callback function.
- **Returns:** Subscription handle (int).

#### Accepted Events

| Event     | Triggered When                                      |
|-----------|-----------------------------------------------------|
| `change`  | The value of the entity changes (after polling/read) |
| `error`   | An error occurs during polling or reading            |

- The `change` event callback receives the new value as its argument.
- The `error` event callback receives an error object `{code, message}`.

### `remove()`

Remove the entity from the controller.

- **Parameters:** None
- **Returns:** None

---

## Example Usage

```js
// Get a controller for server ID 1
let ctrl = ModbusController.get(1, { baud: 9600 });

// Add a holding register entity at address 100
let entity = ctrl.addEntity({ addr: 100, rtype: ModbusController.REGTYPE_HOLDING });

// Create or get a virtual component handle (e.g., for a virtual sensor)
let vcomp = Virtual.getHandle("my_virtual_sensor");

// Read value
entity.readOnce();

// Listen for value changes and reflect them into the virtual component
entity.on('change', (entityHandle) => {
  console.log('Value changed:', entityHandle.value());
  vcomp.setValue(val); // Update the virtual component with the new value
});

// Write value
entity.write(42, (success, err) => {
  if (success) console.log('Write successful');
  else console.error('Write failed', err);
});
```

---

**Note:** All callbacks receive an error object with `{code, message}` if an error occurs.

