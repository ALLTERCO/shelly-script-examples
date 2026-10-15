# Runtime Information 04

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [**Runtime Information 04**](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- Parameter settings and writable controls are in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md).
- Fault and warning register meanings are expanded in [Fault List](fault_list.md).
- Protocol revisions affecting these runtime registers are tracked in [Protocol Change Log](protocol_change_log.md).

## Protocol header (model attribute information)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | InverName | 0-5 | U16*6 | 12 | ASCII |  |  | Normalize the spelling of u16 and U16. | X | √ | X | X |
| √ | √ | InverType | 6 | U16 | 2 |  |  | 0-99 single-phase grid-tied inverter / 100-199 three-phase grid-tied inverter / 201-219 split-phase energy storage / 220-270 single-phase energy storage / 300-499 large three-phase energy storage / 500-599 small three-phase energy storage |  | X | √ | X | X |
| √ | √ | NormAppPower | 7-8 | U32 | 4 |  | 1W |  | 1. 1w changed to 1VA; / 2. rated apparent powerchanged to rated power, unit: 1VA changed to 1W | X | √ | X | X |
| √ | √ | NormReactPower | 9-10 | U32 | 4 |  | 1var |  |  | X | √ | X | X |
| √ | √ | HardName | 11-14 | U16*4 | 8 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | HardVer | 15 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | ProtocolName | 16-19 | U16*4 | 8 | ASCII |  | "" |  | X | √ | X | X |
| √ | √ | ProtocolVer | 20 | U16 | 2 |  |  | XXX.XX | Starts from 1 | X | √ | X | X |
| √ | √ | MasterName | 21-24 | U16*4 | 8 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | MasterVer | 25 | U16 | 2 |  |  | XXX.XX |  | X | √ | X | X |
| √ | √ | SlaveName | 26-29 | U16*4 | 8 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SlaveVer | 30 | U16 | 2 |  |  | XXX.XX |  | X | √ | X | X |
| √ | √ | HMIName | 31-34 | U16*4 | 8 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | HMIVer | 35 | U16 | 2 |  |  | XXX.XX |  | X | √ | X | X |
| √ | √ | CPLDName | 36-39 | U16*4 | 8 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | CPLDVer | 40 | U16 | 2 |  |  | XXX.XX |  | X | √ | X | X |
| √ | √ | SerialNumber15-14 | 41 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber13-12 | 42 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber11-10 | 43 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber9-8 | 44 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber7-6 | 45 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber5-4 | 46 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber3-2 | 47 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | SerialNumber1-0 | 48 | U16 | 2 | ASCII |  |  |  | X | √ | X | X |
| √ | √ | Safty | 49 | U16 | 2 | safety standard |  |  |  | X | √ | X | X |
| √ | √ | MaxAcOutCurr | 50-51 | U32 | 4 |  | 0.01A |  | Added unit 0.01A | X | √ | X | X |
| √ | √ | InverCharacter | 52-53 | U32 | 4 |  |  | B0-B2: 0 means grid-tied inverter, 1 means low-voltage energy storage, 2 means high-voltage energy storage;  / B3-B5: 0 means single-phase, 1 means split-phase, 2 means three-phase;  / B6-B9: PV  boost path count, 0 means 1 path, 1 means 2 paths, N means N+ paths;  / B10: 0 means no generator, 1 means generator present;  / B11-B31: reserved; | Added 21.05.12 used for platform identification / B1-B31 changed to B11-B31 | X | √ | X | X |
|  |  | Reserve | 54-499 |  |  |  |  |  |  | X | √ | X | X |

## Real-time runtime information 1 (PV + grid-tied runtime information)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | Vbus | 500 | U16 | 2 |  | 0.1V | If single-phase, only R phase voltage, R phase current are valid;  / If two-phase, only R, S phase voltage, R,S phase current are valid;  / If three-phase four-wire system,means: "X phase voltage";  / If three-phase three-wire system,means: "x-x line voltage". / positive means the inverter feeds power to the grid; negative means the inverter draws power from the grid |  | X | √ | X | X |
| √ | √ | Vnbus | 501 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Riso | 502 | U16 | 2 |  | KΩ |  |  | X | √ | X | X |
| √ | √ | IgfciRms | 503 | U16 | 2 |  | 1mA |  |  | X | √ | X | X |
| √ | √ | DCIR | 504 | S16 | 2 |  | 1mA |  |  | X | √ | X | X |
| √ | √ | DCIS | 505 | S16 | 2 |  | 1mA |  |  | X | √ | X | X |
| √ | √ | DCIT | 506 | S16 | 2 |  | 1mA |  |  | X | √ | X | X |
| √ | √ | VgridR | 507 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | VgridS | 508 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | VgridT | 509 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | IgridR | 510 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | IgridS | 511 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | IgridT | 512 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | FgridR | 513 | U16 | 2 |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | FgridS | 514 | U16 | 2 |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | FgridT | 515 | U16 | 2 |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | PinvR | 516-517 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | PinvS | 518-519 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | PinvT | 520-521 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | Pinv | 522-523 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | Qinv | 524-525 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | PFinv | 526 | S16 | 2 |  | 1E-3 |  |  | X | √ | X | X |
| √ | √ | Sinv | 527-528 | U32 | 4 |  | VA |  |  | X | √ | X | X |
| √ | √ | PgridR | 529-530 | S32 | 4 |  | W | Negative means the inverter feeds power to the grid; positive means the inverter draws power from the grid |  | X | √ | X | X |
| √ | √ | PgridS | 531-532 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | PgridT | 533-534 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | Pgrid | 535-536 | S32 | 4 |  | W |  | Added unit W | X | √ | X | X |
| √ | √ | Qgrid | 537-538 | S32 | 4 |  | Var |  | Added unit Var | X | √ | X | X |
| √ | √ | Sgrid | 539-540 | U32 | 4 |  | VA |  | Added unit VA | X | √ | X | X |
| x | x | PloadR | 541-542 | S32 | 4 |  | W |  |  | X | √ | X | X |
| x | x | PloadS | 543-544 | S32 | 4 |  | W |  |  | X | √ | X | X |
| x | x | PloadT | 545-546 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | Pload | 547-548 | S32 | 4 |  | W |  | Added unit W | X | √ | X | X |
| x | x | Qload | 549-550 | S32 | 4 |  | Var |  | Added unit Var | X | √ | X | X |
| x | x | Sload | 551-552 | U32 | 4 |  | VA |  | Added unit VA | X | √ | X | X |
| √ | √ | Ppv | 553-554 | U32 | 4 |  | W |  | Added unit W | X | √ | X | X |
| √ | √ | Vpv1 | 555 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv1 | 556 | U16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | Ppv1 | 557 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | Vpv2 | 558 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv2 | 559 | U16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | Ppv2 | 560 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | Vpv3 | 561 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv3 | 562 | U16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | Ppv3 | 563 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | Vpv4 | 564 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv4 | 565 | U16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | Ppv4 | 566 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | Vpv5 | 567 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv5 | 568 | U16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | Ppv5 | 569 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | Vpv6 | 570 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | Ipv6 | 571 | U16 | 2 |  | 0.01A |  | For energy storage, total PV power is required | X | √ | X | X |
| √ | √ | Ppv6 | 572 | U16 | 2 |  | W |  |  | X | √ | X | X |
| √ | √ | PVConn | 573 | U16 | 2 | B0:CONNECTED / B1:AVAILABLE / B2:OPERATING / B3:TEST |  |  |  | X | √ | X | X |
| √ | √ | VInvR | 574 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | VInvS | 575 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | VInvT | 576 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | Passitgrid | 577 | S32 | 4 |  | W |  |  | X | √ | X | X |
| √ | √ | IInvR | 579 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | IInvS | 580 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| √ | √ | IInvT | 581 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
|  |  | Reserve | 574-999 |  |  |  |  |  |  | X | √ | X | X |

