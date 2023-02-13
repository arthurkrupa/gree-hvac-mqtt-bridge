'use strict'

const dgram = require('dgram')
const socket = dgram.createSocket('udp4')
const encryptionService = require('./encryptionService')()
const cmd = require('./commandEnums')

/**
 * Class representing a single connected controller
 */
class Controller {
  /**
     * Create controller model and establish UDP connection with remote host
     * @param {object} [options] Options
     * @param {string} [options.address] HVAC IP address
     * @param {boolean} [options.controllerOnly] Whether to just a controller, does not contain functions (usually VRF)
     * @param {number} [options.pollingInterval] Interval to poll the device for status (unit: ms)
     * @param {boolean} [options.debug] Whether to output debug information
     * @callback [options.onStatus] Callback function run on each status update
     * @callback [options.onUpdate] Callback function run after command
     * @callback [options.onSetup] Callback function run once device is setup
     * @callback [options.onConnected] Callback function run once connection is established
      */
  constructor (options) {
    //  Set defaults
    this.options = {
      host: options.host || '192.168.1.255',
      controllerOnly: options.controllerOnly || false,
      pollingInterval: options.pollingInterval || 3000,
      debug: options.debug || false,
      onStatus: options.onStatus || function () {},
      onUpdate: options.onUpdate || function () {},
      onSetup: options.onSetup || function () {},
      onConnected: options.onConnected || function () {}
    }

    this.debug = this.options.debug

    /**
         * Controller object
         * @type {object}
         * @property {string} cid - cid (Consistent with mac most of the time)
         * @property {string} uid - uid
         * @property {string} mac - Mac
         * @property {string} name - Name
         * @property {string} address - IP address
         * @property {number} port - Port number
         * @property {boolean} bound - If is already bound
         * @property {string} key - Encryption key
         * @property {object} devices - Includes devices
         */
    this.controller = {}

    // Initialize connection and bind with controller
    this._connectToController(this.options.host)

    // Handle incoming messages
    socket.on('message', (msg, rinfo) => this._handleResponse(msg, rinfo))
  }

  /**
     * Initialize connection
     * @param {string} address - IP/host address
     */
  _connectToController (address) {
    try {
      socket.bind(() => {
        const message = Buffer.from(JSON.stringify({ t: 'scan' }))

        socket.setBroadcast(true)
        socket.send(message, 0, message.length, 7000, address)

        console.log('[UDP] Connected to controller at %s', address)
      })
    } catch (err) {
      const timeout = 60

      console.log('[UDP] Unable to connect (' + err.message + '). Retrying in ' + timeout + 's...')
      setTimeout(() => {
        this._connectToController(address)
      }, timeout * 1000)
    }
  }

  /**
     * Register new controller locally
     * @param {object} message - Received handshake message
     * @param {object} pack - Decrypted pack
     * @param {string} address - IP/host address
     * @param {number} port - Port number
     */
  _setController (message, pack, address, port) {
    this.controller.cid = message.cid
    this.controller.uid = message.uid || 0
    this.controller.mac = pack.mac
    this.controller.name = pack.name
    this.controller.subCnt = pack.subCnt || 0
    this.controller.address = address
    this.controller.port = port
    this.controller.bound = false
    this.controller.devices = {}

    console.log('[UDP] New Controller registered: %s', this.controller.name)
  }

  /**
     * Register new device locally
     * @param {string} mac - Device mac address
     * @param {string} name - Device name
     * @param {boolean} isSubDev - If this device is a sub device
     */
  _setDevice (mac, name, isSubDev = false) {
    const options = {
      mac,
      name,
      isSubDev,
      callbacks: {
        onStatus: this.options.onStatus,
        onUpdate: this.options.onUpdate,
        onSetup: this.options.onSetup
      }
    }

    if(Object.keys(this.controller.devices).includes(mac)) {
      console.log('[UDP] Found a duplicate device: %s %s, skipped.', name, mac)
      return
    }

    this.controller.devices[mac] = new Device(this, options)
    console.log('[UDP] New Device registered: %s', name)
  }

  /**
     * Send binding request to controller
     */
  _sendBindRequest () {
    const pack = {
      mac: this.controller.mac,
      t: 'bind',
      uid: 0
    }
    this._sendRequest(pack, 1)
  }

  /**
     * Confirm controller is bound and update controller status on list
     * @param {string} key - Encryption key
     */
  _confirmBinding (key) {
    this.controller.bound = true
    this.controller.key = key
    console.log('[UDP] Controller %s is bound!', this.controller.name)
  }

  /**
     * Request sub device list
     */
  _requestSubDevices (i = 0) {
    const pack = {
      mac: this.controller.mac,
      i: i,
      t: 'subDev'
    }
    this._sendRequest(pack)
  }

  /**
     * Update device status on list
     * @param {Device} device - Device
     */
  _requestDeviceStatus (device) {
    const pack = {
      cols: Object.keys(cmd).map(key => cmd[key].code),
      mac: device.mac,
      t: 'status'
    }
    this._sendRequest(pack)
  }

