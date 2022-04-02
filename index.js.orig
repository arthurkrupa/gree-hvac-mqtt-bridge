#!/usr/bin/env node
'use strict'

const mqtt = require('mqtt')
const commands = require('./app/commandEnums')
const argv = require('minimist')(process.argv.slice(2), {
  string: ['hvac-host', 'mqtt-broker-url', 'mqtt-topic-prefix', 'mqtt-username', 'mqtt-password'],
  '--': true
})

/**
 * Helper: get property key for value
 * @param {*} value
 */
function getKeyByValue (object, value) {
  return Object.keys(object).find(key => object[key] === value)
}

/**
 * Connect to device
 */
const mqttTopicPrefix = argv['mqtt-topic-prefix']

const deviceState = {
  temperature: null,
  fanSpeed: null,
  swingHor: null,
  swingVert: null,
  power: null,
  health: null,
  powerSave: null,
  lights: null,
  quiet: null,
  blow: null,
  air: null,
  sleep: null,
  turbo: null,
  mode: null
}

/**
 * Check if incoming device setting differs from last state and publish change if yes
 * @param {string} stateProp State property to be updated/compared with
 * @param {string} newValue New incoming device state value
 * @param {string} mqttTopic Topic (without prefix) to send with new value
 */
const publishIfChanged = function (stateProp, newValue, mqttTopic) {
  const pubmqttOptions = {
    retain: false
  }
  if (argv['mqtt-retain']) {
    pubmqttOptions.retain = (argv['mqtt-retain'] == "true")
  }
  if (newValue !== deviceState[stateProp]) {
    deviceState[stateProp] = newValue
    client.publish(mqttTopicPrefix + mqttTopic, newValue, pubmqttOptions)
  }
}

const deviceOptions = {
  host: argv['hvac-host'],
  onStatus: (deviceModel) => {
    publishIfChanged('temperature', deviceModel.props[commands.temperature.code].toString(), '/temperature/get')
    publishIfChanged('fanSpeed', getKeyByValue(commands.fanSpeed.value, deviceModel.props[commands.fanSpeed.code]).toString(), '/fanspeed/get')
    publishIfChanged('swingHor', getKeyByValue(commands.swingHor.value, deviceModel.props[commands.swingHor.code]).toString(), '/swinghor/get')
    publishIfChanged('swingVert', getKeyByValue(commands.swingVert.value, deviceModel.props[commands.swingVert.code]).toString(), '/swingvert/get')
    publishIfChanged('power', getKeyByValue(commands.power.value, deviceModel.props[commands.power.code]).toString(), '/power/get')
    publishIfChanged('health', getKeyByValue(commands.health.value, deviceModel.props[commands.health.code]).toString(), '/health/get')
    publishIfChanged('powerSave', getKeyByValue(commands.powerSave.value, deviceModel.props[commands.powerSave.code]).toString(), '/powersave/get')
    publishIfChanged('lights', getKeyByValue(commands.lights.value, deviceModel.props[commands.lights.code]).toString(), '/lights/get')
    publishIfChanged('quiet', getKeyByValue(commands.quiet.value, deviceModel.props[commands.quiet.code]).toString(), '/quiet/get')
    publishIfChanged('blow', getKeyByValue(commands.blow.value, deviceModel.props[commands.blow.code]).toString(), '/blow/get')
    publishIfChanged('air', getKeyByValue(commands.air.value, deviceModel.props[commands.air.code]).toString(), '/air/get')
    publishIfChanged('sleep', getKeyByValue(commands.sleep.value, deviceModel.props[commands.sleep.code]).toString(), '/sleep/get')
    publishIfChanged('turbo', getKeyByValue(commands.turbo.value, deviceModel.props[commands.turbo.code]).toString(), '/turbo/get')
    /**
     * Handle "off" mode status
     * Hass.io MQTT climate control doesn't support power commands through GUI,
     * so an additional pseudo mode is added
     */
    const extendedMode = (deviceModel.props[commands.power.code] === commands.power.value.on)
      ? getKeyByValue(commands.mode.value, deviceModel.props[commands.mode.code]).toString()
      : 'off'
    publishIfChanged('mode', extendedMode, '/mode/get')
  },
  onUpdate: (deviceModel) => {
    console.log('[UDP] Status updated on %s', deviceModel.name)
  },
  onConnected: (deviceModel) => {
    client.subscribe(mqttTopicPrefix + '/temperature/set')
    client.subscribe(mqttTopicPrefix + '/mode/set')
    client.subscribe(mqttTopicPrefix + '/fanspeed/set')
    client.subscribe(mqttTopicPrefix + '/swinghor/set')
    client.subscribe(mqttTopicPrefix + '/swingvert/set')
    client.subscribe(mqttTopicPrefix + '/power/set')
    client.subscribe(mqttTopicPrefix + '/health/set')
    client.subscribe(mqttTopicPrefix + '/powersave/set')
    client.subscribe(mqttTopicPrefix + '/lights/set')
    client.subscribe(mqttTopicPrefix + '/quiet/set')
    client.subscribe(mqttTopicPrefix + '/blow/set')
    client.subscribe(mqttTopicPrefix + '/air/set')
    client.subscribe(mqttTopicPrefix + '/sleep/set')
    client.subscribe(mqttTopicPrefix + '/turbo/set')
  }
}

