/**
 * @title Universal MODBUS-RTU Scanner
 * @description Discovers MODBUS-RTU slave devices by scanning all combinations
 *   of baud rate, mode, and slave IDs using the native Shelly ModbusController.
 *   After finding a device, reads PROBE_REGS to help identify the device type.
 *   Works with any vendor.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/utils/modbus_scan.shelly.js
 */

/**
 * Universal MODBUS-RTU Scanner
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Two-phase operation:
 *
 *   Phase 1 - SCAN:
 *     Sends a generic ping (FC 0x03, addr 0, qty 1) to every combination of
 *     baud rate, mode, and slave ID. Any valid MODBUS response - including
 *     an exception reply - confirms a device at that address.
 *
 *   Phase 2 - IDENTIFY:
 *     For each found device, reads PROBE_REGS in order and prints every
 *     successful register read to help identify the device type.
 *
 * Customization tips:
 *   - Reduce CONFIG.BAUDS / CONFIG.MODES to speed up the scan.
 *   - Lower CONFIG.ID_END if slave IDs are known to be small.
 *   - Add vendor-specific entries to PROBE_REGS for better identification.
 *
 * Note on the dynamic-slave-ID Virtual Component convention used elsewhere in
 * this repo: this script is intentionally excluded from it. Its whole purpose
 * is to sweep CONFIG.ID_START..CONFIG.ID_END looking for a device, so there is
 * no single "current slave ID" to expose as a persisted setting.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  // Baud rates to scan. Remove entries to speed up the sweep.
  BAUDS: [4800, 9600, 19200, 38400, 115200],

  // UART modes: data bits + parity + stop bits.
  MODES: ["8N1", "8N2", "8E1", "8O1"],

  // Slave ID range (MODBUS valid range: 1-247).
  ID_START: 1,
  ID_END: 30,

  // Timeout waiting for ping response (ms). Raise on noisy or slow lines.
  PING_TIMEOUT_MS: 200,

  // Timeout for each PROBE_REGS read during identify phase (ms).
  PROBE_TIMEOUT_MS: 500,

  // Inter-request gap between consecutive requests (ms).
  INTER_FRAME_MS: 20
};

/* === PROBE REGISTERS ===
 *
 * Read from each confirmed device during the IDENTIFY phase.
 * Entries are tried in order; every successful read is printed.
 * A timeout or exception is silently skipped.
 *
 * Each entry: { name, rtype, addr, qty }
 *   rtype - ModbusController.REGTYPE_HOLDING or REGTYPE_INPUT
 *   addr  - register start address (decimal)
 *   qty   - number of 16-bit registers to read (1-125)
 */
var PROBE_REGS = [
  // --- Generic probes (work on most devices) ---
  { name: "Holding[0]", rtype: ModbusController.REGTYPE_HOLDING, addr: 0, qty: 2 },
  { name: "Input[0]", rtype: ModbusController.REGTYPE_INPUT, addr: 0, qty: 2 },

  // --- Wirenboard devices (WB-MIR, WB-M1W2, WB-M*, etc.) ---
  { name: "WB Supply Voltage", rtype: ModbusController.REGTYPE_INPUT, addr: 121, qty: 1 },
  { name: "WB MCU Temperature", rtype: ModbusController.REGTYPE_INPUT, addr: 124, qty: 1 },
  { name: "WB Model String", rtype: ModbusController.REGTYPE_INPUT, addr: 200, qty: 8 },

  // --- Deye / Solis / SolarmanV5 inverters ---
  { name: "Deye Device Type", rtype: ModbusController.REGTYPE_HOLDING, addr: 3, qty: 1 },

  // --- ComWinTop CWT-MB308V ---
  { name: "CWT Input[0]", rtype: ModbusController.REGTYPE_INPUT, addr: 0, qty: 4 },

  // --- JK BMS (JK-PB series) ---
  { name: "JK SOC", rtype: ModbusController.REGTYPE_HOLDING, addr: 0x1298, qty: 1 },

  // --- LinkedGo ST802 thermostat ---
  { name: "LinkedGo Temp", rtype: ModbusController.REGTYPE_HOLDING, addr: 0, qty: 2 }
];

/* === STATE === */
var sc = {
  phase: "scan", // 'scan' | 'identify' | 'done'

  // scan phase
  baudIdx: 0,
  modeIdx: 0,
  slaveId: 0, // set to CONFIG.ID_START in init
  found: [], // [{ id, baud, mode }]

  // identify phase
  foundIdx: 0,
  probeIdx: 0
};

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

// Decode register values as ASCII where printable (Wirenboard model strings etc.)
function regsToAscii(regs) {
  var s = "";
  var i;
  var b;
  for (i = 0; i < regs.length; i++) {
    b = (regs[i] >> 8) & 0xFF;
    if (b >= 0x20 && b < 0x7F) s += String.fromCharCode(b);
    b = regs[i] & 0xFF;
    if (b >= 0x20 && b < 0x7F) s += String.fromCharCode(b);
  }
  return s.length > 0 ? '"' + s + '"' : "";
}

function regsToHex(regs) {
  var s = "";
  var i;
  for (i = 0; i < regs.length; i++) {
    if (i > 0) s += " ";
    s += "0x" + toHex16(regs[i]);
  }
  return s;
}

/* ================================================================
 * PHASE 1 - SCAN
 * ================================================================ */

