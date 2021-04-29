# Gree HVAC MQTT bridge

Bridge service for communicating with Gree air conditioners using MQTT broadcasts. It can also be used as a [Hass.io](https://home-assistant.io/) addon.

## Requirements

- NodeJS (>=8.11.0) with NPM
- An MQTT broker and Gree smart HVAC device on the same network
- Docker (for building Hass.io addon)

## Running locally

Make sure you have NodeJS (>=8.11.0) installed and run the following (adjust the arguments to match your setup):

```shell
npm install
node index.js \
    --hvac-host="192.168.1.255" \
    --mqtt-broker-url="mqtt://localhost" \
    --mqtt-topic-prefix="home/greehvac" \
    --mqtt-username="" \
    --mqtt-password=""
```

## Supported commands

MQTT topic scheme:

- `MQTT_TOPIC_PREFIX/COMMAND/get` Get value
- `MQTT_TOPIC_PREFIX/COMMAND/set` Set value

Note: _boolean_ values are set using 0 or 1

| Command | Values | Description |
|-|-|-|
| **temperature** | any integer |In degrees Celsius by default |
| **mode** | _off_, _auto_, _cool_, _heat_, _dry_, _fan_only_|Operation mode |
| **fanspeed** | _auto_, _low_, _mediumLow_, _medium_, _mediumHigh_, _high_ | Fan speed |
| **swinghor** | _default_, _full_, _fixedLeft_, _fixedMidLeft_, _fixedMid_, _fixedMidRight_, _fixedRight_ | Horizontal Swing |
| **swingvert** | _default_, _full_, _fixedTop_, _fixedMidTop_, _fixedMid_, _fixedMidBottom_, _fixedBottom_, _swingBottom_, _swingMidBottom_, _swingMid_, _swingMidTop_, _swingTop_ | Vetical swing |
| **power** | _0_, _1_ | Turn device on/off |
| **health** | _0_, _1_ | Health ("Cold plasma") mode, only for devices equipped with "anion generator", which absorbs dust and kills bacteria |
| **powersave** | _0_, _1_ | Power Saving mode |
| **lights** | _0_, _1_ | Turn on/off device lights |
| **quiet** | _0_, _1_, _2_, _3_ | Quiet modes |
| **blow** | _0_, _1_ | Keeps the fan running for a while after shutting down (also called "X-Fan", only usable in Dry and Cool mode) |
| **air** | _off_, _inside_, _outside_, _mode3_ | Fresh air valve |
| **sleep** | _0_, _1_ | Sleep mode |
| **turbo** | _0_, _1_ | Turbo mode |

## Hass.io addon

The service can be used as a 3rd party addon for the Hass.io [MQTT climate platform](https://home-assistant.io/components/climate.mqtt/), although not all commands are supported.

1. [Install](https://home-assistant.io/hassio/installing_third_party_addons/) the addon
2. Customize addon options (HVAC host, MQTT broker URL, MQTT topic prefix)
3. Add the following to your `configuration.yaml`

```yaml
climate:
  - platform: mqtt

    # Change to whatever you want
    name: Gree HVAC

    # Change MQTT_TOPIC_PREFIX to what you've set in addon options
    current_temperature_topic: "MQTT_TOPIC_PREFIX/temperature/get"
    temperature_command_topic: "MQTT_TOPIC_PREFIX/temperature/set"
    temperature_state_topic: "MQTT_TOPIC_PREFIX/temperature/get"
    mode_state_topic: "MQTT_TOPIC_PREFIX/mode/get"
    mode_command_topic: "MQTT_TOPIC_PREFIX/mode/set"
    fan_mode_state_topic: "MQTT_TOPIC_PREFIX/fanspeed/get"
    fan_mode_command_topic: "MQTT_TOPIC_PREFIX/fanspeed/set"
    swing_mode_state_topic: "MQTT_TOPIC_PREFIX/swingvert/get"
    swing_mode_command_topic: "MQTT_TOPIC_PREFIX/swingvert/set"
    power_state_topic: "MQTT_TOPIC_PREFIX/power/get"
    power_command_topic: "MQTT_TOPIC_PREFIX/power/set"

    # Keep the following as is
    payload_off: 0
    payload_on: 1
    modes:
      - "off"
      - "auto"
      - "cool"
      - "heat"
      - "dry"
      - "fan_only"
    swing_modes:
      - "default"
      - "full"
      - "fixedTop"
      - "fixedMidTop"
      - "fixedMid"
      - "fixedMidBottom"
      - "fixedBottom"
      - "swingBottom"
      - "swingMidBottom"
      - "swingMid"
      - "swingMidTop"
      - "swingTop"
    fan_modes:
      - "auto"
      - "low"
      - "mediumLow"
      - "medium"
      - "mediumHigh"
      - "high"
```

### How to power on/off

Hass.io doesn't supply separate on/off switch. Use the dedicated mode for that.

### Running addon locally

Create an `./data/options.json` file inside the repo with persistent addon configuration.

```shell
docker build \
    --build-arg BUILD_FROM="homeassistant/amd64-base:latest" \
    -t gree-hvac-mqtt-bridge .

docker run --rm -v "$PWD/data":/data gree-hvac-mqtt-bridge
```

### Multiple devices

As of 1.2.0 the Hassio addon supports multiple devices by running paralell NodeJS processes in PM2. Old configurations will work, but are deprecated.

Deprecated config example:

```json
"hvac_host": "192.168.0.255",
"mqtt": {
    "broker_url": "mqtt://localhost",
    "topic_prefix": "/my/topic/prefix",
}
```

Correct config example:

```json
"mqtt": {
    "broker_url": "mqtt://localhost",
},
"devices": [
  {
    "hvac_host": "192.168.0.255",
    "mqtt_topic_prefix": "/home/hvac01"
  },
  {
    "hvac_host": "192.168.0.254",
    "mqtt_topic_prefix": "/home/hvac02"
  }
]
```

## Configuring HVAC WiFi

1. Make sure your HVAC is running in AP mode. You can reset the WiFi config by pressing MODE +WIFI (or MODE + TURBO) on the AC remote for 5s.
2. Connect with the AP wifi network (the SSID name should be a 8-character alfanumeric, e.g. "u34k5l166").
3. Run the following in your UNIX terminal:

```shell
echo -n "{\"psw\": \"YOUR_WIFI_PASSWORD\",\"ssid\": \"YOUR_WIFI_SSID\",\"t\": \"wlan\"}" | nc -cu 192.168.1.1 7000
````
You should get `{"t":"ret","r":200}` if command was succesfull. Then wait a few minutes, AC will connect to WiFi.

Note: This command may vary depending on your OS (e.g. Linux, macOS, CygWin). If facing problems, please consult the appropriate netcat manual. Do not use Termux (Android app), it won't work, you will get `timeout`.

## Changelog

[1.2.2]

- Fix incorrect state checks

[1.2.0]

- Add multiple device support
- Update config with supported architectures
- Fix state being published even if nothing changed

[1.1.2]

- Discovered codes added for Air and Quiet to avoid errors
- Added swingHor mode codes

[1.1.1]

- Add Turbo mode

[1.1.0]

- Add support for MQTT authentication
- BREAKING: Update MQTT mode state names to match Hass.io defaults
- Add support for new modes: Air, Power Save, Lights, Health, Quiet, Sleep, Blow
- Fix deprecated Buffer() use

[1.0.5]

- Add Hass.io API security role

[1.0.4]

- Bump NodeJS version to 8.11.2

[1.0.3]

- Fix power off command

[1.0.2]

- Bump NodeJS version to 8.9.3

[1.0.1]

- Update MQTT version
- Add UDP error handling
- Extend Readme

[1.0.0]
First release

## License

This project is licensed under the GNU GPLv3 - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

- [tomikaa87](https://github.com/tomikaa87) for reverse-engineering the Gree protocol
- [oroce](https://github.com/oroce) for inspiration
