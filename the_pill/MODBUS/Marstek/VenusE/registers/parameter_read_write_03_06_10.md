# Parameter Read/Write 03-06-10

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [**Parameter Read/Write 03-06-10**](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- `FuncEn` uses [Runtime Function Enable](runtime_function_enable.md).
- `ProtectEn` uses [Protection Function Enable](protection_function_enable.md).
- `Safty` uses [Safety](safety.md), and `BatBrand` uses [Battery Brand](battery_brand.md).

## Set parameters 1 (system parameters)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | Safty | 204 | U16 | 2 | Safty |  | Restart the inverter after setting this value |  | √ | X | √ | √ |
| √ | √ | PVInputType | 205 | U16 | 2 | 0:Independent / 1:Parallel / 2:NoPv |  | Default: 0: Independent | Added 2: No PV | √ | X | √ | √ |
| √ | √ | FuncEn | 206-207 | U32 | 4 | Runtime Function Enable |  |  |  | √ | X | X | √ |
| √ | √ | ProtectEn | 208-209 | U32 | 4 | Protection Function Enable |  |  |  | √ | X | X | √ |
| √ | √ | PvStartVolt | 210 | U16 | 2 | 800-10000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | MeterType | 211 | U16 | 2 | 0: no merter / 1: CT / 2: meter / 3.Dual-CT / 4.Dual-meter / 5.CT-Merter / 6.Merter-CT |  | Default: 1: CT |  | √ | X | √ | √ |
| √ | √ | MeterBrand | 212 | U16 | 2 | 0: DDSU666-1p / 1: DTSU666-3p / 2: UKOB418 / 3: UKOB115 / 4: ACR10R-D16TE / 5: Eastron_3p / 6:Livoltek-3p / 7:Chint-3p / 8.DVRR / 9.Acrel-ADL200 / 10.Acrel-ADL400 |  | Default: 1: Afore3 | 2021-08-30 expanded data range | √ | X | √ | √ |
| √ | √ | CTRatio | 213 | S16 | 2 | -120~120 |  | Default: 100 |  | √ | X | √ | √ |
| √ | √ | ParallOperateOnOff | 236 | U16 |  |  |  | 170: Stop inverter paralleling / 187: Enable inverter paralleling |  | √ | X | √ | √ |
| √ | √ | InverterSumAndID | 237 | U16 |  | InverterSum: 2-16 / InverterID: 0-15 |  | B0-B7: InverterSum / B8-B15: InverterID(0: Master, 1~15: Slave) |  | √ | X | √ | √ |
| √ | √ | Reserve | 238-499 |  |  |  |  |  |  | √ | X | √ | √ |

## Set parameters 2 (system commands)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | TimeYear-Month | 500 | U16 | 2 | H:18-99 / L:1-12 |  |  |  | √ | X | X | √ |
| √ | √ | TimeDate-Hour | 501 | U16 | 2 | H:1-31 / L:0-23 |  |  |  | √ | X | X | √ |
| √ | √ | TimeMinute-Sec | 502 | U16 | 2 | H:0-59 / L:0-59 |  |  |  | √ | X | X | √ |
| √ | √ | IP15-14 | 503 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP13-12 | 504 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP11-10 | 505 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP9-8 | 506 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP7-6 | 507 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP5-4 | 508 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP3-2 | 509 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | IP1-0 | 510 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber15-14 | 511 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber13-12 | 512 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber11-10 | 513 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber9-8 | 514 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber7-6 | 515 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber5-4 | 516 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber3-2 | 517 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
| √ | √ | SerialNumber1-0 | 518 | U16 | 2 | ASCII |  |  |  | √ | X | X | √ |
|  |  | Reserve | 519-526 |  |  |  |  |  |  |  |  |  |  |
| √ | √ | FuncCmd | 527-528 | U32 | 4 | B3: forced reset / B4: restore factory / B5: clear records / B13:CT direction detection |  | B3: forced reset / B4: restore factory settings / B5: clear records / B13:CTdirection detection |  | √ | X | X | √ |

## Set parameters 3 (protection parameters)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | GridOnJudgTime | 1000 | U16 | 2 | 10-1200 | S |  |  | √ | X | √ | √ |
| √ | √ | GridOnVoltMax | 1001 | U16 | 2 | 1010-32001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridOnVoltMin | 1002 | U16 | 2 | 500-2300500~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridOnFreqMax | 1003 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridOnFreqMin | 1004 | U16 | 2 | 4000-6000 | 0.01Hz |  | 21.8.30 Addedunit | √ | X | √ | √ |
| √ | √ | VoltProtectStage | 1005 | U16 | 2 | 1-5 |  | 1:stage 1 defaultstage 1 2: stage 2 3: stage 3 4: stage 4 5: stage 5 |  | √ | X | √ | √ |
| √ | √ | FreqProtectStage | 1006 | U16 | 2 | 1-5 |  | 1:stage 1 defaultstage 1 2: stage 2 3: stage 3 4: stage 4 5: stage 5 |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxRecover | 1007 | U16 | 2 | 1010-32001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinRecover | 1008 | U16 | 2 | 500-2300500~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxRecover | 1009 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinRecover | 1010 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMax1 | 1011 | U16 | 2 | 1000-40001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxTime1 | 1012 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMin1 | 1013 | U16 | 2 | 500-3000200~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinTime1 | 1014 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMax2 | 1015 | U16 | 2 | 1000-40001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxTime2 | 1016 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMin2 | 1017 | U16 | 2 | 500-3000200~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinTime2 | 1018 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMax3 | 1019 | U16 | 2 | 1000-40001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxTime3 | 1020 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMin3 | 1021 | U16 | 2 | 500-3000200~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinTime3 | 1022 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMax4 | 1023 | U16 | 2 | 1000-40001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxTime4 | 1024 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMin4 | 1025 | U16 | 2 | 500-3000200~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinTime4 | 1026 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMax5 | 1027 | U16 | 2 | 1000-40001000~7000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMaxTime5 | 1028 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMin5 | 1029 | U16 | 2 | 500-3000200~5000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | GridVoltMinTime5 | 1030 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMax1 | 1031 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxTime1 | 1032 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMin1 | 1033 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinTime1 | 1034 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMax2 | 1035 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxTime2 | 1036 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMin2 | 1037 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinTime2 | 1038 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMax3 | 1039 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxTime3 | 1040 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMin3 | 1041 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinTime3 | 1042 | U16 | 2 | 0-3000060000(all protections) | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMax4 | 1043 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxTime4 | 1044 | U16 | 2 | 0-3000060000 | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMin4 | 1045 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinTime4 | 1046 | U16 | 2 | 0-3000060000 | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMax5 | 1047 | U16 | 2 | 5000-7000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMaxTime5 | 1048 | U16 | 2 | 0-3000060000 | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMin5 | 1049 | U16 | 2 | 4000-6000 | 0.01Hz |  |  | √ | X | √ | √ |
| √ | √ | GridFreqMinTime5 | 1050 | U16 | 2 | 0-3000060000 | 0.01S |  |  | √ | X | √ | √ |
| √ | √ | 10minGridVoltMax | 1051 | U16 | 2 | 1000-4000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | 10minGridVoltMaxRecover | 1052 | U16 | 2 | 1000-4000 | 0.1V |  |  | √ | X | √ | √ |
| √ | √ | IsoResMin | 1053 | U16 | 2 | 10-800 | KΩ |  |  | √ | X | √ | √ |
|  |  | Reserve | 1054-1067 |  |  |  |  |  |  |  |  |  |  |
| √ | √ | Psw_Gen | 1068-1069 | U32 | 4 | 0~4294967295 | W |  |  |  |  |  |  |
| √ | √ | Phw_Gen | 1070-1071 | U32 | 4 | 0~4294967295 | W |  |  |  |  |  |  |
| √ | √ | Psw_Exp | 1072-1073 | U32 | 4 | 0~4294967295 | W |  |  |  |  |  |  |
| √ | √ | Phw_Exp | 1074-1075 | U32 | 4 | 0~4294967295 | W |  |  |  |  |  |  |
| √ | √ | 10minGridVoltMaxTime | 1076 | U16 | 2 | 0~65000 | 0.01 |  |  | √ | √ | √ | √ |
|  |  | Reserve | 1077-1499 |  |  |  |  |  |  |  |  |  |  |

## Set parameters 4 (grid dispatch parameters 1)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | NormReactPower | 1500-1501 | U32 | 4 | 0-200000 | VA |  |  | √ | X | X | √ |
| √ | √ | OutPwrMaxPer | 1502 | U16 | 2 | 0-1000 | 1E-3 |  |  | √ | X | √ | √ |
| √ | √ | OutPwrMax | 1503-1504 | U32 | 4 | 0-200000 | W |  |  | √ | X | X | √ |
| √ | √ | QMode | 1551 | U16 | 2 | 0: disable / 1: Q Set(used withP1552~1554) / 2: Pf Set(used withP1555) / 3: Q By V(used withP1556~1563) / 4: Pf By P(used withP1564~1574) / 5: Q By P((used withP1587~1594) |  |  |  | √ | X | √ | √ |
| √ | √ | QSet% | 1552 | S16 | 2 | (-1000~1000) | 1E-3 |  |  | √ | X | √ | √ |
| √ | √ | QSet | 1553-1554 | S32 | 4 | ‘-200000~200000 | VA |  |  | √ | X | X | √ |
| √ | √ | PfSet | 1555 | S16 | 2 | (-1000~-800,800~1000) | 1E-3 | V1<V2<V3<V4 |  | √ | X | √ | √ |

## Set parameters 5 (grid dispatch parameters 2)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | DRMModel | 2032 | U16 | 2 | 1~9: DRM0~8 ; other values are invalid |  |  |  | √ | X | X | X |
| √ | √ | DRMPLimit | 2033 | S16 | 2 | -1000-+1000 | 1E-3 |  |  | √ | X | X | X |
| √ | √ | DRMPFSet | 2034 | S16 | 2 | (-1000,-800)U(800,1000) | 1E-3 |  |  | √ | X | X | X |
| √ | √ | IniConnecT | 2037 | U16 | 2 | 1-2000 | S |  |  | √ | X | √ | √ |
| √ | √ | ReConnecT | 2038 | U16 | 2 | 20-2000 | S |  |  | √ | X | √ | √ |
| √ | √ | GridFeedPlimit | 2039-2040 | S32 | 4 | 0~2147483647 | W |  |  | √ | X | X | √ |
| x | √ | GridBackPlimit | 2041-2042 | S32 | 4 | -2147483648~0 | W |  |  | √ | X | X | √ |
| √ | √ | SoftStartSlope | 2043 | U16 | 2 | 0-10000 | 0.01%/S | grid soft-start slope |  | √ | X | √ | √ |
| √ | √ | SoftIncSlope | 2044 | U16 | 2 | 0-10000 | 0.01%/S |  |  | √ | X | √ | √ |
| √ | √ | SoftDecSlope | 2045 | U16 | 2 | 0-10000 | 0.01%/S |  |  | √ | X | √ | √ |
| √ | √ | GridFeedPlimitPer | 2046 | S16 | 2 | 0~32767 | 1E-3 |  |  | √ | X | √ | √ |
| x | √ | GridBackPlimitPer | 2047 | S16 | 2 | --32768~0 | 1E-3 |  |  | √ | X | √ | √ |
| √ | √ | setGradW_Default | 2048 | U16 | 2 | 0-100000 | 0.01%/S |  |  | √ | X | √ | √ |
| √ | √ | OpModExpLimW_Default | 2049-2050 | U32 | 4 | 0-200000 | W |  |  | √ | X | √ | √ |
|  |  | Reserve | 2051-2499 |  |  |  |  |  |  |  |  |  |  |

## Set parameters 6 (EMS)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | EMSMode | 2500 | U16 | 2 | 0:self-use/SelfUse / 1:charge first/CharFst / 2:sell first/SellFst / 3:battery maintenance/Maintain / 4:command mode/CmdChar / 5:external EMS/ExtEms / 6:peak shaving and valley filling mode/PeakShave / 7:unbalance compensation/UbSelfUse / 8:Q compensation mode/QSelfUse / 9: peak shaving mode/PeakCut |  | 7:unbalance compensation/UbSelfUse / 8:Q compensation mode/QSelfUse / split-phase and single-phase energy storage machines do not have this field |  | √ | X | √ | √ |
| x | √ | ChgCmd | 2501 | U16 | 2 | 0xAA:charge/discharge / 0xBB:stop |  | default: 0xBB:stop |  | √ | X | √ | √ |
| x | √ | ChgPowerSet | 2502-2503 | S32 | 4 | [-200000,200000] | W | default: 0W | "charge/discharge power" changed to "charge/discharge power command";  / 21.08.30 updatedunit | √ | X | X | √ |
| x | √ | AcPChgMax | 2504 | U16 | 2 | 0-1000 | 1E-3 |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | AcSocMaxChg | 2505 | U16 | 2 | 0-1000 | 1E-3 |  | "maximum charge SOC" changed to "AC charge maximum SOC"; "SocMaxChg" changed to "AcSocMaxChg";  / 21.08.30 updated range and unit | √ | X | √ | √ |
| x | √ | SocMaxDisChg | 2506 | U16 | 2 | 0-1000 | 1E-3 |  | "minimum discharge SOC" changed to "forced-discharge minimum SOC";  / 21.08.30 updated range and unit;  / | √ | X | √ | √ |
| x | √ | PChgMax | 2507 | U16 | 2 | 0-1000 | 1E-3 |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | PDisChgMax | 2508 | U16 | 2 | 0-1000 | 1E-3 | PV | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | TimeOnAcChg1 | 2509 | U16 | 2 | H:0-23 / M:0-59 |  | distinguish weekends and workdays according to the actual project |  | √ | X | √ | √ |
| x | √ | TimeOffAcChg1 | 2510 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnAcChg2 | 2511 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffAcChg2 | 2512 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnAcChg3 | 2513 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffAcChg3 | 2514 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnAcChg4 | 2515 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffAcChg4 | 2516 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceChg1 | 2517 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceChg1 | 2518 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceChg2 | 2519 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceChg2 | 2520 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceChg3 | 2521 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceChg3 | 2522 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceChg4 | 2523 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceChg4 | 2524 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceDisChg1 | 2525 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceDisChg1 | 2526 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceDisChg2 | 2527 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceDisChg2 | 2528 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceDisChg3 | 2529 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceDisChg3 | 2530 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForceDisChg4 | 2531 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForceDisChg4 | 2532 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForbidChg1 | 2533 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForbidChg1 | 2534 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForbidChg2 | 2535 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForbidChg2 | 2536 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForbidChg3 | 2537 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForbidChg3 | 2538 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnForbidChg4 | 2539 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffForbidChg4 | 2540 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | ForceSocMaxChg | 2548 | U16 | 2 | 0-1000 | 1E-3 |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
|  |  | Reserve | 2549-2550 |  |  |  |  |  |  | √ | X | √ | √ |
| x | √ | GenCtrlEn | 2551 | U16 | 2 | bit0:Diesel engine timing function (0-disable, 1-enable) / bit1:Ambient temperature start (0-off, 1-on) / bit2:Overload start (0-shutdown, 1-start) / bit3-bit16:Rsvd |  | bit0:diesel generator scheduling function(0-off, 1-enable) / bit1:ambient temperature start(0-off, 1-on) / bit2:overload start(0-off, 1-start) / bit3-bit16:reserved |  | √ | X | √ | √ |
| x | √ | StartGenSocMin | 2552 | U16 | 2 | 0-1000 | 1E-3 |  |  | √ | X | √ | √ |
| x | √ | EndGenSocMax | 2553 | U16 | 2 | 0-1000 | 1E-3 |  |  | √ | X | √ | √ |
| x | √ | TimeOnGen1 | 2554 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffGen1 | 2555 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnGen2 | 2556 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffGen2 | 2557 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnGen3 | 2558 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffGen3 | 2559 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnGen4 | 2560 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOffGen4 | 2561 | U16 | 2 | H:0-23 / M:0-59 |  |  |  | √ | X | √ | √ |
| x | √ | TimeOnDelay | 2562 | U16 | 2 | 0-1000 | S |  |  | √ | X | √ | √ |
| x | √ | TimeOffDelay | 2563 | U16 | 2 | 0-60000 | s |  |  | √ | X | √ | √ |
| x | √ | StartGenTEMP | 2564 | S16 | 2 | -40-60 | ℃ |  |  | √ | X | √ | √ |
| x | √ | EndGenTEMP | 2565 | S16 | 2 | -40-60 | ℃ |  |  | √ | X | √ | √ |
| x | √ | ECOModeTimeCnt | 2566 | U16 | 2 | 1-6000 | s |  |  | √ | X | √ | √ |
| x | √ | ECOModePowerStart | 2567 | S16 | 2 | 0~1000 | W |  |  | √ | X | √ | √ |
| x | √ | ExtEmsMod | 2568 | S16 | 2 | 0: controlled charge/discharge power/ChgPwc / 1: controlled inverter power/InvPwr / 2: controlled grid power/GridPwr / 3: Off(power-on default value) |  |  |  | √ | X | √ | √ |
| x | √ | EmsCtrlPwr | 2569-2570 | S32 | 4 | -2147483648~2147483647 | W | external EMS mode=0, is charge/discharge power;  / external EMS mode=1, is inverter power;  / external EMS mode=2, is grid power |  | √ | X | X | √ |
| x | √ | GridPower | 2571 | S16 | 2 |  |  |  |  |  |  |  |  |
|  |  | Reserve | 2568-2999 |  |  |  |  |  |  | √ | X | √ | √ |

## Set parameters 7 (battery parameters)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | BatType | 3000 | U16 | 2 | 0: No Battery  / 1: Lith  / 2: Lead  / 3: Simulated / 4: Sodium |  | default: 0: No Battery |  | √ | X | √ | √ |
| x | √ | BatBrand | 3001 | U16 | 2 | BatBrand |  | default: 2: IVYHV IVY high voltage | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | VBatNorm | 3002 | U16 | 2 | 400-8000 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | BatCap | 3003 | U16 | 2 | 100~10000 | 0.1Ahr |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | ChgCntMax | 3004 | U16 | 2 | 1-10 |  |  |  | √ | X | √ | √ |
| x | √ | MaxSOC | 3005 | U16 | 2 | 0~1000 | 1E-3 |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | MinSOC | 3006 | U16 | 2 | 0~990 | 1E-3 |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | VBatMax | 3007 | U16 | 2 | 350~8500 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | VBatMin | 3008 | U16 | 2 | 350~8500 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | CurrMaxChg | 3009 | U16 | 2 | 500~50000 | 0.01A |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | CurrMaxDisChg | 3010 | U16 | 2 | 500~50000 | 0.01A |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | TBatMax | 3011 | S16 | 2 | 250~900 | 0.1℃ |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | TBatMin | 3012 | S16 | 2 | -300~250 | 0.1℃ |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | VConstVolt | 3013 | U16 | 2 | 350~8500 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | IConstVoltEnd | 3014 | U16 | 2 | 10~10000 | 0.01A |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | TConstVolt | 3015 | U16 | 2 | 1-15000 | S |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | VDisChgEnd | 3016 | U16 | 2 | 350~8000 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | EmerChgStartV | 3017 | U16 | 2 | 100-8000 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | EmerChgEndV | 3018 | U16 | 2 | 350-8000 | 0.1V |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | EmerChgI | 3019 | U16 | 2 | 100~50000 | 0.01A |  | 21.08.30 updated range | √ | X | √ | √ |
| x | √ | BatResComp | 3020 | U16 | 2 | 0.0~50000 | 0.1mΩ |  |  | √ | X | √ | √ |
| x | √ | BatTempComp | 3021 | S16 | 2 | -5000~5000 | (0.1mV/cell/℃ |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | WChaMax | 3022-3023 | U32 | 4 | 100~500000 | 1W |  | 21.08.30 updated range | √ | X | X | √ |
| x | √ | WChaGra | 3024 | U16 | 2 | 0~60000 | 0.1%/s |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | WDisChaGra | 3025 | U16 | 2 | 0~60000 | 0.1%/s |  | 2021-08-30 updated range and unit | √ | X | √ | √ |
| x | √ | LeadAcidBrand | 3026 | U16 |  | 0. common / 1. SACRED SACRED / 2. |  | default: 0: common |  | √ | X | √ | √ |
| x | √ | SeriesPackNum | 3027 | U16 | 2 | 1~25 |  |  |  | √ | X | √ | √ |
| x | √ | VPackNorm | 3028 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackMax | 3029 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackMin | 3030 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackChgEnd | 3031 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackDisChgEnd | 3032 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackEmerChgStart | 3033 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | VPackEmerChgEnd | 3034 | U16 | 2 | 60~850 | 0.1V |  |  | √ | X | √ | √ |
| x | √ | AcidSoc | 3035 | U16 | 2 | 0-1000 | 1E-3 |  |  | √ | X | √ | √ |
| x | √ | Ongrid_Minsoc | 3036 | U16 | 2 | 0~1000 | 1E-3 |  |  | √ | X | √ | √ |
| x | √ | SodiumBrand | 3037 | U16 | 2 | 0: FZSoNick |  |  |  | √ | X | √ | √ |
|  |  | Reserve | 3037-3499 |  |  |  |  |  |  | √ | X | √ | √ |

## Set parameters 8 (lithium battery communication data, rolling download)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | ChgCurrMax | 3500-3501 | Float/S32 | 4 | 100-10000 | 0.01A |  |  | √ | X | X | X |
| x | √ | DisChgCurrMax | 3502-3503 | Float/S32 | 4 | 100-10000 | 0.01A |  |  | √ | X | X | X |
| x | √ | ChgMaxSoc | 3504 | U16 | 2 | 0-100 | % |  |  | √ | X | X | X |
| x | √ | DisChgMinSoc | 3505 | U16 | 2 | 0-100 | % |  |  | √ | X | X | X |
| x | √ | ChgVMax | 3506-3507 | Float/U32 | 4 |  | 0.1V |  |  | √ | X | X | X |
| x | √ | DisChgVMin | 3508-3509 | Float/U32 | 4 |  | 0.1V |  |  | √ | X | X | X |
| x | √ | BatCtrlCmd | 3510 | U16 | 2 | Bit0:chargeenable / Bit1:dischargeenable / Bit2:forced charge command / Bit3:power-off command |  |  |  | √ | X | X | X |
| x | √ | EmerChgStartSoc | 3511 | U16 | 2 |  | % |  |  | √ | X | X | X |
| x | √ | EmerChgEndSoc | 3512 | U16 | 2 |  | % |  |  | √ | X | X | X |
| x | √ | BatState | 3515 | U16 | 2 |  |  | sleep, start, run, fault |  | √ | X | X | X |
| x | √ | SOH | 3516 | U16 | 2 |  | % |  |  | √ | X | X | X |
| x | √ | SOC | 3517 | U16 | 2 |  | % |  |  | √ | X | X | X |
| x | √ | BatVolt | 3518-3519 | Float/U32 | 4 |  | 0.1V |  |  | √ | X | X | X |
| x | √ | BatCurr | 3520-3521 | Float/S32 | 4 |  | 0.01A | charge is positive, discharge is negative |  | √ | X | X | X |
| x | √ | BatTemp | 3522-3523 | Float/U32 | 4 |  | 0.1℃ |  |  | √ | X | X | X |
| x | √ | VCellMin | 3524-3525 | Float/U32 | 4 |  | mV |  |  | √ | X | X | X |
| x | √ | VCellMax | 3526-3527 | Float/U32 | 4 |  | mV |  |  | √ | X | X | X |
| x | √ | BatErr | 3528-3529 | U32 | 4 |  |  |  |  | √ | X | X | X |
| x | √ | NumVCe1lMin | 3530 | U16 | 2 |  |  |  |  | √ | X | X | X |
| x | √ | NumVCellMax | 3531 | U16 | 2 |  |  |  |  | √ | X | X | X |
| x | √ | TempCellMin | 3532-3533 | Float/U32 | 4 |  | ℃ |  |  | √ | X | X | X |
| x | √ | TempCellMax | 3534-3535 | Float/S32 | 4 |  | ℃ |  |  | √ | X | X | X |
| x | √ | NumTempCellMin | 3536 | U16 | 2 |  |  |  |  | √ | X | X | X |
| x | √ | NumTempCellMax | 3537 | U16 | 2 |  |  |  |  | √ | X | X | X |
| x | √ | VCellMinLimit | 3538 | U16 | 2 |  | mV |  |  | √ | X | X | X |
| x | √ | VCellMaxLimit | 3539 | U16 | 2 |  | mV |  |  | √ | X | X | X |
| x | √ | Warning | 3540-3541 | U32 | 4 |  |  |  |  | √ | X | X | X |
| x | √ | BatHwVersion | 3542 | U16 | 2 | H:hardware version V, L:hardware version R |  |  |  | √ | X | X | X |
| x | √ | BatSwVersion | 3543 | U16 | 2 | H:software major version, L:software minor version |  |  |  | √ | X | X | X |
| x | √ | BatCellNums | 3544 | U16 | 2 |  |  |  |  | √ | X | X | X |
| x | √ | BatSN | 3545 | U16 | 24 | ASCII |  |  |  |  |  |  |  |
| x | √ | BatHwVersion Comparison | 3560 | U16 | 4 | battery version status 0xAAconsistent, 0xBBinconsistent |  |  |  | √ | X | X | X |
| x | √ | Reserve | 3561-3999 |  |  |  |  |  |  | √ | X | X | X |

## Battery fault data

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | CanID1 | 3800~3801 | U32 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID2 | 3802~3803 | U32 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID3 | 3804~3805 | U32 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID4 | 3806~3807 | U32 |  |  |  |  |  | √ | X | X | X |
| x | √ | Reserve | 3808~3815 | U8*8 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanIDl Data0-8 | 3816~3819 | U8*8 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID2 Data0-8 | 3820~3823 | U8*8 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID3 Data0-8 | 3824~3827 | U8*8 |  |  |  |  |  | √ | X | X | X |
| x | √ | CanID4 Data0-8 | 3828~3831 | U8*8 |  |  |  |  |  | √ | X | X | X |
| Control mode setting |  |  |  |  |  |  |  |  |  |  |  |  |  |
| x | √ | InvActStatues | 7000 | U16 | 2 | 1:in progress / 2:request data retransmission / other values: invalid |  | inverter updates every minute |  | √ | X | √ | √ |
| x | √ | CurrEActID | 7001 | U16 | 2 | 1-10, actions 1-10 / other values, invalid |  | inverter updates every minute |  | √ | X | √ | √ |
| x | √ | CurrEActCountdownRTime | 7002 | U16 | 2 | 0-1440:current action elapsed time;  / other values, invalid | minute | inverter updates every minute, counting up |  | √ | X | √ | √ |
| x | √ | Reserve7003 | 7003 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | Reserve7004 | 7004 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | Reserve7005 | 7005 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | Reserve7006 | 7006 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | Reserve7007 | 7007 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | EPriceStatues | 7008 | U16 | 2 | 0:globally disabled / 1:restart / other values: invalid |  |  |  | √ | X | √ | √ |
| x | √ | Reserve7009 | 7009 | U16 | 2 |  |  | reserved field |  | √ | X | √ | √ |
| x | √ | EAct1_ActTime | 7010 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct1_CtrlMode | 7011 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct1_Value | 7012 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct2_ActTime | 7013 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct2_CtrlMode | 7014 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct2_Value | 7015 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct3_ActTime | 7016 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct3_CtrlMode | 7017 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct3_Value | 7018 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct4_ActTime | 7019 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct4_CtrlMode | 7020 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct4_Value | 7021 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct5_ActTime | 7022 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct5_CtrlMode | 7023 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct5_Value | 7024 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct6_ActTime | 7025 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct6_CtrlMode | 7026 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct6_Value | 7027 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct7_ActTime | 7028 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct7_CtrlMode | 7029 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct7_Value | 7030 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct8_ActTime | 7031 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct8_CtrlMode | 7032 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct8_Value | 7033 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct9_ActTime | 7034 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct9_CtrlMode | 7035 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct9_Value | 7036 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
| x | √ | EAct10_ActTime | 7037 | U16 | 2 | 1-1440:current action duration | minute |  |  | √ | X | √ | √ |
| x | √ | EAct10_CtrlMode | 7038 | U16 | 2 | 0:action not executed / 1:charge/discharge power, positive is discharge, negative is charge / 2:inverter power / 3:grid power, positive is selling power, negative is buying power |  |  |  | √ | X | √ | √ |
| x | √ | EAct10_Value | 7039 | S16 | 2 | -30000~30000means-300kw~300km | 10W |  |  | √ | X | √ | √ |