## Real-time runtime information 2 (PV + grid-tied energy generation)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | x | EInvOutDay | 1000 | U16 | 2 |  | 0.1kwh |  | Unit changed from 0.1 Wh to 0.1 kWh | X | √ | X | X |
| x | x | EInvRecDay | 1001 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtogridDay | 1002 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EfromgridDay | 1003 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtoLoadDay | 1004 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | x | EfromLoadDay | 1005 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPVDay | 1006-1007 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV1Day | 1008 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV2Day | 1009 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV3Day | 1010 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV4Day | 1011 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV5Day | 1012 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPV6Day | 1013 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | x | EInvOutTotal | 1014-1015 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | x | EInvRecTotal | 1016-1017 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtogridTotal | 1018-1019 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EfromgridTotal | 1020-1021 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtoLoadTotal | 1022-1023 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | x | EfromLoadTotal | 1024-1025 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EPVTotal | 1026-1027 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtogridDay32 | 1041-1042 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EfromgridDay32 | 1043-1044 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| √ | √ | EtoLoadDay32 | 1045-1046 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
|  |  | Reserve | 1028-1499 |  |  |  |  |  |  | X | √ | X | X |

## Real-time runtime information 3 (Backup runtime information)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | DCVR | 1500 | S16 | 2 |  | mV | If output type is 0, only A phase voltage, A phase current are valid;  / If output type is 1,means: "X phase voltage";  / If output type is 2,means: "x-x line voltage". | Added unit mV | X | √ | X | X |
| x | √ | DCVS | 1501 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | DCVT | 1502 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | VepsR | 1503 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | VepsS | 1504 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | VepsT | 1505 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | IepsR | 1506 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | IepsS | 1507 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | IepsT | 1508 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | FepsR | 1509 | U16 | 2 |  | 0.01Hz |  |  | X | √ | X | X |
| x | √ | PepsR | 1510 | S16 | 2 |  | W |  |  | X | √ | X | X |
| x | √ | PepsS | 1511 | S16 | 2 |  | W |  |  | X | √ | X | X |
| x | √ | PepsT | 1512 | S16 | 2 |  | W |  |  | X | √ | X | X |
| x | √ | Peps | 1513-1514 | S32 | 4 |  | W |  | During off-grid parallel operation, active and reactive power may also be negative; related values were changed to signed numbers. | X | √ | X | X |
| x | √ | Qeps | 1515-1516 | S32 | 4 |  | Var |  | VA changed to Var | X | √ | X | X |
| x | √ | Seps | 1517-1518 | U32 | 4 |  | VA |  |  | X | √ | X | X |
| x | √ | EepsInvDay | 1519 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EepsRecDay | 1520 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | VgenR | 1521 | U16 | 2 |  | 0.1V |  | Added unit 0.1V | X | √ | X | X |
| x | √ | VgenS | 1522 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | VgenT | 1523 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | IgenR | 1524 | S16 | 2 |  | 0.01A |  | Addedunit0.01A | X | √ | X | X |
| x | √ | IgenS | 1525 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | IgenT | 1526 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | PgenR | 1527 | S16 | 2 |  | W |  | Added unit W | X | √ | X | X |
| x | √ | PgenS | 1528 | S16 | 2 |  | W |  |  | X | √ | X | X |
| x | √ | PgenT | 1529 | S16 | 2 |  | W |  |  | X | √ | X | X |
| x | √ | Pgen | 1530-1531 | S32 | 4 |  | W |  |  | X | √ | X | X |
| x | √ | Qgen | 1532-1533 | S32 | 4 |  | Var |  | Added unit Var | X | √ | X | X |
| x | √ | Sgen | 1534-1535 | U32 | 4 |  | VA |  | Added unit VA | X | √ | X | X |
| x | √ | EgenDay | 1536 | U16 | 2 |  | 0.1kwh |  | Added unit 0.1 kWh | X | √ | X | X |
| x | √ | EepsInvTotal | 1537-1538 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EepsRecTotal | 1539-1540 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EgenTotal | 1541-1542 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | Reserve | 1543-1553 |  |  |  |  |  |  | X | √ | X | X |
| x | √ | Pacc | 1554-1555 | U32 | 4 |  | W |  |  | X | √ | X | X |
| x | √ | EaccDay | 1556-1557 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EaccTotal | 1558-1559 | U32 | 4 |  | 0.1kwh |  |  | X | √ | X | X |
|  |  | Reserve | 1560~1999 |  |  |  |  |  |  | X | √ | X | X |

