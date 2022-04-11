const mqtt = require('mqtt')
const client  = mqtt.connect('mqtt://pi-4')

client.on('connect', function () {
  client.subscribe('zigbee2mqtt/0x8cf681fffe1fef3a', function (_err, _granted) {
     console.log(_err);
     console.log(_granted);
  });

  client.on('message', function (topic, message) {
    // message is Buffer
    console.log(message.toString())
  })
})
