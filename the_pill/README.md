# The Pill Collection

UART peripheral scripts grouped by device and feature. Each subfolder includes
its own README with wiring, setup, and usage details.

## Contents

- **[UART/](UART/)** — loopback/wiring verification test — *production*
- **[ys_irtm/](ys_irtm/)** — YS-IRTM infrared module (send/receive NEC codes) — *production*
- **[MODBUS/](MODBUS/)** — MODBUS-RTU master scripts and per-device examples
  - [Deye/](MODBUS/Deye/) — Deye SG02LP1 inverter reader + Virtual Components — *production*
  - [Davis/](MODBUS/Davis/) — Davis pyranometer reader + Virtual Components — *production*
  - [LinkedGo/ST802/](MODBUS/LinkedGo/ST802/) — LinkedGo ST802 BMS thermostat client + VC — *production*
  - [JKESS/JK200-MBS/](MODBUS/JKESS/JK200-MBS/) — JKESS JK200-MBS BMS reader + Virtual Components — *production*
  - [wirenboard/WB-M1W2-v3/](MODBUS/wirenboard/WB-M1W2-v3/) — Wirenboard WB-M1W2 v3 reader + VC — *production*
  - [wirenboard/WB-MIR-v-3/](MODBUS/wirenboard/WB-MIR-v-3/) — Wirenboard WB-MIR v3 IR module + VC — *production*
  - [utils/](MODBUS/utils/) — universal MODBUS-RTU scanner — *production*
  - [ComWinTop/](MODBUS/ComWinTop/) — CWT-MB308V IO module + Virtual Components — *under development*
  - [LinkedGo/R290/](MODBUS/LinkedGo/R290/) — LinkedGo R290 air-to-water heat pump — *under development*
  - [HTTP-Bridge/](MODBUS/HTTP-Bridge/) — MODBUS-RTU HTTP bridge — *under development*
- **[iRobotRoomba/](iRobotRoomba/)** — iRobot Roomba Open Interface control — *under development*
- **[RFID-RC522/](RFID-RC522/)** — MFRC522 RFID reader (UART) — *under development*
- **[SDS011/](SDS011/)** — SDS011 air quality sensor (PM2.5/PM10) — *under development*
- **[SDS018/](SDS018/)** — SDS018 air quality sensor (PM2.5/PM10) — *under development*
- **[_backup/](_backup/)** — deprecated/experimental scripts