## Real-time runtime information 4 (battery runtime information)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | BatState | 2000 | U16 | 2 |  |  | No battery 0 / Fault 1 / Sleep 2 / Start 3 / Charging 4 / Discharge 5 / OFF 6 / Wake Up 7 | Excludes forced charging | X | √ | X | X |
| x | √ | Tbat | 2001 | s16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | SOC | 2002 | U16 | 2 |  | % |  |  | X | √ | X | X |
| x | √ | SOH | 2003 | U16 | 2 |  | % |  |  | X | √ | X | X |
| x | √ | Vbat | 2004 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | Ibat | 2005 | S16 | 2 |  | 0.01A | Positive means battery discharge; negative means battery charge |  | X | √ | X | X |
| x | √ | Vbb | 2006 | U16 | 2 |  | 0.1V |  |  | X | √ | X | X |
| x | √ | Pbat | 2007-2008 | S32 | 4 |  | 1W | Positive means battery discharge; negative means battery charge | 1.changed to signed number, / 2. unit0.1V changed to 1W | X | √ | X | X |
| x | √ | EChgDay | 2009 | U16 | 2 |  | 0.1kwh |  | Unit changed from 0.1 Wh to 0.1 kWh | X | √ | X | X |
| x | √ | EDischgDay | 2010 | U16 | 2 |  | 0.1kwh |  |  | X | √ | X | X |
| x | √ | EChgTotal | 2011-2012 | U32 | 4 |  | 0.1kwh |  | Added unit 0.1 kWh | X | √ | X | X |
| x | √ | EDischgTotal | 2013-2014 | U32 | 4 |  | 0.1kwh |  | Added unit 0.1 kWh | X | √ | X | X |
| x | √ | BatCtrlCmd | 2015 | U16 | 2 |  |  | bit0-1: / 0-no operation,1-high-voltage power on,2-high-voltage power off / bit2:charge / bit3:discharge / bit4:reboot / bit5:shutdown / bit6-15:reserved |  | X | √ | X | X |
| x | √ | StorConn | 2016 | U16 | 2 | B0:CONNECTED / B1:AVAILABLE / B2:OPERATING / B3:TEST |  |  |  | X | √ | X | X |
|  |  | Reserve | 2017-2499 |  |  |  |  |  |  | X | √ | X | X |

## Real-time runtime information 5 (system information)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | RunState | 2500 | U16 | 2 |  |  | Initial power on 0 / Standby 1 / Start 2 / Grid 3 / Off-grid 4 / DG 5 / From grid to off-grid 6 / From Off-grid to grid 7 / Power failure processing 8 / Shutdown 9 / Fault 10 / Upgrading 11 |  | X | √ | X | X |
| √ | √ | PLimitMode | 2501-2502 | U32 | 4 |  |  | 0x0000   no power limit / 0x0001   temperature power limit / 0x0002   manual power limit / 0x0004   grid-voltage and PF power limit / 0x0008   over-frequency power limit / 0x0010   PV2-only input power limit / 0x0020   fault-recovery soft-start power limit / 0x0040   reserved channel | Specific power limiting modes can be added later; U32 is recommended. | X | √ | X | X |
| √ | √ | GridCrlMode | 2503-2504 | U32 | 4 |  |  | 0   E_GRID_ADJUST_DEF  / 1   E_GRID_ADJUST_LVRT    / 2   E_GRID_ADJUST_FIXE, / 3   E_GRID_ADJUST_PF  / 4   E_GRID_ADJUST_QP     / 5   E_GRID_ADJUST_TEST | Should be represented bitwise; several combinations may appear at the same time, so U32 is recommended. | X | √ | X | X |
| √ | √ | PV1MpptMode | 2505 | U16 | 2 |  |  | 0  default value / 1  standby / 2  Boost scan / 3  Bus scan / 4  Boost MPPT operation / 5  Bus MPPT operation / 6  centralized bus operation |  | X | √ | X | X |
| √ | √ | PV2MpptMode | 2506 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | PV3MpptMode | 2507 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | PV4MpptMode | 2508 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | PV5MpptMode | 2509 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | PV6MpptMode | 2510 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | LoadCtrlState | 2511 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | MeterTestState | 2512 | U16 | 2 |  |  |  |  | X | √ | X | X |
| √ | √ | ConncetTime | 2513 | U16 | 2 |  | S |  |  | X | √ | X | X |
| √ | √ | Tinner | 2514 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| √ | √ | Radiator Temperature | 2515 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| √ | √ | Temp1 | 2516 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| √ | √ | Temp2 | 2517 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
|  |  | Reserve | 2518-2529 |  |  |  |  |  |  | X | √ | X | X |
| √ | √ | Check whether detection is complete | 2529 | U16 |  |  |  | bit0-7      0 not executed /                 1-8 self-test in progress /                 9 self-test complete / bit8     81<.S2     0-pass,1-fail / bit9     81>.S2     0-pass,1-fail / bit10   81<.S1     0-pass,1-fail / bit11   81>.S1     0-pass,1-fail / bit12   27.S2       0-pass,1-fail / bit13   27.S1       0-pass,1-fail / bit14   59.S2       0-pass,1-fail / bit15   59.S1       0-pass,1-fail |  | X | √ | X | X |
| √ | √ | 59.S1 Trip Value | 2530 | U16 |  |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | 59.S1 Trip Time | 2531 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 59.S2 Trip Value | 2532 | U16 |  |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | 59.S2 Trip Time | 2533 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 27.S1 Trip Value | 2534 | U16 |  |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | 27.S1 Trip Time | 2535 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 27.S2 Trip Value | 2536 | U16 |  |  | 0.1V |  |  | X | √ | X | X |
| √ | √ | 27.S2 Trip Time | 2537 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 81>.S1 Trip Value | 2538 | U16 |  |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | 81>.S1 Trip Time | 2539 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 81<.S1 Trip Value | 2540 | U16 |  |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | 81<.S1 Trip Time | 2541 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 81>.S2 Trip Value | 2542 | U16 |  |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | 81>.S2 Trip Time | 2543 | U16 |  |  | 1ms |  |  | X | √ | X | X |
| √ | √ | 81<.S2 Trip Value | 2544 | U16 |  |  | 0.01Hz |  |  | X | √ | X | X |
| √ | √ | 81<.S2 Trip Time | 2545 | U16 |  |  | 1ms |  |  | X | √ | X | X |

