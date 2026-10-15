# Protection Function Enable

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [**Protection Function Enable**](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- This bitfield is referenced by `ProtectEn` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md).
- Runtime function bits are separate in [Runtime Function Enable](runtime_function_enable.md).

| Bit / function |
| --- |
| B0:Grid connection range judgment |
| B1:AactiveIsland |
| B2:PassiveIsland |
| B3:OverVolt |
| B4:UnderVolt |
| B5:OverFreq |
| B6:UnderFreq |
| B7:10minOverVolt |
| B8:IsoChk |
| B9:DciChk |
| B10:GfciChk |
| B11:EarthChk |
| B12:Three-phase unbalance |
| B13:Power grid transient voltage protection |
| B14:Bus midpoint unbalance protection |
| B15:PV Reverse connection |
| B16:PV Abnormal |
| B17:Sampling detection |
| B18:Abnormal temperature sampling |
| B19:High and low temperature protection |
| B20:GEN voltage frequency detection |
| B21:Relay detection |
| B22:Internal communication detection |
| B23:Fan detection |
| B24:ammete & CT detection |
| B25:Afci |
| B26:RSDEN |
| B27~B31 Reseved |
