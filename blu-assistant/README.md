# Blu Assistant Scripts Documentation

This folder contains example scripts for the **Shelly BLU Assistant**. They demonstrate how to use the built-in Espruino/JavaScript engine on the ESP32 to manage Shelly devices over BLE and Wi-Fi.

> **Note:**  
> The **create-demo-virtual-components.shelly.js** script here is scoped to our demo, it only creates the exact fields/buttons used by scripts 2-4. If you fork or extend these examples, you’ll need to add or remap any additional virtual components yourself.

-

## Table of Contents

1. [Demo Setup Script](#1-demo-setup-script-create-demo-virtual-componentsjs)  
2. [Demo Example Scripts](#2-demo-example-scripts)  
   - [Wi-Fi Provisioning](#21-wi-fi-provisioning-add-to-wifijs)  
   - [Full Device Configuration & Update](#22-full-device-configuration-update-full-configjs)  
   - [MQTT Configuration](#23-mqtt-configuration-config-mqttjs)  
3. [Additional Example Scripts](#3-additional-example-scripts)  
   - [Factory Reset](#31-factory-reset-factory-reset-devicejs)  
   - [Gen3 Matter Update](#32-gen3-matter-update-gen3-update-matterjs)  
   - [Inventory Labels with Printer](#33-inventory-labels-with-printer-print-scriptjs)  
   - [BLU Door/Window → Webhook Bridge](#34-blu-doorwindow-webhook-bridge-bthome-webhookjs)  
4. [Installation & Execution](#4-installation-execution)  
5. [Customization](#5-customization)  
6. [Troubleshooting](#6-troubleshooting)  

-

## 1. Demo Setup Script (create-demo-virtual-components.shelly.js)

**Purpose**  
Automatically creates **only** the virtual components needed by our three demo scripts.  

> **Fields & Buttons Created**  
>
> - **Network Setup** (group 200):  
>   - `text:200` BLE ID  
>   - `text:201` SSID  
>   - `text:202` Pass  
>   - `button:200` Connect WiFi  
>   - `text:211` LOG  
> - **Device Configuration** (group 201):  
>   - `text:200` BLE ID  
>   - `text:201` SSID  
>   - `text:202` Pass  
>   - `text:203` Device Name  
>   - `text:204` Location TZ  
>   - `button:201` Config Device  
>   - `text:211` LOG  
> - **MQTT Configuration** (group 202):  
>   - `text:200` BLE ID  
>   - `text:205` MQTT Server  
>   - `text:206` MQTT Client ID  
>   - `text:207` MQTT Prefix  
>   - `text:208` CA Bundle URL  
>   - `text:209` Client Cert URL  
>   - `text:210` Client Key URL  
>   - `button:202` MQTT Config  
>   - `text:211` LOG  

**Key Features**  

- Automatic Component Creation & correction  
- Configuration Validation against manifest  
- Sequential RPC Queue to avoid overload  

**Usage**  

1. In the Web UI **Scripts** tab, create `create-demo-virtual-components`.  
2. Paste in `create-demo-virtual-components.shelly.js`.  
3. Save & **Run** once—the script self-terminates when done.  

-

## 2. Demo Example Scripts

> **After** running `create-demo-virtual-components`, these three scripts will use the fields/buttons above.

### 2.1 Wi-Fi Provisioning (add-to-wifi.shelly.js)

- **Purpose:**  
  Scans BLE, filters by your **BLE ID** (`text:200`), and joins devices to the SSID/Pass you entered.  
- **Key Features:**  
  - Device Discovery & Filtering  
  - Network Configuration from UI fields  
  - Batch Processing & Retries  
- **Usage:**  
  1. Fill in:  
     - **SSID** → `text:201`  
     - **Pass** → `text:202`  
     - **BLE ID** → `text:200`  
  2. Press **Connect WiFi** (`button:200`).

-

### 2.2 Full Device Configuration & Update (full-config.shelly.js)

- **Purpose:**  
  1. BLE connect → Wi-Fi join (disables AP after provision, 6s delay)  
  2. Rename (`text:203`) & set timezone (`text:204`) in parallel  
  3. Print concise config (TZ, lat/lon, Wi-Fi status/IP)  
  4. Check/apply firmware update via `Shelly.CheckForUpdate`  
- **Key Features:**  
  - Staged & Parallel Execution  
  - Concise Reporting  
  - Firmware Update Check  
- **Usage:**  
  1. Fill in:  
     - **BLE ID** → `text:200`  
     - **SSID**   → `text:201`  
     - **Pass**   → `text:202`  
     - **Device Name** → `text:203`  
     - **Location TZ** → `text:204`  
  2. Press **Config Device** (`button:201`).

-

## 3. Additional Example Scripts

> These aren’t created by the demo setup. You must add or remap virtual components if you want to run them:

### 3.1 Factory Reset (factory-reset-device.shelly.js)

- **Purpose:**  
  BLE-scans for devices matching your **BLE ID** and issues a `Shelly.FactoryReset`, wiping them back to factory defaults.

- **Key Features:**  
  - **BLE Discovery & Filtering:** Reuses the same scan/filter logic as the provisioning script to target only your chosen device(s).  
  - **Retry Logic:** Automatically retries the reset RPC on communication failure (configurable retry count).  
  - **Safe Execution:** You can add a prompt or confirmation step in the code before issuing the reset.

- **Usage:**  
  1. Enter your target **BLE ID** in the virtual field (default: `text:200`).  
  2. Map the reset action to a button of your choice (e.g. `button:201`, or add a new one).  
  3. Press **Reset** to trigger the script.  

-

### 3.2 Gen3 Matter Update (gen3-update-matter.shelly.js)

- **Purpose:**  
  Bulk-discovers all nearby Gen3 Shelly devices, provisions them onto Wi-Fi, checks firmware, applies any “Matter-ready” updates, reboots, and finally enables Matter support.

- **Key Features:**  
  - **Automatic Fleet Update:** Finds multiple devices simultaneously and processes them in parallel.  
  - **Smart Skip Logic:** Skips devices already running the target firmware.  
  - **Full Workflow:** Combines Wi-Fi provisioning, firmware update (`Shelly.Update`), reboot, and Matter enablement into one “fire-and-forget” script.  

- **Usage:**  
  1. Ensure your Assistant has valid Wi-Fi credentials configured (or add `text:201`/`text:202` fields if needed).  
  2. (Optional) Adjust the firmware version filter or retry parameters in the script.  
  3. Map the update action to a button (e.g. a new `button:203`).  
  4. Press your assigned button to start the Gen3 Matter rollout.

-

### 3.3 Inventory Labels with Printer (print-label-online.shelly.js)

- **Purpose:**  
  Transforms your Assistant into a mobile labeling station: reads a device’s info over BLE, fills a ZPL label template, and sends it to a network-connected label printer.

- **Key Features:**  
  - **Dynamic ZPL Templating:** Customize the `zpl_template` variable in-script to control label layout and content.  
  - **Network Printing:** Sends raw ZPL over HTTP/TCP to any IP-addressable ZPL-compatible printer (e.g. Argox, Zebra).  
  - **Batch Labeling:** Can loop through multiple devices in one run, printing labels for each.

- **Usage:**  
  1. Enter **BLE ID** in your existing field (e.g. `text:200`), and printer IP in a text field you create (e.g. `text:204` or `text:212`).  
  2. Edit the `zpl_template` in the script as desired.  
  3. Map the print action to a button (e.g. `button:204`).  
  4. Press **Print Label** to run.

-

### 3.4 BLU Door/Window → Webhook Bridge (bthome-webhook.shelly.js)

- **Purpose:**  
  Listens for open/close events from a Shelly BLU Door/Window sensor and instantly fires HTTP webhooks to trigger other devices or services (lights, alarms, notifications).

- **Key Features:**  
  - **Local BThome Subscription:** Uses the built-in BThome protocol to receive real-time sensor events without cloud dependency.
  - **Configurable Webhooks:** Set separate URLs for open and close events.  

- **Usage:**  
  1. In the script, set:  

     ```js
     const WINDOW_SENSOR_ID     = 0x1234;                   // your sensor’s ID  
     const WINDOW_OPEN_WEBHOOK  = "http://…/open";          // URL to call on open  
     const WINDOW_CLOSE_WEBHOOK = "http://…/close";         // URL to call on close  
     ```  

  2. (Optional) Create virtual text fields for ID and URLs if you want to drive them from the UI.  
  3. Map the bridge action to a button or run it as a background script.  
  4. Open/close your sensor and watch the webhooks fire.

-

## 4. Installation & Execution

1. **Connect** to your Shelly (via its AP or LAN IP).  
2. **Open** the Web UI → **Scripts**.  
3. **Create** & **Paste** each script, naming them:  
   - `create-demo-virtual-components`  
   - `add-to-wifi`  
   - `full-config`  
   - `config-mqtt`  
   - (plus any additional ones)  
4. **Run** `create-demo-virtual-components` first.
5. Start the scripts ypu want to test. Configure the variables for each one.
6. **Trigger** each demo script by its virtual or physical button.

-

## 5. Customization

- Add or remap virtual components for new scripts.  
- Adjust BLE scan parameters, batch sizes, retry limits.

-

## 6. Troubleshooting

- **No devices found?** Check BLE range/power and correct BLE ID (`text:200`).  
- **Command failures?** Inspect Shelly logs and increase retry settings.  
- **Missing UI fields?** Re-run or extend the setup script to create the fields your custom scripts require.  