## Real-time runtime information 6 (faults and warnings)

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| √ | √ | PvErr1 | 3000-3001 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | PvErr2 | 3002-3003 | U32 | 4 |  |  |  |  | X | √ | X | X |
| x | √ | BatErr1 | 3004-3005 | U32 | 4 |  |  |  |  | X | √ | X | X |
| x | √ | BatErr2 | 3006-3007 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | GridErr | 3008-3009 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | OffGridErr | 3010-3011 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | DCErr1 | 3012-3013 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | DCErr2 | 3014-3015 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | ACErr | 3016-3017 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | SysErr1 | 3018-3019 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | SysErr2 | 3020-3021 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | PermErr | 3022-3023 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | InWarning | 3024-3025 | U32 | 4 |  |  |  |  | X | √ | X | X |
| √ | √ | OutWarning | 3026-3027 | U32 | 4 |  |  |  |  | X | √ | X | X |
|  |  | Reserve | 3028-3499 |  |  |  |  |  |  | X | √ | X | X |

## Cell data

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | √ | BC1_U | 5000 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC1_I | 5001 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC1_T | 5002 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC1_SOC | 5003 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC2_U | 5004 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC2_I | 5005 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC2_T | 5006 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC2_SOC | 5007 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC3_U | 5008 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC3_I | 5009 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC3_T | 5010 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC3_SOC | 5011 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC4_U | 5012 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC4_I | 5013 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC4_T | 5014 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC4_SOC | 5015 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC5_U | 5016 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC5_I | 5017 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC5_T | 5018 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC5_SOC | 5019 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC6_U | 5020 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC6_I | 5021 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC6_T | 5022 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC6_SOC | 5023 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC7_U | 5024 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC7_I | 5025 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC7_T | 5026 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC7_SOC | 5027 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC8_U | 5028 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC8_I | 5029 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC8_T | 5030 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC8_SOC | 5031 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC9_U | 5032 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC9_I | 5033 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC9_T | 5034 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC9_SOC | 5035 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC10_U | 5036 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC10_I | 5037 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC10_T | 5038 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC10_SOC | 5039 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC11_U | 5040 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC11_I | 5041 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC11_T | 5042 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC11_SOC | 5043 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC12_U | 5044 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC12_I | 5045 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC12_T | 5046 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC12_SOC | 5047 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC13_U | 5048 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC13_I | 5049 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC13_T | 5050 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC13_SOC | 5051 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC14_U | 5052 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC14_I | 5053 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC14_T | 5054 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC14_SOC | 5055 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC15_U | 5056 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC15_I | 5057 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC15_T | 5058 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC15_SOC | 5059 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC16_U | 5060 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC16_I | 5061 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC16_T | 5062 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC16_SOC | 5063 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC17_U | 5064 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC17_I | 5065 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC17_T | 5066 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC17_SOC | 5067 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC18_U | 5068 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC18_I | 5069 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC18_T | 5070 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC18_SOC | 5071 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC19_U | 5072 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC19_I | 5073 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC19_T | 5074 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC19_SOC | 5075 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC20_U | 5076 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC20_I | 5077 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC20_T | 5078 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC20_SOC | 5079 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC21_U | 5080 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC21_I | 5081 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC21_T | 5082 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC21_SOC | 5083 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC22_U | 5084 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC22_I | 5085 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC22_T | 5086 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC22_SOC | 5087 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC23_U | 5088 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC23_I | 5089 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC23_T | 5090 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC23_SOC | 5091 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC24_U | 5092 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC24_I | 5093 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC24_T | 5094 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC24_SOC | 5095 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC25_U | 5096 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC25_I | 5097 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC25_T | 5098 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC25_SOC | 5099 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC26_U | 5100 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC26_I | 5101 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC26_T | 5102 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC26_SOC | 5103 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC27_U | 5104 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC27_I | 5105 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC27_T | 5106 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC27_SOC | 5107 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC28_U | 5108 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC28_I | 5109 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC28_T | 5110 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC28_SOC | 5111 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC29_U | 5112 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC29_I | 5113 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC29_T | 5114 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC29_SOC | 5115 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC30_U | 5116 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC30_I | 5117 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC30_T | 5118 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC30_SOC | 5119 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC31_U | 5120 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC31_I | 5121 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC31_T | 5122 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC31_SOC | 5123 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC32_U | 5124 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC32_I | 5125 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC32_T | 5126 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC32_SOC | 5127 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC33_U | 5128 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC33_I | 5129 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC33_T | 5130 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC33_SOC | 5131 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC34_U | 5132 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC34_I | 5133 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC34_T | 5134 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC34_SOC | 5135 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC35_U | 5136 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC35_I | 5137 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC35_T | 5138 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC35_SOC | 5139 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC36_U | 5140 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC36_I | 5141 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC36_T | 5142 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC36_SOC | 5143 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC37_U | 5144 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC37_I | 5145 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC37_T | 5146 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC37_SOC | 5147 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC38_U | 5148 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC38_I | 5149 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC38_T | 5150 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC38_SOC | 5151 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC39_U | 5152 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC39_I | 5153 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC39_T | 5154 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC39_SOC | 5155 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC40_U | 5156 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC40_I | 5157 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC40_T | 5158 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC40_SOC | 5159 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC41_U | 5160 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC41_I | 5161 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC41_T | 5162 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC41_SOC | 5163 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC42_U | 5164 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC42_I | 5165 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC42_T | 5166 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC42_SOC | 5167 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC43_U | 5168 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC43_I | 5169 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC43_T | 5170 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC43_SOC | 5171 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC44_U | 5172 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC44_I | 5173 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC44_T | 5174 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC44_SOC | 5175 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC45_U | 5176 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC45_I | 5177 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC45_T | 5178 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC45_SOC | 5179 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC46_U | 5180 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC46_I | 5181 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC46_T | 5182 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC46_SOC | 5183 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC47_U | 5184 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC47_I | 5185 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC47_T | 5186 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC47_SOC | 5187 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC48_U | 5188 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC48_I | 5189 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC48_T | 5190 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC48_SOC | 5191 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC49_U | 5192 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC49_I | 5193 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC49_T | 5194 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC49_SOC | 5195 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC50_U | 5196 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC50_I | 5197 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC50_T | 5198 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC50_SOC | 5199 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC51_U | 5200 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC51_I | 5201 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC51_T | 5202 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC51_SOC | 5203 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC52_U | 5204 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC52_I | 5205 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC52_T | 5206 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC52_SOC | 5207 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC53_U | 5208 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC53_I | 5209 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC53_T | 5210 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC53_SOC | 5211 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC54_U | 5212 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC54_I | 5213 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC54_T | 5214 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC54_SOC | 5215 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC55_U | 5216 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC55_I | 5217 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC55_T | 5218 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC55_SOC | 5219 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC56_U | 5220 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC56_I | 5221 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC56_T | 5222 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC56_SOC | 5223 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC57_U | 5224 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC57_I | 5225 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC57_T | 5226 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC57_SOC | 5227 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC58_U | 5228 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC58_I | 5229 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC58_T | 5230 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC58_SOC | 5231 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC59_U | 5232 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC59_I | 5233 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC59_T | 5234 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC59_SOC | 5235 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC60_U | 5236 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC60_I | 5237 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC60_T | 5238 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC60_SOC | 5239 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC61_U | 5240 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC61_I | 5241 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC61_T | 5242 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC61_SOC | 5243 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC62_U | 5244 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC62_I | 5245 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC62_T | 5246 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC62_SOC | 5247 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC63_U | 5248 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC63_I | 5249 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC63_T | 5250 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC63_SOC | 5251 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC64_U | 5252 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC64_I | 5253 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC64_T | 5254 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC64_SOC | 5255 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC65_U | 5256 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC65_I | 5257 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC65_T | 5258 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC65_SOC | 5259 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC66_U | 5260 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC66_I | 5261 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC66_T | 5262 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC66_SOC | 5263 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC67_U | 5264 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC67_I | 5265 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC67_T | 5266 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC67_SOC | 5267 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC68_U | 5268 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC68_I | 5269 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC68_T | 5270 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC68_SOC | 5271 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC69_U | 5272 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC69_I | 5273 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC69_T | 5274 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC69_SOC | 5275 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC70_U | 5276 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC70_I | 5277 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC70_T | 5278 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC70_SOC | 5279 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC71_U | 5280 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC71_I | 5281 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC71_T | 5282 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC71_SOC | 5283 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC72_U | 5284 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC72_I | 5285 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC72_T | 5286 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC72_SOC | 5287 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC73_U | 5288 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC73_I | 5289 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC73_T | 5290 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC73_SOC | 5291 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC74_U | 5292 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC74_I | 5293 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC74_T | 5294 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC74_SOC | 5295 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC75_U | 5296 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC75_I | 5297 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC75_T | 5298 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC75_SOC | 5299 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC76_U | 5300 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC76_I | 5301 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC76_T | 5302 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC76_SOC | 5303 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC77_U | 5304 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC77_I | 5305 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC77_T | 5306 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC77_SOC | 5307 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC78_U | 5308 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC78_I | 5309 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC78_T | 5310 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC78_SOC | 5311 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC79_U | 5312 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC79_I | 5313 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC79_T | 5314 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC79_SOC | 5315 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC80_U | 5316 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC80_I | 5317 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC80_T | 5318 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC80_SOC | 5319 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC81_U | 5320 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC81_I | 5321 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC81_T | 5322 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC81_SOC | 5323 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC82_U | 5324 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC82_I | 5325 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC82_T | 5326 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC82_SOC | 5327 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC83_U | 5328 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC83_I | 5329 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC83_T | 5330 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC83_SOC | 5331 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC84_U | 5332 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC84_I | 5333 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC84_T | 5334 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC84_SOC | 5335 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC85_U | 5336 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC85_I | 5337 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC85_T | 5338 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC85_SOC | 5339 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC86_U | 5340 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC86_I | 5341 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC86_T | 5342 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC86_SOC | 5343 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC87_U | 5344 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC87_I | 5345 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC87_T | 5346 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC87_SOC | 5347 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC88_U | 5348 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC88_I | 5349 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC88_T | 5350 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC88_SOC | 5351 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC89_U | 5352 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC89_I | 5353 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC89_T | 5354 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC89_SOC | 5355 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC90_U | 5356 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC90_I | 5357 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC90_T | 5358 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC90_SOC | 5359 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC91_U | 5360 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC91_I | 5361 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC91_T | 5362 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC91_SOC | 5363 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC92_U | 5364 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC92_I | 5365 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC92_T | 5366 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC92_SOC | 5367 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC93_U | 5368 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC93_I | 5369 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC93_T | 5370 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC93_SOC | 5371 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC94_U | 5372 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC94_I | 5373 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC94_T | 5374 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC94_SOC | 5375 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC95_U | 5376 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC95_I | 5377 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC95_T | 5378 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC95_SOC | 5379 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC96_U | 5380 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC96_I | 5381 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC96_T | 5382 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC96_SOC | 5383 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC97_U | 5384 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC97_I | 5385 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC97_T | 5386 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC97_SOC | 5387 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC98_U | 5388 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC98_I | 5389 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC98_T | 5390 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC98_SOC | 5391 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC99_U | 5392 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC99_I | 5393 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC99_T | 5394 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC99_SOC | 5395 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC100_U | 5396 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC100_I | 5397 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC100_T | 5398 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC100_SOC | 5399 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC101_U | 5400 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC101_I | 5401 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC101_T | 5402 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC101_SOC | 5403 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC102_U | 5404 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC102_I | 5405 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC102_T | 5406 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC102_SOC | 5407 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC103_U | 5408 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC103_I | 5409 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC103_T | 5410 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC103_SOC | 5411 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC104_U | 5412 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC104_I | 5413 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC104_T | 5414 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC104_SOC | 5415 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC105_U | 5416 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC105_I | 5417 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC105_T | 5418 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC105_SOC | 5419 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC106_U | 5420 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC106_I | 5421 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC106_T | 5422 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC106_SOC | 5423 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC107_U | 5424 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC107_I | 5425 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC107_T | 5426 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC107_SOC | 5427 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC108_U | 5428 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC108_I | 5429 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC108_T | 5430 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC108_SOC | 5431 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC109_U | 5432 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC109_I | 5433 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC109_T | 5434 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC109_SOC | 5435 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC110_U | 5436 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC110_I | 5437 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC110_T | 5438 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC110_SOC | 5439 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC111_U | 5440 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC111_I | 5441 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC111_T | 5442 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC111_SOC | 5443 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC112_U | 5444 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC112_I | 5445 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC112_T | 5446 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC112_SOC | 5447 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC113_U | 5448 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC113_I | 5449 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC113_T | 5450 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC113_SOC | 5451 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC114_U | 5452 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC114_I | 5453 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC114_T | 5454 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC114_SOC | 5455 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC115_U | 5456 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC115_I | 5457 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC115_T | 5458 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC115_SOC | 5459 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC116_U | 5460 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC116_I | 5461 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC116_T | 5462 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC116_SOC | 5463 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC117_U | 5464 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC117_I | 5465 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC117_T | 5466 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC117_SOC | 5467 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC118_U | 5468 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC118_I | 5469 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC118_T | 5470 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC118_SOC | 5471 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC119_U | 5472 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC119_I | 5473 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC119_T | 5474 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC119_SOC | 5475 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC120_U | 5476 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC120_I | 5477 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC120_T | 5478 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC120_SOC | 5479 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC121_U | 5480 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC121_I | 5481 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC121_T | 5482 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC121_SOC | 5483 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC122_U | 5484 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC122_I | 5485 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC122_T | 5486 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC122_SOC | 5487 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC123_U | 5488 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC123_I | 5489 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC123_T | 5490 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC123_SOC | 5491 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC124_U | 5492 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC124_I | 5493 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC124_T | 5494 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC124_SOC | 5495 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC125_U | 5496 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC125_I | 5497 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC125_T | 5498 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC125_SOC | 5499 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC126_U | 5500 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC126_I | 5501 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC126_T | 5502 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC126_SOC | 5503 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC127_U | 5504 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC127_I | 5505 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC127_T | 5506 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC127_SOC | 5507 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC128_U | 5508 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC128_I | 5509 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC128_T | 5510 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC128_SOC | 5511 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC129_U | 5512 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC129_I | 5513 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC129_T | 5514 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC129_SOC | 5515 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC130_U | 5516 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC130_I | 5517 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC130_T | 5518 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC130_SOC | 5519 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC131_U | 5520 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC131_I | 5521 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC131_T | 5522 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC131_SOC | 5523 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC132_U | 5524 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC132_I | 5525 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC132_T | 5526 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC132_SOC | 5527 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC133_U | 5528 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC133_I | 5529 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC133_T | 5530 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC133_SOC | 5531 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC134_U | 5532 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC134_I | 5533 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC134_T | 5534 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC134_SOC | 5535 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC135_U | 5536 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC135_I | 5537 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC135_T | 5538 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC135_SOC | 5539 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC136_U | 5540 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC136_I | 5541 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC136_T | 5542 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC136_SOC | 5543 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC137_U | 5544 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC137_I | 5545 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC137_T | 5546 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC137_SOC | 5547 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC138_U | 5548 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC138_I | 5549 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC138_T | 5550 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC138_SOC | 5551 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC139_U | 5552 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC139_I | 5553 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC139_T | 5554 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC139_SOC | 5555 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC140_U | 5556 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC140_I | 5557 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC140_T | 5558 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC140_SOC | 5559 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC141_U | 5560 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC141_I | 5561 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC141_T | 5562 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC141_SOC | 5563 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC142_U | 5564 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC142_I | 5565 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC142_T | 5566 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC142_SOC | 5567 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC143_U | 5568 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC143_I | 5569 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC143_T | 5570 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC143_SOC | 5571 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC144_U | 5572 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC144_I | 5573 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC144_T | 5574 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC144_SOC | 5575 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC145_U | 5576 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC145_I | 5577 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC145_T | 5578 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC145_SOC | 5579 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC146_U | 5580 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC146_I | 5581 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC146_T | 5582 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC146_SOC | 5583 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC147_U | 5584 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC147_I | 5585 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC147_T | 5586 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC147_SOC | 5587 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC148_U | 5588 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC148_I | 5589 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC148_T | 5590 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC148_SOC | 5591 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC149_U | 5592 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC149_I | 5593 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC149_T | 5594 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC149_SOC | 5595 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC150_U | 5596 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC150_I | 5597 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC150_T | 5598 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC150_SOC | 5599 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC151_U | 5600 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC151_I | 5601 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC151_T | 5602 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC151_SOC | 5603 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC152_U | 5604 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC152_I | 5605 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC152_T | 5606 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC152_SOC | 5607 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC153_U | 5608 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC153_I | 5609 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC153_T | 5610 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC153_SOC | 5611 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC154_U | 5612 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC154_I | 5613 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC154_T | 5614 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC154_SOC | 5615 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC155_U | 5616 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC155_I | 5617 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC155_T | 5618 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC155_SOC | 5619 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC156_U | 5620 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC156_I | 5621 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC156_T | 5622 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC156_SOC | 5623 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC157_U | 5624 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC157_I | 5625 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC157_T | 5626 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC157_SOC | 5627 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC158_U | 5628 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC158_I | 5629 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC158_T | 5630 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC158_SOC | 5631 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC159_U | 5632 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC159_I | 5633 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC159_T | 5634 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC159_SOC | 5635 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC160_U | 5636 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC160_I | 5637 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC160_T | 5638 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC160_SOC | 5639 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC161_U | 5640 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC161_I | 5641 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC161_T | 5642 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC161_SOC | 5643 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC162_U | 5644 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC162_I | 5645 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC162_T | 5646 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC162_SOC | 5647 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC163_U | 5648 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC163_I | 5649 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC163_T | 5650 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC163_SOC | 5651 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC164_U | 5652 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC164_I | 5653 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC164_T | 5654 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC164_SOC | 5655 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC165_U | 5656 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC165_I | 5657 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC165_T | 5658 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC165_SOC | 5659 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC166_U | 5660 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC166_I | 5661 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC166_T | 5662 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC166_SOC | 5663 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC167_U | 5664 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC167_I | 5665 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC167_T | 5666 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC167_SOC | 5667 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC168_U | 5668 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC168_I | 5669 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC168_T | 5670 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC168_SOC | 5671 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC169_U | 5672 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC169_I | 5673 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC169_T | 5674 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC169_SOC | 5675 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC170_U | 5676 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC170_I | 5677 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC170_T | 5678 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC170_SOC | 5679 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC171_U | 5680 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC171_I | 5681 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC171_T | 5682 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC171_SOC | 5683 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC172_U | 5684 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC172_I | 5685 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC172_T | 5686 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC172_SOC | 5687 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC173_U | 5688 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC173_I | 5689 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC173_T | 5690 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC173_SOC | 5691 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC174_U | 5692 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC174_I | 5693 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC174_T | 5694 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC174_SOC | 5695 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC175_U | 5696 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC175_I | 5697 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC175_T | 5698 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC175_SOC | 5699 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC176_U | 5700 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC176_I | 5701 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC176_T | 5702 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC176_SOC | 5703 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC177_U | 5704 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC177_I | 5705 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC177_T | 5706 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC177_SOC | 5707 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC178_U | 5708 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC178_I | 5709 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC178_T | 5710 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC178_SOC | 5711 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC179_U | 5712 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC179_I | 5713 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC179_T | 5714 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC179_SOC | 5715 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC180_U | 5716 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC180_I | 5717 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC180_T | 5718 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC180_SOC | 5719 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC181_U | 5720 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC181_I | 5721 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC181_T | 5722 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC181_SOC | 5723 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC182_U | 5724 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC182_I | 5725 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC182_T | 5726 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC182_SOC | 5727 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC183_U | 5728 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC183_I | 5729 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC183_T | 5730 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC183_SOC | 5731 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC184_U | 5732 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC184_I | 5733 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC184_T | 5734 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC184_SOC | 5735 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC185_U | 5736 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC185_I | 5737 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC185_T | 5738 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC185_SOC | 5739 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC186_U | 5740 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC186_I | 5741 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC186_T | 5742 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC186_SOC | 5743 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC187_U | 5744 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC187_I | 5745 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC187_T | 5746 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC187_SOC | 5747 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC188_U | 5748 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC188_I | 5749 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC188_T | 5750 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC188_SOC | 5751 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC189_U | 5752 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC189_I | 5753 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC189_T | 5754 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC189_SOC | 5755 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC190_U | 5756 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC190_I | 5757 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC190_T | 5758 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC190_SOC | 5759 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC191_U | 5760 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC191_I | 5761 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC191_T | 5762 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC191_SOC | 5763 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC192_U | 5764 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC192_I | 5765 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC192_T | 5766 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC192_SOC | 5767 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC193_U | 5768 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC193_I | 5769 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC193_T | 5770 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC193_SOC | 5771 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC194_U | 5772 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC194_I | 5773 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC194_T | 5774 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC194_SOC | 5775 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC195_U | 5776 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC195_I | 5777 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC195_T | 5778 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC195_SOC | 5779 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC196_U | 5780 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC196_I | 5781 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC196_T | 5782 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC196_SOC | 5783 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC197_U | 5784 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC197_I | 5785 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC197_T | 5786 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC197_SOC | 5787 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC198_U | 5788 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC198_I | 5789 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC198_T | 5790 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC198_SOC | 5791 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC199_U | 5792 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC199_I | 5793 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC199_T | 5794 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC199_SOC | 5795 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC200_U | 5796 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC200_I | 5797 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC200_T | 5798 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC200_SOC | 5799 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC201_U | 5800 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC201_I | 5801 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC201_T | 5802 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC201_SOC | 5803 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC202_U | 5804 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC202_I | 5805 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC202_T | 5806 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC202_SOC | 5807 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC203_U | 5808 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC203_I | 5809 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC203_T | 5810 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC203_SOC | 5811 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC204_U | 5812 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC204_I | 5813 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC204_T | 5814 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC204_SOC | 5815 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC205_U | 5816 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC205_I | 5817 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC205_T | 5818 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC205_SOC | 5819 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC206_U | 5820 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC206_I | 5821 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC206_T | 5822 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC206_SOC | 5823 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC207_U | 5824 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC207_I | 5825 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC207_T | 5826 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC207_SOC | 5827 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC208_U | 5828 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC208_I | 5829 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC208_T | 5830 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC208_SOC | 5831 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC209_U | 5832 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC209_I | 5833 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC209_T | 5834 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC209_SOC | 5835 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC210_U | 5836 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC210_I | 5837 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC210_T | 5838 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC210_SOC | 5839 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC211_U | 5840 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC211_I | 5841 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC211_T | 5842 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC211_SOC | 5843 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC212_U | 5844 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC212_I | 5845 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC212_T | 5846 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC212_SOC | 5847 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC213_U | 5848 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC213_I | 5849 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC213_T | 5850 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC213_SOC | 5851 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC214_U | 5852 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC214_I | 5853 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC214_T | 5854 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC214_SOC | 5855 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC215_U | 5856 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC215_I | 5857 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC215_T | 5858 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC215_SOC | 5859 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC216_U | 5860 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC216_I | 5861 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC216_T | 5862 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC216_SOC | 5863 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC217_U | 5864 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC217_I | 5865 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC217_T | 5866 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC217_SOC | 5867 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC218_U | 5868 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC218_I | 5869 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC218_T | 5870 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC218_SOC | 5871 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC219_U | 5872 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC219_I | 5873 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC219_T | 5874 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC219_SOC | 5875 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC220_U | 5876 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC220_I | 5877 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC220_T | 5878 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC220_SOC | 5879 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC221_U | 5880 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC221_I | 5881 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC221_T | 5882 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC221_SOC | 5883 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC222_U | 5884 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC222_I | 5885 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC222_T | 5886 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC222_SOC | 5887 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC223_U | 5888 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC223_I | 5889 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC223_T | 5890 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC223_SOC | 5891 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC224_U | 5892 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC224_I | 5893 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC224_T | 5894 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC224_SOC | 5895 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC225_U | 5896 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC225_I | 5897 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC225_T | 5898 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC225_SOC | 5899 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC226_U | 5900 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC226_I | 5901 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC226_T | 5902 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC226_SOC | 5903 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC227_U | 5904 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC227_I | 5905 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC227_T | 5906 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC227_SOC | 5907 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC228_U | 5908 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC228_I | 5909 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC228_T | 5910 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC228_SOC | 5911 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC229_U | 5912 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC229_I | 5913 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC229_T | 5914 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC229_SOC | 5915 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC230_U | 5916 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC230_I | 5917 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC230_T | 5918 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC230_SOC | 5919 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC231_U | 5920 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC231_I | 5921 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC231_T | 5922 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC231_SOC | 5923 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC232_U | 5924 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC232_I | 5925 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC232_T | 5926 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC232_SOC | 5927 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC233_U | 5928 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC233_I | 5929 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC233_T | 5930 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC233_SOC | 5931 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC234_U | 5932 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC234_I | 5933 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC234_T | 5934 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC234_SOC | 5935 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC235_U | 5936 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC235_I | 5937 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC235_T | 5938 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC235_SOC | 5939 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC236_U | 5940 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC236_I | 5941 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC236_T | 5942 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC236_SOC | 5943 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC237_U | 5944 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC237_I | 5945 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC237_T | 5946 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC237_SOC | 5947 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC238_U | 5948 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC238_I | 5949 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC238_T | 5950 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC238_SOC | 5951 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC239_U | 5952 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC239_I | 5953 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC239_T | 5954 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC239_SOC | 5955 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC240_U | 5956 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC240_I | 5957 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC240_T | 5958 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC240_SOC | 5959 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC241_U | 5960 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC241_I | 5961 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC241_T | 5962 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC241_SOC | 5963 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC242_U | 5964 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC242_I | 5965 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC242_T | 5966 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC242_SOC | 5967 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC243_U | 5968 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC243_I | 5969 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC243_T | 5970 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC243_SOC | 5971 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC244_U | 5972 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC244_I | 5973 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC244_T | 5974 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC244_SOC | 5975 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC245_U | 5976 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC245_I | 5977 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC245_T | 5978 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC245_SOC | 5979 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC246_U | 5980 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC246_I | 5981 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC246_T | 5982 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC246_SOC | 5983 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC247_U | 5984 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC247_I | 5985 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC247_T | 5986 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC247_SOC | 5987 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC248_U | 5988 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC248_I | 5989 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC248_T | 5990 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC248_SOC | 5991 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC249_U | 5992 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC249_I | 5993 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC249_T | 5994 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC249_SOC | 5995 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC250_U | 5996 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC250_I | 5997 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC250_T | 5998 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC250_SOC | 5999 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC251_U | 6000 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC251_I | 6001 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC251_T | 6002 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC251_SOC | 6003 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC252_U | 6004 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC252_I | 6005 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC252_T | 6006 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC252_SOC | 6007 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC253_U | 6008 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC253_I | 6009 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC253_T | 6010 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC253_SOC | 6011 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC254_U | 6012 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC254_I | 6013 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC254_T | 6014 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC254_SOC | 6015 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC255_U | 6016 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC255_I | 6017 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC255_T | 6018 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC255_SOC | 6019 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |
| x | √ | BC256_U | 6020 | S16 | 2 |  | mV |  |  | X | √ | X | X |
| x | √ | BC256_I | 6021 | S16 | 2 |  | 0.01A |  |  | X | √ | X | X |
| x | √ | BC256_T | 6022 | S16 | 2 |  | 0.1℃ |  |  | X | √ | X | X |
| x | √ | BC256_SOC | 6023 | S16 | 2 |  | 0.01 |  |  | X | √ | X | X |

