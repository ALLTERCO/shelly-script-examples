/**
 * @title RGB Color Cycler
 * @description Cycles through a list of colors on an RGB light component at a
 *   configurable interval with a smooth transition.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/rgbw/color.shelly.js
 */

/**
 * RGB Color Cycler
 *
 * Steps through a predefined color list, applying each color to the RGB
 * component via RGB.Set on a repeating timer.
 *
 * Compatible with devices that expose an RGB component (e.g. Shelly Pro RGBWW PM
 * in rgbx2light or rgbcct profile).
 */

/* === CONFIG === */
var CONFIG = {
    RGB_ID:             0,    // RGB component id
    INTERVAL:        4000,    // ms between color changes
    TRANSITION:         2,    // transition duration in seconds
    COLORS: [
        { r: 255, g:   0, b:   0 }, // red
        { r:   0, g: 255, b:   0 }, // green
        { r:   0, g:   0, b: 255 }, // blue
        { r: 255, g: 255, b:   0 }, // yellow
        { r: 255, g:   0, b: 255 }, // magenta
        { r:   0, g: 255, b: 255 }, // cyan
        { r: 255, g: 255, b: 255 }  // white
    ]
};

/* === STATE === */
var state = {
    index: 0
};

/* === MAIN === */

function changeColor() {
    var c = CONFIG.COLORS[state.index];

    Shelly.call("RGB.Set", {
        id:                  CONFIG.RGB_ID,
        on:                  true,
        rgb:                 [c.r, c.g, c.b],
        transition_duration: CONFIG.TRANSITION
    }, null);

    state.index = (state.index + 1) % CONFIG.COLORS.length;
}

/* === INIT === */

function init() {
    print("RGB Color Cycler");
    print("================");
    print("RGB id:     " + CONFIG.RGB_ID);
    print("Interval:   " + CONFIG.INTERVAL + "ms");
    print("Transition: " + CONFIG.TRANSITION + "s");
    print("Colors:     " + CONFIG.COLORS.length);

    Timer.set(CONFIG.INTERVAL, true, changeColor);
}

init();
