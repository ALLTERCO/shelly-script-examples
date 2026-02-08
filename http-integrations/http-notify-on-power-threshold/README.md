# HTTP Notify On Power Threshold

Script: `http-notify-on-power-threshold.shelly.js`

## What this example is about
This script watches live power draw and sends an HTTP notification when usage crosses a configured threshold, optionally limited to an active time window.

It is a lightweight way to turn power anomalies into actionable alerts.

## The story behind it
In many setups, users do not need full historical analytics first. They need a fast signal when "something is wrong" or "something unusual started running." This script captures that moment and notifies an external endpoint right away.

The built-in time window helps avoid noisy alerts outside relevant hours.

## Use cases this solves
- Detect a heavy appliance unexpectedly turning on.
- Alert when standby consumption suddenly becomes high.
- Trigger automations (webhook workflows) only during business or night hours.
- Build early warning behavior without deploying a full monitoring stack.

## Who this is suitable for
- Home users who want simple consumption alerts.
- Small offices tracking abnormal load patterns.
- Integrators who already have webhook receivers and want event-driven triggers.

## Notes before use
- Tune threshold carefully to avoid false positives.
- Use `notifyOnce` when you only need one alert per event period.
- Point `httpEndpoint` to a reliable service that can log or forward alerts.