## Battery passthrough data

| Grid-tied | Energy storage | Name | Address | Data type | Bytes | Data range | Unit | Notes | Change | 0x03 | 0x04 | 0x06 | 0x10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| x | x | Data 1-8 | 7500 | U8*8 |  |  |  | 0xA30100 |  | X | √ | X | X |
| x | x |  | 7504 | U8*8 |  |  |  | 0xA30200 |  | X | √ | X | X |
| x | x |  | 7508 | U8*8 |  |  |  | 0xA30300 |  | X | √ | X | X |
| x | x |  | 7512 | U8*8 |  |  |  | 0xA30400 |  | X | √ | X | X |
| x | x |  | 7516 | U8*8 |  |  |  | 0xA30500 |  | X | √ | X | X |
| x | x |  | 7520 | U8*8 |  |  |  | 0xA30600 |  | X | √ | X | X |
| x | x |  | 7524 | U8*8 |  |  |  | 0xA30700 |  | X | √ | X | X |
| x | x |  | 7528 | U8*8 |  |  |  | 0xA30800 |  | X | √ | X | X |
| x | x |  | 7532 | U8*8 |  |  |  | 0xA30900 |  | X | √ | X | X |
| x | x |  | 7536 | U8*8 |  |  |  | 0xA30A00 |  | X | √ | X | X |
| x | x |  | 7540 | U8*8 |  |  |  | 0xA30B00 |  | X | √ | X | X |
| x | x |  | 7544 | U8*8 |  |  |  | 0xA30C00 |  | X | √ | X | X |
| x | x |  | 7548 | U8*8 |  |  |  | 0xA30D00 |  | X | √ | X | X |
| x | x |  | 7552 | U8*8 |  |  |  | 0xA30E00 |  | X | √ | X | X |
| x | x | Data 1-4 | 7556 | U8*4 |  |  |  | 0xA30F00 |  | X | √ | X | X |
| x | x |  | 7558 | U8*4 |  |  |  | 0xA31000 |  | X | √ | X | X |
| x | x |  | 7560 | U8*4 |  |  |  | 0xA31100 |  | X | √ | X | X |
| x | x |  | 7562 | U8*4 |  |  |  | 0xA31200 |  | X | √ | X | X |
| x | x |  | 7564 | U8*4 |  |  |  | 0xA31300 |  | X | √ | X | X |
| x | x |  | 7566 | U8*4 |  |  |  | 0xA31400 |  | X | √ | X | X |
| x | x |  | 7568 | U8*4 |  |  |  | 0xA31500 |  | X | √ | X | X |
