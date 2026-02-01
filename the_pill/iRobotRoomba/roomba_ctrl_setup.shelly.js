/**
 * @title iRobot Roomba controller component setup
 * @description Creates virtual components for the Roomba button controller.
 */

/**
 * iRobot Roomba Controller - Virtual Components Setup Script
 *
 * Creates the virtual components required by roomba_ctrl.shelly.js
 * Run this script ONCE to set up the graphical interface.
 *
 * Components Created:
 * - Text:200    - Roomba status display
 * - Number:200  - Battery percentage display
 * - Button:200  - Main control button (clean/stop/dock)
 * - Button:201  - Spot clean button
 *
 * After running, you can delete this script or disable it.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var COMPONENTS = [
    {
        type: 'text',
        id: 200,
        config: {
            name: 'Roomba Status',
            meta: {
                ui: {
                    view: 'label',
                    icon: 'mdi:robot-vacuum'
                }
            }
        }
    },
    {
        type: 'number',
        id: 200,
        config: {
            name: 'Battery %',
            min: 0,
            max: 100,
            meta: {
                ui: {
                    view: 'label',
                    unit: '%',
                    icon: 'mdi:battery'
                }
            }
        }
    },
    {
        type: 'button',
        id: 200,
        config: {
            name: 'Roomba Clean',
            meta: {
                ui: {
                    icon: 'mdi:play-pause'
                }
            }
        }
    },
    {
        type: 'button',
        id: 201,
        config: {
            name: 'Roomba Spot',
            meta: {
                ui: {
                    icon: 'mdi:target'
                }
            }
        }
    }
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
        print('[SETUP] Component ' + componentKey + ' already exists, skipping');
        skippedCount++;
        if (callback) callback(true);
        return;
    }

    print('[SETUP] Creating ' + componentKey + ' (' + comp.config.name + ')...');

    Shelly.call(
        'Virtual.Add',
        {
            type: comp.type,
            id: comp.id,
            config: comp.config
        },
        function(result, error_code, error_message) {
            if (error_code !== 0) {
                print('[SETUP] ERROR creating ' + componentKey + ': ' + error_message);
                errorCount++;
                if (callback) callback(false);
            } else {
                print('[SETUP] Created ' + componentKey + ' successfully');
                createdCount++;
                if (callback) callback(true);
            }
        }
    );
}

function createNextComponent() {
    if (currentIndex >= COMPONENTS.length) {
        printSummary();
        return;
    }

    var comp = COMPONENTS[currentIndex];
    currentIndex++;

    createComponent(comp, function(success) {
        // Small delay between component creation
        Timer.set(200, false, createNextComponent);
    });
}

function printSummary() {
    print('');
    print('[SETUP] ========================================');
    print('[SETUP] Roomba Controller Setup Complete');
    print('[SETUP] ----------------------------------------');
    print('[SETUP] Created: ' + createdCount);
    print('[SETUP] Skipped: ' + skippedCount);
    print('[SETUP] Errors:  ' + errorCount);
    print('[SETUP] ========================================');
    print('');

    if (errorCount === 0) {
        print('[SETUP] All components ready!');
        print('');
        print('[SETUP] Button Usage:');
        print('[SETUP]   Roomba Clean (button:200):');
        print('[SETUP]     - Single push: Start/Stop cleaning');
        print('[SETUP]     - Double push: Emergency stop');
        print('[SETUP]     - Long push:   Return to dock');
        print('[SETUP]   Roomba Spot (button:201):');
        print('[SETUP]     - Single push: Spot clean');
        print('');
        print('[SETUP] You can now run roomba_ctrl.shelly.js');
        print('[SETUP] This setup script can be disabled or deleted.');
    } else {
        print('[SETUP] Some components failed to create.');
        print('[SETUP] Check errors above and try again.');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    print('');
    print('[SETUP] ========================================');
    print('[SETUP] Roomba Controller - Virtual Components');
    print('[SETUP] ========================================');
    print('[SETUP] Creating ' + COMPONENTS.length + ' virtual components...');
    print('');

    // Start creating components
    createNextComponent();
}

init();
