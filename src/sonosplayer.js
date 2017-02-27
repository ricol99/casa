var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');
var Property = require('./property');
var Sonos = require('sonos');

function SonosPlayer(_config) {
   Thing.call(this, _config);

   this.casaSys = CasaSystem.mainInstance();
   this.zone = _config.zone;
   this.host = _config.host;

   this.props['volume']  = new Property({ name: 'volume', type: 'property', initialValue: 0 }, this);
   this.props['playing']  = new Property({ name: 'playing', type: 'property', initialValue: false }, this);
   this.props['current-track']  = new Property({ name: 'current-track', type: 'property', initialValue: "" }, this);
}

util.inherits(SonosPlayer, Thing);

SonosPlayer.prototype.coldStart = function() {
   var that = this;

   if (this.host) {
      this.sonos = new Sonos.Sonos(this.host);
      this.props['ACTIVE'].setProperty(true, { sourceName: this.uName, coldStart: true });
   }
   else {
      this.sonosService = this.casaSys.findService("sonosservice");

      if (!this.sonosService) {
         console.error(this.uName + ": ***** Sonos service not found! *************");
         process.exit();
      }

      this.sonosService.registerForHostForZone(this.zone, function(_err, _host) {

         if (!_err) {
            that.props['ACTIVE'].setProperty(true, { sourceName: that.uName });
            that.host = _host;
            that.sonos = new Sonos.Sonos(that.host);
         }
      });
   }

   Thing.prototype.coldStart.call(this);
};

SonosPlayer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   var that = this;

   if (this.sonos) {

      switch (_propName) {
      case "volume": 
         setVolume(this, _propValue);
         break;

      case "playing":

         if (_propValue) {
            play(_this);
         }
         else {
            pause(_this);
         }
         break;

      case "current-track":
         play(this, _propValue);
         break;

      default:
      }
   }
};

function setVolume(_this, _level) {
   var that = _this;

   _this.sonos.setVolume(_level, function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to set Volume!");
      }
   });
};

function pause(_this, _level) {
   var that = _this;

   _this.sonos.pause(_level, function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to pause!");
      }
   });
};

function play(_this, _url) {
   var that = _this;

   if (url) {
      _this.sonos.queueNext(_url, function(_err, _playing) {

         if (_err) {
            console.log(that.uName + ": Unable to queue next track!");
         }
         else {
            that.sonos.next(function(_err, _result) {

               if (_err) {
                  console.log(that.uName + ": Unable to play next track!");
               }
            });
         }
      });
   }
   else {
      that.sonos.play(function(_err, _result) {

         if (_err) {
            console.log(that.uName + ": Unable to play next track!");
         }
      });
   }
};

module.exports = exports = SonosPlayer;
