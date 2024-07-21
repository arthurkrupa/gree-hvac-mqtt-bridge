'use strict'

const dgram = require('dgram')
const socket = dgram.createSocket('udp4')
const encryptionService = require('./encryptionService')()
const cmd = require('./commandEnums')

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
  constructor (options) {
    //  Set defaults
    this.options = {
      host: options.host || '192.168.1.255',
      localPort: options.localPort || 0,
      onStatus: options.onStatus || function () {},
      onUpdate: options.onUpdate || function () {},
      onConnected: options.onConnected || function () {}
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
    this.device = {}
    this.encryptionVersion = 1;
    this.tag = '';
    this.packetSentNo = 0;
    this.packetReceivedNo = 0;

    // Initialize connection and bind with device
    this._connectToDevice(this.options.host)

    // Handle incoming messages
    socket.on('message', (msg, rinfo) => this._handleResponse(msg, rinfo))
  }

  /**
     * Initialize connection
     * @param {string} address - IP/host address
     */
  _connectToDevice (address) {
    try {
      socket.bind(this.options.localPort, () => {
        const message = Buffer.from(JSON.stringify({ t: 'scan' }))

        this.packetSentNo++;
        //console.log('[UDP] Sent[%d]: %s', this.packetSentNo, message);

        socket.setBroadcast(true)        
        socket.send(message, 0, message.length, 7000, address)

        if (this.options.localPort === 0) {
          console.log('[UDP] Connected to device at %s', address)            
        } else {
          console.log('[UDP] Connected to device at %s from port %d', address, this.options.localPort)
        }
        
      })
    } catch (err) {
      const timeout = 60

      console.log('[UDP] Unable to connect (' + err.message + '). Retrying in ' + timeout + 's...')
      setTimeout(() => {
        this._connectToDevice(address)
      }, timeout * 1000)
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
    this.device.id = id
    this.device.name = name
    this.device.address = address
    this.device.port = port
    this.device.bound = false
    this.device.props = {}

    console.log('[UDP] New device registered: %s @ %s', this.device.id, this.device.address)
  }

  /**
     * Send binding request to device
     * @param {Device} device Device object
     */
  _sendBindRequest (device) {
    
    let encryptedBoundMessage;

    const message = {
      mac: this.device.id,
      t: 'bind',
      uid: 0
    }

    if(this.encryptionVersion === 1) {
      encryptedBoundMessage = encryptionService.encrypt(message)
      this.tag = '';
    }
    else if(this.encryptionVersion === 2) {
      const encrypted = encryptionService.encrypt_v2(message)
      encryptedBoundMessage = encrypted.pack
      this.tag = encrypted.tag;
    }

    const request = (this.tag === '') ? {
      tcid: this.device.id,
      cid: 'app',
      i: 1,
      t: 'pack',
      uid: 0,
      pack: encryptedBoundMessage
    } : {
      tcid: this.device.id,
      cid: 'app',
      i: 1,
      t: 'pack',
      uid: 0,
      tag: this.tag,
      pack: encryptedBoundMessage
    }

    const toSend = Buffer.from(JSON.stringify(request))
    socket.send(toSend, 0, toSend.length, device.port, device.address)

    this.packetSentNo++;
    //console.log('[UDP] Sent[%d]: %s', this.packetSentNo, toSend);
    
    //console.log('[UDP] Device %s bind request sent...', this.device.id)
  }

  /**
     * Confirm device is bound and update device status on list
     * @param {String} id - Device ID
     * @param {String} key - Encryption key
     */
  _confirmBinding (id, key) {
    this.device.bound = true
    this.device.key = key
    console.log('[UDP] Device %s is bound!', this.device.id)
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
    }
    this._sendRequest(message, device.address, device.port)
  }

  /**
     * Handle UDP response from device
     * @param {string} msg Serialized JSON string with message
     * @param {object} rinfo Additional request information
     * @param {string} rinfo.address IP/host address
     * @param {number} rinfo.port Port number
     */
  _handleResponse (msg, rinfo) {
    
    this.packetReceivedNo++;

    let pack;
    const message = JSON.parse(msg + '')

    //console.log('[UDP] Received[%d]: %s', this.packetReceivedNo, message);

    // Extract encrypted package from message using device key (if available)
    if (this.encryptionVersion === 1) {
      //console.log('[UDP] Received packet with encryption version: 1')
      pack = encryptionService.decrypt(message, message.i === 1 ? undefined : this.device.key)
    }
    else if (this.encryptionVersion === 2) {
      //console.log('[UDP] Received packet with encryption version: 2')
      pack = encryptionService.decrypt_v2(message, message.i === 1 ? undefined : this.device.key)
    }

    //console.log('[UDP] Pack %s', pack);

    // If package type is response to handshake
    if (pack.t === 'dev') {

      //console.log('[UDP] Device respond for scan');

      if (this.encryptionVersion === 1 && pack.ver && pack.ver.toString().startsWith('V2.')) {
        //console.log('[UDP] Encryption switched to version: 2')
        // first V2 version responded to scan command with V1 encryption but binding requires V2 encryption
        this.encryptionVersion = 2;
        this._setDevice(pack.cid, pack.name, rinfo.address, rinfo.port)
      }
      else {
        this._setDevice(message.cid, pack.name, rinfo.address, rinfo.port)
      }

      this._sendBindRequest(this.device)
      return

    }

    // If package type is binding confirmation
    if (pack.t === 'bindok' && this.device.id) {

      //console.log('[UDP] Device respond for bind');

      this._confirmBinding(message.cid, pack.key)

      // Start requesting device status on set interval
      setInterval(this._requestDeviceStatus.bind(this, this.device), 3000)
      this.options.onConnected(this.device)
      return
    }

    // If package type is device status
    if (pack.t === 'dat' && this.device.bound) {
      pack.cols.forEach((col, i) => {
        this.device.props[col] = pack.dat[i]
      })
      this.options.onStatus(this.device)
      return
    }

    // If package type is response, update device properties
    if (pack.t === 'res' && this.device.bound) {      
      pack.opt.forEach((opt, i) => {
        const value = pack.p !== undefined ? pack.p[i] : pack.val[i];
        this.device.props[opt] = value;
      })
      this.options.onUpdate(this.device)
      return
    }

    console.log('[UDP] Unknown message of type %s: %s, %s', pack.t, message, pack)
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
    }
    this._sendRequest(message)
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

    let encryptedBoundMessage;

    //console.log('[UDP] SendRequest: %s', message);  

    if(this.encryptionVersion === 1) {
      encryptedBoundMessage = encryptionService.encrypt(message, this.device.key)
      this.tag = '';
    }
    else if(this.encryptionVersion === 2) {
      const encrypted = encryptionService.encrypt_v2(message, this.device.key)
      encryptedBoundMessage = encrypted.pack
      this.tag = encrypted.tag;
    }

    const request = (this.tag === '') ? {
      tcid: this.device.id,
      cid: 'app',
      i: 0,
      t: 'pack',
      uid: 0,
      pack: encryptedBoundMessage
    } : {
      tcid: this.device.id,
      cid: 'app',
      i: 0,
      t: 'pack',
      uid: 0,
      tag: this.tag,
      pack: encryptedBoundMessage
    }
    const serializedRequest = Buffer.from(JSON.stringify(request))
    socket.send(serializedRequest, 0, serializedRequest.length, port, address)

    this.packetSentNo++;
    //console.log('[UDP] Sent[%d]: %s', this.packetSentNo, serializedRequest);    

  };

  /**
     * Turn on/off
     * @param {boolean} value State
     */
  setPower (value) {
    this._sendCommand(
      [cmd.power.code],
      [value ? 1 : 0]
    )
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
    )
  };

  /**
     * Set mode
     * @param {number} value Mode value (0-4)
     */
  setMode (value) {
    this._sendCommand(
      [cmd.mode.code],
      [value]
    )
  };

  /**
     * Set fan speed
     * @param {number} value Fan speed value (0-5)
     */
  setFanSpeed (value) {
    this._sendCommand(
      [cmd.fanSpeed.code],
      [value]
    )
  };

  /**
     * Set horizontal swing
     * @param {number} value Horizontal swing value (0-7)
     */
  setSwingHor (value) {
    this._sendCommand(
      [cmd.swingHor.code],
      [value]
    )
  };

  /**
     * Set vertical swing
     * @param {number} value Vertical swing value (0-11)
     */
  setSwingVert (value) {
    this._sendCommand(
      [cmd.swingVert.code],
      [value]
    )
  };

  /**
     * Set power save mode
     * @param {boolean} value on/off
     */
  setPowerSave (value) {
    this._sendCommand(
      [cmd.powerSave.code],
      [value ? 1 : 0]
    )
  };

  /**
     * Set lights on/off
     * @param {boolean} value on/off
     */
  setLights (value) {
    this._sendCommand(
      [cmd.lights.code],
      [value ? 1 : 0]
    )
  };

  /**
     * Set health mode
     * @param {boolean} value on/off
     */
  setHealthMode (value) {
    this._sendCommand(
      [cmd.health.code],
      [value ? 1 : 0]
    )
  }

  /**
     * Set quiet mode
     * @param {boolean} value on/off
     */
  setQuietMode (value) {
    this._sendCommand(
      [cmd.quiet.code],
      [value]
    )
  };

  /**
     * Set blow mode
     * @param {boolean} value on/off
     */
  setBlow (value) {
    this._sendCommand(
      [cmd.blow.code],
      [value ? 1 : 0]
    )
  };

  /**
     * Set air valve mode
     * @param {boolean} value on/off
     */
  setAir (value) {
    this._sendCommand(
      [cmd.air.code],
      [value]
    )
  };

  /**
     * Set sleep mode
     * @param {boolean} value on/off
     */
  setSleepMode (value) {
    this._sendCommand(
      [cmd.sleep.code],
      [value ? 1 : 0]
    )
  };

  /**
     * Set turbo mode
     * @param {boolean} value on/off
     */
  setTurbo (value) {
    this._sendCommand(
      [cmd.turbo.code],
      [value ? 1 : 0]
    )
  };
};

module.exports.connect = function (options) {
  return new Device(options)
}
