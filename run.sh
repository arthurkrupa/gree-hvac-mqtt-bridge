#!/bin/sh
set -e

CONFIG_PATH=/data/options.json

HVAC_HOST=$(jq -r ".hvac_host" $CONFIG_PATH)
MQTT_BROKER_URL=$(jq -r ".mqtt.broker_url" $CONFIG_PATH)
MQTT_TOPIC_PREFIX=$(jq -r ".mqtt.topic_prefix" $CONFIG_PATH)
MQTT_USERNAME=$(jq -r ".mqtt.username" $CONFIG_PATH)
MQTT_PASSWORD=$(jq -r ".mqtt.password" $CONFIG_PATH)
MQTT_RETAIN=$(jq -r ".mqtt.retain" $CONFIG_PATH)
if [ "$MQTT_RETAIN" = null ]; then
  MQTT_RETAIN=false
fi

echo "MQTT_RETAIN: ${MQTT_RETAIN}"
npm install

INSTANCES=$(jq '.devices | length' $CONFIG_PATH)

if [ "$INSTANCES" -gt 1 ]; then
	for i in $(seq 0 $(($INSTANCES - 1))); do
		HVAC_HOST=$(jq -r ".devices[$i].hvac_host" $CONFIG_PATH);
		MQTT_TOPIC_PREFIX=$(jq -r ".devices[$i].mqtt_topic_prefix" $CONFIG_PATH);
		if [[ $HVAC_HOST = null ]]; then echo "[ERROR] Missing hvac_host for device $i. Skipping." && continue; fi
		if [[ $MQTT_TOPIC_PREFIX = null ]]; then echo "[ERROR] Missing mqtt_topic_prefix for device $i. Skipping." && continue; fi
		echo "Running instance $i for $HVAC_HOST"
		npx pm2 start index.js --silent -m --merge-logs --name="HVAC_${i}" -- \
			--hvac-host="${HVAC_HOST}" \
			--mqtt-broker-url="${MQTT_BROKER_URL}" \
			--mqtt-topic-prefix="${MQTT_TOPIC_PREFIX}" \
			--mqtt-username="${MQTT_USERNAME}" \
			--mqtt-password="${MQTT_PASSWORD}" \
			--mqtt-retain="${MQTT_RETAIN}"
	done
	npx pm2 logs /HVAC_/
else
	HVAC_HOST=$(jq -r ".devices[0].hvac_host" $CONFIG_PATH);
	MQTT_TOPIC_PREFIX=$(jq -r ".devices[0].mqtt_topic_prefix" $CONFIG_PATH);
	echo "Running single instance for $HVAC_HOST"
	#echo "${HVAC_HOST}, ${MQTT_BROKER_URL}, ${MQTT_TOPIC_PREFIX}, ${MQTT_USERNAME}, ${MQTT_PASSWORD}"
	/usr/bin/node index.js \
		--hvac-host="${HVAC_HOST}" \
		--mqtt-broker-url="${MQTT_BROKER_URL}" \
		--mqtt-topic-prefix="${MQTT_TOPIC_PREFIX}" \
		--mqtt-username="${MQTT_USERNAME}" \
		--mqtt-password="${MQTT_PASSWORD}" \
		--mqtt-retain="${MQTT_RETAIN}"
fi
