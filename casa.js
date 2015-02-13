var util = require('util');
var Thing = require('./thing');
var limb = require('limb')

function Casa(_name, _displayName, _listeningPort, _owner, _props) {
   this.listeningPort = _listeningPort;
   Thing.call(this, 'casa:' + _name, _displayName, _owner, _props);
   var that = this;

   limb.listen(this.listeningPort)
 
   limb.on('client', function(client) {
     // do stuff with newly client
     console.log('New client id=' + client.id + ', name=' + client.data.name);
     that.emit('casa-joined', client.data.name);
   })

   limb.on('drop', function(client) {
     // do stuff with dropped client
     console.log('Dropped client id=' + client.id + ', name=' + client.data.name);
     that.emit('casa-lost', client.data.name);
   })

}

util.inherits(Casa, Thing);

module.exports = exports = Casa;

