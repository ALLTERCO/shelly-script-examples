# Virtual Components Helper Integration Test Plan

## Purpose

This plan defines what to test after integrating `snippets/virtual-components-helper.shelly.js` into scripts that use Shelly Virtual Components (VCs). The goal is to prove that each script can create, detect, repair, group, and update its own VCs reliably with one setup call:

```js
ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, vc) {
  if (!ok) return;
  // script logic starts here
});
```

## Scope

Test every script that uses one of these patterns:

- `Virtual.getHandle(...)`
- `Shelly.call("Virtual.Add", ...)`
- `Shelly.call("Virtual.Delete", ...)`
- `vcId`, `vcHandle`, or explicit VC mapping arrays
- grouped VC dashboards with `Group.Set`

Do not refactor all scripts at once. First validate the helper on three representative scripts:

- Simple telemetry script with fixed VC IDs, for example `the_pill/SDS011/sds011-vc-cycle.shelly.js`.
- MODBUS telemetry script with multiple `vcId` bindings, for example `the_pill/MODBUS/V-TAC/VT6607103/vtac_six_register_example_vc.shelly.js`.
- Complex controller/dashboard script that creates VCs and groups, for example `the_pill/MODBUS/Marstek/VenusE/venus_e_control_vc.shelly.js`.

After those pass, migrate the remaining VC scripts in small batches.

## Pre-Integration Checklist

For each target script, record the current VC contract before editing:

- Component logical name.
- Component type: `number`, `boolean`, `text`, `enum`, `button`, or `group`.
- Existing fixed ID, if any.
- Component display name.
- Unit, min, max, default value, persisted flag, and UI metadata.
- Cloud metadata: `measurement`, `log`, or empty.
- Group membership and group ID.
- Whether IDs are expected to be stable for external dashboards or scripts.

Create a `VIRTUAL_COMPONENTS` manifest in the script from that contract.


## Transition Plan: Scripts Build Their Own VCs

The transition goal is that every script using Virtual Components becomes self-contained. A user should be able to upload and start the script on a compatible Shelly device without manually creating VCs first. On startup, the script must create missing VCs, reuse existing matching VCs, repair fixed-ID VCs when their configuration is wrong, and then bind handles before normal logic starts.

Do not migrate all scripts in one pass. Convert and test a few representative scripts first, then continue in small batches.

### Phase 1: Inventory Current VC Usage

For each script, classify how it uses VCs today:

- Legacy manual handles only: uses `Virtual.getHandle(...)` and assumes VCs already exist.
- Setup script pattern: a separate script or block calls `Virtual.Add` before the runtime script starts.
- Dynamic setup pattern: runtime script creates some VCs itself.
- Group dashboard pattern: script creates VCs and puts them into one or more groups.
- Placeholder pattern: script contains `vcId`, `vcHandle`, or mapping arrays but does not fully own creation.

Record every current component as a manifest item before changing behavior.

### Phase 2: Define The Script-Owned VC Contract

Add one `VIRTUAL_COMPONENTS` manifest to the script. This manifest is the source of truth for the VCs that the script owns.

Rules:

- Preserve fixed IDs when another script, dashboard, article, README, or user workflow depends on `type:id`.
- Use no-ID by-name creation only when there is no external dependency on the exact ID.
- Use stable logical keys such as `soc`, `voltage_l1`, `relay_state`, or `alarm_text`.
- Keep component names, units, ranges, default values, persisted flags, and Cloud metadata identical to the old behavior unless the migration intentionally fixes a bug.
- Define groups by logical keys, not raw strings such as `number:200`.

### Phase 3: Add The Helper Without Changing Runtime Logic

Paste or include `snippets/virtual-components-helper.shelly.js` near the top of the script, then add the manifest. At this stage, keep the existing polling, control, and value calculation logic unchanged.

Replace only the VC binding/setup part:

```js
var vc = null;

ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
  if (!ok) return;
  vc = readyVc;
  startMainLogic();
});
```

Normal logic must not run before the callback succeeds, because handles do not exist until the helper has created or detected the VCs.

### Phase 4: Replace Manual Handles With Helper Handles

Convert old direct handles to helper-owned handles.

Before:

```js
var VC_SOC = Virtual.getHandle("number:200");
VC_SOC.setValue(soc);
```

