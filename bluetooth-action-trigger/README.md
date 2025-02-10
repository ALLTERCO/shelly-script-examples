## Prerequisites

This code will run in a GEN 2 device

## Installation

Create a new script in the BLE_Gateway device. Make sure it is the first one in the list.
Copy the code to the scripts page
Modify the array is the list of target devices where either has its own script or that will be affected by this script
The variables action1/2/3/4 are the corresponding commands that will be executed on the device in the list

IF EXECUTING SCRIPTS:

This code requires that each device have the same script in the same position
This code requires that each script stops itself after execution. 
Paste the code bellow at the end of the script. Change the ID for the specific script index.

let timer_handle = null;
Timer.clear(timer_handle);
timer_handle = Timer.set(5000,false,function stopScript(){Shelly.call("Script.Stop",{"id":1})},null);


## Usage
Example: 
When press button 1x the code will call executeOutsideAction1 and run the script 1 in each device in the array


INSTRUCTIONS TO MODIFY THE SCRIPT

to run scripts that are in another device: In the CONFIG section, DEACTIVATE the action by COMMENTING the line "action: executeInsideScript"

to run scripts that are in the BLE_Gateway device: In the CONFIG section, DEACTIVATE the action by COMMENTING the line "action: executeOutsideAction" and the variables bellow

comment/uncomment these if you want to run scripts on devices
let action1 = "/rpc/Script.Start?id=1";
let action2 = "/rpc/Script.Start?id=2";
let action3 = "/rpc/Script.Start?id=3";
let action4 = "/rpc/Script.Start?id=4";

OR

comment/uncomment these if you want to toggle and set brightness on lights
let action1 = "/settings/light/0?turn=toggle";
let action2 = "/settings/light/0?brightness=15";
let action3 = "/settings/light/0?brightness=45";
let action4 = "/settings/light/0?brightness=75";

OR

comment/uncomment these if you want to toggle GEN2  devices
let action1 = "/rpc/Switch.Set?id=0&on=true";
let action2 = "/rpc/Switch.Set?id=0&on=false";
let action3 = "/rpc/Switch.Toggle?id=0";
let action4 = "/rpc/Shelly.Reboot";