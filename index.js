#!/usr/bin/env node
'use strict';

const mqtt = require('mqtt');
const commands = require('./app/commandEnums');
const argv = require('minimist')(process.argv.slice(2), {
  string: [ 'device', 'mqtt' ],
  boolean: [ 'debug' ],
  alias: { d: 'debug' },
  default: { debug: false },
  '--': true,
});

/**
 * Helper: get property key for value
 * @param {*} value 
 */
Object.prototype.getKeyByValue = function( value ) {
  for( var prop in this ) {
      if( this.hasOwnProperty( prop ) ) {
           if( this[ prop ] === value )
               return prop;
      }
  }
}

/**
 * Connect to device
 */
const deviceOptions = {
  host: argv.device,
  onStatus: (deviceModel) => {
    client.publish('home/level2/bathroom/ac/temperature/get', deviceModel.props[commands.temperature.code].toString());
    client.publish('home/level2/bathroom/ac/mode/get', commands.mode.value.getKeyByValue(deviceModel.props[commands.mode.code]).toString());
    client.publish('home/level2/bathroom/ac/fanspeed/get', commands.fanSpeed.value.getKeyByValue(deviceModel.props[commands.fanSpeed.code]).toString());
    client.publish('home/level2/bathroom/ac/swingvert/get', commands.swingVert.value.getKeyByValue(deviceModel.props[commands.swingVert.code]).toString());
  },
  onUpdate: (deviceModel) => {
    console.log('Update received from %s', deviceModel.name)
  },
  onConnected: (deviceModel) => {
    client.subscribe('home/level2/bathroom/ac/temperature/set');
    client.subscribe('home/level2/bathroom/ac/mode/set');
    client.subscribe('home/level2/bathroom/ac/fanspeed/set');
    client.subscribe('home/level2/bathroom/ac/swingvert/set');
    client.subscribe('home/level2/bathroom/ac/power/set');
  }
};

let device;

/**
 * Connect to MQTT broker
 */
const client  = mqtt.connect(argv.mqtt);
client.on('connect', () => {
  console.log('Connected to MQTT broker on ' + argv.mqtt)  
  device = require('./app/deviceFactory').connect(deviceOptions);
});

client.on('message', (topic, message) => {
  message = message.toString();
  console.log('[MQTT] Message "%s" received for %s', message, topic);

  switch (topic) {
    case 'home/level2/bathroom/ac/temperature/set':
      device.setTemp(parseInt(message));
      return;
    case 'home/level2/bathroom/ac/mode/set':
      device.setMode(commands.mode.value[message])
      return;
    case 'home/level2/bathroom/ac/fanspeed/set':
      device.setFanSpeed(commands.fanSpeed.value[message])
      return;
    case 'home/level2/bathroom/ac/swingvert/set':
    device.setSwingVert(commands.swingVert.value[message])
      return;
    case 'home/level2/bathroom/ac/power/set':
      device.setPower(message);
      return;
  }
  console.log('[MQTT] No handler for topic %s', topic)
});