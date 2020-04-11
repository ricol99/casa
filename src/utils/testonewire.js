var w1bus = require('node-w1bus');
var bus = w1bus.create();

var config = bus.getConfig();
console.log("Config", config);

bus.listAllSensors()
.then(function(data){
    console.log(data);
    var dev = data.ids[0];

    bus.isConnected(data.ids[0])
    .then(function(data){
        console.log(data.connected);

        var opt_measureType = "temperature";

        bus.getValueFrom(dev, opt_measureType)
        .then(function(res){
            console.log(res);
        });
    });

});

