# Cooper&Hunter HVAC MQTT bridge

Bridge service for communicating with Cooper&Hunter(Ch-s09ftn-e2wf) Nordic evo 2 series air conditioners using MQTT broadcasts. It can also be used as a [Hass.io](https://home-assistant.io/) addon.

## Original app
- [https://play.google.com/store/apps/details?id=net.conditioner.web]

## Original Docs 
- [http://cooperandhunter.com/ua/nordic_evo_two_instruction.pdf]

## Requirements

- NodeJS (>=8.9.3) with NPM
- An MQTT broker and Cooper&Hunter smart HVAC device on the same network
- Docker (for building Hass.io addon)

## Running locally

Make sure you have NodeJS (>=8.9.3) installed and run the following (adjust the arguments to match your setup):

```shell
npm install
node index.js \
    --hvac-host="192.168.107.49" \
    --mqtt-broker-url="mqtt://localhost" \
    --mqtt-topic-prefix="home/greehvac"
```

## Hass.io addon

The service can be used as a 3rd party addon for the Hass.io [MQTT climate platform](https://home-assistant.io/components/climate.mqtt/).

1. [Install](https://home-assistant.io/hassio/installing_third_party_addons/) the addon
2. Customize addon options (HVAC host, MQTT broker URL, MQTT topic prefix)
3. Add the following to your `configuration.yaml`

```yaml
climate:
  - platform: mqtt

    # Change to whatever you want
    name: Cooper&Hunter HVAC

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
      - none
      - auto
      - cool
      - dry
      - fan
      - heat
    swing_modes:
      - default
      - full
      - fixedTop
      - fixedMidTop
      - fixedMid
      - fixedMidBottom
      - fixedBottom
      - swingBottom
      - swingMidBottom
      - swingMid
      - swingMidTop
      - swingTop
    fan_modes:
      - auto
      - low
      - mediumLow
      - medium
      - mediumHigh
      - high
```

### How to power on/off

Hass.io doesn't supply an on/off switch. As a workaround, switch mode to "NONE" to power off or any other to power on.

### Running addon locally

Create an `./data/options.json` file inside the repo with persistent addon configuration.

```shell
docker build \
    --build-arg BUILD_FROM="homeassistant/amd64-base:latest" \
    -t gree-hvac-mqtt-bridge .

docker run --rm -v "$PWD/data":/data gree-hvac-mqtt-bridge
```

## Configuring HVAC WiFi

1. Make sure your HVAC is running in AP mode. You can reset the WiFi config by pressing WIFI on the AC remote for 5s.
2. Connect with the AP wifi network (the SSID name should e.g. "SMART_083X"), the passwork should be 88888888.


## Changelog

[1.0.1] - Initial Cooper&Hunter support. Work just reading info: mode, indoor temp.


This project is licensed under the GNU GPLv3 - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

- [tomikaa87](https://github.com/tomikaa87) for reverse-engineering the Gree protocol
- [oroce](https://github.com/oroce) for inspiration
