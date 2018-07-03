'use strict';
const net = require('net');
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
const encryptionService = require('./encryptionService')();
const cmd = require('./commandEnums');
const _ = require('lodash');

const utils = require("./utils");

const client = new net.Socket();



/**
 * Class representing a single connected device
 */
class Device {

    /**
     * Create device model and establish UDP connection with remote host
     * @param {object} [options] Options
     * @param {string} [options.address] HVAC IP address
     * @callback [options.onStatus] Callback function run on each status update
     * @callback [options.onUpdate] Callback function run after command
     * @callback [options.onConnected] Callback function run once connection is established
     */
    constructor(options) {

        //  Set defaults
        this.options = {
            host: options.host || '192.168.111.255',
            onStatus: options.onStatus || function() {},
            onUpdate: options.onUpdate || function() {},
            onConnected: options.onConnected || function() {}
        };
        client.on('data', (msg, rinfo) => this._handleResponse(msg, rinfo));

        client.on('listening', () => {
            const address = client.address();
            console.log(`server listening ${address.address}:${address.port}`);
        });
        /**
         * Device object
         * @typedef {object} Device
         * @property {string} id - ID
         * @property {string} name - Name
         * @property {string} address - IP address
         * @property {number} port - Port number
         * @property {boolean} bound - If is already bound
         * @property {object} props - Properties
         */
        this.device = {};
        //
        this.defaultPort = 12414;
        this.defaultDiscoveryPort = 2415;
        this.deviceStatusPort = 12416
            // Initialize connection and bind with device
        this._connectToDevice(this.options.host);

        // Handle incoming messages
        socket.on('message', (msg, rinfo) => this._handleResponse(msg, rinfo));
    }

    /**
     * Initialize connection
     * @param {string} address - IP/host address 
     */
    _connectToDevice(address) {
        try {
            socket.bind(() => {
                const bufView = new Buffer(9);
                bufView[0] = 0xAA;
                bufView[1] = 0xAA;
                bufView[2] = 0x06;
                bufView[3] = 0x02;
                bufView[4] = 0xFF;
                bufView[5] = 0xFF;
                bufView[6] = 0xFF;
                bufView[7] = 0x00;
                bufView[8] = 0x59;

                socket.setBroadcast(true);
                socket.send(bufView, 0, bufView.length, this.defaultPort, address);

                console.log('[UDP] Connected to device at %s', address);
            });
        } catch (err) {
            const timeout = 60

            console.log('[UDP] Unable to connect (' + err.message + '). Retrying in ' + timeout + 's...');
            setTimeout(() => {
                this._connectToDevice(address);
            }, timeout * 1000);
        }
    }

    /**
     * Register new device locally
     * @param {string} id - CID received in handshake message
     * @param {string} name - Device name received in handshake message
     * @param {string} address - IP/host address
     * @param {number} port - Port number
     */
    _setDevice(id, name, address, port) {
        this.device.id = id;
        this.device.name = name;
        this.device.address = address;
        this.device.port = port;
        this.device.bound = false;
        this.device.props = {};

        console.log('[UDP] New device registered: %s', this.device.name);
    }

    /**
     * Send binding request to device
     * @param {Device} device Device object
     */
    _sendBindRequest(device) {
        /*const message = {
            mac: this.device.id,
            t: 'bind',
            uid: 0
        };
        const encryptedBoundMessage = encryptionService.encrypt(message);
        const request = {
            cid: 'app',
            i: 1,
            t: 'pack',
            uid: 0,
            pack: encryptedBoundMessage
        };
        const toSend = new Buffer(JSON.stringify(request));
        socket.send(toSend, 0, toSend.length, device.port, device.address);*/
    }

    /**
     * Confirm device is bound and update device status on list
     * @param {String} id - Device ID
     * @param {String} key - Encryption key
     */
    _confirmBinding(id, key) {
        /*  this.device.bound = true;
          this.device.key = key;
          console.log('[UDP] Device %s is bound!', this.device.name);*/
    }

    /**
     * Confirm device is bound and update device status on list
     * @param {Device} device - Device
     */
    _requestDeviceStatus(device, that) {
        console.log("--in _requestDeviceStatus");
        let serializedRequest = new Buffer([0xAA, 0xAA, 0x12, 0xA0, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1A]);

        if (!this.isConnected) {
            client.connect(this.deviceStatusPort, device.address, function(data) {
                console.log('Connected to tcp port');
                this.isConnected = true;
                client.write(serializedRequest);
            });
        } else {
            console.log("-- already connected");
            client.write(serializedRequest);
        }

        // socket.send(serializedRequest, 0, serializedRequest.length, device.port, device.ip);
    }

    /**
     * Handle UDP response from device
     * @param {string} msg Serialized JSON string with message
     * @param {object} rinfo Additional request information
     * @param {string} rinfo.address IP/host address
     * @param {number} rinfo.port Port number
     */
    _handleResponse(msg, rinfo) {

        //default discovery msg
        if (msg && msg[2] == 12 && msg[3] === 0x03) {
            const message = utils.unpackCMD(rinfo.address, msg);
            this._setDevice(message.mac, message.name, rinfo.address, rinfo.port);
            this._requestDeviceStatus(this.device, this);
            this.options.onConnected(this.device);
            // this._sendBindRequest(this.device);
        } else {
            console.log("received status msg.");
            let statusMessage = utils.parseMessage(msg);
            console.log(statusMessage);
            this.device.lastCmd = msg;
            this.device.props = statusMessage;
            this.options.onStatus(this.device);
        }
    }

    /**
     * Send commands to a bound device
     * @param {string[]} commands List of commands
     * @param {number[]} values List of values
     */
    _sendCommand(commands = [], values = []) {
        /*   const message = {
               opt: commands,
               p: values,
               t: 'cmd'
           };
           this._sendRequest(message);*/
    };

    /**
     * Send request to a bound device
     * @param {object} message
     * @param {string[]} message.opt
     * @param {number[]} message.p
     * @param {string} message.t
     * @param {string} [address] IP/host address
     * @param {number} [port] Port number
     */
    _sendRequest(message, address = this.device.address, port = this.device.port) {};

    /**
     * Turn on/off
     * @param {boolean} value State
     */
    setPower(value) {
        console.log('--In setPower: ' + value);
        if (this.device.lastCmd)
            client.write(utils.cmd01(this.device.lastCmd, value));
    };

    /**
     * Set temperature
     * @param {number} value Temperature
     * @param {number} [unit=0] Units (defaults to Celsius)
     */
    setTemp(value, unit = cmd.temperatureUnit.value.celsius) {
        console.log('--In setTemp: ' + value);
        if (this.device.lastCmd)
            client.write(utils.cmd07(this.device.lastCmd, value, false));

    };

    /**
     * Set mode
     * @param {number} value Mode value (0-4)
     */
    setMode(value) {
        this._sendCommand(
            [cmd.mode.code], [value]
        );
    };

    /**
     * Set fan speed
     * @param {number} value Fan speed value (0-5)
     */
    setFanSpeed(value) {
        this._sendCommand(
            [cmd.fanSpeed.code], [value]
        );
    };

    /**
     * Set vertical swing
     * @param {number} value Vertical swing value (0-11)
     */
    setSwingVert(value) {
        this._sendCommand(
            [cmd.swingVert.code], [value]
        );
    };
};

module.exports.connect = function(options) {
    return new Device(options);
};
