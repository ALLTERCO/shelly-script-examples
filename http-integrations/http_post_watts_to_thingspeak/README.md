# ThingSpeak HTTP POST

Script: `http_post_watts_to_thingspeak.shelly.js`

## What this example is about
This script periodically reads active power (watts) and pushes it to ThingSpeak with `HTTP.POST`.

It is designed as a minimal cloud telemetry pipeline: read a local metric, send it to a hosted time-series channel.

## The story behind it
A common first analytics goal is simple trending: "How does power usage change through the day?" This example focuses on that exact path with very little setup and no extra broker dependency.

You get a practical baseline for remote graphs and lightweight reporting.

## Use cases this solves
- Build quick power dashboards in ThingSpeak.
- Compare daily or weekly consumption trends.
- Validate behavior after schedule or automation changes.
- Provide simple external visibility for non-local stakeholders.

## Who this is suitable for
- Users new to cloud telemetry who want an easy first integration.
- Makers and hobbyists already using ThingSpeak channels.
- Integrators who need a straightforward HTTP push example for adaptation.

## Notes before use
- Set your ThingSpeak write API key before enabling the script.
- Adjust posting interval based on channel limits and desired granularity.
- Extend payload fields if you want temperature or additional metrics.
