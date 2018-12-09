'use strict';

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
const encryptionService = require('./encryptionService')();
const cmd = require('./commandEnums');

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
            host: options.host || '192.168.1.255',
            onStatus: options.onStatus || function() {},
            onUpdate: options.onUpdate || function() {},
            onConnected: options.onConnected || function() {}
        }

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
                const message = Buffer.from(JSON.stringify({t: 'scan'}));

                socket.setBroadcast(true);
                socket.send(message, 0, message.length, 7000, address);

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
    _setDevice (id, name, address, port) {
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
        const message = {
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
        const toSend = Buffer.from(JSON.stringify(request));
        socket.send(toSend, 0, toSend.length, device.port, device.address);
    }

    /**
     * Confirm device is bound and update device status on list
     * @param {String} id - Device ID
     * @param {String} key - Encryption key
     */
    _confirmBinding(id, key) {
        this.device.bound = true;
        this.device.key = key;
        console.log('[UDP] Device %s is bound!', this.device.name);
    }

    /**
     * Confirm device is bound and update device status on list
     * @param {Device} device - Device
     */
    _requestDeviceStatus (device) {
        const message = {
            cols: Object.keys(cmd).map(key => cmd[key].code),
            mac: device.id,
            t: 'status'
        };
        this._sendRequest(message, device.address, device.port);
    }

    /**
     * Handle UDP response from device
     * @param {string} msg Serialized JSON string with message
     * @param {object} rinfo Additional request information
     * @param {string} rinfo.address IP/host address
     * @param {number} rinfo.port Port number
     */
    _handleResponse(msg, rinfo) {

        const message = JSON.parse(msg + '');

        // Extract encrypted package from message using device key (if available)
        const pack = encryptionService.decrypt(message, (this.device || {}).key);
        
        // If package type is response to handshake
        if (pack.t === 'dev') {
            this._setDevice(message.cid, pack.name, rinfo.address, rinfo.port);
            this._sendBindRequest(this.device);
            return;
        }

        // If package type is binding confirmation
        if (pack.t === 'bindok' && this.device.id) {
            this._confirmBinding(message.cid, pack.key);

            // Start requesting device status on set interval
            setInterval(this._requestDeviceStatus.bind(this, this.device), 3000);
            this.options.onConnected(this.device)
            return;
        }

        // If package type is device status
        if (pack.t === 'dat' && this.device.bound) {
            pack.cols.forEach((col, i) => {
                this.device.props[col] = pack.dat[i];
            });
            this.options.onStatus(this.device);
            return;
        }

        // If package type is response, update device properties
        if (pack.t === 'res' && this.device.bound) {
            pack.opt.forEach((opt, i) => {
                this.device.props[opt] = pack.val[i];
            });
            this.options.onUpdate(this.device);
            return;
        }
        
        console.log('[UDP] Unknown message of type %s: %s, %s', pack.t, message, pack);
    }

    /**
     * Send commands to a bound device
     * @param {string[]} commands List of commands
     * @param {number[]} values List of values
     */
    _sendCommand (commands = [], values = []) {
        const message = {
            opt: commands,
            p: values,
            t: 'cmd'
        };
        this._sendRequest(message);
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
    _sendRequest (message, address = this.device.address, port = this.device.port) {
        const encryptedMessage = encryptionService.encrypt(message, this.device.key);
        const request = {
          cid: 'app',
          i: 0,
          t: 'pack',
          uid: 0,
          pack: encryptedMessage
        };
        const serializedRequest = Buffer.from(JSON.stringify(request));
        socket.send(serializedRequest, 0, serializedRequest.length, port, address);
    };
    
    /**
     * Turn on/off
     * @param {boolean} value State
     */
    setPower (value) {
        this._sendCommand(
            [cmd.power.code],
            [value ? 1 : 0]
        );
    };
    
    /**
     * Set temperature
     * @param {number} value Temperature
     * @param {number} [unit=0] Units (defaults to Celsius)
     */
    setTemp (value, unit = cmd.temperatureUnit.value.celsius) {
        this._sendCommand(
            [cmd.temperatureUnit.code, cmd.temperature.code],
            [unit, value]
        );
    };
    
    /**
     * Set mode
     * @param {number} value Mode value (0-4)
     */
    setMode (value) {
        this._sendCommand(
            [cmd.mode.code],
            [value]
        );
    };
    
    /**
     * Set fan speed
     * @param {number} value Fan speed value (0-5)
     */
    setFanSpeed (value) {
        this._sendCommand(
            [cmd.fanSpeed.code],
            [value]
        );
    };
    
    /**
     * Set vertical swing
     * @param {number} value Vertical swing value (0-11)
     */
    setSwingVert (value) {
        this._sendCommand(
            [cmd.swingVert.code],
            [value]
        );
    };
    
};

module.exports.connect = function(options) {
    return new Device(options);
};
