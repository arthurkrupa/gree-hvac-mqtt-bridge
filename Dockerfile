ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --no-cache jq nodejs nodejs-npm && \
npm set unsafe-perm true

# Copy data for add-on
WORKDIR /usr/src/app
COPY . .
RUN chmod +x run.sh

CMD [ "./run.sh" ]
