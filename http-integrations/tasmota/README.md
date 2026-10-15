# Tasmota HTTP Integrations

Scripts that use a Shelly device as the local control layer and one or more
Tasmota devices as HTTP-controlled execution endpoints.

## Problem (The Story)
A Shelly device is a convenient place to host logic, schedules, and Virtual
Components, but some installations already use Tasmota hardware for infrared
transmission or protocol bridging. In that setup, Shelly becomes the
decision-maker and user-facing dashboard, while Tasmota acts as the device that
actually emits the command into the physical world.

These examples show how to connect the two roles over the local network:
- Shelly stores configuration, exposes controls, and decides when to act
- Tasmota receives HTTP commands from Shelly and performs the IR send

## Persona
- Home automation user who wants Shelly UI controls for equipment handled by a Tasmota bridge
- Integrator combining Shelly logic with existing Tasmota IR blasters on the LAN
- Installer who needs a simple LAN-only control path without an extra server

## Device Folders

- [`mitsubishi-heavy-ac/`](mitsubishi-heavy-ac/): Mitsubishi Heavy HVAC control through Tasmota IR bridges. The Virtual Components controller is production.

## Shelly-Tasmota Relationship

In this collection, the Shelly device is the controller:
- it creates Virtual Components
- it stores the selected mode, fan speed, temperature, and target
- it sends HTTP requests to the chosen Tasmota endpoint

The Tasmota device is the executor:
- it listens on its HTTP command endpoint
- it accepts `IRHVAC` payloads from Shelly
- it transmits the IR frame toward the air conditioner

## Notes

- Shelly and Tasmota must be reachable on the same trusted network.
- The Tasmota device must expose the `/cm?cmnd=` endpoint.
- Example IPs inside scripts and docs may be placeholders and must be replaced before deployment.
