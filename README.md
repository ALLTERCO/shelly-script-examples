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
- [BLU Assistant](blu-assistant/README.md) - BLE device provisioning, configuration, and management scripts
- [Cury](cury/README.md) - Expressive light patterns and visual feedback for Shelly Cury devices

## Repository Layout

- [ble/](ble/README.md) - BLE/BLU sensors, buttons, and gateways
- [howto/](howto/README.md) - Minimal examples and tutorials
- [http-integrations/](http-integrations/README.md) - HTTP endpoints, notifications, and external services
- [lora/](lora/README.md) - LoRa send/receive and device control examples
- [mqtt/](mqtt/README.md) - MQTT and Home Assistant integrations
- [networking/](networking/README.md) - Provisioning and watchdog scripts
- [power-energy/](power-energy/README.md) - Load management, power thresholds, and monitoring
- [scheduling/](scheduling/README.md) - Scheduling, scenes, and orchestration
- [switch-input/](switch-input/README.md) - Input handling, switch behavior, and cover control
- [weather-env/](weather-env/README.md) - Weather and environmental sensor integrations
