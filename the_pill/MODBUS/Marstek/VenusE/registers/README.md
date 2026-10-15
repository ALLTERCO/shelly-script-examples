# Register Documents

Source workbook: `Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

This folder contains one Markdown document per workbook tab. The files are cross-linked so enum tables, bitfields, runtime data, writable parameters, faults, and change history can be followed from any document.

## Document Map

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [Safety](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Relationship Map

- `FuncEn` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) uses [Runtime Function Enable](runtime_function_enable.md).
- `ProtectEn` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) uses [Protection Function Enable](protection_function_enable.md).
- `Safty` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) uses [Safety](safety.md).
- `BatBrand` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) uses [Battery Brand](battery_brand.md).
- Runtime fault and warning registers in [Runtime Information 04](runtime_information_04.md) are explained by [Fault List](fault_list.md).
- Source version changes are tracked in [Protocol Change Log](protocol_change_log.md).
