'use strict'
const commands = require('../app/commandEnums')

/**
 * @param {object} [options] Options
 * @param {boolean} [options.debug]
 * @param {string} [options.device_mac]
 * @param {string} [options.device_name]
 * @param {MqttClient} [options.mqttClient]
 * @param {string} [options.mqttDeviceTopic]
 * @param {object} [options.mqttPubOptions]
 * @param {number} [options.mqttPubInterval]
 */
class HOMEASSISTANT_DISCOVERY{
    constructor (options) {
        this.debug = options.debug || false

        if(!options.device_mac || !options.device_name || !options.mqttClient || !options.mqttDeviceTopic)
            throw '[HomeAssistant_Discovery][Fatal] Missing required parameter.'
        this.device_mac = options.device_mac
        this.device_name = options.device_name
        this.mqttClient = options.mqttClient
        this.mqttDeviceTopic = options.mqttDeviceTopic
        this.mqttPubOptions = options.mqttPubOptions || {}
        this.mqttPubInterval = options.mqttPubInterval*1000 || 600*1000

        this.unique_id = 'gree_' + this.device_mac

        this.DEVMSG = {
            device: {
                identifiers: this.unique_id,
                manufacturer: 'gree',
                name: this.device_name,
            }
        }

        this.registered = []
    }

    REGISTER_ALL(){
        this._register_climate()
        this._register_power()
        this._register_sleep()
        this._register_turbo()
        this._register_powersave()
        this._register_health()
        this._register_lights()
        this._register_blow()
        this._register_quiet()
        this._register_air()
    }

    _interval_register(fn){
        this.registered.push(setInterval(fn.bind(this), this.mqttPubInterval))
    }

    _publish(msg, component, entity){
        const entityName = entity ? '_'+entity : ''

        let fn;(fn = () => {
            this.mqttClient.publish(
                'TTTTThomeassistant/' + component + '/' + this.unique_id + entityName + '/config',
                JSON.stringify(Object.assign({
                    'unique_id': this.unique_id + entityName,
                    'object_id': component + '.' + this.unique_id + entityName
                }, this.DEVMSG, msg)),
                Object.assign({}, this.mqttPubOptions, {retain: true})
            )
        })()
        this._interval_register(fn)
        this.debug && console.log("[HOMEASSISTANT_DISCOVERY][Debug] %s %s: %s %s registered.", this.device_name, this.device_mac, component, entity)
    }

    //Register Climate
    _register_climate(temperatureUnit){
        const component = 'climate'
        const DISCOVERY_MSG = {
            'name': 'Climate',

            'temperature_state_topic':    this.mqttDeviceTopic + "/temperature/get",
            'temperature_command_topic':  this.mqttDeviceTopic + "/temperature/set",
            'mode_state_topic':           this.mqttDeviceTopic + "/mode/get",
            'mode_command_topic':         this.mqttDeviceTopic + "/mode/set",
            'fan_mode_state_topic':       this.mqttDeviceTopic + "/fanspeed/get",
            'fan_mode_command_topic':     this.mqttDeviceTopic + "/fanspeed/set",
            'swing_mode_state_topic':     this.mqttDeviceTopic + "/swingvert/get",
            'swing_mode_command_topic':   this.mqttDeviceTopic + "/swingvert/set",

            'modes': ['off', ...Object.keys(commands.mode.value)],
            'fan_modes': Object.keys(commands.fanSpeed.value),
            'swing_modes': Object.keys(commands.swingVert.value),
        }
        const DISCOVERY_Optional = {}

        if(temperatureUnit){
            const acceptedTemperatureUnits = ['C', 'F']
            if(acceptedTemperatureUnits.includes(temperatureUnit))
                DISCOVERY_Optional['temperature_unit'] = temperatureUnit
            else 
                console.log("[HOMEASSISTANT_DISCOVERY][Error] Unacceptable temperature unit, ignored.")
        }

        this._publish(Object.assign({}, DISCOVERY_MSG, DISCOVERY_Optional), component)
    }

    _register_power(){
        return this.__register_switch('power', 'Power', 'power')
    }

    _register_sleep(){
        return this.__register_switch('sleep', 'Sleep Mode', 'power-sleep')
    }

    _register_turbo(){
        return this.__register_switch('turbo', 'Turbo Mode', 'car-turbocharger')
    }

    _register_powersave(){
        return this.__register_switch('powersave', 'Power Saving Mode', 'sprout')
    }

    _register_health(){
        return this.__register_switch('health', 'Health (Cold plasma) Mode', 'cog-outline')
    }

    _register_lights(){
        return this.__register_switch('lights', 'Lights', 'lightbulb')
    }

    _register_blow(){
        return this.__register_switch('blow', 'X-Fan', 'fan')
    }

    _register_quiet_as_switch(){
        return this.__register_switch('quiet', 'Quiet', 'volume-off')
    }

    _register_quiet(){
        return this.__register_select('quier', 'Quiet', {
            'options': Object.keys(commands.quiet.value),
            'command_template': this.__generate_template(commands.quiet.value),
            'value_template': this.__generate_template(commands.quiet.value, 'value')
        }, 'volume-off')
    }

    _register_air(){
        return this.__register_select('air', 'Fresh Air Valve', {
            'options': Object.keys(commands.air.value),
        }, 'sync')
    }

    //Common Switch Register
    __register_switch(entity, name, icon){
        const component = 'switch'
        const DISCOVERY_MSG = {
            'name': name,

            'state_topic': this.mqttDeviceTopic + '/' + entity + '/get',
            'command_topic': this.mqttDeviceTopic + '/' + entity + '/set',
            'payload_off': 0,
            'payload_on': 1,
        }
        if(icon) DISCOVERY_MSG['icon'] = 'mdi:' + icon
        this._publish(DISCOVERY_MSG, component, entity)
    }

    //Common Select Register
    __register_select(entity, name, options, icon){
        const component = 'select'
        const DISCOVERY_MSG = {
            'name': name,

            'state_topic': this.mqttDeviceTopic + '/' + entity + '/get',
            'command_topic': this.mqttDeviceTopic + '/' + entity + '/set',
        }
        if(icon) DISCOVERY_MSG['icon'] = 'mdi:' + icon
        this._publish(Object.assign({}, DISCOVERY_MSG, options), component, entity)
    }

    __generate_template(values ,type = 'command'){
        if(type === 'value')
            values = Object.fromEntries(
                Object
                  .entries(values)
                  .map(([key, value]) => [value, key])
            )
        let template = `{% set values = ${JSON.stringify(values)} %}\n`
        template += `{% set default="${Object.values(values)[0]}" %}\n`
        template += '{{ values.get(value, default) }}\n'
        return template
    }

}

module.exports.publish = function (options) {
    return new HOMEASSISTANT_DISCOVERY(options)
}