# Backup Scripts

This folder contains backup/experimental versions of scripts that are work-in-progress or deprecated.

## Files

### _backup_uart.shelly.js

Early development version of the YS-IRTM infrared module script with basic UART communication and virtual component integration.

**Features:**
- Basic IR code transmission via YS-IRTM module
- Virtual component integration (text display for RX/TX, button for POWER)
- Hardcoded IR code mappings (POWER, VOL+, VOL-, MUTE)
- RX data displayed as both hex and JavaScript array format

**Note:** This script has syntax errors and is preserved for reference only. Use the scripts in `ys_irtm/` folder instead.

---

### _backup_tvt.shelly.js

Similar backup version with corrupted/malformed content. Preserved for historical reference.

---

## Usage

These files are **not intended for production use**. They are kept for reference and development history. For working implementations, see:

- IR control: `the_pill/ys_irtm/`
- Roomba control: `the_pill/iRobotRoomba/`
- RFID reading: `the_pill/RFID-RC522/`