After:

```js
vc.handles.soc.setValue(soc);
```

For larger scripts, use small wrappers to keep the rest of the code readable:

```js
function setSoc(value) {
  vc.handles.soc.setValue(value);
}
```

### Phase 5: Retire Separate Setup Paths

After the runtime script successfully creates and reuses its own VCs, remove or disable old duplicate setup paths:

- Separate setup-only scripts that only call `Virtual.Add`.
- Old `Virtual.Add` blocks inside the runtime script.
- Hard-coded assumptions that a user has already created components manually.
- Documentation steps that tell the user to create VCs before uploading the script.

If a setup-only script is still useful as a standalone installer, convert it to use the same manifest and helper so it follows the same contract.

### Phase 6: Preserve Existing Installations

The migration must not break users who already have working VCs.

Expected behavior on existing devices:

- Matching fixed-ID components are reused.
- Mismatched fixed-ID components are deleted and recreated with the same `type:id`.
- Matching no-ID components are found by `type + config.name`.
- Mismatched no-ID components are not deleted automatically, because they may be user-created. The helper creates the missing script-owned component instead.
- Groups are updated from logical keys after components are resolved.

### Phase 7: Update Documentation And Examples

For each migrated script, update nearby README or article text so the setup model is clear:

- The script creates its own VCs at startup.
- Manual VC creation is not required.
- Fixed IDs, if used, are listed as part of the script contract.
- Device VC capacity must be checked before installation on devices with many existing dynamic components.

### Phase 8: Test Gate Before Batch Migration

A script is considered transitioned only after these tests pass:

- Fresh device or cleared dynamic VC list: script creates every required VC.
- Restart: script reuses existing matching VCs and creates no duplicates.
- Fixed-ID mismatch: helper repairs the component and keeps the same ID.
- Value update: script writes correct values to helper-owned handles.
- Reboot: script rebinds handles and continues without manual action.

Use one commit per script for the first few migrations. After the pattern is proven, use small batch commits grouped by device family or protocol.


## Static Verification

Run these checks before loading the script to a device:

1. The script contains exactly one `ensureVirtualComponents(...)` call for setup.
2. Main logic starts only inside or after the helper callback confirms `ok === true`.
3. No old duplicate setup path remains active.
4. Every VC update uses `vc.handles.<key>.setValue(...)` or a wrapper around those handles.
5. Fixed IDs are used only when the ID must be stable.
6. Dynamic/no-ID components are matched by `type + config.name`.
7. Group definitions reference logical keys, not raw `number:200` strings.
8. No two components in the same script use the same fixed `type:id`.
9. All component names are unique inside the script for no-ID components.
10. Script remains Shelly mJS compatible: no imports, no arrow functions, no classes, no trailing commas.

Suggested local search commands:

```bash
rg -n "ensureVirtualComponents|Virtual\.Add|Virtual\.Delete|Virtual\.getHandle|vcId|vcHandle" path/to/script.shelly.js
rg -n "=>|class |import |export " path/to/script.shelly.js
```

## Device Test Matrix

Run these tests on a real Shelly device that supports dynamic Virtual Components.

### 1. Clean Device Creation Test

Purpose: prove the script can build its own VC layout from nothing.

Steps:

1. Delete existing dynamic VCs from the device, or use a fresh test device.
2. Upload the integrated script.
3. Start the script.
4. Watch the script log.
5. Open the Shelly web UI or app Components page.

Expected result:

- All VCs from `VIRTUAL_COMPONENTS.components` exist.
- All groups from `VIRTUAL_COMPONENTS.groups` exist.
- Group members are in the expected group.
- Script log shows setup completion without repeated errors.
- Handles are usable and values update.

### 2. Existing Matching Components Test

Purpose: prove the script reuses existing correct VCs.

Steps:

1. Keep the VCs created by the clean creation test.
2. Stop and restart the script.
3. Watch the log and UI.

Expected result:

- Existing VCs are reused.
- No duplicate components are created.
- Fixed-ID components keep their IDs.
- No-ID components keep the matched existing IDs.
- Values continue updating.

### 3. Mismatched Fixed-ID Repair Test

Purpose: prove the helper repairs fixed IDs whose config no longer fits.

