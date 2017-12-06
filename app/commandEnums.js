'use strict';

module.exports = {
    // power state of the device
    power: {
        code: 'Pow',
        value: {
            off: 0,
            on: 1
        }
    },
    // mode of operation
    mode: {
        code: 'Mod',
        value: {
            auto: 0,
            cool: 1,
            dry: 2,
            fan: 3, 
            heat: 4
        }
    },
    // temperature unit (must be together with set temperature)
    temperatureUnit: {
        code: 'TemUn',
        value: {
            celsius: 0,
            fahrenheit: 1
        }
    },
    // set temperature (must be together with temperature unit)
    temperature: {
        code: 'SetTem'
    },
    // fan speed
    fanSpeed: {
        code: 'WdSpd',
        value: {
            auto: 0,
            low: 1,
            mediumLow: 2,  // not available on 3-speed units
            medium: 3,
            mediumHigh: 4, // not available on 3-speed units
            high: 5
        }
    },
    // fresh air valve
    airVale: {
        code: 'Air',
        value: {
            off: 0,
            on: 1
        }
    },
    // "Blow" or "X-Fan", this function keeps the fan running for a while after shutting down. Only usable in Dry and Cool mode
    blow: {
        code: 'Blo',
        value: {
            off: 0,
            on: 1
        }
    },
    // controls Health ("Cold plasma") mode, only for devices equipped with "anion generator", which absorbs dust and kills bacteria
    health: {
        code: 'Health',
        value: {
            off: 0,
            on: 1
        }
    },
    // sleep mode, which gradually changes the temperature in Cool, Heat and Dry mode
    sleep: {
        code: 'SwhSlp',
        value: {
            off: 0,
            on: 1
        }
    },
    // turns all indicators and the display on the unit on or off
    lights: {
        code: 'Lig',
        value: {
            off: 0,
            on: 1
        }
    },
    // controls the swing mode of the horizontal air blades (not available on all units)
    swingHor: {
        code: 'SwingLfRig',
        value: {
            default: 0
            // TODO: remaining values
        }
    },
    // controls the swing mode of the vertical air blades
    swingVert: {
        code: 'SwUpDn',
        value: {
            default: 0,
            full: 1, // swing in full range
            fixedTop: 2, // fixed in the upmost position (1/5)
            fixedMidTop: 3, // fixed in the middle-up position (2/5)
            fixedMid: 4, // fixed in the middle position (3/5)
            fixedMidBottom: 5, // fixed in the middle-low position (4/5)
            fixedBottom: 6, // fixed in the lowest position (5/5)
            swingBottom: 7, // swing in the downmost region (5/5)
            swingMidBottom: 8, // swing in the middle-low region (4/5)
            swingMid: 9, // swing in the middle region (3/5)
            swingMidTop: 10, // swing in the middle-up region (2/5)
            swingTop: 11 // swing in the upmost region (1/5)
        }
    },
    // controls the Quiet mode which slows down the fan to its most quiet speed. Not available in Dry and Fan mode
    quiet: {
        code: 'Quiet',
        value: {
            off: 0,
            on: 1
        }
    },
    // sets fan speed to the maximum. Fan speed cannot be changed while active and only available in Dry and Cool mode
    turbo: {
        code: 'Tur',
        value: {
            off: 0,
            on: 1
        }
    },
    // energy saving mode
    energySave: {
        code: 'SvSt',
        value: {
            off: 0,
            on: 1
        }
    },
};
