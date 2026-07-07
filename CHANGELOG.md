# Changelog

All notable changes to this project will be documented in this file.

## 2026-07
- Clarify Sigenergy SigenStor installation-specific power limits and enum label metadata
- Update Sigenergy SigenStor Virtual Component display order and enum labels for Shelly app rendering
- Add Shelly Cloud measurement/log metadata to the Sigenergy SigenStor Virtual Components
- Enhance the Sigenergy SigenStor MODBUS monitor with load, battery, and operating-mode status Virtual Components
- Add Iconify UI icons to the Sigenergy SigenStor Virtual Components
- Add Sigenergy SigenStor MODBUS-RTU plant monitor for Shelly Pro RS485 Addon with Virtual Component setup

## 2026-05
- Promote Marstek VenusE read-only MODBUS telemetry scripts to production after hardware validation on The Pill
- Add `venus_e_status_vc.shelly.js`, a status-focused Marstek VenusE Virtual Components layout for SOC, limits, temperatures, daily energy, operating state, and alarm/fault count
- Add label-backed Marstek VenusE Virtual Component min/max ranges to the VC setup script and device README
- Correct Marstek VenusE AC frequency scaling to `0.1 Hz` based on live register value
- Add Marstek Venus-E nameplate ratings to device documentation
- Add `the_pill/MODBUS/VALIDATION_PROPOSAL.md` with a reusable validation flow for new MODBUS integrations
- Note that Marstek VenusE signed direction validation requires an office load or charge/discharge test
- Note that Marstek VenusE 32-bit word-order validation remains open until a non-zero load test is available
- Mark both Marstek VenusE reader scripts as hardware-tested for live MODBUS reads
- Mark Marstek VenusE hardware response and Shelly UI screenshot validation as complete
- Mark the Marstek Venus-E 3.0 RJ45 RS485 pinout as physically confirmed in the device docs
- Add Marstek VenusE Virtual Components screenshot section to the device README
- Reduce Marstek VenusE VC script to 10 total Virtual Components so it fits The Pill firmware limits
- Document Marstek Venus-E 3.0 RS485 RJ45 pinout for The Pill wiring
- Move VenusE work under `the_pill/MODBUS/Marstek/VenusE/` and add a Marstek vendor README
- Update The Pill and MODBUS indexes for the new Marstek VenusE folder and the nested V-TAC VT6607103 folder
- Document Marstek VenusE protocol notes, register CSV, and alarm/fault CSV sources
- Add Marstek VenusE alarm/fault bit definitions from `modbus marstek - ex_info.csv` and decode active bits in the console reader
- Update Marstek VenusE MODBUS defaults from the `Venus-E 3.0 485 Protocol` note: address `1`, `115200`, `8N1`
- Add Marstek VenusE MODBUS register documentation, console and Virtual Component telemetry readers, and validation TODOs
- Update `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js` icon mapping so both PV voltage VCs use the larger solar-panel icon and the other Number VCs get explicit voltage, power, and frequency icons
- Remove the temporary `PV1 Input` and `PV2 Input` text-label components from `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js` and keep only the grouped data VCs
- Update `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js` so PV inputs have dedicated visible solar-icon label components alongside their progress bars
- Add `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js`, a Virtual Components variant of the six-register V-TAC example that auto-creates Number VCs and a group on The Pill
- Change the working V-TAC `5790` power scale assumption from `0.1 W` to `0.01 W` in the six-register example, baseline watcher comments, register proposals, and register table
- Add `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example.shelly.js`, a compact six-register console example for the current live V-TAC register candidates
- Comment the latest live-tested V-TAC register hypotheses in `the_pill/MODBUS/V-TAC/VT6607103/vtac_baseline_watch.shelly.js` for ongoing manual validation
- Add `the_pill/MODBUS/V-TAC/VT6607103/vtac_baseline_watch.shelly.js`, an under-development watcher that polls all currently known readable `VT-66036103` holding and input registers and reports deviations from the saved baseline values
- Add `the_pill/MODBUS/V-TAC/VT6607103/vtac_inferred_reader.shelly.js`, an under-development console reader that polls the strongest inferred `VT-66036103` holding registers every 15 seconds
- Move `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` to `the_pill/MODBUS/utils/modbus_register_scan.shelly.js` and document it as a generic MODBUS register-discovery utility
- Add `the_pill/MODBUS/V-TAC/VT6607103/register-proposals.md` with a first-pass inferred register map for `VT-66036103` based on discovered holding registers and public V-TAC/INVT specifications
- Remove KVS persistence from `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js`; keep it as a pure register-discovery utility
- Chunk `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` KVS output across multiple keys so large readable-register arrays fit within Shelly KVS value limits
- Store readable register-address arrays from `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` in Shelly KVS after the discovery run finishes
- Expand `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` register-map discovery to walk `FC03` and `FC04` addresses `0..2000` and test both `9600 8N1` and `115200 8N1` at slave `1`
- Refocus `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` from serial-parameter scanning to register-map discovery: walk `FC03` and `FC04` addresses `0..1000` with single-register reads at known settings `9600 8N1`, slave `1`
- Add `the_pill/MODBUS/V-TAC/vtac_modbus_scan.shelly.js` and `the_pill/MODBUS/V-TAC/README.md` to probe RS485/MODBUS settings for the V-TAC `VT-66036103` hybrid inverter from The Pill
- Promote `http-integrations/ecoflow/stream-ultra/load_balancing_static_vc.shelly.js` and `http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js` to production
- Restructure `http-integrations/tasmota/` into collection and device folders; add README files describing the Shelly-to-Tasmota relationship and move `mitsubishi_heavy_ac_vc.shelly.js` into `http-integrations/tasmota/mitsubishi-heavy-ac/`
- Standardize `http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js` with repository metadata headers, technical documentation block, sectioned Shelly script layout, and anonymized target labels/IP placeholders
- Add `http-integrations/ecoflow/stream-ultra/` with static-config EcoFlow STREAM Ultra load-balancing scripts, screenshot, and README files; add parent `http-integrations/ecoflow/README.md`
- Simplify `the_pill/MODBUS/` documentation by removing duplicated per-device RS485 pinout text and a redundant root index screenshot/list entries

