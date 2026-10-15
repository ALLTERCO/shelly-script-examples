# Safety

Source: `../Afore Modbus.xlsx`

Parent: [VenusE README](../README.md)

## Register Documents

- [Runtime Information 04](runtime_information_04.md) - Read-only runtime/status register map.
- [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md) - Read/write parameter register map.
- [Runtime Function Enable](runtime_function_enable.md) - Bit definitions referenced by `FuncEn`.
- [Protection Function Enable](protection_function_enable.md) - Bit definitions referenced by `ProtectEn`.
- [**Safety**](safety.md) - Safety-standard enum values referenced by `Safty`.
- [Battery Brand](battery_brand.md) - Battery-brand enum values referenced by `BatBrand`.
- [Fault List](fault_list.md) - Fault-code and fault-bit reference.
- [Protocol Change Log](protocol_change_log.md) - Version history and source changes.

## Related Notes

- These enum values are referenced by `Safty` in [Parameter Read/Write 03-06-10](parameter_read_write_03_06_10.md).
- Related battery manufacturer enum values are in [Battery Brand](battery_brand.md).

## Low-voltage grid-tied inverter safety range: 51-108

| Register value (decimal) | Safety |
| --- | --- |
| 51 | ComL-50Hz |
| 52 | ComL-60Hz |
| 53 | Mexico |
| 54 | Japan-50 |
| 55 | Japan-60 |
| 56 | USA |
| 57 | Canada |
| 58 | Taiwan, China |
| 59 | HongKong,China |
| 60 | Norway |
| 61 | Bahrain |
| 62 | Nicaragua |
| 63 | Guatemala |
| 64 | SA |
| 65 | SouthKorea |
| 66 | Cambodia |
| 67 | Philippin |
| 68 | Vietnam |
| 69 | Lebanon |
| 70 | Ecuador |
| 71 | Brazil |
| 72 | Barbados |
| 73 | Bahamas |
| 74 | Jamaica |
| 75 | Cuba |
| 76 | Dominica |
| 77 | Bermuda |
| 78 | Honduras |
| 79 | Belize |
| 80 | Venezuela |
| 81 | PuertoRico |
| 82 | Bolivia |
| 83 | Colombia |
| 84 | CostaRica |
| 85 | Haiti |
| 86 | Guyana |
| 87 | ElSalvador |
| 88 | Guam |
| 89 | Suriname |
| 90 | Spain |
| 91 | Monaco |
| 92 | Libya |
| 93 | Mali |
| 94 | Senegal |
| 95 | Liberia |
| 96 | CONNERA |
| 97 | China |
| 98 | Belgium |
| 99 | Reserve99 |
| 100 | Reserve100 |
| 101 | Reserve101 |
| 102 | Reserve102 |
| 103 | Reserve103 |
| 104 | Reserve104 |
| 105 | Reserve105 |
| 106 | Reserve106 |
| 107 | Reserve107 |
| 108 | Reserve108 |

## High-voltage grid-tied inverter safety range: 151-184

| Register value (decimal) | Safety |
| --- | --- |
| 151 | ComH-50Hz |
| 152 | ComH-60Hz |
| 153 | Taiwan, China |
| 154 | Philippin |
| 155 | SA |
| 156 | Finland |
| 157 | Holland |
| 158 | Norway |
| 159 | Switzerland |
| 160 | Czech |
| 161 | Canada |
| 162 | USA |
| 163 | Belize |
| 164 | CostaRica |
| 165 | Dominica |
| 166 | Honduras |
| 167 | Jamaica |
| 168 | Mexico |
| 169 | Paraguay |
| 170 | Peru |
| 171 | China |
| 172 | Ecuador |
| 173 | Panama |
| 174 | Colombia |
| 175 | Reserve175 |
| 176 | Reserve176 |
| 177 | Reserve177 |
| 178 | Reserve178 |
| 179 | Reserve179 |
| 180 | Reserve180 |
| 181 | Reserve181 |
| 182 | Reserve182 |
| 183 | Reserve183 |
| 184 | Reserve184 |

