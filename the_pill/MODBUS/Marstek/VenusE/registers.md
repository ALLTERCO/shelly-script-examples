# Marstek VenusE Register Reference

Sources:
- [`modbus marstek - address.csv`](modbus%20marstek%20-%20address.csv)
- [`modbus marstek - ex_info.csv`](modbus%20marstek%20-%20ex_info.csv)

The register map appears to use holding-register addresses directly. Multi-register values are treated as big-endian word order until hardware testing proves otherwise.

## Read Registers (`FC03`)

| Address | Hex | Name | Words | Type | Scale / Unit | Notes |
|---:|---:|---|---:|---|---|---|
| 30200 | `0x75F8` | EMS app version | 1 | `u16` | raw | Example raw `124` |
| 30201 | `0x75F9` | EMS boot version | 1 | `u16` | raw | Example raw `17`, note says boot ver 103 |
| 30202 | `0x75FA` | Inverter app version | 1 | `u16` | raw | Example raw `111` |
| 30203 | `0x75FB` | Inverter boot version | 1 | `u16` | raw | Example raw `105` |
| 30204 | `0x75FC` | BMS version | 1 | `u16` | raw | Example raw `103` |
| 30300 | `0x765C` | WiFi status | 1 | `u16` | enum | `0=disconnect`, `1=connect` |
| 30301 | `0x765D` | BLE status | 1 | `u16` | enum | `0=disconnect`, `1=broadcasting`, `2=connect` |
| 30302 | `0x765E` | MQTT status | 1 | `u16` | enum | `0=disconnect`, `1=connect` |
| 30303 | `0x765F` | WiFi signal strength | 1 | `u16` | dB |  |
| 30304 | `0x7660` | MAC | 6 | `u8` | raw | 12 bytes |
| 31000 | `0x7918` | Device name | 10 | `char` | text | 20 bytes |
| 32100 | `0x7D64` | Battery voltage | 1 | `u16` | `0.01 V` | Example `5120` = `51.2 V` |
| 32101 | `0x7D65` | Battery current | 1 | `s16` | `0.01 A` | Example `1502` = `15.02 A` |
| 32102 | `0x7D66` | Battery power | 2 | `s32` | `1 W` | Example `2500` = `2500 W` |
| 32104 | `0x7D68` | Battery SOC | 1 | `u16` | `1 %` | Example `50` = `50 %` |
| 32105 | `0x7D69` | Battery total energy | 1 | `u16` | `0.001 kWh` | Example `2500` = `2.5 kWh` |
| 32200 | `0x7DC8` | AC voltage | 1 | `u16` | `0.1 V` | Example `2200` = `220 V` |
| 32202 | `0x7DCA` | AC power | 2 | `s32` | `1 W` | Positive value means feeds power into the grid |
| 32204 | `0x7DCC` | AC frequency | 1 | `u16` | `0.01 Hz` | Example `5000` = `50 Hz` |
| 32300 | `0x7E2C` | AC offgrid voltage | 1 | `u16` | `0.1 V` | Example `2200` = `220 V` |
| 32302 | `0x7E2E` | AC offgrid power | 2 | `s32` | `1 W` |  |
| 33000 | `0x80E8` | Total charging energy | 2 | `u32` | `0.01 kWh` |  |
| 33002 | `0x80EA` | Total discharging energy | 2 | `u32` | `0.01 kWh` |  |
| 33004 | `0x80EC` | Daily charging energy | 2 | `u32` | `0.01 kWh` | Updated daily at 00:00 |
| 33006 | `0x80EE` | Daily discharging energy | 2 | `u32` | `0.01 kWh` | Updated daily at 00:00 |
| 33008 | `0x80F0` | Monthly charging energy | 2 | `u32` | `0.01 kWh` | Updated on the 1st of each month |
| 33010 | `0x80F2` | Monthly discharging energy | 2 | `u32` | `0.01 kWh` | Updated on the 1st of each month |
| 35000 | `0x88B8` | Internal temperature | 1 | `s16` | `0.1 C` | Example `373` = `37.3 C` |
| 35001 | `0x88B9` | Internal max MOS temperature | 1 | `s16` | `0.1 C` | Example `257` = `25.7 C` |
| 35010 | `0x88C2` | Max cell temperature | 1 | `s16` | `0.1 C` |  |
| 35011 | `0x88C3` | Min cell temperature | 1 | `s16` | `0.1 C` |  |
| 35100 | `0x891C` | Inverter state | 1 | `u16` | enum | `0=sleep`, `1=standby`, `2=charge`, `3=discharge`, `4=backup mode`, `5=OTA upgrade`, `6=bypass` |
| 35110 | `0x8926` | Battery charge voltage limit | 1 | `u16` | `0.1 V` | CSV says `100 mV` |
| 35111 | `0x8927` | Battery charge current limit | 1 | `u16` | `0.1 A` | CSV says `100 mA` |
| 35112 | `0x8928` | Battery discharge current limit | 1 | `u16` | `0.1 A` | CSV says `100 mA` |
| 36000 | `0x8CA0` | Alarm word 36000 | 1 | `bit` | raw | See alarm bit table below |
| 36001 | `0x8CA1` | Alarm word 36001 | 1 | `bit` | raw | See alarm bit table below |
| 36100 | `0x8D04` | Fault word 36100 | 1 | `bit` | raw | See fault bit table below |
| 36101 | `0x8D05` | Fault word 36101 | 1 | `bit` | raw | See fault bit table below |
| 36103 | `0x8D07` | Fault word 36103 | 1 | `bit` | raw | See fault bit table below |
| 36104 | `0x8D08` | Fault word 36104 | 1 | `bit` | raw | See fault bit table below |

