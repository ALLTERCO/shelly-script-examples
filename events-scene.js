let CONFIG = {
    scenes: [
        {
            conditions: {
                event: "shelly-blu",
                button: {
                    compare: ">",
                    value: 0
                }
            },

            action: function(data) {
                console.log("The button was pressed");
            }
        },
        {
            conditions: {
                event: "shelly-blu",
                button: function(value) {
                    return typeof value === "number" && value % 2 === 0;
                }
            },

            action: function(data) {
                console.log("The button was pressed even number of times");
            }
        }
    ]
};

let SceneManager = {
    scenes: [],

    setScenes: function(scenes) {
        this.scenes = scenes;
    },
    onNewData: function(data) {
        console.log(JSON.stringify(data));
        for(let sceneIndex in this.scenes) {
            if(this.validateConditionsForScene(sceneIndex, data)) {
                this.executeScene(sceneIndex, data);
            }
        }
    },
    eventHandler: function(eventData, sceneEventObject) {
        let info = eventData.info;
        if(typeof info !== "object") {
            console.log("ERROR: can't find the info object");
            
            return;
        }

        if(typeof info.data === "object") {
            for(let key in info.data) {
                info[key] = info.data[key];
            }
        }

        sceneEventObject.onNewData(info);
    },
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
            let currValue = receivedData[condKey];
            let condData = conditions[condKey];
            let compValue = condData;
            let compFunc = condData;

            if(typeof condData === "object") {
                compValue = condData.value;
                compFunc = condData.compare;
            }
            else if(typeof condData === "string") {
                compFunc = "==";
            }

            if( !(this.checkCondition(compFunc, currValue, compValue))) {
                console.log("FAILED", compFunc, currValue, compValue);
                return false;
            }
        }

        return true;
    },
    executeScene: function(sceneIndex, data) {
        if(
            typeof sceneIndex !== "number" || 
            sceneIndex < 0 || 
            sceneIndex >= this.scenes.length
        ) {
            return;
        }

        let func = this.scenes[sceneIndex];
        if(typeof func === "function") {
            func(data);
        }
    },
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

function init() {
    SceneManager.setScenes(CONFIG.scenes);
    Shelly.addEventHandler(SceneManager.eventHandler, SceneManager);    
}

init();