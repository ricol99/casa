var util = require('util');
var Thing = require('./thing');
var limb = require('limb')
var S = require('string');

function PeerCasa(_name, _displayName, _address, _casa, _owner, _props) {
   this.address = _address;
   this.casa = _casa;
   this.connected = false;
   
   Thing.call(this, 'peer-casa:' + _name, _displayName, _owner, _props);
   var that = this;

   this.casa.on('casa-joined', function(name, socket) {
      
      if (name == S(that.name).strip('peer-')) {
        console.log(that.name + ': I am connected to my peer. Socket: ' + socket);

        if (that.connected == false) {
           that.connected = true;
           that.emit('casa-joined', name, socket);

           socket.on('state-active', function(data) {
              stateName = data.stateName;
           });

           socket.on('state-inactive', function(data) {
              stateName = data.stateName;
           });
        }
      }
   });

   this.casa.on('casa-lost', function(name) {
      if (name == S(that.name).strip('peer-')) {
        console.log(that.name + ': I have lost my peer!');

        if (that.connected == true) {
           that.connected = false;
           that.emit('casa-lost', name);
        }
      }
   });
}

util.inherits(PeerCasa, Thing);

PeerCasa.prototype.getHostname = function() {
   return this.address.hostname;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

module.exports = exports = PeerCasa;

