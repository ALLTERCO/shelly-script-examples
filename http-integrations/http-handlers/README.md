# HTTP Handlers

Script: `http-handlers.shelly.js`

## What this example is about
This script shows how to turn a Shelly device into a tiny HTTP API. It registers a custom endpoint on the device and routes query-string parameters to different actions.

Think of it as the first step from "a script that runs locally" to "a script that can be controlled remotely by other systems."

## The story behind it
Many integrations start with a simple need: trigger something on Shelly from another service, dashboard, or automation engine. Instead of hard-coding one behavior, this example demonstrates a pattern where one endpoint can dispatch multiple actions.

That makes it a practical foundation for building local control interfaces that are easy to extend.

## Use cases this solves
- Expose a simple local API for Home Assistant, Node-RED, or custom scripts.
- Trigger profile or switch behavior from another device on the LAN.
- Prototype command-style integrations before building larger automations.
- Learn request parsing and response handling in Shelly mJS.

## Who this is suitable for
- Users who already run local automations and want direct HTTP control.
- Integrators building custom bridges between Shelly and third-party systems.
- Developers learning endpoint design patterns in constrained scripting environments.

## Notes before use
- Keep endpoints on trusted networks unless you add your own security checks.
- Start with a test-only action first, then add device-control actions.
- Prefer clear action names and explicit parameter validation.