## 2026-04
- Restore `http-integrations/fronius/integration.shelly.js` unchanged and add `http-integrations/fronius/integration-dashboard.shelly.js` as a local-only under-development multi-channel Fronius dashboard variant with 10 VC slots, integrated kWh logging, runtime VC metadata updates, and configurable lookup paths for battery, Wattpilot, and ELWA data
- Fix `http-integrations/fronius/integration.shelly.js` to use Shelly Virtual Component handles with typed VC keys (`number:200`-`number:203`) and restore valid Fronius HTTP polling
- Replace per-device text wiring descriptions with a unified ASCII art diagram in all 23 `the_pill/MODBUS/**/*.shelly.js` examples
- Promote `the_pill/MODBUS/MarsRock/SUN-G2/sun_g2.shelly.js`, `sun_g2_vc.shelly.js`, `wirenboard/WB-MIR-v-3/wb_mir_v3_ir.shelly.js`, `ComWinTop/mb308v.shelly.js`, and `mb308v_vc.shelly.js` to production
- Refactor `the_pill/MODBUS/ComWinTop/mb308v.shelly.js`: replace verbose `ENTITIES` array, `FC` map, and `CRC_TABLE` with compact count variables; update `SLAVE_ID` to 2

## 2026-03
- Promote `the_pill/MODBUS/DFRobot/SEN0492/sen0492.shelly.js` and `sen0492_vc.shelly.js` to production
- Add `the_pill/MODBUS/DFRobot/SEN0492/sen0492.shelly.js` and `sen0492_vc.shelly.js`: MODBUS-RTU console reader and Virtual Component variant for DFRobot SEN0492 RS485 laser ranging sensor (40–4000 mm); add device README and DFRobot vendor README; update MODBUS root README index
- Add `the_pill/MODBUS/GACIA/AICB2SP/aicb2sp.shelly.js`: MODBUS-RTU reader and switch controller for GACIA AICB2SP Smart IoT MCB over RS485; add device README and GACIA vendor README; update MODBUS root README index
- Update `the_pill/README.md` to reflect accurate production/under-development statuses, expand MODBUS subtree with per-device links, and correct YS-IRTM and UART entries to production
- Remove "Under Development" warning from `the_pill/UART/README.md` — script is production
- Add missing `wb_m1w2_v3_vc.shelly.js` to Files and Virtual Component mapping table in `the_pill/MODBUS/wirenboard/WB-M1W2-v3/README.md`
- Add missing `wb_mir_v3_reconfig.shelly.js` to Files in `the_pill/MODBUS/wirenboard/WB-MIR-v-3/README.md`; mark `wb_mir_v3_ir.shelly.js` as under development
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
