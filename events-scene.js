/**
 * The `CONFIG` object contains a scenes property which is an array of scene objects. 
 * Each scene object consists of two properties: `conditions` and `action`. The `conditions` property 
 * defines the conditions under which the scene should be triggered, and the `action` 
 * property defines the function to be executed when the conditions are met. 
 * 
 * The `conditions` are defined as key-value pairs.
 * These keys correspond to specific data values received with the event. 
 * The values associated with these keys can be either a direct value, an object specifying a comparison, or a function that
 * must return boolean value.
 * 
 * The `action` property defines a function that receives event's data as an input. You can write custom code within this function to 
 * perform specific actions.
 * 
 */

/****************** START CHANGE ******************/
let CONFIG = {

    /**
     * List of scenes
     */
    scenes: [
        /** SCENE START **/
        {
            /**s
             * In this case, event and button are the keys , and the condition is that the value of 
             * button must be greater than 0. The condition is defined using an object with compare and value properties.
             * And the event value must be equal to "shelly-blu". You can target a specified button by 
             * adding `addess: <BLU BUTTON ADDRESS>` parameter to the condtions object.
             * 
             * NOTE: To use `shelly-blu` event you need to have installed a seperated script called ble-shelly-blu.js
             */
            conditions: {
                event: "shelly-blu",
                button: {
                    compare: ">",
                    value: 0
                }
            },

            /**
             * In this example, when the conditions of the scene are met, it simply logs a message to the console.
             */
            action: function(data) {
                console.log("The button was pressed");
            }
        },
        /** SCENE END **/

        /** SCENE START **/
        {
            /**
             * In this case, window is the key, and the condition is that the value of window must be equal to 1.
             * 
             * NOTE: To use `shelly-blu` event you need to have installed a seperated script called ble-shelly-blu.js
             */
            conditions: {
                event: "shelly-blu",
                window: 1
            },

            /**
             * Here when the condtions are met, it will publish a message via MQTT with the addess of the Shelly BLU Door/Window.
             * 
             * The MQTT.publish() function is used to publish a message to an MQTT broker. 
             * It takes two arguments: the topic and the message to be published. More info here: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#mqttpublish
             */
            action: function(data) {
                MQTT.publish(
                    "mymqttbroker/shelly/window/open",
                    "The window with addess " + data.address + " was opened"
                );

                console.log("The window with addess " + data.address + " was opened");
            }
        },
        /** SCENE END **/

        /** SCENE START **/
        {
            /**
             * Check if the measured analog value in percentages is less than the random number
             */
            conditions: {
                event: "analog_measurement",
                percent: function(per) {
                    /** Get a random number between 0 and 100
                     * Documentation: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#math-api
                     */
                    let rand = Math.random() * 100;

                    return per < rand;
                }
            },

            action: function(data) {

                /**
                 * Switch the output with id=0 ON for 4 seconds
                 * The shelly call function documentation: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#shellycall
                 * The switch component documentation: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#switchset
                 */
                Shelly.call(
                    "Switch.Set", 
                    {
                        on: true,
                        toggle_after: 4,
                        id: 0
                    }
                );
            }
        },
        /** SCENE END **/

        /** SCENE START **/
        {
            /**
             * Here the script will check if the event is `temperature_measurement`, the id is 100 and if the 
             * temperature sensor id=100 is greater than the temperature sensor id=101.
             * 
             * The documentation about Shelly.getComponentStatus: https://shelly-api-docs.shelly.cloud/gen2/Scripts/ShellyScriptLanguageFeatures#shellygetcomponentstatus
             * 
             * NOTE: To have `temperature_measurement` event, you need Shelly Plus Add-on installed on the device
             */
            conditions: {
                event: "temperature_measurement",
                id: 100,
                tC: function(firstTempSensor) {
                    let secondTempSensor = Shelly.getComponentStatus("temperature:101");
                    if(typeof secondTempSensor !== "object") {
                        return false;
                    }

                    return firstTempSensor > secondTempSensor.tC;
                }
            },

            /**
             * Send GET request to another Shelly device with IP=192.168.33.2 to turn off its first output
             */
            action: function(data) {
                Shelly.call(
                    "HTTP.GET",
                    {
                        url: "http://192.168.33.2/relay/0?turn=off",
                        timeout: 5
                    }
                );
            }
        },
        /** SCENE END **/
    ],

    /**
     * When set to true, debug messages will be logged to the console.
     */
    debug: false,
};
/****************** STOP CHANGE ******************/

/**
 * Logs the provided message with an optional prefix to the console.
 * @param {string} message - The message to log.
 * @param {string} [prefix] - An optional prefix for the log message.
 */
function logger(message, prefix) {

    //exit if the debug isn't enabled
    if(!CONFIG.debug) {
        return;
    }

    let finalText = "";

    //if the message is list loop over it
    if(typeof message === "array") {
        for(let i = 0; i < message.length; i++) {
            finalText = finalText + " " + JSON.stringify(message[i]);
        }
    }
    else {
        finalText = JSON.stringify(message);
    }

    //the prefix must be string
    if(typeof prefix !== "string") {
        prefix = "";
    }
    else {
        prefix = prefix + ":"
    }

    //log the result
    console.log(prefix, finalText);
}

