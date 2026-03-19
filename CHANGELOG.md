# Changelog

All notable changes to this project will be documented in this file.

## 2026-03
- Promote `http-integrations/finance-yahoo/stock-monitor_vc.shelly.js` to production: rename from `stock-monitor.shelly.js`, fix mJS compatibility (`Number.isFinite` → `isFinite`, `padStart` → `pad2` helper), add screenshot to README
- Add `the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3_ir.shelly.js`, a dedicated under-development IR utility for WB-MIR v3 learn/play/dump/erase operations
- Promote all `the_pill/MODBUS/wirenboard/WB-MIR-v-3/*.shelly.js` scripts to production and add them to `examples-manifest.json`
- Set WB-MIR v3 boolean Virtual Component labels to `OFF` and `ON` via `meta.ui.titles`
- Round all WB-MIR v3 Virtual Component numeric values to one decimal place before updating Shelly VCs
- Change WB-MIR v3 Virtual Component `Supply Voltage` from `mV` to `V` and update its runtime VC metadata so the Shelly UI unit matches
- Remove unused WB-MIR v3 press-counter Virtual Components from `the_pill/MODBUS/wirenboard/WB-MIR-v-3/wb_mir_v3_vc.shelly.js` so its remaining VCs fit on The Pill and can be grouped under `group:200`
- Add `the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_v3_vc.shelly.js` Virtual Components variant of WB-M1W2 v3 reader; promote to production and register in manifest; add Shelly UI screenshot
- Promote `the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_v3.shelly.js` to production and register in manifest
- Update `the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_v3_vc.shelly.js` to apply `meta.ui.unit` to existing number Virtual Components on startup so Shelly UI shows measurement units
- Change `the_pill/MODBUS/wirenboard/WB-M1W2-v3/wb_m1w2_v3_vc.shelly.js` supply voltage Virtual Component from `mV` to `V` and scale MODBUS register 121 accordingly
- Add universal MODBUS-RTU scanner (`the_pill/MODBUS/utils/modbus_scan.shelly.js`): two-phase scan (ping all baud/mode/ID combos) then identify found devices via configurable PROBE_REGS; remove device-specific `wb_m1w2_scan.shelly.js` in favour of this shared utility; add `utils/` README and update MODBUS root README index
- Update `wb_m1w2_scan.shelly.js` scanner to probe all four baud rates (4800/9600/19200/38400) × both stop-bit modes (8N1/8N2), switch probe register to addr 121 (supply voltage, universally present on all Wirenboard devices), and reduce per-attempt timeout from 400 ms to 250 ms
- Add Wirenboard WB-M1W2 v3 MODBUS-RTU scripts (`the_pill/MODBUS/wirenboard/WB-M1W2-v3/`): console reader and slave ID scanner utility; add `WB-M1W2-v3/` README; update wirenboard root README index
- Add Wirenboard WB-MIR v3 MODBUS-RTU scripts (`the_pill/MODBUS/wirenboard/WB-MIR-v-3/`): console reader and Virtual Components variant; add `wirenboard/` and `WB-MIR-v-3/` READMEs; update MODBUS root README index
- Add screenshot sections with descriptive captions to Deye, JK200, and ST802 MODBUS README files
- Promote `the_pill/MODBUS/Deye/deye.shelly.js` to production and fix its header `@link` path
- Promote `the_pill/MODBUS/Deye/deye_vc.shelly.js` to production and fix its header `@link` path
- Promote `the_pill/MODBUS/LinkedGo/ST802/st802_bms.shelly.js` to production and update its header `@link` to the ALLTERCO repository path
- Promote `the_pill/MODBUS/LinkedGo/ST802/st802_bms_vc.shelly.js` to production and update its header `@link` to the ALLTERCO repository path
- Promote `the_pill/MODBUS/JKESS/JK200-MBS/jk200.shelly.js` to production and fix its header `@link` path
- Promote `the_pill/MODBUS/JKESS/JK200-MBS/jk200_vc.shelly.js` to production and fix its header `@link` path
- Change JK200 VC `Pack Current` unit from `mA` to `A` and scale value conversion in `jk200_vc.shelly.js`; update `skills/modbus-vc-deploy.md` JK200 VC table and creation example
- Change JK200 VC `Pack Power` unit from `mW` to `W` and scale value conversion in `jk200_vc.shelly.js`; update `skills/modbus-vc-deploy.md` JK200 VC table and creation example
- Change JK200 VC `Pack Voltage` unit from `mV` to `V` and scale value conversion in `jk200_vc.shelly.js`; update `skills/modbus-vc-deploy.md` VC creation table accordingly
- Update `skills/modbus-vc-deploy.md` to require including all created VCs in `Group.Set` membership so grouped components are visible in Shelly UI
- Add `skills/js-to-shelly-standardize.md` for converting non-standard `.js` files into repository-compliant `.shelly.js` scripts with required headers and doc updates
- Standardize BLE open windows script by renaming `ble/open_windows.js` to `ble/ble-open-windows.shelly.js`, adding standard headers, and aligning code style/structure
- Add `skills/git-commit-merge-cleanup.md` documenting the team Git flow and required local/remote `feature/*` branch cleanup after merges
- Add `http-integrations/finance-yahoo/README.md` with Problem (The Story) and Persona sections for the Yahoo Finance stock monitor example
- Rename `http-integrations/finance-yahoo/stock_monitor 2.js` to `http-integrations/finance-yahoo/stock-monitor.shelly.js` to follow script naming standards
- Remove legacy SDS011 setup/UI scripts and rename `uart_lib_SDS011.js` to `the_pill/SDS011/sds011-vc-cycle.shelly.js`; add standard metadata headers and refresh SDS011 README references
- Add LinkedGo R290 A/W thermal pump MODBUS-RTU example for The Pill (`the_pill/MODBUS/LinkedGo/r290_aw_thermal_pump.shelly.js`) with FC03 polling, FC06 control helpers, and RS485 wiring notes
- Update all `the_pill/MODBUS/**/README.md` files with RS485-for-The-Pill wiring guidance plus `Problem (The Story)` and `Persona` sections; add missing README files for `JKESS`, `LinkedGo`, `LinkedGo/ST802`, and `LinkedGo/R290`
- Add skill document `skills/manifest-verify-tools.md` for strict `tools/`-driven manifest/index verification and regeneration workflow

