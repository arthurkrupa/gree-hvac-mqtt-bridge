#!/usr/bin/env node
'use strict';

const mqtt = require('mqtt');
const commands = require('./app/commandEnums');
const argv = require('minimist')(process.argv.slice(2), {
  string: [ 'hvac-host', 'mqtt-broker-url', 'mqtt-topic-prefix', 'mqtt-username', 'mqtt-password'],
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
const mqttTopicPrefix = argv['mqtt-topic-prefix'];

var last_temperature = '';
var last_fanspeed = '';
var last_swinghor = '';
var last_swingvert = '';
var last_power = '';
var last_health = '';
var last_powersave = '';
var last_lights = '';
var last_quiet = '';
var last_blow = '';
var last_air = '';
var last_sleep = '';
var last_turbo = '';
var last_mode = '';

const deviceOptions = {
  host: argv['hvac-host'],
  onStatus: (deviceModel) => {
	  
	var actual_temperature = deviceModel.props[commands.temperature.code].toString();
	if(last_temperature != actual_temperature){
	  client.publish(mqttTopicPrefix + '/temperature/get', actual_temperature);
	  last_temperature = actual_temperature;
	}
	
	var actual_fanspeed = commands.fanSpeed.value.getKeyByValue(deviceModel.props[commands.fanSpeed.code]).toString();
	if(last_fanspeed != actual_fanspeed){
      client.publish(mqttTopicPrefix + '/fanspeed/get', actual_fanspeed);
	  last_fanspeed = actual_fanspeed;
	}
    
	var actual_swinghor = commands.swingHor.value.getKeyByValue(deviceModel.props[commands.swingHor.code]).toString();
	if(last_swinghor != actual_swinghor){
      client.publish(mqttTopicPrefix + '/swinghor/get', actual_swinghor);
	  last_swinghor = actual_swinghor;
	}
    
	var actual_swingvert = commands.swingVert.value.getKeyByValue(deviceModel.props[commands.swingVert.code]).toString();
	if(last_swingvert != actual_swingvert){
      client.publish(mqttTopicPrefix + '/swingvert/get', actual_swingvert);
	  last_swingvert = actual_swingvert;
	}
    
	var actual_power = commands.power.value.getKeyByValue(deviceModel.props[commands.power.code]).toString();
	if(last_power != actual_power){
      client.publish(mqttTopicPrefix + '/power/get', actual_power);
	  last_power = actual_power;
	}
    
	var actual_health = commands.health.value.getKeyByValue(deviceModel.props[commands.health.code]).toString();
	if(last_health != actual_health){
      client.publish(mqttTopicPrefix + '/health/get', actual_health);
	  last_health = actual_health;
	}
    
	var actual_powersave = commands.energySave.value.getKeyByValue(deviceModel.props[commands.energySave.code]).toString();
	if(last_powersave != actual_powersave){
      client.publish(mqttTopicPrefix + '/powersave/get', actual_powersave);
	  last_powersave = actual_powersave;
	}
    
	var actual_lights = commands.lights.value.getKeyByValue(deviceModel.props[commands.lights.code]).toString();
	if(last_lights != actual_lights){
      client.publish(mqttTopicPrefix + '/lights/get', actual_lights);
	  last_lights = actual_lights;
	}
    
	var actual_quiet = commands.quiet.value.getKeyByValue(deviceModel.props[commands.quiet.code]).toString();
	if(last_quiet != actual_quiet){
      client.publish(mqttTopicPrefix + '/quiet/get', actual_quiet);
	  last_quiet = actual_quiet;
	}
    
	var actual_blow = commands.blow.value.getKeyByValue(deviceModel.props[commands.blow.code]).toString();
	if(last_blow != actual_blow){
      client.publish(mqttTopicPrefix + '/blow/get', actual_blow);
	  last_blow = actual_blow;
	}
    
	var actual_air = commands.air.value.getKeyByValue(deviceModel.props[commands.air.code]).toString();
	if(last_air != actual_air){
      client.publish(mqttTopicPrefix + '/air/get', actual_air);
	  last_air = actual_air;
	}
    
	var actual_sleep = commands.sleep.value.getKeyByValue(deviceModel.props[commands.sleep.code]).toString();
	if(last_sleep != actual_sleep){
      client.publish(mqttTopicPrefix + '/sleep/get', actual_sleep);
	  last_sleep = actual_sleep;
	}
    
	var actual_turbo = commands.turbo.value.getKeyByValue(deviceModel.props[commands.turbo.code]).toString();
	if(last_turbo != actual_turbo){
      client.publish(mqttTopicPrefix + '/turbo/get', actual_turbo);
	  last_turbo = actual_turbo;
	}

    /**
     * Handle "off" mode status
     * Hass.io MQTT climate control doesn't support power commands through GUI,
     * so an additional pseudo mode is added
     */ 
	 var actual_mode = (deviceModel.props[commands.power.code] === commands.power.value.on)
        ? commands.mode.value.getKeyByValue(deviceModel.props[commands.mode.code]).toString()
        : 'off';
    if(last_mode != actual_mode){
      client.publish(mqttTopicPrefix + '/mode/get', actual_mode);
	  last_mode = actual_mode;
	}
  },
  onUpdate: (deviceModel) => {
    console.log('[UDP] Status updated on %s', deviceModel.name)
  },
  onConnected: (deviceModel) => {
    client.subscribe(mqttTopicPrefix + '/temperature/set');
    client.subscribe(mqttTopicPrefix + '/mode/set');
    client.subscribe(mqttTopicPrefix + '/fanspeed/set');
    client.subscribe(mqttTopicPrefix + '/swinghor/set');
    client.subscribe(mqttTopicPrefix + '/swingvert/set');
    client.subscribe(mqttTopicPrefix + '/power/set');
    client.subscribe(mqttTopicPrefix + '/health/set');
    client.subscribe(mqttTopicPrefix + '/powersave/set');
    client.subscribe(mqttTopicPrefix + '/lights/set');
    client.subscribe(mqttTopicPrefix + '/quiet/set');
    client.subscribe(mqttTopicPrefix + '/blow/set');
    client.subscribe(mqttTopicPrefix + '/air/set');
    client.subscribe(mqttTopicPrefix + '/sleep/set');
    client.subscribe(mqttTopicPrefix + '/turbo/set');
  }
};

let hvac;

/**
 * Connect to MQTT broker
 */

const mqttOptions = {};
let authLog = '';
if (argv['mqtt-username'] && argv['mqtt-password']) {
  mqttOptions.username = argv['mqtt-username'];
  mqttOptions.password = argv['mqtt-password'];
  authLog = ' as "' + mqttOptions.username + '"';
}
const client  = mqtt.connect(argv['mqtt-broker-url'], mqttOptions);
client.on('connect', () => {
  console.log('[MQTT] Connected to broker on ' + argv['mqtt-broker-url'] + authLog)
  hvac = require('./app/deviceFactory').connect(deviceOptions);
});

client.on('message', (topic, message) => {
  message = message.toString();
  console.log('[MQTT] Message "%s" received for %s', message, topic);

  switch (topic) {
    case mqttTopicPrefix + '/temperature/set':
      hvac.setTemp(parseInt(message));
      return;
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
      return;
    case mqttTopicPrefix + '/fanspeed/set':
      hvac.setFanSpeed(commands.fanSpeed.value[message])
      return;
    case mqttTopicPrefix + '/swinghor/set':
      hvac.setSwingHor(commands.swingHor.value[message])
      return;
    case mqttTopicPrefix + '/swingvert/set':
      hvac.setSwingVert(commands.swingVert.value[message])
      return;
    case mqttTopicPrefix + '/power/set':
      hvac.setPower(parseInt(message));
      return;
    case mqttTopicPrefix + '/health/set':
      hvac.setHealthMode(parseInt(message));
      return;
    case mqttTopicPrefix + '/powersave/set':
      hvac.setPowerSave(parseInt(message));
      return;
    case mqttTopicPrefix + '/lights/set':
      hvac.setLights(parseInt(message));
      return;
    case mqttTopicPrefix + '/quiet/set':
      hvac.setQuietMode(parseInt(message));
      return;
    case mqttTopicPrefix + '/blow/set':
      hvac.setBlow(parseInt(message));
      return;
    case mqttTopicPrefix + '/air/set':
      hvac.setAir(parseInt(message));
      return;
    case mqttTopicPrefix + '/sleep/set':
      hvac.setSleepMode(parseInt(message));
      return;
    case mqttTopicPrefix + '/turbo/set':
      hvac.setTurbo(parseInt(message));
      return;
  }
  console.log('[MQTT] No handler for topic %s', topic)
});
