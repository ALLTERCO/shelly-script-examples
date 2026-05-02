# V-TAC Proposed Register Map

This document is a working interpretation of the discovered `FC 0x03` holding
registers from [`registers.md`](registers.md). It is not an official protocol
document.

The goal is to compare the discovered values against public product and manual
data for the same inverter family and produce a practical first-pass naming and
scaling proposal for further testing.

## Sources Used

- V-TAC `VT-66036103` product page:
  https://v-tac.eu/solar-pv-systems/solar-inverters/3-6kw-on-off-grid-hybrid-solar-inverter-single-phase-3-yrs-warranty-ip65-detail.html
- V-TAC `VT-66036103` instruction manual:
  https://www.manualslib.com/manual/2955996/V-Tac-Vt-66036103.html
- INVT `XD3-6KTL` product page:
  https://www.invt.com/products/xd3-6kw-single-phase-hybrid-inverter-223

## Important Caveat

There is still no public official register map for `VT-66036103`.

So the logic here is:

1. V-TAC publicly identifies this product as `Brand: INVT`.
2. The published electrical limits of the V-TAC unit strongly resemble the
   INVT single-phase hybrid family.
3. Several discovered values match the published electrical ratings closely
   enough to support tentative naming and scaling.

Anything marked `Low` confidence should be treated as a hypothesis only.

## Proposed Grouping

| Address Range | Proposed Group | Reasoning | Confidence |
|---|---|---|---|
| `0x1000..0x1321` | Identification, versioning, status words, and static data | Mixed values with many zeros; several words look more like metadata than live telemetry | Low |
| `0x1600..0x16C7` | Battery/BMS and DC-side thresholds | Cluster contains values that look like voltage/current limits and battery-related configuration | Medium |
| `0x2200..0x222C` | Rated electrical limits and factory template values | This block contains several values that align with published current, power, and voltage limits | Medium |
| `0x2284..0x2298` | Flags, sentinels, or standard-specific options | Mostly zeros, plus `0xFFFF` and one obvious percentage-style value (`100`) | Low |
| `0x231C..0x2323` | Grid code protection thresholds and timers | `50.50` and `47.00` are strong candidates for frequency trip thresholds | Medium |

## Proposed Registers

