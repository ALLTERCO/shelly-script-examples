/**
 * @title SDS011 virtual component setup
 * @description Creates virtual components for displaying SDS011 readings.
 */

/**
 * SDS011 Air Quality Sensor - Virtual Components Setup Script
 *
 * Creates the virtual components for SDS011 air quality monitoring UI.
 * Run this script ONCE to set up the graphical interface.
 *
 * Components Created:
 * - Group:200   - Air Quality group container
 * - Number:200  - PM2.5 value display (ug/m3)
 * - Number:201  - PM10 value display (ug/m3)
 * - Text:200    - AQI category display
 * - Button:200  - Wake/Sleep toggle
 *
 * After running, you can delete this script or disable it.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var GROUP_ID = 200;
var GROUP_NAME = 'Air Quality';

var COMPONENTS = [
    {
        type: 'group',
        id: GROUP_ID,
        config: {
            name: GROUP_NAME
        }
    },
    {
        type: 'number',
        id: 200,
        config: {
            name: 'PM2.5',
            min: 0,
            max: 1000,
            meta: {
                ui: {
                    view: 'label',
                    unit: 'ug/m3',
                    icon: 'mdi:blur'
                }
            }
        }
    },
    {
        type: 'number',
        id: 201,
        config: {
            name: 'PM10',
            min: 0,
            max: 1000,
            meta: {
                ui: {
                    view: 'label',
                    unit: 'ug/m3',
                    icon: 'mdi:blur-linear'
                }
            }
        }
    },
    {
        type: 'text',
        id: 200,
        config: {
            name: 'AQI',
            meta: {
                ui: {
                    view: 'label',
                    icon: 'mdi:air-filter'
                }
            }
        }
    },
    {
        type: 'button',
        id: 200,
        config: {
            name: 'Wake/Sleep',
            meta: {
                ui: {
                    icon: 'mdi:power'
                }
            }
        }
    }
];

// Group members (component keys to add to the group)
var GROUP_MEMBERS = [
    'number:200',
    'number:201',
    'text:200',
    'button:200'
];

// ============================================================================
// STATE
// ============================================================================

var currentIndex = 0;
var createdCount = 0;
var skippedCount = 0;
var errorCount = 0;

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

function createComponent(comp, callback) {
    var componentKey = comp.type + ':' + comp.id;

    // First check if component already exists
    var status = Shelly.getComponentStatus(comp.type, comp.id);
    if (status !== null) {
        print('[SETUP] ' + componentKey + ' exists, skipping');
        skippedCount++;
        if (callback) callback(true);
        return;
    }

    print('[SETUP] Creating ' + componentKey + '...');

    Shelly.call(
        'Virtual.Add',
        {
            type: comp.type,
            id: comp.id,
            config: comp.config
        },
        function(result, error_code, error_message) {
            if (error_code !== 0) {
                print('[SETUP] ERROR: ' + error_message);
                errorCount++;
                if (callback) callback(false);
            } else {
                print('[SETUP] Created ' + componentKey);
                createdCount++;
                if (callback) callback(true);
            }
        }
    );
}

function createNextComponent() {
    if (currentIndex >= COMPONENTS.length) {
        // All components created, now set group members
        Timer.set(300, false, setGroupMembers);
        return;
    }

    var comp = COMPONENTS[currentIndex];
    currentIndex++;

    createComponent(comp, function(success) {
        Timer.set(200, false, createNextComponent);
    });
}

function setGroupMembers() {
    print('[SETUP] Setting group members...');

    Shelly.call(
        'Group.Set',
        {
            id: GROUP_ID,
            value: GROUP_MEMBERS
        },
        function(result, error_code, error_message) {
            if (error_code !== 0) {
                print('[SETUP] ERROR setting group: ' + error_message);
                errorCount++;
            } else {
                print('[SETUP] Group members set successfully');
            }
            printSummary();
        }
    );
}

function printSummary() {
    print('');
    print('[SETUP] ========================================');
    print('[SETUP] SDS011 Setup Complete');
    print('[SETUP] ----------------------------------------');
    print('[SETUP] Created: ' + createdCount);
    print('[SETUP] Skipped: ' + skippedCount);
    print('[SETUP] Errors:  ' + errorCount);
    print('[SETUP] ========================================');

    if (errorCount === 0) {
        print('[SETUP] All components ready in group:' + GROUP_ID);
        print('[SETUP] You can now run sds011_vc.shelly.js');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    print('');
    print('[SETUP] SDS011 Air Quality - Virtual Components');
    print('[SETUP] Creating ' + COMPONENTS.length + ' components...');
    print('');

    createNextComponent();
}

init();