  /**
     * Handle UDP response from device
     * @param {string} msg Serialized JSON string with message
     * @param {object} rinfo Additional request information
     * @param {string} rinfo.address IP/host address
     * @param {number} rinfo.port Port number
     */
  _handleResponse (msg, rinfo) {
    const message = JSON.parse(msg + '')

    // Extract encrypted package from message using device key (if available)
    const pack = encryptionService.decrypt(message, (this.controller || {}).key)
    const type = pack.t || ''

    // If package type is response to handshake
    if (type === 'dev') {
      this._setController(message, pack, rinfo.address, rinfo.port)
      this._sendBindRequest()
      return
    }

    // If package type is binding confirmation
    if (type.toLowerCase() === 'bindok') {
      this._confirmBinding(pack.key)
      this.options.onConnected(this.controller)
      if(!this.options.controllerOnly)
        this._setDevice(this.controller.mac, this.controller.name)
      if(this.controller.subCnt>=1)
        this._requestSubDevices()
      return
    }

    // If package type is subDev list
    if (type === 'subList'){
      for(let device of pack.list)
        this._setDevice(device.mac, device.name, true)
      let count = 0
      for(let device of Object.values(this.controller.devices))
        if(device.isSubDev)
          count++
      if(count<this.controller.subCnt)
        this._requestSubDevices(pack.i + 1)
      return
    }

    // If package type is device status
    if (type === 'dat' && this.controller.bound) {
      if(Object.keys(this.controller.devices).includes(pack.mac))
        this.controller.devices[pack.mac]._handleDat(pack)
      else
        console.log('[UDP] Received dat message for unknown device %s: %s, %s', pack.mac, message, pack)
      return
    }

    // If package type is response, update device properties
    if (type === 'res' && this.controller.bound) {
      if(Object.keys(this.controller.devices).includes(pack.mac))
        this.controller.devices[pack.mac]._handleRes(pack)
      else
        console.log('[UDP] Received res message for unknown device %s: %s, %s', pack.mac, message, pack)
      return
    }

    console.log('[UDP] Unknown message of type %s: %s, %s', pack.t, message, pack)
  }

  /**
     * Send request to a bound device
     * @param {object} pack
     * @param {number} i
     */
  _sendRequest (pack, i = 0) {
    const encryptedPack = encryptionService.encrypt(pack, this.controller.key)
    const request = {
      cid: 'app',
      i: i,
      t: 'pack',
      uid: this.controller.uid,
      pack: encryptedPack,
      tcid: this.controller.cid
    }
    const serializedRequest = Buffer.from(JSON.stringify(request))
    socket.send(serializedRequest, 0, serializedRequest.length, this.controller.port, this.controller.address)
  };

};


/**
 * Class representing a single connected device
 */
class Device {
  /**
     * Create device model
     * @param {Controller} [parent] the controller object of this device
     * @param {object} [options] Options
     * @param {string} [options.mac] device mac address
     * @param {string} [options.name] device name
     * @param {boolean} [options.isSubDev] if this device is a sub device
     * @param {object} [options.callbacks] Callback functions
     * @param {function} [options.callbacks.onStatus] Callback function run on each status update
     * @param {function} [options.callbacks.onUpdate] Callback function run after command
     * @param {function} [options.callbacks.onSetup] Callback function run once device is setup
      */
  constructor (parent, options) {

    this.controller = parent
    this.isSubDev = options.isSubDev
    this.pollingInterval = this.controller.options.pollingInterval

    this.mac = options.mac
    this.name = options.name
    this.callbacks = options.callbacks

    this.debug = this.controller.debug

    this.props = {}

    // Start requesting device status on set interval
    setInterval(this.controller._requestDeviceStatus.bind(this.controller, this), this.pollingInterval)

    // Wait props update, then call onSetup
    let waiting;
    (waiting = () => {
      if(Object.keys(this.props).length > 0){
        this.callbacks.onSetup(this)
        return
      }
      setTimeout(waiting.bind(this), 1000)
    })()

  }

  _prepareCallback (changedProps) {
    const res = {}
    for(let key in changedProps){
      let name = Object.keys(cmd).find(k => cmd[k].code === key)
      let state
      if(!name){
        this.debug && console.log("[UDP][Debug][prepareCallback] Unknown Prop Name %s: %s", key, changedProps)
        continue
      }
      if(cmd[name].value)
        state = Object.keys(cmd[name].value).find(k => cmd[name].value[k] === changedProps[key])
      else
        state = changedProps[key]
      res[name] = {value: changedProps[key], state}
      this.debug && console.log("[UDP][Debug][Status Prepare] %s %s: %s -> %s %s", this.name, this.mac, name, state, changedProps[key])
    }
    return res
  }

  /**
     * Handle dat message
     * @param {object} pack
     * @param {string[]} [pack.cols]
     * @param {number[]} [pack.dat]
     */
  _handleDat (pack) {
    const changed = {}
    pack.cols.forEach((col, i) => {
      if(this.props[col] !== pack.dat[i])
        changed[col] = pack.dat[i]
      this.props[col] = pack.dat[i]
    })
    if(Object.keys(changed).length > 0)
      this.callbacks.onStatus(this, this._prepareCallback(changed))
    return
  }

  /**
     * Handle res message
     * @param {object} pack
     * @param {string[]} [pack.opt]
     * @param {number[]} [pack.val]
     */
  _handleRes (pack) {
    const changed = {}
    pack.opt.forEach((opt, i) => {
      changed[opt] = pack.val[i]
      this.props[opt] = pack.val[i]
    })
    this.callbacks.onUpdate(this, this._prepareCallback(changed))
    return
  }

  /**
     * Send commands to a bound device
     * @param {string[]} commands List of commands
     * @param {number[]} values List of values
     */
  _sendCommand (commands = [], values = []) {
    const pack = {
      opt: commands,
      p: values,
      t: 'cmd'
    }
    if(this.isSubDev)
      pack.sub = this.mac
    this.controller._sendRequest(pack)
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
      /**
       * On my device, the return value is fine but the actual temperature does not change.
       * Works normally after swapping unit and value.
       * GOD Knows WHY !!!
       * 
       * [cmd.temperatureUnit.code, cmd.temperature.code],
       * [unit, value]
       */
      [cmd.temperature.code, cmd.temperatureUnit.code],
      [value, unit]
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
  return new Controller(options)
}
