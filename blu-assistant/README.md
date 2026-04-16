# Blu Assistant Scripts Documentation

This folder contains example scripts for the **Shelly BLU Assistant**. They demonstrate how to use the built-in Espruino/JavaScript engine on the ESP32 to manage Shelly devices over BLE and Wi-Fi.

> **Note:**
> The **create-demo-virtual-components.shelly.js** script here is scoped to our demo, it only creates the exact fields/buttons used by scripts 2-4. If you fork or extend these examples, you'll need to add or remap any additional virtual components yourself.

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
   - [Inventory Labels with Printer](#33-inventory-labels-with-printer-print-label-onlinejs)
   - [BLU Door/Window → Webhook Bridge](#34-blu-doorwindow-webhook-bridge-bthome-webhookjs)
4. [Physical Button Scripts (two-script pair)](#4-physical-button-scripts-two-script-pair)
   - [Button Event Source](#41-button-event-source-button-event-sourcejs)
   - [WiFi Provisioning by Model ID](#42-wifi-provisioning-by-model-id-wifi-provisioningjs)
5. [Installation & Execution](#5-installation-execution)
6. [Customization](#6-customization)
7. [Troubleshooting](#7-troubleshooting)

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

### 2.3 MQTT Configuration (config-mqtt.shelly.js)

- **Purpose:**
  Configures MQTT broker settings on a remote Shelly device over BLE.
- **Usage:**
  1. Fill in the MQTT fields (`text:205`–`text:210`).
  2. Press **MQTT Config** (`button:202`).

-

## 3. Additional Example Scripts

> These aren't created by the demo setup. You must add or remap virtual components if you want to run them.

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
  Bulk-discovers all nearby Gen3 Shelly devices, provisions them onto Wi-Fi, checks firmware, applies any "Matter-ready" updates, reboots, and finally enables Matter support.

- **Key Features:**
  - **Automatic Fleet Update:** Finds multiple devices simultaneously and processes them in parallel.
  - **Smart Skip Logic:** Skips devices already running the target firmware.
  - **Full Workflow:** Combines Wi-Fi provisioning, firmware update (`Shelly.Update`), reboot, and Matter enablement into one "fire-and-forget" script.

- **Usage:**
  1. Ensure your Assistant has valid Wi-Fi credentials configured (or add `text:201`/`text:202` fields if needed).
  2. (Optional) Adjust the firmware version filter or retry parameters in the script.
  3. Map the update action to a button (e.g. a new `button:203`).
  4. Press your assigned button to start the Gen3 Matter rollout.

-

### 3.3 Inventory Labels with Printer (print-label-online.shelly.js)

- **Purpose:**
  Transforms your Assistant into a mobile labeling station: reads a device's info over BLE, fills a ZPL label template, and sends it to a network-connected label printer.

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
     const WINDOW_SENSOR_ID     = 0x1234;                   // your sensor's ID
     const WINDOW_OPEN_WEBHOOK  = "http://…/open";          // URL to call on open
     const WINDOW_CLOSE_WEBHOOK = "http://…/close";         // URL to call on close
     ```

  2. (Optional) Create virtual text fields for ID and URLs if you want to drive them from the UI.
  3. Map the bridge action to a button or run it as a background script.
  4. Open/close your sensor and watch the webhooks fire.

-

## 4. Physical Button Scripts (two-script pair)

These two scripts work together and are designed to run simultaneously. The **button event source** routes hardware button presses; the **WiFi provisioning** script does the actual BLE scan and device configuration. They communicate via `Script.Eval` so that each script stays focused on one responsibility.

```
Physical button "one" ──► button-event-source  ──► Script.Eval ──► wifi-provisioning
Physical button "two" ──► button-event-source  ──► (your action)
```

### 4.1 Button Event Source (button-event-source.shelly.js)

- **Purpose:**
  Routes press events from the two physical buttons (`"one"` and `"two"`) on the BLU Assistant. Button **ONE** calls `startProvisioning()` on the provisioning script via `Script.Eval`. Button **TWO** is a placeholder for a second action.

- **Key Features:**
  - No BLE or networking logic — purely an event dispatcher
  - Ignores repeated presses while provisioning is already running
  - `PROV_SCRIPT_ID` config value decouples it from the provisioning script slot

- **Configuration:**

  ```js
  var CONFIG = {
    PROV_SCRIPT_ID: 2   // slot ID of wifi-provisioning.shelly.js on the device
  };
  ```

- **Usage:**
  1. Upload to script slot **1**.
  2. Set `PROV_SCRIPT_ID` to match the slot where `wifi-provisioning.shelly.js` is loaded.
  3. Start the script — it runs continuously in the background.

-

### 4.2 WiFi Provisioning by Model ID (wifi-provisioning.shelly.js)

- **Purpose:**
  Scans BLE for Shelly devices whose model ID matches any entry in `TARGET_MODEL_IDS` and sends `Wifi.SetConfig` over GATTC to provision them as STA clients. Each device is retried up to `MAX_ATTEMPTS` times on failure.

- **Key Features:**
  - **Multi-model targeting:** `TARGET_MODEL_IDS` is an array — provision mixed fleets in one scan
  - **Queue with retries:** failed devices are re-queued automatically
  - **Guard against re-entry:** ignores a second trigger while a run is in progress
  - **Full Gen3/Gen4 model ID reference** in comments (see script source)

- **Configuration:**

  ```js
  var PROV_CONFIG = {
    TARGET_MODEL_IDS: [0x1829],   // add more IDs as needed
    WIFI_SSID: "your-ssid",
    WIFI_PASS: "your-password",
    MAX_ATTEMPTS: 3
  };
  ```

  > **Gen3/Gen4 model ID quick reference** (full list in script comments):
  >
  > | Hex ID | Device |
  > |--------|--------|
  > | `0x1829` | The Pill by Shelly (S3SN-0U53X) |
  > | `0x1018` | Shelly 1 Gen3 |
  > | `0x1019` | Shelly 1PM Gen3 |
  > | `0x1005` | Shelly 2PM Gen3 |
  > | `0x1028` | Shelly 1 Gen4 |
  > | `0x1029` | Shelly 1PM Gen4 |
  > | `0x1032` | Shelly 2PM Gen4 |

- **Usage:**
  1. Upload to script slot **2** (or whichever slot matches `PROV_SCRIPT_ID` in the button source).
  2. Set `WIFI_SSID`, `WIFI_PASS`, and `TARGET_MODEL_IDS` in `PROV_CONFIG`.
  3. Start the script — it waits for `startProvisioning()` to be called (via `Script.Eval` from the button source, or directly from the web UI console).

-

## 5. Installation & Execution

1. **Connect** to your Shelly (via its AP or LAN IP).
2. **Open** the Web UI → **Scripts**.
3. **Create** & **Paste** each script, naming them:
   - `create-demo-virtual-components`
   - `add-to-wifi`
   - `full-config`
   - `config-mqtt`
   - `button-event-source` (slot 1)
   - `wifi-provisioning` (slot 2)
   - (plus any additional ones)
4. **Run** `create-demo-virtual-components` first if using the demo scripts.
5. For the physical-button pair: start **both** `button-event-source` and `wifi-provisioning`, then press the hardware button to trigger a scan.
6. **Trigger** each demo script by its virtual or physical button.

-

## 6. Customization

- Add or remap virtual components for new scripts.
- Adjust BLE scan parameters (`duration_ms`, `rssi_thr`) in `BLE_SCAN_PARAMS`.
- Extend `TARGET_MODEL_IDS` with additional Gen3/Gen4 model IDs (full list in `wifi-provisioning.shelly.js` comments).
- Add a second action to `onButton2Press()` in `button-event-source.shelly.js`.

-

## 7. Troubleshooting

- **No devices found?** Check BLE range/power. For the physical-button scripts, ensure `TARGET_MODEL_IDS` includes the correct model ID for your device.
- **Command failures?** Inspect Shelly logs (`/debug/log` WebSocket) and increase `MAX_ATTEMPTS`.
- **Missing UI fields?** Re-run or extend the setup script to create the fields your custom scripts require.
- **`startProvisioning` not found?** Ensure `wifi-provisioning.shelly.js` is **running** before pressing button ONE — `Script.Eval` can only call functions in a running script.
- **Wrong slot ID?** If you move `wifi-provisioning.shelly.js` to a different slot, update `PROV_SCRIPT_ID` in `button-event-source.shelly.js` to match.
