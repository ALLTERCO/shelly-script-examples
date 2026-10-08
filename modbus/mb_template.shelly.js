/**
 * @title Modbus RTU Template
 * @description Demonstrates basic Modbus RTU operations for coils, discrete
 *   inputs, holding/input registers, and write operations. Update the register
 *   addresses and payloads for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/mb_template.shelly.js
 */

/**
 * Modbus RTU communication template.
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly devices with Modbus RTU Add-on support.
 *
 * Features:
 * - Read coils and discrete inputs
 * - Read holding and input registers
 * - Write single and multiple registers
 * - Convert 16-bit and 32-bit values
 */

// Update rate (sec)
var UPDATE_RATE = 5;

/*
    🔧 Utility: Split a 16-bit register into two 8-bit bytes (High & Low)
*/
function split16To8(n) {
  n = n & 0xFFFF;
  let high = (n >> 8) & 0xFF;
  let low  = n & 0xFF;
  return [high, low];
}

/*
    🔧 Utility: Combine two 8-bit bytes back into a signed/unsigned 16-bit value
*/
function make16From8(high, low) {
  high = high & 0xFF;
  low  = low & 0xFF;
  return ((high << 8) | low) & 0xFFFF;
}

/*
    📥 Read Coil (Function Code 0x01)
    Used for reading ON/OFF control outputs
*/
function read_coils() {
  MODBUS_ENDPOINT.readRegisters(
    { addr: 0, qty: 1, rtype: ModbusController.REGTYPE_COIL, itype: "u16" },
    function (data, error) {
      if (error) console.log("Coil Read Error: " + error.message, error.code);
      if (data !== undefined) console.log("Coils: " + data);
    }
  );
}

/*
    📥 Read Discrete Inputs (Function Code 0x02)
    Used for reading digital sensor inputs
*/
function read_discrete_inputs() {
  MODBUS_ENDPOINT.readRegisters(
    { addr: 0, qty: 1, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "u16" },
    function (data, error) {
      if (error) console.log("DI Read Error: " + error.message, error.code);
      if (data !== undefined) console.log("Discrete Input: " + data);
    }
  );
}

/*
    📥 Read Holding Register (Function Code 0x03)
    Used for configuration parameters and control settings
*/
function read_holding_register() {
  MODBUS_ENDPOINT.readRegisters(
    { addr: 0, qty: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
    function (data, error) {
      if (error) console.log("HR Read Error: " + error.message, error.code);
      if (data !== undefined) console.log("Holding Register: " + data);
    }
  );
}

/*
    📥 Read Input Register (Function Code 0x04)
    Used for real-time sensor data (voltage, current, power)
*/
function read_input_register() {
  MODBUS_ENDPOINT.readRegisters(
    { addr: 0, qty: 1, rtype: ModbusController.REGTYPE_INPUT, itype: "u16" },
    function (data, error) {
      if (error) console.log("IR Read Error: " + error.message, error.code);
      if (data !== undefined) console.log("Input Register: " + data);
    }
  );
}

/*
    ✍ Write Single Coil (Function Code 0x05)
    ON/OFF commands (like relay control)
*/
function write_single_coils() {
  MODBUS_ENDPOINT.writeRegisters(
    { addr: 0, rtype: ModbusController.REGTYPE_COIL, itype: "u16" },
    [1],
    function (data, error) {
      if (error) console.log("Write Single Coil Error: " + error.message, error.code);
      if (data !== undefined) console.log("Write Coil Response: " + data);
    }
  );
}

/*
    ✍ Write Single Holding Register (Function Code 0x06)
    Used for adjusting configuration parameters
*/
function write_single_holding_register() {
  MODBUS_ENDPOINT.writeRegisters(
    { addr: 0, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
    [1],
    function (data, error) {
      if (error) console.log("Write HR Error: " + error.message, error.code);
      if (data !== undefined) console.log("Write HR Response: " + data);
    }
  );
}

/*
    ✍ Write Multiple Coils (Function Code 0x0F)
    Batch ON/OFF commands
*/
function write_multiple_coils() {
  MODBUS_ENDPOINT.writeRegisters(
    { addr: 0, rtype: ModbusController.REGTYPE_COIL, itype: "u16" },
    [1,0,1,0,1,0,1,0],
    function (data, error) {
      if (error) console.log("Write Coils Error: " + error.message, error.code);
      if (data !== undefined) console.log("Write Coils Response: " + data);
    }
  );
}

/*
    ✍ Write Multiple Holding Registers (Function Code 0x10)
    Batch write of configuration registers
*/
function write_multiple_holding_registers() {
  MODBUS_ENDPOINT.writeRegisters(
    { addr: 0, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
    [1,0,1,0,1,0,1,0],
    function (data, error) {
      if (error) console.log("Write HRs Error: " + error.message, error.code);
      if (data !== undefined) console.log("Write HRs Response: " + data);
    }
  );
}

/*
    🔄 Polling update
*/
function update() {
  read_coils();
  read_discrete_inputs();
  read_holding_register();
  read_input_register();
  write_single_coils();
  write_single_holding_register();
  write_multiple_coils();
  write_multiple_holding_registers();
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  let device_type = 250;
  console.log("Device Type: 0x" + device_type.toString(16).toUpperCase());
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();