## Alarm Bits

| Register | Bit | Meaning |
|---:|---:|---|
| 36000 | 0 | PLL Abnormal Restart |
| 36000 | 1 | Overtemperature Limit |
| 36000 | 2 | Low Temperature Limit |
| 36000 | 3 | Fan Abnormal Warning |
| 36000 | 4 | Low Battery SOC Warning |
| 36000 | 5 | Output Overcurrent Warning |
| 36000 | 6 | Abnormal Line Sequence Detection |
| 36001 | 0 | WIFI abnormal |
| 36001 | 1 | BLE abnormal |
| 36001 | 2 | Network abnormal |
| 36001 | 3 | CT connection abnormal |

## Fault Bits

| Register | Bit | Meaning |
|---:|---:|---|
| 36100 | 0 | Grid overvoltage |
| 36100 | 1 | Grid undervoltage |
| 36100 | 2 | Grid overfrequency |
| 36100 | 3 | Grid underfrequency |
| 36100 | 4 | Grid peak voltage abnormal |
| 36100 | 5 | Current Dcover |
| 36100 | 6 | Voltage Dcover |
| 36101 | 0 | BAT overvoltage |
| 36101 | 1 | BAT undervoltage |
| 36101 | 2 | BAT overcurrent |
| 36101 | 3 | BAT low SOC |
| 36101 | 4 | BAT communication failure |
| 36101 | 5 | BMS protect |
| 36103 | 0 | hardware Bus overvoltage |
| 36103 | 1 | hardware Output overcurrent |
| 36103 | 2 | hardware trans overcurrent |
| 36103 | 3 | hardware Battery overcurrent |
| 36103 | 4 | Hardware protection |
| 36103 | 5 | Output overcurrent |
| 36103 | 6 | High voltage bus overvoltage |
| 36103 | 7 | High voltage bus undervoltage |
| 36103 | 8 | Overpower protection |
| 36103 | 9 | FSM abnormal |
| 36103 | 10 | Overtemperature protection |
| 36103 | 11 | Inverter soft start timeout |
| 36104 | 0 | self-test fault |
| 36104 | 1 | eeprom fault |
| 36104 | 2 | other system fault |

## Writable / Control Registers (`FC03`, `FC06`, `FC10`)

These registers are documented for completeness only. The current Shelly scripts do not write them.

| Address | Hex | Name | Words | Type | Scale / Unit | Notes |
|---:|---:|---|---:|---|---|---|
| 41000 | `0xA028` | Device restart | 1 | `u16` | raw | Write `0x55AA` to reset |
| 41100 | `0xA08C` | MODBUS address | 1 | `u16` | raw | Range `1..255` |
| 41200 | `0xA0F0` | Backup function | 1 | `u16` | enum | CSV says `0=enable`, `1=disable` |
| 41500 | `0xA21C` | WiFi name | 16 | `char` | text | Append `\0` terminator |
| 41600 | `0xA280` | WiFi password | 32 | `char` | text | Write-only, append `\0` terminator |
| 42000 | `0xA410` | RS485 control mode | 1 | `u16` | enum | `0x55AA=enable`, `0x55BB=disable` |
| 42010 | `0xA41A` | Forcible charge/discharge | 1 | `u16` | enum | `0=stop`, `1=charge`, `2=discharge` |
| 42011 | `0xA41B` | Charge to SOC | 1 | `u16` | `1 %` | CSV range says `10..100 %`, example is inconsistent |
| 42020 | `0xA424` | Forcible charge power | 1 | `u16` | `W` | Range `0..2500 W` |
| 42021 | `0xA425` | Forcible discharge power | 1 | `u16` | `W` | Range `0..2500 W` |
| 43000 | `0xA7F8` | User work mode | 1 | `u16` | enum | `0=manual`, `1=anti-feed`, `2=eco mode / AI mode` |
| 43100..43129 | `0xA85C..0xA879` | Discharge time 1..6 schedule | 30 | mixed | mixed | Week bitmask, start/end `HHMM`, signed power, enable |
| 44001 | `0xABE1` | Discharging cutoff capacity | 1 | `u16` | `0.1 %` | Range `12..30 %`, example `150` = `15.0 %` |
| 44002 | `0xABE2` | Max charge power | 1 | `u16` | `W` | Range `0..2500 W` |
| 44003 | `0xABE3` | Max discharge power | 1 | `u16` | `W` | Range `0..2500 W` |
