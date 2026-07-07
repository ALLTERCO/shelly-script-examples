# MODBUS Examples

MODBUS examples for Shelly devices using built-in MODBUS clients or RS485 add-ons.

## Problem (The Story)

Many inverters, batteries, meters, and plant controllers expose useful local
telemetry over MODBUS. These examples turn that device data into Shelly logs,
Virtual Components, or automation-ready values without relying on vendor cloud
services.

## Persona

- Installer integrating local energy telemetry into a Shelly-based system
- Advanced user replacing cloud-only monitoring with local MODBUS reads
- Engineer validating register maps and automation logic on real devices

## Structure

- [`Sigenergy/`](Sigenergy/): Sigenergy/SigenStor MODBUS examples for Shelly Pro RS485 Addon
