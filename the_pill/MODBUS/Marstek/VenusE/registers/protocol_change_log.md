# Protocol Change Log

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [**Protocol Change Log**](protocol_change_log.md) - Version history and source changes.

## Related Notes

- Current runtime register definitions are in [Runtime Information 04](runtime_information_04.md).
- Current parameter/register enum definitions are in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md), [Safety](safety.md), and [Battery Brand](battery_brand.md).

| No. | Version | Date | Change details | Notes |
| --- | --- | --- | --- | --- |
| 1 | V1.0 | 2021-11-06 | Released |  |
| 2 | V1.1 | 2023-08-06 | Initial version |  |
| 3 | V1.2 | 2023-10-12 | Added grid-tied inverter and energy storage inverter classification per customer request, "√" means the field is used, "x" means the field is not used |  |
| 4 | V1.3 | 2023-11-22 | Grid-tied inverter fields: daily PV generation, daily PV1 generation, daily PV2 generation, daily PV3 generation, daily PV4 generation, daily PV5 generation, daily PV6 generation, total PV generation, changed from "√" to "x" |  |
| 5 | V1.4 | 2023-12-05 | Resistance compensation data type changed from S16 to U16 |  |
| 5 | V1.4 | 2023-12-05 | Deleted B22:RSSEn from Runtime Function Enable |  |
| 5 | V1.4 | 2023-12-05 | Changed B26:RSSEn to B26:RSDEN in Protection Function Enable |  |
| 5 | V1.4 | 2023-12-05 | grid import power limit value data range -200000~0 changed to -2147483648~0 |  |
| 5 | V1.4 | 2023-12-05 | grid import power limit percentage data range -1000~0 changed to -32768~0 |  |
| 5 | V1.4 | 2023-12-05 | feed-in power limit valuedata range 0~200000changed to 0~2147483647 |  |
| 5 | V1.4 | 2023-12-05 | feed-in power limit percentage0~1000changed to 0~32767 |  |
| 5 | V1.4 | 2023-12-05 | Updated lithium battery manufacturers |  |
| 5 | V1.4 | 2023-12-05 | address 2000 battery statusAdded 7: wake up(Wake Up) |  |
| 5 | V1.4 | 2023-12-05 | grid-tied discharge depthchanged tominimum grid-tied discharge SOC, GridDodchanged toOngrid_Minsoc |  |
| 5 | V1.4 | 2023-12-05 | Added meter manufacturers Livoltek-3p and Chint-3p |  |
| 5 | V1.4 | 2023-12-05 | Initial grid connection time range changed from 1-600 to 1-2000 |  |
| 5 | V1.4 | 2023-12-05 | Fault reconnect time range changed from 20-600 to 20-2000 |  |
| 5 | V1.4 | 2023-12-05 | Added safety standard(Safty) 258: Norway(Norway) |  |
| 5 | V1.4 | 2023-12-05 | Added 10minute overvoltage protection time(10minGridVoltMaxTime), address 1076 |  |
| 5 | V1.4 | 2023-12-05 | Added battery hardware version(BatHwVersion), address3542 |  |
| 5 | V1.4 | 2023-12-05 | Added battery software version(BatSwVersion), address3543 |  |
| 5 | V1.4 | 2023-12-05 | Set parameters 8 (lithium battery communication data, rolling download)changed to read-only |  |
| 5 | V1.4 | 2023-12-05 | Applicable machine type range: 129-137(low-voltage safety standard)changed 137 to 138 |  |
| 6 | V1.5 | 2024-03-12 | Added lithium battery manufacturers(BatBrand):  / 51 Kowint Kowint / 52 BlueSun BlueSun / 53 LithValley LithValley / 54 Solareast Solareast / 55 STELTEC STELTEC / 56 Goldenmate Goldenmate / 57 Huafeng Huafeng |  |
| 6 | V1.5 | 2024-03-12 | Addedsafety standard(Safty):  / 259 Bolivia Bolivia / 260 Dominica_120 Dominica_120 / 261 Dominica_240 Dominica_240 |  |
| 6 | V1.5 | 2024-03-12 | Added protocol fields:  / daily energy to grid EtogridDay32 1041-1042 / daily energy from grid EfromgridDay32 1043-1044 / daily energy to load EtoLoadDay32 1045-1046 / Description: when energy is less than 6553.5 kWh, use the previous fields(1002~1004), energy = 6553.5 kWh indicates the range was exceeded and the old registers cannot hold the value; enable the current energy register fields; |  |
| 6 | V1.5 | 2024-03-12 | address2515: "transformer temperature" changed to "radiator temperature", "Ttransf" changed to "Radiator Temperature" |  |
| 6 | V1.5 | 2024-03-12 | meter manufacturer: ADL200changed toACR10R-D16TE; ADL400changed toEastron_3p |  |
| 6 | V1.5 | 2024-03-12 | parallel inverter count(InverterSum)updated to 16, ID(InverterID)setting range updated to15 |  |
| 6 | V1.5 | 2024-03-12 | Redefined external EMS, address: 2568, 2569-2570, 2571addressdeleted |  |
| 6 | V1.5 | 2024-03-12 | Data types U32 and S32 do not support single-register write(0x06) |  |
| 7 | V1.6 | 2024-03-25 | Addedinverter time and collector SN+IP,address500-518 |  |
| 8 | V1.7 | 2024-04-23 | Added Chinese translations for Runtime Function Enable and Protection Function Enable |  |
| 9 | V1.7.2 | 2024-04-24 | AddedItalian startup self-test 527-528 bit15 / AddedItalian self-test parameters2529-2545 / Note: safety standardmust be Italy | Original versionV1.5 |
| 10 | V1.8 | 2024-07-02 | Updated Safety (Safty) and lithium battery manufacturer (BatBrand) |  |
| 11 | V1.9 | 2024-07-30 | Addedlithium battery communication data, address3530~3540 |  |
| 12 | V2.0 | 2024-08-23 | Updated Safety (Safty) and lithium battery manufacturer (BatBrand) |  |
| 12 | V2.0 | 2024-08-23 | machine type(6)adjusted:  / 0-99 single-phase grid-tied inverter / 100-199 three-phase grid-tied inverter / 201-219 split-phase energy storage / 220-270 single-phase energy storage / 300-499 large three-phase energy storage / 500-599 small three-phase energy storage |  |
| 12 | V2.0 | 2024-08-23 | Adjusted ranges in Set Parameters 3 (protection parameters) |  |
| 13 | V2.1 | 2024-08-27 | address2502-2503 charge/discharge power command range[-22000,20000]changed to[-200000,200000] |  |
| 13 | V2.1 | 2024-08-27 | address3006 SOC lower-limit range 0-1000changed to 0~990 |  |
| 13 | V2.1 | 2024-08-27 | address3000 battery typeAddedsodium battery Sodium |  |
| 13 | V2.1 | 2024-08-27 | Addedaddress3037 sodium battery manufacturer |  |
| 13 | V2.1 | 2024-08-27 | Adjusted address 212 meter manufacturer range |  |
| 13 | V2.1 | 2024-08-27 | address 213 CT ratio range 0~100 changed to -120~120,Data typeU16changed to S16 |  |
| 13 | V2.1 | 2024-08-27 | address1552 reactive power setting%unit0.001changed to 0.1% |  |
| 14 | V2.2 | 2024-09-14 | Addedaddress2048  set active-power output default change-rate value(setGradW_Default) | South Australia certification field |
| 14 | V2.2 | 2024-09-14 | Addedaddress2049-2050 set grid-side output limit default value(OpModExpLimW_Default) |  |
| 15 | V2.3 | 2024-10-11 | Added addresses 1068-1075 | South Australia certification field |
| 16 | V2.4 | 2024-12-12 | Added battery fault data and battery transparent-transmission data |  |
| 17 | V2.5 | 2025-01-17 | Added addresses 574-581 |  |
| 18 | V2.6 | 2025-03-20 | EMS mode changed |  |
| 19 | V2.7 | 2025-04-11 | in function execution commandAddedB13:CTdirection detection |  |
| 20 | V2.8 | 2025-05-21 | Updated dynamic electricity price related parameters |  |
| 21 | V2.9 | 2025-07-14 | Updated faults; updated safety standard273~276; updated lithium battery manufacturers65~83 |  |
| 22 | V3.0 | 2025-08-11 | Addedsafety standard-Denmark2(277), Sri LankaB(278), Serbia(279) |  |
| 22 | V3.0 | 2025-08-11 | Added lithium battery manufacturers 84 Neutral Neutral |  |
| 23 | V3.1 | 2025-05-18 | Addedsafety standard 98 Belgium 174 Colombia |  |
| 23 | V3.1 | 2025-05-18 | Added lithium battery manufacturers 85 Huijue 86 Huyu 87 Meri 2a  / 81 Meri 2changed toMeri 2b |  |
| 24 | V3.2 | 2025-08-20 | Added3545 battery SN(BatSN) |  |
| 25 | V3.3 | 2025-08-27 | internal warningAddedI18 chip check abnormal ChipWarning |  |
| 26 | V3.4 | 2025-11-19 | AddedAC Couple parameters   battery version comparison  3560 |  |
