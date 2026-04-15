# EcoFlow HTTP Integrations

Scripts that control EcoFlow devices via the EcoFlow cloud REST API from a Shelly device.

## Problem (The Story)
EcoFlow batteries (e.g. STREAM Ultra) can be commanded over the EcoFlow cloud API, but pairing that API with local Shelly metering data requires a bridge. These scripts run on the Shelly itself, sign and send API requests, and close the loop between local energy measurements and battery dispatch — no external server needed.

## Persona
- Home solar / storage owner automating battery charge and discharge
- Energy automation engineer integrating EcoFlow devices into a local Shelly setup
- Installer deploying self-consumption or load-balancing logic alongside EcoFlow hardware

## Device Folders

- [`stream-ultra/`](stream-ultra/): EcoFlow STREAM Ultra battery examples

## References
- [EcoFlow Open Platform (EU)](https://developer-eu.ecoflow.com)
- [EcoFlow Open Platform (US)](https://developer.ecoflow.com)