Steps:

1. Pick one fixed-ID component from the manifest.
2. In the Shelly UI, change its name or metadata if possible, or temporarily modify the manifest name/unit and run once.
3. Restart the script.
4. Watch the log and Components page.

Expected result:

- The helper detects the mismatch.
- The old fixed-ID component is deleted.
- A new component with the same fixed `type:id` and desired config is created.
- The returned handle works.

### 4. Mismatched No-ID Component Test

Purpose: prove no-ID components do not destroy unrelated user-created VCs.

Steps:

1. Create a VC with the same type and similar name but intentionally wrong config.
2. Run the script.

Expected result:

- The helper does not delete the unrelated no-ID component.
- It creates a new component that fits the manifest.
- The script stores and uses the new returned ID.

### 5. Group Membership Test

Purpose: prove groups are rebuilt from logical keys.

Steps:

1. Remove one component from a group manually.
2. Restart the script.
3. Inspect the group.

Expected result:

- The group membership is restored from the manifest.
- Missing logical keys are not silently added as invalid strings.

### 6. Value Update Test

Purpose: prove script logic still updates VCs correctly.

Steps:

1. Trigger or wait for one normal polling/update cycle.
2. Compare logged source values with VC displayed values.
3. For control scripts, press virtual buttons or change virtual input values.

Expected result:

- Number values are scaled and rounded as before.
- Boolean values switch correctly.
- Text values update correctly.
- Enum values use valid options.
- Button handlers still trigger the expected script action.

### 7. Reboot Persistence Test

Purpose: prove the system survives device reboot.

Steps:

1. Let the integrated script complete setup.
2. Reboot the Shelly device.
3. Confirm script auto-start behavior.
4. Inspect VCs and groups.

Expected result:

- Persisted VCs keep stored values where configured.
- Non-persisted VCs reset as expected.
- Script rebinds handles after boot.
- No duplicate VCs are created.

### 8. Pagination Test

Purpose: prove detection works when the device has more dynamic components than the first `Shelly.GetComponents` page.

Steps:

1. Create enough dynamic VCs so `Shelly.GetComponents` paginates.
2. Run the integrated script.

Expected result:

- The helper reads all pages.
- Existing matching VCs are still found.
- No duplicate matching components are created because of pagination.

### 9. Capacity Limit Test

Purpose: prove behavior is understandable when the device VC limit is reached.

Steps:

1. Fill the device near the dynamic component limit.
2. Run a script that needs additional VCs.

Expected result:

- `Virtual.Add` failures are logged clearly.
- `ok` passed to callback is `false`.
- Main script logic does not start if required VCs are unavailable.

### 10. Backward Compatibility Test

Purpose: prove external references remain stable when fixed IDs are required.

Steps:

1. Check any README, dashboard, HTTP endpoint, or companion script that references specific VC IDs.
2. Run the integrated script.
3. Confirm those IDs still exist and receive values.

Expected result:

- Fixed ID contracts remain stable.
- Any intentional ID changes are documented in README and changelog.

## Acceptance Criteria

A script is accepted after helper integration when:

- It passes static verification.
- It passes clean creation and restart reuse tests.
- It does not create duplicate VCs on repeated restarts.
- It repairs mismatched fixed-ID components.
- It does not delete unrelated no-ID user components.
- All displayed values and control actions match the pre-integration behavior.
- README or inline comments document the VC manifest and any fixed IDs.

## Batch Migration Process

Use this process for the full repository migration:

1. Convert one simple script.
2. Run the full test matrix.
3. Convert one MODBUS telemetry script.
4. Run the full test matrix.
5. Convert one complex grouped/controller script.
6. Run the full test matrix.
7. Convert remaining scripts in batches of five.
8. After each batch, run static checks and at least clean creation + restart reuse on one script from the batch.
9. Keep each batch in a separate commit.

## Suggested Automation Later

Add a repository checker that parses JS files and reports:

- Files using `Virtual.*` without `ensureVirtualComponents`.
- Duplicate fixed `type:id` entries inside one manifest.
- Missing `key`, `type`, or `config.name` fields.
- Group references to unknown logical keys.
- Scripts whose README does not mention required VC behavior.

This checker should not replace hardware validation; it only prevents obvious drift.