| Address | Hex | Proposed Name | Scale | Proposed Unit | Group | Why | Confidence |
|---|---|---|---|---|---|---|---|
| `5752` | `0x1678` | `battery_nominal_voltage` | `0.1` | `V` | Battery/BMS | `6405 -> 640.5 V` is too high for this platform, but `64.05 V` is too low for the published battery family; this may instead be a packed or model-specific DC reference value | Low |
| `5776` | `0x1690` | `pv1_voltage` | `0.1` | `V` | Battery/BMS | Live changes such as `130 -> 263` map cleanly to `13.0 -> 26.3 V`, which is a plausible PV string voltage | High |
| `5778` | `0x1692` | `pv2_voltage` | `0.1` | `V` | Battery/BMS | Live changes such as `120 -> 205` map cleanly to `12.0 -> 20.5 V`, matching a second PV input | High |
| `5784` | `0x1698` | `input_voltage` | `0.1` | `V` | Battery/BMS | Live changes such as `2377 -> 2395` map to `237.7 -> 239.5 V`, a realistic AC-side voltage | High |
| `5786` | `0x169A` | `output_voltage` | `0.1` | `V` | Battery/BMS | Live changes such as `2306 -> 2356` map to `230.6 -> 235.6 V`, a realistic output/grid voltage range | High |
| `5790` | `0x169E` | `power` | `0.01` | `W` | Battery/BMS | Working assumption from live testing: this register moves with load and should currently be treated as a power-like value with `0.01 W` scaling | Medium |
| `5792` | `0x16A0` | `frequency` | `0.01` | `Hz` | Battery/BMS | Live changes such as `4998 -> 4999 -> 5001` map exactly to `49.98 -> 49.99 -> 50.01 Hz`, which strongly confirms a live frequency measurement | High |
| `5793` | `0x16A1` | `nominal_frequency` | `0.01` or `0.1` | `Hz` | Battery/BMS | `100` can represent `50.0 Hz` only under an encoded scheme; keep as placeholder near `5792` | Low |
| `5798` | `0x16A6` | `grid_voltage_or_current_limit_1` | `0.1` | `V or A` | Battery/BMS | `240 -> 24.0` or `240.0`; plausible utility-side threshold value | Low |
| `5799` | `0x16A7` | `grid_voltage_or_current_limit_2` | `0.1` | `V or A` | Battery/BMS | `540 -> 54.0` or `540.0`; likely paired with `5798` | Low |
| `5800` | `0x16A8` | `grid_voltage_or_current_limit_3` | `0.1` | `V or A` | Battery/BMS | Same cluster as `5798/5799` | Low |
| `8704` | `0x2200` | `battery_voltage_threshold_a` | `0.1` | `V` | Rated limits | `940 -> 94.0 V` is plausible for a high-voltage battery threshold | Medium |
| `8705` | `0x2201` | `battery_voltage_threshold_b` | `0.1` | `V` | Rated limits | `970 -> 97.0 V` fits the same battery-threshold cluster | Medium |
| `8706` | `0x2202` | `battery_voltage_threshold_c` | `0.1` | `V` | Rated limits | `1030 -> 103.0 V` fits the same cluster | Medium |
| `8707` | `0x2203` | `battery_voltage_threshold_d` | `0.1` | `V` | Rated limits | `1060 -> 106.0 V` fits the same cluster | Medium |
| `8708` | `0x2204` | `battery_charge_current_limit` | `0.1` | `A` | Rated limits | `440 -> 44.0 A` is plausible for a `~100 V` battery and `~3.6 kW` inverter | Medium |
| `8711` | `0x2207` | `battery_discharge_current_limit` | `0.1` | `A` | Rated limits | Same reasoning as `8708` | Medium |
| `8712` | `0x2208` | `battery_capacity` | `0.1` or `1` | `Ah` | Rated limits | `1000` is a good fit for `100.0 Ah` or `100 Ah` | Medium |
| `8713` | `0x2209` | `pv1_max_input_current` | `0.1` | `A` | PV ratings | `160 -> 16.0 A` matches the published maximum PV input current | High |
| `8714` | `0x220A` | `pv2_max_input_current` | `0.1` | `A` | PV ratings | Same match as `8713`; the inverter has two MPPT trackers | High |
| `8718` | `0x220E` | `pv_max_voltage_limit` | `0.1` | `V` | PV ratings | `6200 -> 620.0 V` is close to the INVT family max PV voltage class (`600 V`) and may include guard margin | Medium |
| `8719` | `0x220F` | `pv_operating_voltage_limit` | `0.1` | `V` | PV ratings | `6120 -> 612.0 V` fits the same cluster | Low |
| `8720` | `0x2210` | `mppt_voltage_upper_limit` | `0.1` | `V` | PV ratings | `4705 -> 470.5 V` is close to the published MPPT upper range family | Medium |
| `8721` | `0x2211` | `mppt_voltage_upper_recovery` | `0.1` | `V` | PV ratings | `4650 -> 465.0 V` plausibly pairs with `8720` | Medium |
| `8725` | `0x2215` | `rated_ac_power` | `1` | `W` | AC ratings | `3000` matches the lower rated AC power published for this family | High |
| `8726` | `0x2216` | `apparent_power_or_charge_power_limit` | `1` | `W` | AC ratings | `1200` is too neat to ignore, but the exact function is unclear | Low |
| `8727` | `0x2217` | `power_limit_1` | `1` | `W` | AC ratings | `500` may be a configurable power step or reserve level | Low |
| `8728` | `0x2218` | `power_limit_2` | `1` | `W` | AC ratings | Same cluster as `8727` | Low |
| `8729` | `0x2219` | `ac_output_current_limit` | `0.1` | `A` | AC ratings | `130 -> 13.0 A` matches the lower published output-current class | Medium |
| `8730` | `0x221A` | `surge_or_charge_current_limit` | `0.1` | `A` | AC ratings | `200 -> 20.0 A` looks like a limit rather than live telemetry | Low |
| `8733` | `0x221D` | `battery_capacity_duplicate` | `0.1` or `1` | `Ah` | Battery/BMS | Another `1000`, likely same family setting repeated in a second template block | Low |
| `8737` | `0x2221` | `model_power_class` | `0.1` | `kW` | AC ratings | `36 -> 3.6 kW` matches the V-TAC model rating very closely | Medium |
| `8738` | `0x2222` | `nominal_grid_frequency_a` | `1` or `0.1` | `Hz` | Grid standard | `50` strongly suggests nominal grid frequency | Medium |
| `8739` | `0x2223` | `nominal_grid_frequency_b` | `1` or `0.1` | `Hz` | Grid standard | Duplicate `50`, likely second mode or backup mode | Medium |
| `8740` | `0x2224` | `current_limit_template_a` | `0.1` or `1` | `A` | Grid standard | `40` fits a current-limit style field, but not yet attributable | Low |
| `8741` | `0x2225` | `power_limit_template_a` | `0.1` or `1` | `kW or A` | Grid standard | `30` may encode `3.0 kW` or `30 A` depending on family convention | Low |
| `8742` | `0x2226` | `voltage_limit_template_a` | `0.1` | `V` | Grid standard | `1200 -> 120.0 V` looks like a protection threshold | Low |
| `8743` | `0x2227` | `voltage_limit_template_b` | `0.1` | `V` | Grid standard | `800 -> 80.0 V` likely pairs with `8742` | Low |
| `8744` | `0x2228` | `peak_power_limit` | `1` | `W` | AC ratings | `6700` may represent a family template value or combined peak/DC limit | Low |
| `8745` | `0x2229` | `backup_peak_power_limit` | `1` | `W` | AC ratings | `4500` matches a plausible `150% of 3 kW` peak-output value | Medium |
| `8747` | `0x222B` | `reconnect_voltage_or_power_threshold` | `0.1` or `1` | `V or W` | Grid standard | `1300` likely belongs to the same protection template cluster | Low |
| `8836` | `0x2284` | `invalid_or_unused_marker` | `raw` | `-` | Flags | `65535` is a common sentinel for unused or unsupported fields | High |
| `8856` | `0x2298` | `soc_or_percentage_limit` | `1` | `%` | Flags | `100` is a strong fit for a percentage-style full-scale setting | Medium |
| `8988` | `0x231C` | `trip_delay_or_percent_1` | `1` or `0.1` | `s or %` | Grid code | `200` is structured like a delay or percentage field | Low |
| `8989` | `0x231D` | `trip_delay_or_percent_2` | `1` or `0.1` | `s or %` | Grid code | `50` belongs to the same compact settings block | Low |
| `8990` | `0x231E` | `trip_delay_or_percent_3` | `1` or `0.1` | `s or %` | Grid code | `100` belongs to the same compact settings block | Low |
| `8991` | `0x231F` | `trip_delay_or_percent_4` | `1` or `0.1` | `s or %` | Grid code | Same as `8990` | Low |
| `8992` | `0x2320` | `grid_frequency_high_trip` | `0.01` | `Hz` | Grid code | `5050 -> 50.50 Hz` is a very strong fit for an anti-islanding/grid-code threshold | High |
| `8993` | `0x2321` | `grid_frequency_low_trip` | `0.01` | `Hz` | Grid code | `4700 -> 47.00 Hz` is a very strong fit for the paired low-frequency trip threshold | High |
| `8994` | `0x2322` | `grid_voltage_low_trip_or_reconnect` | `0.1` | `V` | Grid code | `1100 -> 110.0 V` is plausible for a protection threshold, but not yet confirmed | Medium |
| `8995` | `0x2323` | `grid_voltage_low_trip_or_reconnect_2` | `0.1` | `V` | Grid code | `850 -> 85.0 V` looks like a paired lower threshold or recovery value | Medium |

## What Looks Strongest Right Now

These are the best current candidates:

- `5776` and `5778` as live `PV1/PV2 voltage` with `0.1 V` scaling
- `5784` and `5786` as live `input/output voltage` with `0.1 V` scaling
- `5790` as live `power` with `0.01 W` scaling
- `5792` as live `frequency` with `0.01 Hz` scaling
- `8992` and `8993` as `grid frequency high/low trip = 50.50 / 47.00 Hz`
- `8836` as an unused/sentinel field

## Recommended Next Validation Steps

1. Change the inverter grid standard in the LCD and re-read `8992..8995`.
   If they move, that confirms this as a grid-code block.
2. Change battery type or battery charge/discharge settings and re-read
   `8704..8712`.
3. Temporarily reduce any user-exposed charge/discharge current limit and
   check whether `8708` or `8711` follow the setting.
4. Re-scan a small live window during PV production and battery charging to see
   whether any of these "static-looking" registers are actually live telemetry.
5. Once a name is validated, copy it back into [`registers.md`](registers.md)
   as the first-column `Name` value.
