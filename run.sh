#!/bin/sh
set -e

CONFIG_PATH=/data/options.json

HVAC_HOST=$(jq --raw-output ".hvac_host" $CONFIG_PATH)
MQTT_BROKER_URL=$(jq --raw-output ".mqtt.broker_url" $CONFIG_PATH)
MQTT_TOPIC_PREFIX=$(jq --raw-output ".mqtt.topic_prefix" $CONFIG_PATH)

npm install
node index.js \
    --hvac-host="${HVAC_HOST}" \
    --mqtt-broker-url="${MQTT_BROKER_URL}" \
    --mqtt-topic-prefix="${MQTT_TOPIC_PREFIX}"