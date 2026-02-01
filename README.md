# Shelly Script Examples

This project contains example Shelly Script solutions.

Initial support for Shelly Script comes with firmware version 0.9, September
2021 for Gen2 Shellies based on ESP32.

## Who is this for?

This repository is designed for:

- **Home automation enthusiasts** - Looking to extend Shelly device capabilities beyond the default features
- **Smart home integrators** - Building custom solutions with Shelly devices for clients
- **Developers** - Learning Shelly scripting through practical, working examples
- **IoT hobbyists** - Experimenting with BLE sensors, MQTT, LoRa, and other protocols
- **Energy-conscious users** - Implementing load shedding, power monitoring, and efficiency solutions

**Prerequisites:**
- Basic understanding of JavaScript
- Shelly Gen2 or Gen3 device with firmware 0.9+
- Access to the Shelly web interface or app for script deployment

## Documentation

- [Script Index](SHELLY_MJS.md) - Full list of all example scripts with descriptions
- [Changelog](CHANGELOG.md) - See what's new
- [Contributing](CONTRIBUTING.md) - How to contribute to this project
- [Tools](tools/README.md) - Helper utilities for uploading scripts and validation
- [License](LICENSE) - Apache License 2.0
- [Shelly Script Documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures) - Official Shelly scripting docs

## Collections

- [The Pill](the_pill/README.md) - UART peripherals and hardware integrations

## Repository Layout

- `ble/` - BLE/BLU sensors, buttons, and gateways
- `lora/` - LoRa send/receive and device control examples
- `mqtt/` - MQTT and Home Assistant integrations
- `power-energy/` - Load management, power thresholds, and monitoring
- `switch-input/` - Input handling, switch behavior, and cover control
- `weather-env/` - Weather and environmental sensor integrations
- `http-integrations/` - HTTP endpoints, notifications, and external services
- `networking/` - Provisioning and watchdog scripts
- `scheduling/` - Scheduling, scenes, and orchestration
- `blu-assistant/` - BLU Assistant device management scripts
- `howto/` - Minimal examples and tutorials