## 2026-02
- Mark LinkedGo ST802 BMS client as production; add @link, POLL_MODE, POLL_FAN_SPEED, POLL_HUMIDITY flags
- Add LinkedGo ST802 Youth Smart Thermostat Modbus RTU BMS client (`the_pill/MODBUS/LinkedGo/ST802/st802_bms.shelly.js`) with enable-flag mechanism for 8 BMS scenarios
- Add Shelly script deploy and monitor skill document (`skills/shelly-script-deploy.md`)
- Move JK200 BMS script into JKESS/JK200-MBS namespace
- Mark YS-IRTM scripts as production; add all 6 to manifest; remove Under Development banner from README
- Add JK200 BMS MODBUS-RTU reader (`the_pill/MODBUS/JK200-MBS`) with README
- Mark Deye SG02LP1 MODBUS-RTU scripts as production; fix @link URLs; add to manifest; add README
- Auto-set script name on device from original filename in `put_script.py`
- Add default manifest path to `sync-manifest-json.py` based on script location
- Remove non-production `ble/events-to-kvs.shelly.js` from manifest (missing @status)
- Add remote feature branch cleanup rule to AGENTS.md git workflow
- Add dev branch to CI/CD pull_request trigger
- Mark SDS011 examples as under development
- Mark all the_pill examples as under development
- Expand `cury/` README files with per-script use cases and user personas
- Standardize JSDoc metadata headers for all `cury/**/*.shelly.js` scripts (`@title`, `@description`, `@status`, `@link`)
- Reorganize `cury/` examples into `light-language/`, `button-control/`, and `legacy/` folders with README files and duplicate analysis notes
- Add `switch-input/rgbw-remote-controll.shelly.js` and register it in the manifest/index
- Restructure loose HTTP integration scripts into per-script folders with matching README files
- Fix incomplete Prometheus move (update manifest, @link, README, delete old file)
- Move Telegram files into http-integrations/telegram directory
- Clarify in `AGENTS.md` that all commit requests must follow AGENTS rules
- Add Python shebang and UTF-8 encoding headers to all `tools/*.py` scripts
- Remove deprecated `tools/upload-script.sh` and its documentation section
- Enhance put_script.py with full lifecycle (stop, upload, start) and error handling
- Move BLU Assistant and Cury to Collections section in README
- Remove Apache 2.0 license header comments from legacy JS and Python examples
- Add AGENTS.md with coding standards and contribution guidelines
- Reorganize documentation structure (separate CHANGELOG.md, update README.md)
- Add The Pill UART peripheral collection (Roomba, MODBUS, RFID, SDS011/018, YS-IRTM)
- Reorganize JS examples into capability-based folders
- Rename all script files to .shelly.js
- Add BLU presence watcher example
- Add manifest integrity checker tool (check-manifest-integrity.py)

## 2025-11
- Add script that allows to monitor data from Victron's Smartsolar charge controller.

## 2025-05
- Add examples of how to send and receive messages using the LoRa Addon.

## 2024-12
- Update some legacy code to the latest version.

## 2024-11
- Add a universal BLU to MQTT script
- Fixed n-way-dimmer synchronization problem

## 2024-06
- Advanced Load shedding with schedules and notifications
- Add a second meter to advanced load shedding with a companion script
- Monitor Power Outages or Crashed Services
- Updated N-Way Dimmer with JSON fix and documentation

## 2024-04
- Load shedding with Shelly Pro4PM and Pro3EM

## 2023-11
- NTC Conversion example

## 2023-09
- Shelly BLU Motion script example

## 2023-08
- Telegram interaction with Shelly script

## 2023-06
- BLE scanner examples - Aranet2 support

## 2023-05
- BLE scanner examples - Shelly BLU (refactored solution)
- BLE events handler - Scene Manager
- Push notifications example

## 2023-04
- BLE scanner examples - Aranet4 support
- Gateway between Shelly BLU button1 and other devices

## 2023-03
- shell script for uploading scripts on linux and mac
- http handler example

## 2022-12
- Shelly BLU Button example
- Shelly BLU Door Window example

## 2022-11
- BLE scanner examples - ruuvi and b-parasite support

## 2022-09
- Schedule usage scripts and schedule registering scripts

## 2022-03
- HomeAssistant MQTT discovery of sensors

## 2022-01
- HomeAssistant MQTT discovery example
- activation_switch behavior replicated in script

## 2021-11
- Updated wifi-provision to include support for Gen1 devices
- Added relay control based on weather service temperature reading
- Router Watchdog script
- Building block snippets

## 2021-09
- Shelly Scripts demonstrating different script or device capabilities
- `tools/put_script.py` for uploading scripts from the command line.
