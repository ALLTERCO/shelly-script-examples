# TODO - Marstek VenusE

- Confirm whether 32-bit registers use high-word-first or low-word-first ordering. Current test had no load, so non-zero 32-bit power/energy values were not available for validation.
- Confirm signed direction conventions for battery current, battery power, AC power, and offgrid power. Requires an office test with charge/discharge or load.
- Confirm the remaining `35100` inverter-state enum values while the device is sleeping and in backup/bypass modes. Standby (`1`), charging (`2`), and discharging (`3`) were verified through USB-RS485 control.
- Confirm alarm/fault bit behavior on hardware and capture at least one non-zero example if possible.
- Validate `venus_e_control_vc.shelly.js` on The Pill, including VC creation, power persistence, queued Stop behavior, write-echo handling, and charge/discharge state changes.
- Decide whether schedule programming should be added as a separate guarded script.
- Complete extended control-script soak testing on The Pill.
