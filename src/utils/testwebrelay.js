// client.js
const WebSocket = require('ws');

const ws = new WebSocket('wss://my.webhookrelay.com/v1/socket');

var apiKey = "1a73dea2-9dbc-4ece-83eb-df3ef1de847e";
var apiSecret = "prDhLpQCpDxf";

ws.on('open', function open() {
  // on connection, send our authentication request
  ws.send(JSON.stringify({action: 'auth', key: apiKey, secret: apiSecret}));  
});

ws.on('close', function close() {
  console.log('disconnected');
});

ws.on('message', function incoming(data) {
  console.log(data)
  var msg = JSON.parse(data);

  if (msg.type === 'status' && msg.status === 'authenticated') {
    // if we got authentication confirmation, send subscribe event to the server
    ws.send(JSON.stringify({action: 'subscribe', buckets: ['Casa','Casa-Test']}));
    console.log("Ready");
  }
  else {
     console.log(msg);
     console.log(msg.body);
  }
});
