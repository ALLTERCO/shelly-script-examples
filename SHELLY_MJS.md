ble/ble-PTM215B-button.shelly.js: PTM215B EnOcean BLE button handler
===
Handles PTM215B energy-harvesting BLE button events to control up to 4 relays.

ble/ble-aranet2.shelly.js: Aranet2 example with BLE scripting
===
Example how to use a 3rd party BLE sensor and execute actions based on conditions. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-aranet4.shelly.js: Aranet4 example with BLE scripting
===
Example how to use a 3rd party BLE sensor and execute actions based on conditions. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-bparasite.shelly.js: BLE in Scripting - b-parasite example
===
Example how to use a 3rd party BLE sensor, read environment data. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-events-handler.shelly.js: Handles event from the device (at the moment tested only with BLU events from "ble-shelly-blu.shelly.js" example
===
Do automations based on events and easy conditioning. This script must be used with another script that emits events for example "ble-shelly-blu.shelly.js" script. 
(Requires firmware version: 1.0.0-beta or newer)

ble/ble-miflora-xiaomi-hhccjcy01.shelly.js: MiFlora Parser / xiaomi_hhccjcy01
===
Scans for BLE events of MiFlora plant sensors and publishes them

ble/ble-mopeka.shelly.js: Mopeka propane tank gauge BLE reader
===
Reads Mopeka ultrasonic tank sensor via BLE and publishes level data to MQTT.

ble/ble-pasv-mqtt-gw.shelly.js: BLE Thermometer passive data collector for MQTT Autodiscovery
===
BLE passive mode scanner for non-battery operated Gen2 devices.
Decoding protocols Mijia/ATC/pvvx/BTHome2, forwards data to the MQTT broker with Autodiscovery objects. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-ruuvi.shelly.js: BLE in Scripting - Ruuvi example
===
Example how to use a 3rd party BLE sensor, read data and turn on switch based on the data. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-shelly-blu-remote-control-cover.shelly.js: Control a cover with a Shelly BLU Remote Control ZB
===
Script that handles bluetooh events from a Shelly BLU Remote Control ZB device and controls a cover connected to a Shelly 2PM (gen 2 or newer). Requires the "ble-shelly-blu.shelly.js" script to be installed and running 
(Requires firmware version: 1.0.0-beta or newer)

ble/ble-shelly-blu.shelly.js: Shelly BLU devices event handler for scripts
===
Script that handles and parses events from all Shelly BLU devices and emits event with the received data. Made to be used with "ble-events-handler.shelly.js" script that handles the events 
(Requires firmware version: 1.0.0-beta or newer)

ble/ble-shelly-btn-gateway-for-other-devices.shelly.js: Gateway between Shelly BLU button1 and other devices
===
Use your Gen2 device as a gateway between Shelly Blu button1 and other Shelly devices (no matter Gen1 or Gen2) by sending local requests by their local IP APIs.

ble/ble-shelly-btn.shelly.js: BLE in Scripting - Shelly BLU Button script actions
===
Example how to use a Shelly BLU Button, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-shelly-dw.shelly.js: BLE in Scripting - Shelly BLU DoorWindow script actions
===
Example how to use a Shelly BLU DoorWindow, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-shelly-motion.shelly.js: BLE in Scripting - Shelly BLU Motion script actions
===
Example how to use a Shelly BLU Motion, read advertising data, decode and turn on switch. (Requires firmware version
0.12.0-beta1 or newer)

ble/ble-shelly-scanner.shelly.js: BLE in Scripting - Shelly BLU Scanner
===
This script will scan aired advertisement data, select Shelly BLU devices and will print their name and address (Requires firmware version
0.12.0-beta1 or newer)

ble/ble_btn_in_range.shelly.js: BLU presence watcher with auto-off
===
Tracks BLU device presence via BTHome, logs absence, and turns off a local switch after a timeout.

ble/hue-lights-control.shelly.js: Controlling hue lights with Shelly BLU Button or virtual buttons
===
This script allows you to control your hue lights with a Shelly BLU Button or virtual buttons. You can turn on/off lights, change brightness and color temperature. (Requires firmware version: 1.3 or newer)

ble/universal-blu-to-mqtt.shelly.js: Example - Universal BLU to MQTT Script
===
This script is about shares any BLU product's complete payload to MQTT..

blu-assistant/add-to-wifi.shelly.js: BLU Assistant WiFi provisioning
===
Provisions Shelly BLU devices with WiFi credentials via BLE scanning and RPC.

blu-assistant/bthome-webhook.shelly.js: BTHome sensor webhook trigger
===
Sends HTTP webhooks when BTHome sensor state changes (e.g. window open/close).

blu-assistant/config-mqtt.shelly.js: BLU Assistant MQTT configuration
===
Configures MQTT settings on Shelly BLU devices via BLE scanning and RPC.

blu-assistant/create-demo-virtual-components.shelly.js: Virtual component auto-setup from manifest
===
Creates virtual components and groups on boot based on a manifest definition.

blu-assistant/delete-all-vcomponents.shelly.js: Delete all virtual components
===
Removes all dynamic virtual components and groups with throttled RPC calls.

blu-assistant/factory-reset-device.shelly.js: BLU Assistant factory reset
===
Factory resets Shelly BLU devices via BLE scanning and RPC commands.

blu-assistant/full-config.shelly.js: BLU Assistant full device configuration
===
Configures Shelly BLU devices with WiFi, name, and timezone via BLE RPC.

blu-assistant/gen3-update-matter.shelly.js: Gen3 Matter firmware updater
===
Updates Shelly Gen3 devices to Matter firmware via BLE provisioning and OTA.

blu-assistant/print-label-online.shelly.js: BLU device label printer
===
Scans for Shelly BLU devices and sends device info to an online label printer.

cury/cury-light-language-2.shelly.js: Cury Light Language v2
===
Expressive light patterns for Shelly Cury UI and ambient LEDs with 9 communication states.

howto/input-event.shelly.js: Example - Input events
===
Example showing how to work with Input component's events.

howto/input-read.shelly.js: Example - Reading Input status
===
Example showing how to read Input component's status.

howto/switch-event.shelly.js: Example - Switch events
===
Example showing how to work with Switch component's events.

howto/switch-notifications.shelly.js: Example - Switch notifications - reading consumption active power
===
Example how to read Switch notifications and listen for when active power is more than 4W.

howto/switch-read.shelly.js: Example - Reading Switch status
===
Example of reading Switch component's status.

http-integrations/http-handlers/http-handlers.shelly.js: Shelly HTTP script handling GET requests, query strings
===
This script registers a HTTP handler endpoint and implements simple logic for requests and handlers for
those requests. Reconfiguration of a Switch component as an example is included

http-integrations/http-notify-on-power-threshold/http-notify-on-power-threshold.shelly.js: Shelly XPM - Send HTTP notification if power goes above threshold
===
This script subscribes for notifications, monitors the instanteneous power of the output switch and if that
goes above a threshold value and if current time is within the active time window will send an HTTP notification

http-integrations/http_post_watts_to_thingspeak/http_post_watts_to_thingspeak.shelly.js: Send energy meter watts to ThingSpeak via HTTP POST
===
Posts live active power (watts) to a ThingSpeak channel at a fixed interval.

http-integrations/prometheus/prometheus.shelly.js: Prometheus HTTP Endpoint for a single switch
===
This script exposes a /status endpoint that returns Prometheus metrics that can be scraped.

http-integrations/push-pushed/push-pushed.shelly.js: Push notifications using Pushed service
===
Use a script to notify directly on your mobile phone via a push notification service.

http-integrations/telegram/telegram-interaction.shelly.js: Telegram interaction with Shelly script
===
This script allows the creation of personalized commands for a Telegram bot, providing the ability to define handlers for each command and support for advanced parameter validation. 
(Requires firmware version: 1.0.0-beta or newer)

lora/lora-covercontrol-receiver/lora-covercontrol-bthome-emitter.shelly.js: Receive cover control commands over LoRa and send BTHome sensor data
===
Example how to handle commands over LoRa to control Cover device and data from BTHome sensors. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-covercontrol-receiver/lora-covercontrol-receiver.shelly.js: Remote Cover control over LoRa and receive BTHome sensor data
===
Example how to send commands over LoRa to control Cover device and receive data from BTHome sensors. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-covercontrol-sender/lora-covercontrol-listener.shelly.js: Receive cover control commands over LoRa
===
Example how to handle commands over LoRa to control Cover device. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-covercontrol-sender/lora-covercontrol-sender.shelly.js: Remote Cover control over LoRa
===
Example how to send commands over LoRa to control Cover device. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-encrypted-communication/lora-receive-encrypted-msg.shelly.js: LoRa Message Receiver with AES Decryption and Checksum Verification
===
This script shows how to receive and validate LoRa messages using Shelly scripting. It decrypts incoming messages with AES-256-ECB and verifies their integrity using a prepended checksum. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-encrypted-communication/lora-send-encrypted-msg.shelly.js: LoRa Message Sender with AES Encryption and Checksum
===
This script demonstrates how to send secure LoRa messages using Shelly scripting. It encrypts the message with AES-256-ECB and prepends a checksum to ensure message integrity. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-lightcontrol-receiver/lora-lightcontrol-receiver.shelly.js: Receive light control commands over LoRa
===
Example how to handle commands over LoRa to control Light device. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-lightcontrol-sender/lora-lightcontrol-initiator.shelly.js: LoRa light control scheduler
===
Schedules LoRa light control commands based on time-of-day brightness settings.

lora/lora-lightcontrol-sender/lora-lightcontrol-sender.shelly.js: Remote Light control over LoRa
===
Example how to control remote light device over LoRa with Shelly Scripting. Check README.md before use. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-receive-no-encryption.shelly.js: Receive message over lora without encryption
===
This script demonstrates how to receive unencrypted LoRa messages using Shelly scripting. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

lora/lora-send-no-encryption.shelly.js: Send message over lora without encryption
===
This script demonstrates how to send unencrypted LoRa messages using Shelly scripting. (Requires firmware version: 1.6 or newer and LoRa Add-on hardware installed)

mqtt/control-ha-light-entity-with-boolean.shelly.js: Control Light entity from HA via virtual boolean component
===
This script will control a light entity in Home Assistant via a virtual boolean component in Shelly. The script will listen for changes in the boolean component and will turn on or off the light entity in Home Assistant accordingly.

mqtt/mqtt-announce-control.shelly.js: Backward compatibility with Gen1 MQTT format (extended)
===
Use MQTT in scripting to provide backwards compatibility with Gen1 MQTT topics shellies/announce, shellies/command, <device-id>/command,
/command/switch:0/output.

Publish device status, input and switch status

mqtt/mqtt-announce.shelly.js: Backward compatibility with Gen1 MQTT format (announce only)
===
Use MQTT in scripting to provide backwards compatibility with Gen1 MQTT topics shellies/announce and shellies/command

mqtt/mqtt-discovery-sensors.shelly.js: MQTT Auto Discovery in Home Assistant - Sensors
===
This script is registering a virtual switch device in HA.

Switch sensors are also registered as entities.

Note: Requires configuration.yaml change in HA, please refer to the comments in the code of this file.

mqtt/mqtt-discovery.shelly.js: MQTT Auto Discovery in Home Assistant
===
This script is registering a virtual switch device in HA.

The implementation is banal and directly reports switch state and controls a switch, but you can have a totally different virtual device: valve, light, scene.

Note: Requires configuration.yaml change in HA, please refer to the comments in the code of this file.

mqtt/mqtt-jaalee-jht-bridge.shelly.js: Jaalee JHT BLE - MQTT Home Assistant Bridge via Shelly BLU Gateway
===
Jaalee JHT temperature/humidity/battery (temp: celsius, fahrenheit, kelvin) via Shelly BLU Gateway to MQTT. Bridge script for Jaalee JHT BLE sensor to MQTT topics, compatible with Home Assistant MQTT Discovery. (Requires firmware version: 1.0.0-beta or newer)

mqtt/mqtt-switch-status-announce.shelly.js: Periodically send Switch status to MQTT topic
===
Use MQTT in scripting to periodically provide switch status updates on the mentioned topic "<topic_prefix>/status/switch:0"

mqtt/mqtt-switch-status.shelly.js: Send Switch status to a custom MQTT topic
===
Use MQTT in scripting to provide switch status updates on a custom topic

mqtt/shelly1p-mqtt-autodiscover.shelly.js: Shelly 1 Plus MQTT Auto Discovery
===
Registers Shelly 1 Plus as switch, binary sensor, and temperature sensor in Home Assistant via MQTT.

networking/ip-assignment-watchdog.shelly.js: Reboot on DHCP IP assignment issues
===
Monitor for valid IP assignment from DHCP server and reboot if not received within a certain time period.

networking/router-watchdog.shelly.js: Router Watchdog
===
This script tries to execute HTTP GET requests within a set time, against a set of endpoints.

After certain number of failures the script sets the Switch off and after some time turns it back on.

networking/wifi-provision.shelly.js: Provisioning of new Shelly Plus gen 2 devices
===
This scripts periodically scans for access points with SSID matching the template for Shelly Plus device APs and if
found, will connect to that AP and provision WiFi credentials.

power-energy/advanced-load-shedding.shelly.js: Advanced Load shedding with schedules and notifications
===
Adds schedule, device, and notification templates and functionality to the original load shedding script.

power-energy/consume-limited-power.shelly.js: Shelly Plus 1PM - Stop the output after consuming certain amount of power
===
This script listens for the event when the output is turned on, and starts counting the power reported in NotifyStatus
every minute.
It is accumulated in a counter and if the combined consumption is over a threshold the output is turned off.

power-energy/failure-monitor.shelly.js: Load monitoring and alerting in Shelly Gen2
===
This script listens for events when power changes to 0 and if the switch is still on then it alerts that something
might have happened to the load.

power-energy/load-shedding.shelly.js: Load shedding with Shelly Pro4PM and Pro3EM
===
Keeps measured usage between a low (min_before_re_adding) and high (max_before_shedding) total power (watts), by controlling power to other devices

power-energy/monitor-production.shelly.js: Add Additional Meter to the Advanced Load Shedding script
===
Use this script paired with advanced-load-shedding.shelly.js to add a second source - example, grid, PV, generator, etc.

power-energy/power-outages.shelly.js: Monitor Power Outages or Crashed Services
===
Monitors any device or service that returns data from HTTP/HTTPS requests. Executes webhooks and/or updates MQTT topics.

power-energy/power-threshold-limit-output.shelly.js: Power threshold load shedding
===
Turns off configured channels when total power consumption exceeds a threshold.

power-energy/victron-mppt-solar-controller.shelly.js: Victron's Smartsolar charge controller data monitoring
===
This script allows the decryption of Victron's Smartsolar charge controller data and update the virtual components with live solar charger values.

scheduling/objects.shelly.js: mJS example of how to create custom Objects that interact with components (Switch in this case)
===
Example of how to create wrappers around RPC calls and using Object.create.

scheduling/register-scheduled-script.shelly.js: Schedule script function for execution into the system schedule
===
When the script is run it will check if it is registered in the schedule and if not will register itself

scheduling/remoterpc.shelly.js: Example of remote calling a Shelly Gen2
===
A remote Shelly abstraction Call an RPC method on the remote Shelly

scheduling/restore-schedule.shelly.js: After boot scan schedules and run active one
===
When device boots and there is a schedule that has to be active at the moment it won't be executed. This script
walks through the configured schedules and runs the one that should be active at that moment of time.

scheduling/scene.shelly.js: Scene playing in Shelly Gen2
===
Simple scene abstraction A scene is an array of actions or conditions that
are played squentially.

An action can have a delay property, which means after executing the action function wait until proceeding to the next one.

A condition is an element of a scene that has property type:"cond".
If the result is true, the scene continues with the next item, if it is false it
stops.

scheduling/test-scene.shelly.js: Scene Test with multiple Shellies
===
Playing a scene with four Shellies with that have a lamp as a load.

Demonstration of a "Remote Shelly" wrapper object. object prototyping, and simple scene player.

switch-input/activation-switch.shelly.js: Activation switch
===
Replicate activation_switch profile from Gen1 devices.

switch-input/cover-scheduled-event-handlers.shelly.js: Control a Shelly Plus 2PM (Gen2) by handling events
===
The script, when run, will subscribe to events and handle "cover_open_to" and "cover_close_to" events to open or close a cover to a certain position. "cover_open_to" also supports a "not_before" configuration to prevent opening the cover before a certain time.

switch-input/cycle-switch.shelly.js: Configurable Cycle switch
===
Replicate Cycle switch feature from Gen1 devices. Allows for custom list of operations to cycle through.

switch-input/double-press-double-switch.shelly.js: Double-press handler for dual switches
===
Detects single and double press on two toggle switches with full-off combo action.

switch-input/double-press-switch.shelly.js: Double-press handler for single switch
===
Detects single and double press on a toggle switch to trigger different actions.

switch-input/idle-alert.shelly.js: Alert on inactivity
===
Script that will monitor the inputs of a Shelly and if there was no user interaction with the input(s) It will call an
URL with a predefined message

switch-input/n-way-dimmer.shelly.js: n-way-dimmer.shelly.js
===
Setup an N-Way dimmer group using Gen3, Pro, or Plus dimmer products. One dimmer is connected to the light while the other dimmer products can be useed to remotely control the light and will reflect the current state of the light. This setup only requires wifi connectivity, the swiches communicate directly with each other. You will need to update the CONFIG GROUP with the IP addresses of all the switches in the group.

switch-input/rgbw-remote-controll.shelly.js: RGBW Remote Toggle with Day/Night Brightness
===
Toggle an RGBW output via HTTP endpoint with automatic brightness

switch-input/shelly2p-domo-coverfix-v2.shelly.js: Shelly Plus 2PM cover fix for Domoticz MQTTAD v2
===
Simple fix for outgoing Domoticz MQTTAD command 'GoToPosition'.
 Only Shelly firmware >= 1.x supported. Developed for ShellyTeacher4Domo.

switch-input/shelly2p-domo-coverfix.shelly.js: Shelly Plus 2PM cover fix for Domoticz MQTTAD v1
===
Simple fix for outgoing Domoticz MQTTAD command 'GoToPosition'.
 Shelly firmware 0.x supported. Developed for ShellyTeacher4Domo.

weather-env/cover-control-weather.shelly.js: Control a Shelly 2.5 (Gen1) depending on current cloud conditions
===
The script, when run, will fetch via REST api from a weather service the current conditions for a location check if
cloud coverage is above or below certain percentage and respectively open or close window shades by calling a Shelly
2.5 (Gen1) endpoint.

weather-env/ntc-conversion.shelly.js: Converts NTC thermal resistor output to temperature and execute actions
===
Reads voltage data from the Shelly Plus Add-on, calculate the corresponding temperature using the Steinhart-Hart equation, and take action based on the temperature reading

weather-env/precipitation-irrigation.shelly.js: Turn on/off watering based on precipitation in last 24 hours (based on AccuWeather data)
===
If there was precipitation in the past period (24h) skip an irrigation cycle. Data is retrieved from a public wather API service for the location.
You can use any Shelly Plus 1/Pro 1 ot Pro 2 to control your irrigation system.
Don't forger to add AutoOFF for max Irrigation time and set a Schedule which start irrigation in device webUI.
Note: Configure your Accuweather APIKEY and end points in the script once you add it.

weather-env/script-temperature-adjust.shelly.js: DHT22 temperature adjustment for Wall Display
===
Reads DHT22 sensor and applies temperature/humidity delta to Shelly Wall Display.

weather-env/turn-on-weather.shelly.js: turn-on-weather.shelly.js
===
Turn on when temperature is below CONFIG.tempBelowTurnOn.

Turn off when temperature is above CONFIG.tempAboveTurnOff.

For getting an API-KEY from Accuweather follow the instructions on their site for registering a new application, copy
the key and paste it here.