## Standard grid-tied inverter + energy storage inverter safety range: 0-50, 251-322

| Register value (decimal) | Safety |
| --- | --- |
| 0 | Com-50Hz |
| 1 | Com-60Hz |
| 2 | China |
| 3 | Japan-50 |
| 4 | Japan-60 |
| 5 | US_240S |
| 6 | US_240D |
| 7 | US_208S |
| 8 | US_208D |
| 9 | Australia |
| 10 | UK_G99 |
| 11 | UK_G98 |
| 12 | DE |
| 13 | DE_BDEW |
| 14 | France |
| 15 | Fra-IL50Hz |
| 16 | Fra-IL60Hz |
| 17 | Poland |
| 18 | IT CEI 0-21 |
| 19 | ThailandME |
| 20 | ThailandPE |
| 21 | India |
| 22 | SouthKorea |
| 23 | Philippin |
| 24 | DPRK |
| 25 | Malaysia |
| 26 | Cyprus |
| 27 | Holland |
| 28 | EN50549-1 |
| 29 | Spain |
| 30 | Greece |
| 31 | Hungary |
| 32 | Portugal |
| 33 | Belgium |
| 34 | Denmark |
| 35 | Estonia |
| 36 | Moldova |
| 37 | Slovak |
| 38 | Sweden |
| 39 | Austria |
| 40 | Bulgaria |
| 41 | Croatia |
| 42 | Ukraine |
| 43 | S.Africa |
| 44 | Mauritius |
| 45 | Israel |
| 46 | Mexico |
| 47 | Brazil |
| 48 | SriLanka |
| 49 | Chile |
| 50 | CONNERA |
| 251 | Ireland |
| 252 | Lithuania |
| 253 | Slovenia |
| 254 | Latvia |
| 255 | IEC 61727 |
| 256 | Colombia |
| 257 | Romania |
| 258 | Norway |
| 259 | Bolivia |
| 260 | Dominica_120 |
| 261 | Dominica_240 |
| 262 | Vietnam |
| 263 | Czech |
| 264 | Australia A |
| 265 | Pakistan |
| 266 | Nigeria |
| 267 | Australia B |
| 268 | Australia C |
| 269 | New Zealand |
| 270 | CostaRica |
| 271 | Iran |
| 272 | Azerbaijan |
| 273 | MT-R |
| 274 | MT-U |
| 275 | Switzerland |
| 276 | Pakistan-W |
| 277 | Denmark 2 |
| 278 | SriLanka B |
| 279 | Serbia |
| 280 | Reserve280 |
| 281 | Reserve281 |
| 282 | Reserve282 |
| 283 | Reserve283 |
| 284 | Reserve284 |
| 285 | Reserve285 |
| 286 | Reserve286 |
| 287 | Reserve287 |
| 288 | Reserve288 |
| 289 | Reserve289 |
| 290 | Reserve290 |
| 291 | Reserve291 |
| 292 | Reserve292 |
| 293 | Reserve293 |
| 294 | Reserve294 |
| 295 | Reserve295 |
| 296 | Reserve296 |
| 297 | Reserve297 |
| 298 | Reserve298 |
| 299 | Reserve299 |
| 300 | Reserve300 |
| 301 | Reserve301 |
| 302 | Reserve302 |
| 303 | Reserve303 |
| 304 | Reserve304 |
| 305 | Reserve305 |
| 306 | Reserve306 |
| 307 | Reserve307 |
| 308 | Reserve308 |
| 309 | Reserve309 |
| 310 | Reserve310 |
| 311 | Reserve311 |
| 312 | Reserve312 |
| 313 | Reserve313 |
| 314 | Reserve314 |
| 315 | Reserve315 |
| 316 | Reserve316 |
| 317 | Reserve317 |
| 318 | Reserve318 |
| 319 | Reserve319 |
| 320 | Reserve320 |
| 321 | Reserve321 |
| 322 | Reserve322 |
