# Changelog

All notable changes to this project will be documented in this file.

## 2026-09
- Convert every classical self-provisioning Virtual Component script under `modbus/` to the firmware-managed `@meta`/`Script.getVcHandle` pattern, then delete the superseded classical originals and drop the now-redundant `_managed`/`_managed_vc` filename suffix repo-wide, since each script now has exactly one managed-VC version at its original filename
  - LG THERMA V (`lg-therma-v-pro-em50_vc.shelly.js`) and Sigenergy SigenStor (`sigenstor_plant_vc.shelly.js`) keep `@status production`, since that's what their classical predecessors had; every other converted script stays `@status under development` pending hardware testing
  - The two VC-free WB-MIR utility scripts (IR utility, reconfig utility) gained a persisted `slaveId` Virtual Component during conversion and took over their original filenames; every other VC-free diagnostic/reference script (register-table dumps, scan utilities) is left untouched, since it never used Virtual Components to begin with
  - Fixes a pre-existing `@link` typo in `sg02lp1_vc.shelly.js` that pointed at a nonexistent doubled `_vc_managed_vc` path
- Add a separate Marstek VenusE controller using a fully managed seven-role Virtual Component dashboard and portable `MbRtuClient` RPC telemetry/control; keep the complete `@meta vc` declaration on the first line at exactly the firmware's 1024-character limit, add repository design rules and integrity enforcement for managed metadata, and document that tested Pill Gen3 firmware 2.0.1-ge1a198b reboots on managed-VC script startup
- Replace the Marstek VenusE control buttons with a Charge / Stop / Discharge Virtual Component dropdown, migrate obsolete controls automatically, preserve the persisted power setting across script restarts, use spaced Pill FC06 writes for Gen3-compatible VenusE control, and release RS485 control on Stop
- Add `mqtt/mqtt-jaalee-jht-bridge.shelly.js`, a bridge script that parses Jaalee JHT BLE sensor data (temperature/humidity/battery) via Shelly BLU Gateway and publishes to Home Assistant via MQTT Auto-Discovery
- Add `power-energy/victron-ble-bridge.shelly.js` (upstream PR #217 by Thiemo van Engelen, Victron Energy): a BLE bridge that forwards BLE advertisement data to a Victron GX device over HTTPS, making bridged sensors appear under Settings → Bluetooth Sensors. Requires Shelly firmware 1.5.0+ and GX firmware 3.80+; configured through Virtual Components where supported, otherwise a `venus-host` KVS key. Cherry-picked from `upstream/main` and adapted to the fork's standard two-header JSDoc convention
- Backport upstream PR #211 (tscofield): wrap the `HTTP.POST`, `KVS.Set`, and `syncKVSToAll` paths in `switch-input/n-way-dimmer.shelly.js` in try/catch so a failed remote call logs instead of throwing
- Sync with `upstream/main` (ALLTERCO PRs up to #223): add `modbus/LG/lg-therma-v-pro-em50_vc.shelly.js` (LG THERMA V heat pump bridge for Shelly Pro EM-50), `power-energy/pro4pm-load-shedding.shelly.js` (single-device Pro 4PM load shedding, reverse-priority channel restore), and `ble/blu-gateway-bthome-to-mqtt.shelly.js` (BLU Gateway BTHome advertisements to MQTT); pull in a fix (upstream PR #216) across 15 `ble/` scripts for firmware 2.0.0+ removing the global `ble.enable` config flag — each script now checks for an explicit `false` instead of falsy/undefined, so it no longer aborts at startup on 2.0.0+

## 2026-08
- Tag `modbus/` and `the_pill/MODBUS/` scripts in `examples-manifest.json` so the library search can distinguish them: `modbus-controller` for the native Shelly `ModbusController` API + hardware add-on, `modbus-software` for `the_pill/MODBUS/`'s hand-rolled UART-based MODBUS-RTU library. Applied to the 1 `modbus/` and 25 `the_pill/MODBUS/` entries currently in the manifest (only `@status production` files are indexed; the rest of `modbus/` is still `@status under development` and stays out of the manifest until promoted)
- Make the Modbus slave/unit ID dynamic across every `modbus/` script instead of a hardcoded constant: expose it as a persisted `number:299` Virtual Component (min 1, max 247, precise numeric `input` view rather than a slider) carrying a `modbus_id` role tag for generic tooling discovery; a shared `getSlaveId()` helper reads the component live on every use, clamps/rounds it into range, and writes the clamped value back if it was out of range
  - Continuously-polled scripts rebuild their `ModbusController` endpoint (and re-register all entities) whenever the slave-ID Virtual Component fires a `change` event, so a reconfigured ID takes effect without a script restart
  - Applied to 97 scripts across every device folder, covering every architecture in the repo: `addEntity`-based dashboards, one-shot `readRegisters`/`writeRegisters` readers, module-scope single-entity examples, BMS command-simulation write logic (LinkedGo ST802), and HTTP-relayed control sequences (Marstek VenusE, SHEKRAN display, Deye/Growatt mode selectors)
  - "Print-only, no data VC" scripts (register-table dumps, CLI examples, diagnostic scans) still get a slave-ID-only Virtual Component, since the ID is configuration, not sensor data
  - `modbus/http-bridge/modbus_http_bridge.shelly.js` gets a lighter-weight treatment: only its per-request fallback default slave ID is now dynamic, since the bridge already accepts a `slave` override per request and builds a fresh endpoint each call
  - `modbus/utils/modbus_scan.shelly.js` is intentionally excluded and documented as such: its entire purpose is sweeping a range of slave IDs looking for a device, so there is no single "current slave ID" to expose. `modbus/utils/modbus_register_scan.shelly.js` (fixed slave ID, sweeps register addresses instead) and `modbus/mb_structure_entities.shelly.js` do get the dynamic treatment; `modbus/mb_template.shelly.js` is left alone as a genuinely incomplete placeholder that never declares a Modbus endpoint
  - Fixed a pre-existing bug (unrelated to this change, found while touching these files): 21 scripts across Deye SG01HP3/SG03LP1/SG04LP3 and all 4 Growatt device folders referenced `MODBUS_ENDPOINT`/`UPDATE_RATE` without ever declaring them
- Make the Modbus slave/unit ID dynamic across `the_pill/MODBUS/` (the raw-UART, hand-rolled-library counterpart to `modbus/`'s native `ModbusController` rollout): replace every hardcoded `CONFIG.SLAVE_ID`/`CONFIG.SLAVE_CURRENT`/`CONFIG.SLAVE_TARGET`/`CONFIG.DEFAULT_SLAVE` with a persisted `number:299` Virtual Component (range 1-247, numeric `input` view, `modbus_id` role tag), read live via a shared `getSlaveId()` helper at every `buildFrame(...)` call site
  - Applied to 32 scripts across every device folder: plain readers, existing `_vc.shelly.js` dashboards (`AUTO_VC_GROUP_ID`/`buildVirtualComponentsManifest()` pattern), inline-array frame builders (Marstek VenusE x4, V-TAC six-register x2), GACIA AICB2SP's dual read/write frame builders, and the HTTP bridge (lighter default-only treatment, since it already accepts a per-request `slave` override)
  - `ComWinTop/mb308v.shelly.js`'s auto-scan-on-boot logic now writes each candidate ID straight into the Virtual Component instead of a local `CONFIG.SLAVE_ID` field, so `getSlaveId()` (used by `buildFrame()`) picks up the candidate mid-scan and the discovered ID ends up persisted
  - `wirenboard/WB-MIR-v-3/wb_mir_v3_reconfig.shelly.js` gets two Virtual Components instead of one (`number:299` current + `number:298` target), since this utility genuinely needs both the ID it's currently talking to the device on and the ID it's reconfiguring the device to
  - `utils/modbus_scan.shelly.js` is intentionally excluded and documented, matching its `modbus/` counterpart: it sweeps a slave-ID range by design, so there is no single "current slave ID" to expose; its post-scan help text now points at the Virtual Component instead of the old `CONFIG.SLAVE_ID` field
  - `modbus_rtu.shelly.js` (the shared library) is left untouched: its public API already takes `slave` as an explicit per-call parameter, and its unused `CONFIG.DEFAULT_SLAVE` constant is dead config, not a hardcoded ID
- Add `ble/ble-blu-button-presence_vc.shelly.js`, a Shelly BLU button presence watcher that tracks paired `bthomedevice` beacons and auto-creates a Boolean Virtual Component group for nearby/away state
- Document the BLU button presence watcher step by step in `ble/README.md`, including the native Shelly Webhook (`boolean.change`) pattern for local "away" actions, keeping the published script free of hardcoded URLs
- Update `http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js` to the new Mitsubishi Heavy AC auto-send workflow, target mapping, and reduced VC set; refresh its README and manifest description
- Anonymize Mitsubishi Heavy AC example Tasmota target IP addresses to TEST-NET placeholders in the script and README
- Add a self-deploying `*_vc.shelly.js` companion script to every device folder under `modbus/` (Deye SG01HP3/SG02LP1/SG03LP1/SG04LP3, Growatt MIC_2500TL-X/MIN_4200TL-XE/SFP5000/SPH_10000TL3_BH-UP, Huawei SUN-2000, IGEN DTSD422, MarsRock G2 SUN Series, ComWinTop CWT-MB308V, CyberPower CP1600EPFCLCD): reads the full documented register set every poll (printed to console) and self-deploys the 9 most valuable parameters as a grouped Virtual Components dashboard via the standard `ensureVirtualComponents` helper, replacing the previous `Virtual.getHandle`-only assumption that components already existed
- Restore standard JSDoc headers (`@title`/`@description`/`@status`/`@link`) on 66 existing `modbus/` scripts that had lost them
- Fix a stale `@link` pointing at `the_pill/MODBUS/...` on the MarsRock G2 SUN Series reader
- Document the new per-device `*_vc.shelly.js` pattern in `modbus/README.md`
- Make every remaining single-purpose `modbus/` script self-deploy its own Virtual Component(s) for whatever it reads, instead of assuming components already exist:
  - Rewire 33 `ENTITIES`-array scripts across CyberPower CP1600EPFCLCD, Deye SG01HP3/SG02LP1/SG03LP1/SG04LP3, and Growatt MIC_2500TL-X/MIN_4200TL-XE/SFP5000/SPH_10000TL3_BH-UP to build a number-type Virtual Component (+ group) for every register they read via `ensureVirtualComponents`
  - Rebuild the 5 raw Huawei SUN-2000 register-table fragments (`get_grid`, `get_pv`, `get_energy`, `device_state`, `get_inverter_status`) into complete, standalone, self-deploying scripts with a MODBUS endpoint, polling loop, and Virtual Components dashboard (previously just bare arrays with no runnable scaffolding)
  - Add per-channel self-deploying Virtual Components to the 5 ComWinTop CWT-MB308V single-channel examples (`example_discrete_inputs`, `example_input_register`, `example_write_holding_register`, `example_discrete_outputs`, `example_pot_anim`), fixing two of them that assumed a pre-existing `number:200` component
  - Fix 7 Deye/Growatt `application_examples` scripts (`display_virtual_components` x2, `display_virtual_components_ui_async`, `external_display`, `shekran/shekran`, `vc_modes_deye`, `vc_modes_growatt`) that previously called `Virtual.getHandle` on components assumed to already exist; the two `vc_modes_*` scripts now self-deploy `enum`-type Virtual Components for their mode selectors
  - Leave `print_parameters.shelly.js`, `example_cli.shelly.js`, and `diagnostic_register_scan.shelly.js` intentionally Virtual-Component-free: their stated purpose is a console-only readout or a one-shot register scan with no fixed named parameters, matching the existing `entire_modbus_table.shelly.js`/`all_registes.shelly.js` exception
  - Leave `get_battery.shelly.js` (Huawei), `get_regs.shelly.js`, `get_env.shelly.js`, and `get_inverter_settings.shelly.js` untouched: the first duplicates the other 5 Huawei fragments combined (treated like an entire-table reference), the other three still contain `TODO` placeholder register addresses that cannot be legitimately turned into working Virtual Components without fabricating hardware data
- Adapt the `the_pill/MODBUS/` examples (raw UART + hand-rolled MODBUS-RTU library) to the native Shelly `ModbusController` API under `modbus/`, each with a self-deploying Virtual Components dashboard: Davis Pyranometer, DFRobot SEN0492, GACIA AICB2SP, JKESS JK200-MBS, LinkedGo R290 thermal pump, LinkedGo ST802 thermostat + BMS command simulation, Marstek VenusE (plus a dedicated charge/discharge control script), V-TAC VT6607103, Wirenboard WB-M1W2-v3, and Wirenboard WB-MIR-v3
  - Skip ComWinTop MB308V, Deye SG02LP1, and MarsRock SUN-G2: already ported to `modbus/` from this same source earlier in the session
  - Also port the vendor-agnostic `modbus_scan.shelly.js` and `modbus_register_scan.shelly.js` discovery utilities to `modbus/utils/`, and the `modbus_http_bridge.shelly.js` HTTP-to-MODBUS bridge to `modbus/http-bridge/`, all rebuilt on the native `ModbusController` API (the HTTP bridge in particular drops hundreds of lines of manual CRC/byte-order encode-decode logic now handled internally by the controller)
  - Update `modbus/README.md` with the newly ported device folders
- Equalize `modbus/` with `the_pill/MODBUS/` by porting the 5 remaining device scripts initially skipped as lower-priority: `venus_e_status_vc.shelly.js` (Marstek's operational-status VC dashboard, a distinct curated layout from `venus_e_vc.shelly.js`'s live-power-flow one), `vtac_baseline_watch.shelly.js` and `vtac_inferred_reader.shelly.js` (V-TAC register-discovery/validation tools), and `wb_mir_v3_ir.shelly.js`/`wb_mir_v3_reconfig.shelly.js` (WB-MIR v3 IR learn/play/dump/erase and baud/slave-ID reconfiguration utilities) - `modbus/` now has full 1:1 parity with `the_pill/MODBUS/` (excluding the raw `modbus_rtu.shelly.js` library itself, which has no native-API equivalent to port)

## 2026-07-29

- Remove setup-only Virtual Component scripts after merging VC creation into the runtime applications
- Merge BLU assistant demo VC creation into `add-to-wifi.shelly.js`, `full-config.shelly.js`, and `config-mqtt.shelly.js`
- Add `_vc.shelly.js` self-provisioning variants for BLE open windows, Fronius grid/dashboard, Victron MPPT, Roomba, and YS-IRTM examples
- Move EcoFlow STREAM Ultra static VC script onto the shared Virtual Component helper so it creates, verifies, groups, and reuses dashboard components consistently

## 2026-07
- Migrate runtime Virtual Component examples to self-create, verify, repair, group, and bind their own VCs through the standard helper mechanism
- Start Virtual Components helper transition by migrating the SDS011 cycle reader and V-TAC six-register VC example to self-create, verify, and bind their own VCs at startup
- Add reusable Virtual Components helper snippet for creating, repairing, grouping, and returning VC handles from one setup call
- Add a production Marstek Venus-E Virtual Components controller with embedded-web Force Charge, Stop, and Discharge buttons, adjustable power, and SOC telemetry
- Correct the Marstek Venus-E RJ45 pinout to pin 1=A, pin 2=B, pins 3/6=NC, pins 4/5=+5V, and pins 7/8=GND
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
- Update `modbus/Deye/SG02LP1/application_examples/shekran/README.md` to reflect script functionality
- Add new `modbus/` example collection and standardize JSDoc headers across the new `.shelly.js` files
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
