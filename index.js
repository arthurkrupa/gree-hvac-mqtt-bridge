#!/usr/bin/env node
'use strict'

const mqtt = require('mqtt')
const commands = require('./app/commandEnums')
const argv = require('minimist')(process.argv.slice(2), {
  string: ['hvac-host', 'mqtt-broker-url', 'mqtt-topic-prefix', 'mqtt-username', 'mqtt-password'],
  '--': true
})

/**
 * Debug Flag
 */
const debug = argv['debug'] ? true : false

/**
 * Connect to device
 */
const skipCmdNames = ['temperatureUnit']
const publicValDirect = ['power','health','powerSave','lights','quiet','blow','sleep','turbo']
const onStatus = function(deviceModel, changed) {
  for(let name in changed){
    if(skipCmdNames.includes(name))
      continue
    let val = changed[name].state
    if(publicValDirect.includes(name))
      val = changed[name].value
    /**
     * Handle "off" mode status
     * Hass.io MQTT climate control doesn't support power commands through GUI,
     * so an additional pseudo mode is added
     */
    if(name === 'mode' && deviceModel.props[commands.power.code] === commands.power.value.off)
      val = 'off'
    publish2mqtt(val, deviceModel.mac+'/'+name.toLowerCase())
    if(!deviceModel.isSubDev)
      publish2mqtt(val, name.toLowerCase())
  }
}

const onSetup = function(deviceModel){
  for(let name of Object.keys(commands)){
    if(skipCmdNames.includes(name))
      continue
    client.subscribe(mqttTopicPrefix + deviceModel.mac + '/' + name.toLowerCase() + '/set')
    if(!deviceModel.isSubDev)
      client.subscribe(mqttTopicPrefix + name.toLowerCase() + '/set')
  }
}

const deviceOptions = {
  host: argv['hvac-host'],
  controllerOnly: argv['controllerOnly'] ? true : false,
  pollingInterval: parseInt(argv['polling-interval'])*1000 || 3000,
  debug: debug,
  onStatus: (deviceModel, changed) => {
    onStatus(deviceModel, changed)
    console.log('[UDP] Status changed on %s: %s', deviceModel.name, changed)
  },
  onUpdate: (deviceModel, changed) => {
    onStatus(deviceModel, changed)
    console.log('[UDP] Status updated on %s: %s', deviceModel.name, changed)
  },
  onSetup: onSetup,
  onConnected: (deviceModel) => {

  }
}

let hvac

/**
 * Connect to MQTT broker
 */
let __mqttTopicPrefix = argv['mqtt-topic-prefix']
if(!__mqttTopicPrefix.endsWith('/'))
  __mqttTopicPrefix += '/'
const mqttTopicPrefix = __mqttTopicPrefix

const pubmqttOptions = {
  retain: false
}
if (argv['mqtt-retain']) {
  pubmqttOptions.retain = (argv['mqtt-retain'] == "true")
}

const publish2mqtt = function (newValue, mqttTopic) {
  client.publish(mqttTopicPrefix + mqttTopic + '/get', newValue.toString(), pubmqttOptions)
}

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

  if(topic.startsWith(mqttTopicPrefix)){
    let t = topic.substr(mqttTopicPrefix.length).split('/')
    if(t.length === 2)
      t.unshift(hvac.controller.mac)
    let device = hvac.controller.devices[t[0]]
    switch(t[1]){
      case 'temperature':
        device.setTemp(parseInt(message))
        return
      case 'mode':
        if(message === 'off'){
          device.setPower(commands.power.value.off)
        }
        else{
          if(device.props[commands.power.code] === commands.power.value.off)
            device.setPower(commands.power.value.on)
          device.setMode(commands.mode.value[message])
        }
        return
      case 'fanspeed':
        device.setFanSpeed(commands.fanSpeed.value[message])
        return
      case 'swinghor':
        device.setSwingHor(commands.swingHor.value[message])
        return
      case 'swingvert':
        device.setSwingVert(commands.swingVert.value[message])
        return
      case 'power':
        device.setPower(parseInt(message))
        return
      case 'health':
        device.setHealthMode(parseInt(message))
        return
      case 'powersave':
        device.setPowerSave(parseInt(message))
        return
      case 'lights':
        device.setLights(parseInt(message))
        return
      case 'quiet':
        device.setQuietMode(parseInt(message))
        return
      case 'blow':
        device.setBlow(parseInt(message))
        return
      case 'air':
        device.setAir(parseInt(message))
        return
      case 'sleep':
        device.setSleepMode(parseInt(message))
        return
      case 'turbo':
        device.setTurbo(parseInt(message))
        return
    }
  }
  console.log('[MQTT] No handler for topic %s', topic)
})