/**
 * Scene Manager object
 * 
 * Handle scenes based on the events and do automations
 */
let SceneManager = {
    scenes: [],

    /**
     * Set the scenes for the SceneManager
     * @param {Array} scenes - Array of scene objects
     */
    setScenes: function(scenes) {
        this.scenes = scenes;
    },

    /**
     * Process new data and check if any scenes should be executed
     * @param {Object} data - New data received
     */
    onNewData: function(data) {
        logger(["New data received", JSON.stringify(data)], "Info");
        for(let sceneIndex = 0; sceneIndex < this.scenes.length; sceneIndex++) {
            logger(["Validating conditions for scene with index=", sceneIndex], "Info");
            if(this.validateConditionsForScene(sceneIndex, data)) {
                logger(["Conditions are valid for scene with index=", sceneIndex], "Info");
                this.executeScene(sceneIndex, data);
            }
            else {
                logger(["Conditions are invalid for scene with index=", sceneIndex], "Info");
            }
        }
    },

    /**
     * Event handler for handling events from the device
     * @param {Object} eventData - Event data
     * @param {Object} sceneEventObject - Scene manager object
     */
    eventHandler: function(eventData, sceneEventObject) {
        let info = eventData.info;
        if(typeof info !== "object") {
            console.log("ERROR: ");
            logger("Can't find the info object", "Error");
            
            return;
        }

        if(typeof info.data === "object") {
            for(let key in info.data) {
                info[key] = info.data[key];
            }

            info.data = undefined;
        }

        sceneEventObject.onNewData(info);
    },

    /**
     * Check if the conditions are met
     * @param {string|function} compFunc - Comparison function or operator.
     * @param {*} currValue - Current value to compare.
     * @param {*} compValue - Value to compare against.
     * @returns {boolean} - Whether the conditions are met
     */
    checkCondition: function(compFunc, currValue, compValue) {
        if(
            typeof currValue === "undefined" || 
            typeof compValue === "undefined" ||
            typeof compFunc === "undefined"
        ) {
            return false;
        }

        if(typeof compFunc === "string") {
            compFunc = this.compareFunctions[compFunc];
        }
        
        if(typeof compFunc === "function") {
            return compFunc(currValue, compValue);
        }

        return false;
    },

    /**
     * Validate conditions for a specific scene based on the received data
     * @param {number} sceneIndex - Index of the scene to validate
     * @param {Object} receivedData - Data received for validation
     * @returns {boolean} - Whether the conditions are met
     */
    validateConditionsForScene: function(sceneIndex, receivedData) {
        if(
            typeof sceneIndex !== "number" || 
            sceneIndex < 0 || 
            sceneIndex >= this.scenes.length
        ) {
            return false;
        }

        let conditions = this.scenes[sceneIndex].conditions;
        if(typeof conditions === "undefined") {
            return false;
        }

        for(let condKey in conditions) {
            let condData = conditions[condKey];
            let currValue = receivedData[condKey];
            let compValue = condData;
            let compFunc = condData;

            if(typeof condData === "object") {
                compValue = condData.value;
                compFunc = condData.compare;
            }
            else if(typeof condData !== "function") {
                compFunc = "==";
            }

            if( !(this.checkCondition(compFunc, currValue, compValue))) {
                logger(["Checking failed for", condKey, "in scene with index=", sceneIndex], "Info");
                return false;
            }
        }

        return true;
    },

    /**
     * Execute the action for a specific scene
     * @param {number} sceneIndex - Index of the scene to execute
     * @param {Object} data - Data to be passed to the action
     */
    executeScene: function(sceneIndex, data) {
        if(
            typeof sceneIndex !== "number" || 
            sceneIndex < 0 || 
            sceneIndex >= this.scenes.length
        ) {
            return;
        }

        let func = this.scenes[sceneIndex].action;
        if(typeof func === "function") {
            logger(["Executing action for scene with index=", sceneIndex], "Info");
            func(data);
        }
    },

    /**
     * Comparison functions used for validating conditions.
     */
    compareFunctions: {
        "==": function(currValue, compValue) {
            if(typeof currValue !== typeof compValue) {
                return false;
            }

            return currValue === compValue;
        },
        "~=": function(currValue, compValue) {
            if(
                typeof currValue !== "number" ||
                typeof compValue !== "number"
            ) {
                return false;
            }

            return Math.round(currValue) === Math.round(compValue);
        },
        ">": function(currValue, compValue) {
            if(
                typeof currValue !== "number" ||
                typeof compValue !== "number"
            ) {
                return false;
            }
            
            return currValue > compValue;
        },
        "<": function(currValue, compValue) {
            if(
                typeof currValue !== "number" ||
                typeof compValue !== "number"
            ) {
                return false;
            }
            
            return currValue < compValue;
        },
    }
};

/**
 * Initialize function for the scene manager and register the event handler
 */
function init() {
    SceneManager.setScenes(CONFIG.scenes);
    Shelly.addEventHandler(SceneManager.eventHandler, SceneManager);    
    logger("Scene Manager successfully started", "Info");
}

init();