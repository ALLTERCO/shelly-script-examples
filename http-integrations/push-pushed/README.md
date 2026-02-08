# Pushed Notifications

Script: `push-pushed.shelly.js`

## What this example is about
This script sends push notifications through the Pushed service by constructing and submitting form-encoded HTTP requests.

It demonstrates how Shelly can act as a direct notifier without requiring a full automation platform in the middle.

## The story behind it
Sometimes users need "human-in-the-loop" awareness, not just machine-to-machine events. This example focuses on delivering a message to a phone quickly when a condition in your script is met.

It provides a reusable notification block you can plug into many other scripts.

## Use cases this solves
- Send immediate phone alerts for critical device events.
- Notify users when safety-related or operational states change.
- Add confirmation messages for automation outcomes.
- Build simple escalation paths from local events to personal devices.

## Who this is suitable for
- Home users who want direct mobile alerts from Shelly logic.
- Integrators adding notification output to existing scripts.
- Developers learning HTTP form payload patterns in mJS.

## Notes before use
- Configure app key and secret before testing notifications.
- Keep notification text short, specific, and actionable.
- Reuse `getPushedDataObject()` and `prepareFormData()` in other integrations.
