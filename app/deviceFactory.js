'use strict';
const net = require('net');
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
const encryptionService = require('./encryptionService')();
const cmd = require('./commandEnums');
const _ = require('lodash');
var CryptoJS = require("crypto-js");
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
        }
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
        const toSend = new Buffer(JSON.stringify(request));
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
            const message = this._unpackCMD(rinfo.address, msg);
            this._setDevice(message.mac, message.name, rinfo.address, rinfo.port);
            this._requestDeviceStatus(this.device, this);
            this.options.onConnected(this.device);
            // this._sendBindRequest(this.device);
        } else {
            console.log("_handleResponse -> else");
            let statusMessage = this._parseMessage(msg);
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
    _sendRequest(message, address = this.device.address, port = this.device.port) {
        /*  const encryptedMessage = encryptionService.encrypt(message, this.device.key);
          const request = {
              cid: 'app',
              i: 0,
              t: 'pack',
              uid: 0,
              pack: encryptedMessage
          };
          const serializedRequest = new Buffer(JSON.stringify(request));
          socket.send(serializedRequest, 0, serializedRequest.length, port, address);*/

    };

    /**
     * Turn on/off
     * @param {boolean} value State
     */
    setPower(value) {

        console.log('--In setPower: ' + value);
        /* if (!this.isConnected) {
             client.connect(this.deviceStatusPort, this.device.address, function(data) {
                 console.log('Connected to tcp port');
                 this.isConnected = true;
                 client.write(utils.cmd01(this.lastCmd, 1));
             });
         } else {*/
        if (this.device.lastCmd)
            client.write(utils.cmd01(this.device.lastCmd, value));
        //else {
        //   this._requestDeviceStatus(this.device, this);
        // }
        // }
    };

    /**
     * Set temperature
     * @param {number} value Temperature
     * @param {number} [unit=0] Units (defaults to Celsius)
     */
    setTemp(value, unit = cmd.temperatureUnit.value.celsius) {
        console.log('--In setTemp: ' + value);
        if (this.device.lastCmd) {
            client.write(utils.cmd07(this.device.lastCmd, value, false));
        }
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

    _getSecKey(mac) {
        let magic = 'Y2016-10-24Y';
        let magic_odd = '2Y10-6012-Y4';
        let result = '';

        if (mac && mac.length == 12) {
            for (let i = 0; i < mac.length; i += 2) {
                result += mac[i];
            }

            result += magic_odd;

            result = CryptoJS.MD5(result).toString().substr(8, 16);
            console.log("getSecKey----mac:" + mac + "----key:" + result);

            return result
        }
    };
    _unpackCMD(ip, cmd, state) {
        if (cmd && cmd[2] == 12 && cmd[3] === 0x03) {
            let industry = cmd[4];
            let vender = cmd[5];
            let type = cmd[6];
            let mac = this._num10THexStr([
                cmd[7], cmd[8], cmd[9],
                cmd[10], cmd[11], cmd[12]
            ]);
            let secret = this._getSecKey(mac);
            let status = "1";
            let name = mac;
            type = this._num10THexStr([industry, vender, type]);

            return {
                "industry": industry,
                "vender": vender,
                "type": type,
                "mac": mac,
                "ip": ip,
                "name": name,
                "status": status,
                "secret": secret
            };
        }

    };

    _cmd(cmdCom) {
        cmdCom[3] = 0x01;
        var code = 0x00;
        for (var i = 0; i < cmdCom.length - 1; i++) {
            code += cmdCom[i];
        }
        cmdCom[cmdCom.length - 1] = code & 0xFF;
        return cmdCom;
    };

    _num10THex(num) {
        let hex = num.toString(16);
        return hex.length === 1 ? '' + hex : '' + hex;
    };
    _num10THexStr(nums) {
        let str = '';
        for (let index = 0; index < nums.length; index++) {
            let hex = this._num10THex(nums[index]);
            str = str + '' + (hex.length == 1 ? '0' + hex : hex);
        }
        return str;
    };


    _parseMessage(message) {
        let data3 = this._parseData3(message[4 + 3]);
        let data4 = this._parseData4(message[4 + 4]);
        let data5 = this._parseData5(message[4 + 5]);
        let data6 = this._parseData6(message[4 + 6]);
        let data789 = this._parseData789(message[4 + 7], message[4 + 8], message[4 + 9]);
        let data10 = this._parseData10(message[4 + 10]);
        let data11And12 = this._parseData11And12(data4.temtyp, message[4 + 11], message[4 + 12])
        let cpmode = data3.cpmode;
        let mute = data4.mute;
        let windMode = parseInt(data3.windLevel, 2);
        if (cpmode) {
            windMode = 8;
        } else if (mute) {
            windMode = 7;
        }
        let devSt = _.assign(data3, data4, data5, data6, data789, data10, data11And12, { windMode });
        return devSt;
    };

    _parseData3(byte) {
        var bit = this._intToBit(byte);

        var runMode = bit[5] + "" + bit[6] + "" + bit[7];
        let boot = bit[4]
        var windLevel = bit[1] + "" + bit[2] + "" + bit[3];
        let cpmode = bit[0]
        return {
            runMode,
            boot,
            windLevel,
            cpmode,
        };
    };

    _parseData4(byte) {
        var bit = this._intToBit(byte);
        var mute = bit[1]
        let mode = bit[2]
        var wenTwo = bit[3] + "" + bit[4] + "" + bit[5] + "" + bit[6] + "" + bit[7];

        let wdNumber = 0
        if (!!!mode) {
            var wen = parseInt(wenTwo, 2);
            wen = wen >= 16 ? wen - 16 : wen;
            wdNumber = wen > 0 ? wen + 16 : 16;
        } else {
            wdNumber = array_2[wenTwo]
        }

        return {
            mute,
            temtyp: mode,
            wdNumber,
        };
    };

    _parseData5(byte) {
        var bit = this._intToBit(byte);

        var windLR = bit[0] + "" + bit[1] + "" + bit[2] + "" + bit[3];
        var windTB = bit[4] + "" + bit[5] + "" + bit[6] + "" + bit[7];
        return {
            windLR,
            windTB,
        };
    };

    _parseData6(byte) {
        var bit = this._intToBit(byte);
        return {
            lighting: bit[0],
            healthy: bit[1],
            timingMode: bit[2],
            dryingmode: bit[3],
            wdNumberMode: bit[4] + '' + bit[5],
            sleep: bit[6],
            eco: bit[7],
        };
    };

    _parseData789(byte7, byte8, byte9) {
        let bits7 = this._intToBit(byte7);
        let bits8 = this._intToBit(byte8);
        let bits9 = this._intToBit(byte9);
        let shut = bits7[0]
        let shutT = '' + bits7[1] + '' + bits7[2] + bits7[3] + (_.join(bits9, ''))
        let boot = bits7[4]
        let bootT = '' + bits7[5] + bits7[6] + bits7[7] + (_.join(bits8, ''))
        let bootSec = parseInt(bootT, 2)
        let shutSec = parseInt(shutT, 2)
        let bootHor = parseInt(bootSec / 60)
        let bootSecnd = parseInt(bootSec % 60)
        let shutHor = parseInt(shutSec / 60)
        let shutSecnd = parseInt(shutSec % 60)
        let bootTime = (bootHor >= 10 ? bootHor : '0' + bootHor) + ":" + (bootSecnd >= 10 ? bootSecnd : '0' + bootSecnd)
        let shutTime = (shutHor >= 10 ? shutHor : '0' + shutHor) + ":" + (shutSecnd >= 10 ? shutSecnd : '0' + shutSecnd)
        return {
            bootEnabled: boot,
            bootTime,
            shutEnabled: shut,
            shutTime
        };
    };

    _parseData10(byte10) {
        return {
            wujiNum: byte10
        };
    };

    _parseData11And12(type = 0, byte11, byte12) {
        return {
            indoorTemperature: type ? ((byte11 * 1.8) + 32) : byte11 + '.' + byte12
        };
    };

    _cmd01(nowCmd, val) {
        let cmdPos = 4 + 3;
        let byte = nowCmd[cmdPos]
        let bit = _intToBit(byte);
        bit[4] = val
        nowCmd[cmdPos] = _byteTohex(bit.join(''));
        if (val) {
            _cmd14(nowCmd, 0, true)
        }

        if (!val) {
            _cmd16(nowCmd, 0, true)
        }

        let timeSt = _parseData789(nowCmd[4 + 7], nowCmd[4 + 8], nowCmd[4 + 9])

        _cmd18(nowCmd, false, timeSt.bootTime, false, timeSt.shutTime, true)

        return _cmd(nowCmd)
    }

    _byteTohex(byte) {
        byte = parseInt(byte, 2);
        return parseInt(byte.toString(16), 16);
    }

    _intToBit(x) {
        var str = x.toString(2);
        var c = 8 - str.length;
        for (var i = 0; i < c; i++) {
            str = "0" + str;
        }
        var bit = str.split("");
        for (var i = 0; i < bit.length; i++) {
            bit[i] = parseInt(bit[i]);
        }
        return bit;
    }


};






module.exports.connect = function(options) {
    return new Device(options);
};