function sendPing() {
  var baud = CONFIG.BAUDS[sc.baudIdx];
  var mode = CONFIG.MODES[sc.modeIdx];
  var endpoint = ModbusController.get(sc.slaveId, { baud: baud, mode: mode });
  var timedOut = false;
  var timer;

  timer = Timer.set(CONFIG.PING_TIMEOUT_MS, false, function() {
    timedOut = true;
    Timer.set(CONFIG.INTER_FRAME_MS, false, advanceScan);
  });

  endpoint.readRegisters({ rtype: ModbusController.REGTYPE_HOLDING, addr: 0, qty: 1 }, function(result, error) {
    if (timedOut) return;
    Timer.clear(timer);

    if (result !== undefined && result !== null) {
      print("  *** FOUND: slave=" + sc.slaveId + "  baud=" + baud + "  mode=" + mode + " -> OK ***");
      sc.found.push({ id: sc.slaveId, baud: baud, mode: mode });
    } else if (error) {
      // A MODBUS exception reply still confirms a device is present on the bus.
      if (typeof error === "object" && error !== null && error.code !== undefined) {
        print("  *** FOUND: slave=" + sc.slaveId + "  baud=" + baud + "  mode=" + mode + " -> exception " + error.code + " ***");
        sc.found.push({ id: sc.slaveId, baud: baud, mode: mode });
      }
    }

    Timer.set(CONFIG.INTER_FRAME_MS, false, advanceScan);
  });
}

function advanceScan() {
  sc.slaveId++;

  if (sc.slaveId > CONFIG.ID_END) {
    sc.slaveId = CONFIG.ID_START;
    sc.modeIdx++;

    if (sc.modeIdx >= CONFIG.MODES.length) {
      sc.modeIdx = 0;
      sc.baudIdx++;

      if (sc.baudIdx >= CONFIG.BAUDS.length) {
        // Scan complete -- move to identify phase
        print("");
        print("Scan complete. Found: " + sc.found.length + " device(s).");
        if (sc.found.length === 0) {
          printSummary();
          return;
        }
        sc.phase = "identify";
        sc.foundIdx = 0;
        sc.probeIdx = 0;
        Timer.set(CONFIG.INTER_FRAME_MS, false, startIdentify);
        return;
      }
    }

    print("");
    print("--- " + CONFIG.BAUDS[sc.baudIdx] + " baud  " + CONFIG.MODES[sc.modeIdx] + " ---");
  }

  Timer.set(CONFIG.INTER_FRAME_MS, false, sendPing);
}

/* ================================================================
 * PHASE 2 - IDENTIFY
 * ================================================================ */

function startIdentify() {
  if (sc.foundIdx >= sc.found.length) {
    printSummary();
    return;
  }

  var dev = sc.found[sc.foundIdx];
  print("");
  print("Identifying slave=" + dev.id + "  baud=" + dev.baud + "  mode=" + dev.mode);
  sc.probeIdx = 0;
  Timer.set(CONFIG.INTER_FRAME_MS * 5, false, sendProbe);
}

function sendProbe() {
  if (sc.probeIdx >= PROBE_REGS.length) {
    sc.foundIdx++;
    Timer.set(CONFIG.INTER_FRAME_MS, false, startIdentify);
    return;
  }

  var dev = sc.found[sc.foundIdx];
  var probe = PROBE_REGS[sc.probeIdx];
  var endpoint = ModbusController.get(dev.id, { baud: dev.baud, mode: dev.mode });
  var timedOut = false;
  var timer;

  timer = Timer.set(CONFIG.PROBE_TIMEOUT_MS, false, function() {
    timedOut = true;
    sc.probeIdx++;
    Timer.set(CONFIG.INTER_FRAME_MS, false, sendProbe);
  });

  endpoint.readRegisters({ rtype: probe.rtype, addr: probe.addr, qty: probe.qty }, function(result, error) {
    if (timedOut) return;
    Timer.clear(timer);

    if (result !== undefined && result !== null) {
      var hex = regsToHex(result);
      var ascii = regsToAscii(result);
      var line = "  [" + probe.name + "] addr=0x" + toHex16(probe.addr) + " -> " + hex;
      if (ascii) line += "  " + ascii;
      print(line);
    }
    // Exception or timeout: register not implemented; skip silently.

    sc.probeIdx++;
    Timer.set(CONFIG.INTER_FRAME_MS, false, sendProbe);
  });
}

/* ================================================================
 * SUMMARY
 * ================================================================ */

function printSummary() {
  var i;
  var d;

  print("");
  print("========================================");
  print("MODBUS Scan Summary");
  print("========================================");

  if (sc.found.length === 0) {
    print("No devices found.");
    print("Check: wiring, power supply, baud rate range, slave ID range.");
  } else {
    print("Devices found: " + sc.found.length);
    for (i = 0; i < sc.found.length; i++) {
      d = sc.found[i];
      print("  slave=" + d.id + "  baud=" + d.baud + "  mode=" + d.mode);
    }
  }

  print("");
  print("To use a found device, set in your reader script:");
  print("  ModbusController.get(<slave>, { baud: <baud>, mode: '<mode>' })");
  print("========================================");
}

/* ================================================================
 * INIT
 * ================================================================ */

function init() {
  print("");
  print("Universal MODBUS-RTU Scanner");
  print("============================");
  print("Bauds:   " + CONFIG.BAUDS.join(", "));
  print("Modes:   " + CONFIG.MODES.join(", "));
  print("IDs:     " + CONFIG.ID_START + " - " + CONFIG.ID_END);
  print("Combos:  " + (CONFIG.BAUDS.length * CONFIG.MODES.length * (CONFIG.ID_END - CONFIG.ID_START + 1)));
  print("");

  sc.slaveId = CONFIG.ID_START;

  print("--- " + CONFIG.BAUDS[0] + " baud  " + CONFIG.MODES[0] + " ---");
  Timer.set(300, false, sendPing);
}

init();
