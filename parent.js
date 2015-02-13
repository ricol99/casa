var util = require('util');
var Thing = require('./thing');
var limb = require('limb')

function Parent(_name, _displayName, _parentHostname, _parentPort, _childPort, _props) {
   this.displayName = _displayName;
   this.hostname = _parentHostname;
   this.port = _parentPort;
   this.childPort = _childPort;
   

   Thing.call(this, 'user:' + _name, _props);
   var that = this;
   limb.listen(7000)
  
   limb.on('client', function(client) {
     // do stuff with newly client 
     console.log('New client id=' + client.id + ', name=' + client.data.name);
   })
 
   limb.on('drop', function(client) {
     // do stuff with dropped client 
     console.log('Drppoed client id=' + client.id + ', name=' + client.data.name);
   })

}

util.inherits(Parent, Thing);

Parent.prototype.getHostname = function() {
   return this.hostname;
};

Parent.prototype.getPort = function() {
   return this.port;
};

module.exports = exports = Parent;