let hvac

/**
 * Connect to MQTT broker
 */

const mqttOptions = {}
let authLog = ''
if (argv['mqtt-username'] && argv['mqtt-password']) {
  mqttOptions.username = argv['mqtt-username']
  mqttOptions.password = argv['mqtt-password']
  authLog = ' as "' + mqttOptions.username + '"'
}
console.log('[MQTT] Connecting to ' + argv['mqtt-broker-url'] + authLog + '...')
const client = mqtt.connect(argv['mqtt-broker-url'], mqttOptions)

client.on('reconnect', () => {
  console.log('[MQTT] Reconnecting to ' + argv['mqtt-broker-url'] + authLog + '...')
})

client.stream.on('error', e => {
  console.error('[MQTT] Error:', e)
})

client.on('close', () => {
  console.log(`[MQTT] Disconnected`)
})

client.on('connect', () => {
  console.log('[MQTT] Connected to broker')
  hvac = require('./app/deviceFactory').connect(deviceOptions)
})

client.on('message', (topic, message) => {
  message = message.toString()
  console.log('[MQTT] Message "%s" received for %s', message, topic)

  switch (topic) {
    case mqttTopicPrefix + '/temperature/set':
      hvac.setTemp(parseInt(message))
      return
    case mqttTopicPrefix + '/mode/set':
      if (message === 'off') {
        // Power off when "off" mode
        hvac.setPower(commands.power.value.off)
      } else {
        // Power on and set mode if other than 'off'
        if (hvac.device.props[commands.power.code] === commands.power.value.off) {
          hvac.setPower(commands.power.value.on)
        }
        hvac.setMode(commands.mode.value[message])
      }
      return
    case mqttTopicPrefix + '/fanspeed/set':
      hvac.setFanSpeed(commands.fanSpeed.value[message])
      return
    case mqttTopicPrefix + '/swinghor/set':
      hvac.setSwingHor(commands.swingHor.value[message])
      return
    case mqttTopicPrefix + '/swingvert/set':
      hvac.setSwingVert(commands.swingVert.value[message])
      return
    case mqttTopicPrefix + '/power/set':
      hvac.setPower(parseInt(message))
      return
    case mqttTopicPrefix + '/health/set':
      hvac.setHealthMode(parseInt(message))
      return
    case mqttTopicPrefix + '/powersave/set':
      hvac.setPowerSave(parseInt(message))
      return
    case mqttTopicPrefix + '/lights/set':
      hvac.setLights(parseInt(message))
      return
    case mqttTopicPrefix + '/quiet/set':
      hvac.setQuietMode(parseInt(message))
      return
    case mqttTopicPrefix + '/blow/set':
      hvac.setBlow(parseInt(message))
      return
    case mqttTopicPrefix + '/air/set':
      hvac.setAir(parseInt(message))
      return
    case mqttTopicPrefix + '/sleep/set':
      hvac.setSleepMode(parseInt(message))
      return
    case mqttTopicPrefix + '/turbo/set':
      hvac.setTurbo(parseInt(message))
      return
  }
  console.log('[MQTT] No handler for topic %s', topic)
})
