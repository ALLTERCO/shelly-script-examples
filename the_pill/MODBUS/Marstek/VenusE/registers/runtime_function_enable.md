# Runtime Function Enable

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [**Runtime Function Enable**](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- This bitfield is referenced by `FuncEn` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md).
- Protection bits are separate in [Protection Function Enable](protection_function_enable.md).

| Bit / function |
| --- |
| B0:switch machine |
| B1:Soft start enable |
| B2:Power soft |
| B3:EPS Mode enable |
| B4:Timing AC charge enable |
| B5:Timing  charge enable |
| B6:Timing discharge enable |
| B7:JET simulating test |
| B8:DRMS enable |
| B9:ripple control |
| B10: Grid high voltage drop |
| B11: Grid Low Voltage Rise |
| B12: Grid over-frequency and load reduction |
| B13: Grid under-frequency load increase |
| B14:HVRT |
| B15:LVRT |
| B16:Timing Forbid discharge enable |
| B17: other17 |
| B18:other18 |
| B19:other19 |
| B20:DisselGenFunction |
| B21:DieselWorkMode |
| B22:other22 |
| B23:EcoEn |
| B24~B31 Reseved |
