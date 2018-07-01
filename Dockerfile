FROM homeassistant/amd64-base:latest

ENV LANG C.UTF-8

RUN apk add --no-cache jq nodejs nodejs-npm && \
npm set unsafe-perm true

# Copy data for add-on
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . .
RUN chmod +x run.sh

RUN npm install

#CMD [ "./run.sh" ]
ENTRYPOINT ./run.sh
