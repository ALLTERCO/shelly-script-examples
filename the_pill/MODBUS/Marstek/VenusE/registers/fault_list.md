# Fault List

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [**Fault List**](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- Runtime fault and warning register locations are listed in [Runtime Information 04](runtime_information_04.md).
- Protocol changes that add or update faults are tracked in [Protocol Change Log](protocol_change_log.md).

| Fault type | No. | Bit | Fault code | Fault name |
| --- | --- | --- | --- | --- |
| PV faults | 1 | 0 | A01 | PvConnectFault |
| PV faults | 2 | 1 | A02 | IsoFault |
| PV faults | 3 | 2 | A03 | PvAfciFault |
| PV faults | 4 | 3 | A04 | Pv1OverVoltageFault |
| PV faults | 5 | 4 | A05 | Pv2OverVoltageFault |
| PV faults | 6 | 5 | A06 | Pv3OverVoltageFault |
| PV faults | 7 | 6 | A07 | Pv4OverVoltageFault |
| PV faults | 8 | 7 | A08 | Pv5OverVoltageFault |
| PV faults | 9 | 8 | A09 | Pv6OverVoltageFault |
| PV faults | 10 | 9 | A10 | Pv7OverVoltageFault |
| PV faults | 11 | 10 | A11 | Pv8OverVoltageFault |
| PV faults | 12 | 11 | A12 | Pv9OverVoltageFault |
| PV faults | 13 | 12 | A13 | Pv10OverVoltageFault |
| PV faults | 14 | 13 | A14 | Pv11OverVoltageFault |
| PV faults | 15 | 14 | A15 | Pv12OverVoltageFault |
| PV faults | 16 | 15 | A16 | PV1ReverseFault |
| PV faults | 17 | 16 | A17 | PV2ReverseFault |
| PV faults | 18 | 17 | A18 | PV3ReverseFault |
| PV faults | 19 | 18 | A19 | PV4ReverseFault |
| PV faults | 20 | 19 | A20 | PV5ReverseFault |
| PV faults | 21 | 20 | A21 | PV6ReverseFault |
| PV faults | 22 | 21 | A22 | PV7ReverseFault |
| PV faults | 23 | 22 | A23 | PV8ReverseFault |
| PV faults | 24 | 23 | A24 | PV9ReverseFault |
| PV faults | 25 | 24 | A25 | PV10ReverseFault |
| PV faults | 26 | 25 | A26 | PV11ReverseFault |
| PV faults | 27 | 26 | A27 | PV12ReverseFault |
| PV faults | 28 | 27 | A28 | Reserved |
| PV faults | 29 | 28 | A29 | Reserved |
| PV faults | 30 | 29 | A30 | Reserved |
| PV faults | 31 | 30 | A31 | Reserved |
| PV faults | 32 | 31 | A32 | Reserved |
| PV faults | 33 | 0 | A33 | Pv1AberrantFault |
| PV faults | 34 | 1 | A34 | Pv2AberrantFault |
| PV faults | 35 | 2 | A35 | Pv3AberrantFault |
| PV faults | 36 | 3 | A36 | Pv4AberrantFault |
| PV faults | 37 | 4 | A37 | Pv5AberrantFault |
| PV faults | 38 | 5 | A38 | Pv6AberrantFault |
| PV faults | 39 | 6 | A39 | Pv7AberrantFault |
| PV faults | 40 | 7 | A40 | Pv8AberrantFault |
| PV faults | 41 | 8 | A41 | Pv9AberrantFault |
| PV faults | 42 | 9 | A42 | Pv10AberrantFault |
| PV faults | 43 | 10 | A43 | Pv11AberrantFault |
| PV faults | 44 | 11 | A44 | Pv12AberrantFault |
| PV faults | 45 | 12 | A45 | Pv13AberrantFault |
| PV faults | 46 | 13 | A46 | Pv14AberrantFault |
| PV faults | 47 | 14 | A47 | Pv15AberrantFault |
| PV faults | 48 | 15 | A48 | Pv16AberrantFault |
| PV faults | 49 | 16 | A49 | Pv17AberrantFault |
| PV faults | 50 | 17 | A50 | Pv18AberrantFault |
| PV faults | 51 | 18 | A51 | Pv19AberrantFault |
| PV faults | 52 | 19 | A52 | Pv20AberrantFault |
| PV faults | 53 | 20 | A53 | Pv21AberrantFault |
| PV faults | 54 | 21 | A54 | Pv22AberrantFault |
| PV faults | 55 | 22 | A55 | Pv23AberrantFault |
| PV faults | 56 | 23 | A56 | Pv24AberrantFault |
| Battery faults | 1 | 0 | B01 | PcsBatVolOverFault |
| Battery faults | 2 | 1 | B02 | PcsBatVolUnderFault |
| Battery faults | 3 | 2 | B03 | PcsBatVolInsOverFaul |
| Battery faults | 4 | 3 | B04 | PcsBatReverseFault |
| Battery faults | 5 | 4 | B05 | PcsBatConnectFault |
| Battery faults | 6 | 5 | B06 | PcsBatCommunicationF |
| Battery faults | 7 | 6 | B07 | PcsBatTempSensorOpen |
| Battery faults | 8 | 7 | B08 | PcsBatTempSensorShor |
| Battery faults | 9 | 8 | B09 | BmsBatSystemFault |
| Battery faults | 10 | 9 | B10 | BmsBatVolOverFault |
| Battery faults | 11 | 10 | B11 | BmsBatVolUnderFault |
| Battery faults | 12 | 11 | B12 | BmsCellVolOverFault |
| Battery faults | 13 | 12 | B13 | BmsCellVolUnderFault |
| Battery faults | 14 | 13 | B14 | BmsCellVolUnbanceFau |
| Battery faults | 15 | 14 | B15 | BatChgCurOverFault |
| Battery faults | 16 | 15 | B16 | BatDChgCurOverFault |
| Battery faults | 17 | 16 | B17 | BatTemperatureOverFa |
| Battery faults | 18 | 17 | B18 | BatTemperatureUnderF |
| Battery faults | 19 | 18 | B19 | CelTemperatureOverFa |
| Battery faults | 20 | 19 | B20 | CelTemperatureUnderF |
| Battery faults | 21 | 20 | B21 | BatIsoFault |
| Battery faults | 22 | 21 | B22 | BatSocLowFault |
| Battery faults | 23 | 22 | B23 | BmsInterComFault |
| Battery faults | 24 | 23 | B24 | BatRelayFault |
| Battery faults | 25 | 24 | B25 | BatPreChaFault |
| Battery faults | 26 | 25 | B26 | BmsBatChgMosFault |
| Battery faults | 27 | 26 | B27 | BmsBatDChgMosFault |
| Battery faults | 28 | 27 | B28 | BMSVolOVFault |
| Battery faults | 29 | 28 | B29 | BMSVolLFault |
| Battery faults | 30 | 29 | B30 | VolLockOpenFault |
| Battery faults | 31 | 30 | B31 | VolLockShortFault |
| Battery faults | 32 | 31 | B32 | ChgRefOVFault |
| Grid faults | 1 | 0 | C01 | GridLossFault |
| Grid faults | 2 | 1 | C02 | GridVoltUnbalanFault |
| Grid faults | 3 | 2 | C03 | GridInstVoltHighFaul |
| Grid faults | 4 | 3 | C04 | Grid10MinOverFault |
| Grid faults | 5 | 4 | C05 | GridOverVoltFault |
| Grid faults | 6 | 5 | C06 | GridUnderVoltFault |
| Grid faults | 7 | 6 | C07 | GridOverLineVoltFaul |
| Grid faults | 8 | 7 | C08 | GridUnderLineVoltFau |
| Grid faults | 9 | 8 | C09 | GridOverFreqFault |
| Grid faults | 10 | 9 | C10 | GridUnderFreqFault |
| Off-grid faults | 1 | 0 | D01 | UpsOVerPowerFault |
| Off-grid faults | 2 | 1 | D02 | GridConflictFault |
| Off-grid faults | 3 | 2 | D03 | DieselOverVoltFault |
| Off-grid faults | 4 | 3 | D04 | DieselUnderVoltFault |
| Off-grid faults | 5 | 4 | D05 | DieselOverFreqFault |
| Off-grid faults | 6 | 5 | D06 | DieselUnderFreqFault |
| DC-side faults 1 | 1 | 0 | E01 | Pv1HwOverCurrFault |
| DC-side faults 1 | 2 | 1 | E02 | Pv2HwOverCurrFault |
| DC-side faults 1 | 3 | 2 | E03 | Pv3HwOverCurrFault |
| DC-side faults 1 | 4 | 3 | E04 | Pv4HwOverCurrFault |
| DC-side faults 1 | 5 | 4 | E05 | Pv5HwOverCurrFault |
| DC-side faults 1 | 6 | 5 | E06 | Pv6HwOverCurrFault |
| DC-side faults 1 | 7 | 6 | E07 | Pv7HwOverCurrFault |
| DC-side faults 1 | 8 | 7 | E08 | Pv8HwOverCurrFault |
| DC-side faults 1 | 9 | 8 | E09 | Pv9HwOverCurrFault |
| DC-side faults 1 | 10 | 9 | E10 | Pv10HwOverCurrFault |
| DC-side faults 1 | 11 | 10 | E11 | Pv11HwOverCurrFault |
| DC-side faults 1 | 12 | 11 | E12 | Pv12HwOverCurrFault |
| DC-side faults 1 | 13 | 12 | E13 | Pv1SwOverCurrFault |
| DC-side faults 1 | 14 | 13 | E14 | Pv2SwOverCurrFault |
| DC-side faults 1 | 15 | 14 | E15 | Pv3SwOverCurrFault |
| DC-side faults 1 | 16 | 15 | E16 | Pv4SwOverCurrFault |
| DC-side faults 1 | 17 | 16 | E17 | Pv5SwOverCurrFault |
| DC-side faults 1 | 18 | 17 | E18 | Pv6SwOverCurrFault |
| DC-side faults 1 | 19 | 18 | E19 | Pv7SwOverCurrFault |
| DC-side faults 1 | 20 | 19 | E20 | Pv8SwOverCurrFault |
| DC-side faults 1 | 21 | 20 | E21 | Pv9SwOverCurrFault |
| DC-side faults 1 | 22 | 21 | E22 | Pv10SwOverCurrFault |
| DC-side faults 1 | 23 | 22 | E23 | Pv11SwOverCurrFault |
| DC-side faults 1 | 24 | 23 | E24 | Pv12SwOverCurrFault |
| DC-side faults 1 | 25 | 24 | E25 | Reserved |
| DC-side faults 1 | 26 | 25 | E26 | Reserved |
| DC-side faults 1 | 27 | 26 | E27 | Reserved |
| DC-side faults 1 | 28 | 27 | E28 | Reserved |
| DC-side faults 1 | 29 | 28 | E29 | Reserved |
| DC-side faults 1 | 30 | 29 | E30 | Reserved |
| DC-side faults 1 | 31 | 30 | E31 | Reserved |
| DC-side faults 1 | 32 | 31 | E32 | Reserved |
| DC-side faults 1 | 33 | 0 | E33 | Boost1SelfCheckFault |
| DC-side faults 1 | 34 | 1 | E34 | Boost2SelfCheckFault |
| DC-side faults 1 | 35 | 2 | E35 | Boost3SelfCheckFault |
| DC-side faults 1 | 36 | 3 | E36 | Boost4SelfCheckFault |
| DC-side faults 1 | 37 | 4 | E37 | Boost5SelfCheckFault |
| DC-side faults 1 | 38 | 5 | E38 | Boost6SelfCheckFault |
| DC-side faults 1 | 39 | 6 | E39 | Boost7SelfCheckFault |
| DC-side faults 1 | 40 | 7 | E40 | Boost8SelfCheckFault |
| DC-side faults 1 | 41 | 8 | E41 | Boost9SelfCheckFault |
| DC-side faults 1 | 42 | 9 | E42 | Boost10SelfCheckFault |
| DC-side faults 1 | 43 | 10 | E43 | Boost11SelfCheckFault |
| DC-side faults 1 | 44 | 11 | E44 | Boost12SelfCheckFault |
| DC-side faults 1 | 45 | 12 | E45 | BusAllVoltHwOveFault |
| DC-side faults 1 | 46 | 13 | E46 | BusHalfVoltHwOveFault |
| DC-side faults 1 | 47 | 14 | E47 | BusAllVoltSwOveFault |
| DC-side faults 1 | 48 | 15 | E48 | BusHalfVoltSwOveFault |
| DC-side faults 1 | 49 | 16 | E49 | BusAllVoltSwUnderFault |
| DC-side faults 1 | 50 | 17 | E50 | BusUnbalaFault |
| DC-side faults 1 | 51 | 18 | E51 | BusBalBridgeHwOverCurFault |
| DC-side faults 1 | 52 | 19 | E52 | BusBalBridgeSwOverCurFault |
| DC-side faults 1 | 53 | 20 | E53 | BusBalBridgeSelfCheckFault |
| DC-side faults 1 | 54 | 21 | E54 | BuckBoostHwOverCurrFault |
| DC-side faults 1 | 55 | 22 | E55 | BuckBoostSwOverCurrFault |
| DC-side faults 1 | 56 | 23 | E56 | BuckBoostSelfCheckFault |
| DC-side faults 1 | 57 | 24 | E57 | BuckBoostSwOverVoltFault |
| DC-side faults 1 | 58 | 25 | E58 | HwTransformerFault |
| DC-side faults 1 | 59 | 26 | E59 | BdcFuseFault |
| DC-side faults 1 | 60 | 27 | E60 | BdcRelayFault |
| AC-side faults | 1 | 0 | F01 | HardwareFault |
| AC-side faults | 2 | 1 | F02 | InvHwCurrHighFault |
| AC-side faults | 3 | 2 | F03 | RInvInstCurrHighFault |
| AC-side faults | 4 | 3 | F04 | SInvInstCurrHighFault |
| AC-side faults | 5 | 4 | F05 | TInvInstCurrHighFault |
| AC-side faults | 6 | 5 | F06 | GridCurrUnbanceFault |
| AC-side faults | 7 | 6 | F07 | DcInjCurrFault |
| AC-side faults | 8 | 7 | F08 | LeakCurrFault |
| AC-side faults | 9 | 8 | F09 | PllFault |
| AC-side faults | 10 | 9 | F10 | GridRelayFault |
| AC-side faults | 11 | 10 | F11 | UpsRelayFault |
| AC-side faults | 12 | 11 | F12 | GenRelayFault |
| AC-side faults | 13 | 12 | F13 | Relay4Fault |
| AC-side faults | 14 | 13 | F14 | RUPSInstCurrHighFault |
| AC-side faults | 15 | 14 | F15 | SUPSInstCurrHighFault |
| AC-side faults | 16 | 15 | F16 | TUPSInstCurrHighFault |
| AC-side faults | 17 | 16 | F17 | RDieselInstCurrHighFault |
| AC-side faults | 18 | 17 | F18 | SDieselInstCurrHighFault |
| AC-side faults | 19 | 18 | F19 | TDieselInstCurrHighFault |
| AC-side faults | 20 | 19 | F20 | TDieselPowerBackFault |
| AC-side faults | 21 | 20 | F21 | UPSInvHighVoltFault |
| AC-side faults | 22 | 21 | F22 | UPSInvLowVoltFault |
| AC-side faults | 23 | 22 | F23 | UPSInvHighFreqFault |
| AC-side faults | 24 | 23 | F24 | UPSInvLowFreqFault |
| AC-side faults | 25 | 24 | F25 | DcInjVoltFault |
| AC-side faults | 26 | 25 | F26 | ShortFault |
| AC-side faults | 27 | 26 | F27 | InvTubeFault |
| AC-side faults | 1 | 0 | G01 | PV1CurAdChanFault |
| AC-side faults | 2 | 1 | G02 | PV2CurAdChanFault |
| AC-side faults | 3 | 2 | G03 | PV3CurAdChanFault |
| AC-side faults | 4 | 3 | G04 | PV4CurAdChanFault |
| AC-side faults | 5 | 4 | G05 | PV5CurAdChanFault |
| AC-side faults | 6 | 5 | G06 | PV6CurAdChanFault |
| AC-side faults | 7 | 6 | G07 | PV7CurAdChanFault |
| AC-side faults | 8 | 7 | G08 | PV8CurAdChanFault |
| AC-side faults | 9 | 8 | G09 | PV9CurAdChanFault |
| AC-side faults | 10 | 9 | G10 | PV10CurAdChanFault |
| AC-side faults | 11 | 10 | G11 | PV11CurAdChanFault |
| AC-side faults | 12 | 11 | G12 | PV12CurAdChanFault |
| AC-side faults | 13 | 12 | G13 | BDCCurrAdChanFault |
| AC-side faults | 14 | 13 | G14 | BDCTransCurAdChanFault |
| AC-side faults | 15 | 14 | G15 | BusBalBridgeCurAdChanFault |
| AC-side faults | 16 | 15 | G16 | RInvCurAdChanFault |
| AC-side faults | 17 | 16 | G17 | SInvCurAdChanFault |
| AC-side faults | 18 | 17 | G18 | TInvCurAdChanFault |
| AC-side faults | 19 | 18 | G19 | RInvDciAdChanFault |
| AC-side faults | 20 | 19 | G20 | SInvDciAdChanFault |
| AC-side faults | 21 | 20 | G21 | TInvDciAdChanFault |
| AC-side faults | 22 | 21 | G22 | LeakSampCurrChanFault |
| AC-side faults | 23 | 22 | G23 | VolRefAdChanFault |
| AC-side faults | 24 | 23 | G24 | RUpsCurAdChanFault |
| AC-side faults | 25 | 24 | G25 | SUpsCurAdChanFault |
| AC-side faults | 26 | 25 | G26 | TUpsCurAdChanFault |
| AC-side faults | 27 | 26 | G27 | RGenCurAdChanFault |
| AC-side faults | 28 | 27 | G28 | SGenCurAdChanFault |
| AC-side faults | 29 | 28 | G29 | TGenCurAdChanFault |
| AC-side faults | 30 | 29 | G30 | RUpsDciAdChanFault |
| AC-side faults | 31 | 30 | G31 | SUpsDciAdChanFault |
| AC-side faults | 32 | 31 | G32 | TUpsDciAdChanFault |
| AC-side faults | 33 | 0 | G33 | Reserved |
| AC-side faults | 34 | 1 | G34 | Reserved |
| AC-side faults | 35 | 2 | G35 | Reserved |
| AC-side faults | 36 | 3 | G36 | Reserved |
| AC-side faults | 37 | 4 | G37 | TemperatureAdChanFault |
| AC-side faults | 38 | 5 | G38 | PVBatBusInconsistentFault |
| AC-side faults | 39 | 6 | G39 | MasterSlaveInconsistentFault |
| AC-side faults | 40 | 7 | G40 | InconsistentPortVolFault |
| AC-side faults | 41 | 8 | G41 | EnvironmentTemOverFault |
| AC-side faults | 42 | 9 | G42 | EnvironmentTemLowFault |
| AC-side faults | 43 | 10 | G43 | CoolingHighTempFault |
| AC-side faults | 44 | 11 | G44 | CoolingLowTempFault |
| AC-side faults | 45 | 12 | G45 | HighTemp3Fault |
| AC-side faults | 46 | 13 | G46 | LowTemp3Fault |
| AC-side faults | 47 | 14 | G47 | DspHighTempFault |
| AC-side faults | 48 | 15 | G48 | SoftHardInconsFault |
| AC-side faults | 49 | 16 | G49 | AfciSelfChkFault |
| AC-side faults | 50 | 17 | G50 | LeakSelfChkFault |
| AC-side faults | 51 | 18 | G51 | MicroInvOverPwr |
| AC-side faults | 1 | 0 | H01 | PVCurrOverErr |
| AC-side faults | 2 | 1 | H02 | BdcCurrOverErr |
| AC-side faults | 3 | 2 | H03 | InvCurrOverErr |
| AC-side faults | 4 | 3 | H04 | UpsCurrOverErr |
| AC-side faults | 5 | 4 | H05 | GenCurrOverErr |
| AC-side faults | 6 | 5 | H06 | DcInjCurrErr |
| AC-side faults | 7 | 6 | H07 | DcInjVoltErr |
| AC-side faults | 8 | 7 | H08 | BusAllVoltSwOveErr |
| AC-side faults | 9 | 8 | H09 | RelayErr |
| AC-side faults | 10 | 9 | H10 | PvBoostSelfChckErr |
| AC-side faults | 11 | 10 | H11 | BDCSelfChkPermErr |
| AC-side faults | 12 | 11 | H12 | InvOpenTestErr |
| Internal warnings | 1 | 0 | I01 | InterFanWarning |
| Internal warnings | 2 | 1 | I02 | ExternFanWarning |
| Internal warnings | 3 | 2 | I03 | Fan3Warning |
| Internal warnings | 4 | 3 | I04 | EnvironmentTemAdChanWarning |
| Internal warnings | 5 | 4 | I05 | CoolingTemAdChanWarning |
| Internal warnings | 6 | 5 | I06 | Temp3AdChanWarning |
| Internal warnings | 7 | 6 | I07 | FlashReadWarning |
| Internal warnings | 8 | 7 | I08 | EepromComWarning |
| Internal warnings | 9 | 8 | I09 | SlaveComWarning |
| Internal warnings | 10 | 9 | I10 | HmiComWarning |
| Internal warnings | 11 | 10 | I11 | FreqCalcConflictWarning |
| Internal warnings | 12 | 11 | I12 | UnsetModel |
| Internal warnings | 13 | 12 | I13 | ArcComWarning |
| Internal warnings | 14 | 13 | I14 | DspUpdate Fail |
| Internal warnings | 15 | 14 | I15 | OldTestPwrWarning |
| Internal warnings | 16 | 15 | I16 | PhsAbnormal |
| Internal warnings | 17 | 16 | I17 | Fan2Warning |
| Internal warnings | 18 | 17 | I18 | ChipWarning |
| External warnings | 1 | 0 | J01 | MeterComWarning |
| External warnings | 2 | 1 | J02 | MeterInstalWarning |
| External warnings | 3 | 2 | J03 | SohWarning |
| External warnings | 4 | 3 | J04 | GndAbnormalWarning |
| External warnings | 5 | 4 | J05 | ParallelComWarning |
| External warnings | 6 | 5 | J06 | PVOverVoltWaring |
| External warnings | 7 | 6 | J07 | Meter2ComWarning |
| External warnings | 8 | 7 | J08 | ParaComErr |
| External warnings | 9 | 8 | J09 | ParaComWarning |
| External warnings | 10 | 9 | J10 | MeterDataAbnormal |
| External warnings | 11 | 10 | J11 | CTDirectionErr |
| External warnings | 12 | 11 | J12 | Bat Activate Fail |
| External warnings | 13 | 12 | J13 | BatSocLowWarning |
| External warnings | 14 | 13 | J14 | RPWarning |
| External warnings | 15 | 14 | J15 | OVGWarning |
| External warnings | 16 | 15 | J16 | BatSoftwareMismatch |
| External warnings | 17 | 16 | J17 | SlavelComWarning |
| External warnings | 18 | 17 | J18 | Slave2ComWarning |
| External warnings | 19 | 18 | J19 | Slave3ComWarning |
| External warnings | 20 | 19 | J20 | Slave4ComWarning |
| External warnings | 21 | 20 | J21 | Slave5ComWarning |
| External warnings | 22 | 21 | J22 | Fire Alarm |
