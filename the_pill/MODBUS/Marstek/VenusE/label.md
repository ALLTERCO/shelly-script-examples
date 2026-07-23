# Marstek VenusE Label Notes

## Known
- Device family: Marstek Venus-E
- Device identity confirmed by user for this integration.
- Label/nameplate photo reviewed by user and used for the ratings below.
- Model: `MST-BIE5-2500`
- Battery energy: `5120 Wh`
- Battery type: `LiFePO4`
- Depth of discharge: `90%`
- Nominal battery voltage: `51.2 V`
- Battery capacity: `100 Ah`
- Nominal input power: `2500 W`
- Nominal input current: `10.9 Aac`
- Nominal grid voltage: `230 Vac`
- Grid voltage range: `187-253 Vac` (best-effort reading from label photo)
- Nominal grid frequency: `50 Hz`
- Power factor: `>0.99` (best-effort reading from label photo)
- Max output power: `2500 VA`
- Nominal output power: `2500 VA`
- Nominal output current: `10.9 Aac`
- Nominal output voltage: `230 Vac`
- Nominal output frequency: `50 Hz`
- Over-voltage category: `DC II / AC III`
- Operating ambient temperature: `-10..55 C`
- Ingress protection: `IP65`
- Weight: `60 kg`
- Interface source: `modbus marstek - address.csv`
- Alarm/fault source: `modbus marstek - ex_info.csv`
- Protocol source: `Venus-E 3.0 485 Protocol`, v1.0, 2024-07-08
- Communication: Standard Modbus RTU, address `1`, `115200`, 8 data bits, no parity, 1 stop bit
- Hardware response confirmed with address `1`, `115200`, `8N1` on The Pill.
- Both console and Virtual Component readers confirmed working on hardware.
- Confirmed RS485 RJ45 pinout for this Venus-E 3.0: pin `1=A`, pin `2=B`, pins `3/6=NC`, pins `4/5=+5V`, pins `7/8=GND`
- MODBUS register map includes EMS, inverter, BMS, AC, battery, WiFi/BLE/MQTT, schedule, and force charge/discharge registers.

## Missing
- Vendor firmware version shown on the device/app
- Vendor documentation URL or public PDF source
- Serial number and barcode values were not readable enough from the reviewed label photo.

## Validation Notes
The label photo is blurry, so values marked as best-effort should be confirmed
from a sharper photo or vendor datasheet before production promotion.
