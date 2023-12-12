ntc-conversion.js: Converts NTC thermal resistor output to temperature and execute actions
===
Reads voltage data from the Shelly Plus Add-on, calculate the corresponding temperature using the Steinhart-Hart equation, and take action based on the temperature reading

ble-shelly-motion.js: BLE in Scripting - Shelly BLU Motion script actions
===
Example how to use a Shelly BLU Motion, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

telegram-interaction.js: Telegram interaction with Shelly script
===
This script allows the creation of personalized commands for a Telegram bot, providing the ability to define handlers for each command and support for advanced parameter validation. 
(Requires firmware version: 1.0.0-beta or newer)

ble-shelly-blu.js: Shelly BLU devices event handler for scripts
===
Script that handles and parses events from all Shelly BLU devices and emits event with the received data. Made to be used with "ble-events-handler.js" script that handles the events 
(Requires firmware version: 1.0.0-beta or newer)

ble-events-handler.js: Handles event from the device (at the moment tested only with BLU events from "ble-shelly-blu.js" example
===
Do automations based on events and easy conditioning. This script must be used with another script that emits events for example "ble-shelly-blu.js" script. 
(Requires firmware version: 1.0.0-beta or newer)

ble-aranet4.js: Aranet4 example with BLE scripting
===
Example how to use a 3rd party BLE sensor and execute actions based on conditions. (Requires firmware version
0.12.0-beta1 or newer)

ble-aranet2.js: Aranet2 example with BLE scripting
===
Example how to use a 3rd party BLE sensor and execute actions based on conditions. (Requires firmware version
0.12.0-beta1 or newer)

ble-shelly-btn-gateway-for-other-devices.js: Gateway between Shelly BLU button1 and other devices
===
Use your Gen2 device as a gateway between Shelly Blu button1 and other Shelly devices (no matter Gen1 or Gen2) by sending local requests by their local IP APIs.

activation-switch.js: Activation switch
===
Replicate activation_switch profile from Gen1 devices.

ble-pasv-mqtt-gw.js: BLE Thermometer passive data collector for MQTT Autodiscovery
===
BLE passive mode scanner for non-battery operated Gen2 devices.
Decoding protocols Mijia/ATC/pvvx/BTHome2, forwards data to the MQTT broker with Autodiscovery objects. (Requires firmware version
0.12.0-beta1 or newer)

ble-shelly-btn.js: BLE in Scripting - Shelly BLU Button script actions
===
Example how to use a Shelly BLU Button, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

ble-shelly-dw.js: BLE in Scripting - Shelly BLU DoorWindow script actions
===
Example how to use a Shelly BLU DoorWindow, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

ble-shelly-scanner.js: BLE in Scripting - Shelly BLU Scanner
===
This script will scan aired advertisement data, select Shelly BLU devices and will print their name and address (Requires firmware version
0.12.0-beta1 or newer)

ble-ruuvi.js: BLE in Scripting - Ruuvi example
===
Example how to use a 3rd party BLE sensor, read data and turn on switch based on the data. (Requires firmware version
0.12.0-beta1 or newer)

ble-bparasite.js: BLE in Scripting - b-parasite example
===
Example how to use a 3rd party BLE sensor, read environment data. (Requires firmware version
0.12.0-beta1 or newer)

cycle-switch.js: Configurable Cycle switch
===
Replicate Cycle switch feature from Gen1 devices. Allows for custom list of operations to cycle through.

http-notify-on-power-threshold.js: Shelly XPM - Send HTTP notification if power goes above threshold
===
This script subscribes for notifications, monitors the instanteneous power of the output switch and if that
goes above a threshold value and if current time is within the active time window will send an HTTP notification

http-handlers.js: Shelly HTTP script handling GET requests, query strings
===
This script registers a HTTP handler endpoint and implements simple logic for requests and handlers for
those requests. Reconfiguration of a Switch component as an example is included

prometheus.js: Prometheus HTTP Endpoint for a single switch
===
This script exposes a /status endpoint that returns Prometheus metrics that can be scraped.

consume-limited-power.js: Shelly Plus 1PM - Stop the output after consuming certain amount of power
===
This script listens for the event when the output is turned on, and starts counting the power reported in NotifyStatus
every minute.
It is accumulated in a counter and if the combined consumption is over a threshold the output is turned off.

cover-control-weather.js: Control a Shelly 2.5 (Gen1) depending on current cloud conditions
===
The script, when run, will fetch via REST api from a weather service the current conditions for a location check if
cloud coverage is above or below certain percentage and respectively open or close window shades by calling a Shelly
2.5 (Gen1) endpoint.

cover-scheduled-event-handlers.js: Control a Shelly Plus 2PM (Gen2) by handling events
===
The script, when run, will subscribe to events and handle "cover_open_to" and "cover_close_to" events to open or close a cover to a certain position. "cover_open_to" also supports a "not_before" configuration to prevent opening the cover before a certain time.

precipitation-irrigation.js: Turn on/off watering based on precipitation in last 24 hours (based on AccuWeather data)
===
If there was precipitation in the past period (24h) skip an irrigation cycle. Data is retrieved from a public wather API service for the location.
You can use any Shelly Plus 1/Pro 1 ot Pro 2 to control your irrigation system.
Don't forger to add AutoOFF for max Irrigation time and set a Schedule which start irrigation in device webUI.
Note: Configure your Accuweather APIKEY and end points in the script once you add it.

failure-monitor.js: Load monitoring and alerting in Shelly Gen2
===
This script listens for events when power changes to 0 and if the switch is still on then it alerts that something
might have happened to the load.

idle-alert.js: Alert on inactivity
===
Script that will monitor the inputs of a Shelly and if there was no user interaction with the input(s) It will call an
URL with a predefined message

mqtt-announce.js: Backward compatibility with Gen1 MQTT format (announce only)
===
Use MQTT in scripting to provide backwards compatibility with Gen1 MQTT topics shellies/announce and shellies/command

mqtt-announce-control.js: Backward compatibility with Gen1 MQTT format (extended)
===
Use MQTT in scripting to provide backwards compatibility with Gen1 MQTT topics shellies/announce, shellies/command, <device-id>/command,
/command/switch:0/output.

Publish device status, input and switch status

mqtt-discovery.js: MQTT Auto Discovery in Home Assistant
===
This script is registering a virtual switch device in HA.

The implementation is banal and directly reports switch state and controls a switch, but you can have a totally different virtual device: valve, light, scene.

Note: Requires configuration.yaml change in HA, please refer to the comments in the code of this file.

mqtt-discovery-sensors.js: MQTT Auto Discovery in Home Assistant - Sensors
===
This script is registering a virtual switch device in HA.

Switch sensors are also registered as entities.

Note: Requires configuration.yaml change in HA, please refer to the comments in the code of this file.

mqtt-switch-status.js: Send Switch status to a custom MQTT topic
===
Use MQTT in scripting to provide switch status updates on a custom topic

n-way-dimmer.js: n-way-dimmer.js
===
Setup an N-Way dimmer using the Shelly Plus Wall Dimmer. One dimmer is connected to the light while the other dimmer switches can be useed to remotely control the light and will reflect the current state of the light. This setup only requires wifi connectivity, the swiches communicate directly with each other. You will need to update the CONFIG GROUP with the IP addresses of all the switches in the group.

objects.js: mJS example of how to create custom Objects that interact with components (Switch in this case)
===
Example of how to create wrappers around RPC calls and using Object.create.

push-pushed.js: Push notifications using Pushed service
===
Use a script to notify directly on your mobile phone via a push notification service.

remoterpc.js: Example of remote calling a Shelly Gen2
===
A remote Shelly abstraction Call an RPC method on the remote Shelly

register-scheduled-script.js: Schedule script function for execution into the system schedule
===
When the script is run it will check if it is registered in the schedule and if not will register itself

restore-schedule.js: After boot scan schedules and run active one
===
When device boots and there is a schedule that has to be active at the moment it won't be executed. This script
walks through the configured schedules and runs the one that should be active at that moment of time.

router-watchdog.js: Router Watchdog
===
This script tries to execute HTTP GET requests within a set time, against a set of endpoints.

After certain number of failures the script sets the Switch off and after some time turns it back on.

scene.js: Scene playing in Shelly Gen2
===
Simple scene abstraction A scene is an array of actions or conditions that
are played squentially.

An action can have a delay property, which means after executing the action function wait until proceeding to the next one.

A condition is an element of a scene that has property type:"cond".
If the result is true, the scene continues with the next item, if it is false it
stops.

shelly2p-domo-coverfix.js: Shelly Plus 2PM cover fix for Domoticz MQTTAD v1
===
Simple fix for outgoing Domoticz MQTTAD command 'GoToPosition'.
 Shelly firmware 0.x supported. Developed for ShellyTeacher4Domo.

shelly2p-domo-coverfix-v2.js: Shelly Plus 2PM cover fix for Domoticz MQTTAD v2
===
Simple fix for outgoing Domoticz MQTTAD command 'GoToPosition'.
 Only Shelly firmware >= 1.x supported. Developed for ShellyTeacher4Domo.

test-scene.js: Scene Test with multiple Shellies
===
Playing a scene with four Shellies with that have a lamp as a load.

Demonstration of a "Remote Shelly" wrapper object. object prototyping, and simple scene player.

turn-on-weather.js: turn-on-weather.js
===
Turn on when temperature is below CONFIG.tempBelowTurnOn.

Turn off when temperature is above CONFIG.tempAboveTurnOff.

For getting an API-KEY from Accuweather follow the instructions on their site for registering a new application, copy
the key and paste it here.

wifi-provision.js: Provisioning of new Shelly Plus gen 2 devices
===
This scripts periodically scans for access points with SSID matching the template for Shelly Plus device APs and if
found, will connect to that AP and provision WiFi credentials.

mqtt-switch-status-announce.js: Periodically send Switch status to MQTT topic
===
Use MQTT in scripting to periodically provide switch status updates on the mentioned topic "<topic_prefix>/status/switch:0"

howto/input-event.js: Example - Input events
===
Example showing how to work with Input component's events.

howto/input-read.js: Example - Reading Input status
===
Example showing how to read Input component's status.

howto/switch-event.js: Example - Switch events
===
Example showing how to work with Switch component's events.

howto/switch-notifications.js: Example - Switch notifications - reading consumption active power
===
Example how to read Switch notifications and listen for when active power is more than 4W.

howto/switch-read.js: Example - Reading Switch status
===
Example of reading Switch component's status.

ip-assignment-watchdog.js: Reboot on DHCP IP assignment issues
===
Monitor for valid IP assignment from DHCP server and reboot if not received within a certain time period.

