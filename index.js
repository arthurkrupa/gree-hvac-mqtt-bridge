#!/usr/bin/env node
'use strict';

const mqtt = require('mqtt');
const commands = require('./app/commandEnums');
const argv = require('minimist')(process.argv.slice(2), {
  string: [ 'hvac-host', 'mqtt-broker-url', 'mqtt-topic-prefix' ],
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
const deviceOptions = {
  host: argv['hvac-host'],
  onStatus: (deviceModel) => {
    console.debug(deviceModel);
    client.publish(mqttTopicPrefix + '/temperature/get', deviceModel.props[commands.temperature.code].toString());
    client.publish(mqttTopicPrefix + '/fanspeed/get', commands.fanSpeed.value.getKeyByValue(deviceModel.props[commands.fanSpeed.code]).toString());
    client.publish(mqttTopicPrefix + '/swingvert/get', commands.swingVert.value.getKeyByValue(deviceModel.props[commands.swingVert.code]).toString());
    client.publish(mqttTopicPrefix + '/power/get', commands.power.value.getKeyByValue(deviceModel.props[commands.power.code]).toString());
    client.publish(mqttTopicPrefix + '/health/get', commands.health.value.getKeyByValue(deviceModel.props[commands.health.code]).toString());
    client.publish(mqttTopicPrefix + '/powersave/get', commands.energySave.value.getKeyByValue(deviceModel.props[commands.energySave.code]).toString());
    client.publish(mqttTopicPrefix + '/lights/get', commands.lights.value.getKeyByValue(deviceModel.props[commands.lights.code]).toString());
    client.publish(mqttTopicPrefix + '/quiet/get', commands.quiet.value.getKeyByValue(deviceModel.props[commands.quiet.code]).toString());
    client.publish(mqttTopicPrefix + '/xfan/get', commands.blow.value.getKeyByValue(deviceModel.props[commands.blow.code]).toString());
    client.publish(mqttTopicPrefix + '/freshair/get', commands.airVale.value.getKeyByValue(deviceModel.props[commands.airVale.code]).toString());
    client.publish(mqttTopicPrefix + '/sleep/get', commands.sleep.value.getKeyByValue(deviceModel.props[commands.sleep.code]).toString());

    /**
     * Handle "none" mode status
     * Hass.io MQTT climate control doesn't support power commands through GUI,
     * so an additional pseudo mode is added
     */ 
    client.publish(mqttTopicPrefix + '/mode/get',
      (deviceModel.props[commands.power.code] === commands.power.value.on)
        ? commands.mode.value.getKeyByValue(deviceModel.props[commands.mode.code]).toString()
        : 'none'
    );
  },
  onUpdate: (deviceModel) => {
    console.log('[UDP] Status updated on %s', deviceModel.name)
  },
  onConnected: (deviceModel) => {
    client.subscribe(mqttTopicPrefix + '/temperature/set');
    client.subscribe(mqttTopicPrefix + '/mode/set');
    client.subscribe(mqttTopicPrefix + '/fanspeed/set');
    client.subscribe(mqttTopicPrefix + '/swingvert/set');
    client.subscribe(mqttTopicPrefix + '/power/set');
    client.subscribe(mqttTopicPrefix + '/health/set');
    client.subscribe(mqttTopicPrefix + '/powersave/set');
    client.subscribe(mqttTopicPrefix + '/lights/set');
    client.subscribe(mqttTopicPrefix + '/quiet/set');
    client.subscribe(mqttTopicPrefix + '/xfan/set');
    client.subscribe(mqttTopicPrefix + '/freshair/set');
    client.subscribe(mqttTopicPrefix + '/sleep/set');
  }
};

let hvac;

/**
 * Connect to MQTT broker
 */
const client  = mqtt.connect(argv['mqtt-broker-url']);
client.on('connect', () => {
  console.log('[MQTT] Connected to broker on ' + argv['mqtt-broker-url'])
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
      if (message === 'none') {
        // Power off when "none" mode
        hvac.setPower(commands.power.value.off)
      } else {
        // Power on and set mode if other than 'none'
        if (hvac.device.props[commands.power.code] === commands.power.value.off) {
          hvac.setPower(commands.power.value.on)
        }
        hvac.setMode(commands.mode.value[message])
      }
      return;
    case mqttTopicPrefix + '/fanspeed/set':
      hvac.setFanSpeed(commands.fanSpeed.value[message])
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
    case mqttTopicPrefix + '/xfan/set':
      hvac.setXFan(parseInt(message));
      return;
    case mqttTopicPrefix + '/freshair/set':
      hvac.setFreshAir(parseInt(message));
      return;
    case mqttTopicPrefix + '/sleep/set':
      hvac.setSleepMode(parseInt(message));
      return;
  }
  console.log('[MQTT] No handler for topic %s', topic)
});