#!/usr/bin/env node
'use strict';

const argv = require('minimist')(process.argv.slice(2), {
  string: [ 'host' ],
  boolean: [ 'debug' ],
  alias: { d: 'debug' },
  default: { debug: false },
  '--': true,
});

const deviceOptions = {
  host: argv.host,
  onStatus: (deviceModel) => {
    console.log('Status received from ', deviceModel.name, ': ', deviceModel.props)
  },
  onUpdate: (deviceModel) => {
    console.log('Update received from ', deviceModel.name, ': ', deviceModel.props)
  },
  onConnected: (deviceModel) => {
  }
};

const deviceA = require('./app/deviceFactory').connect(deviceOptions);
