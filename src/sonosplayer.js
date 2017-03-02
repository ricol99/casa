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
   this.alarmUrls = {};
   this.alarmRepeatTimes = {};
   this.alarmVolumes = {};
   this.notifications = {};
   this.inAlarmStatus = false;

   this.props['volume']  = new Property({ name: 'volume', type: 'property', initialValue: 0 }, this);
   this.props['volume-writable']  = new Property({ name: 'volume-writable', type: 'property', initialValue: false }, this);
   this.props['muted']  = new Property({ name: 'muted', type: 'property', initialValue: false }, this);
   this.props['playing']  = new Property({ name: 'playing', type: 'property', initialValue: false }, this);
   this.props['current-track']  = new Property({ name: 'current-track', type: 'property', initialValue: "" }, this);
   this.props['play-mode']  = new Property({ name: 'play-mode', type: 'property', initialValue: "" }, this);

   if (_config.alarmUrl) {
      this.alarmUrls['alarm'] = _config.alarmUrl;
      this.alarmRepeatTimes['alarm'] = _config.alarmRepeatTime;
      this.alarmVolumes['alarm'] = _config.hasOwnProperty("alarmVolume") ? _config.alarmVolume : 60;
      this.props['alarm']  = new Property({ name: 'alarm', type: 'property', initialValue: false }, this);
   }

   if (_config.fireAlarmUrl) {
      this.alarmUrls['fire-alarm'] = _config.fireAlarmUrl;
      this.alarmRepeatTimes['fire-alarm'] = _config.fireAlarmRepeatTime;
      this.alarmVolumes['fire-alarm'] = _config.hasOwnProperty("fireAlarmVolume") ? _config.fireAlarmVolume : 60;
      this.props['fire-alarm']  = new Property({ name: 'fire-alarm', type: 'property', initialValue: false }, this);
   }
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
         process.exit(1);
      }

      this.sonosService.registerForHostForZone(this.zone, function(_err, _device) {

         if (!_err) {
            that.establishPlayerConnection(_device);
         }
      });
   }

   Thing.prototype.coldStart.call(this);
};

SonosPlayer.prototype.establishPlayerConnection = function(_device) {
   var that = this;

   this.props['ACTIVE'].setProperty(true, { sourceName: this.uName });
   this.device = _device;
   this.sonos = new Sonos.Sonos(this.device.host, this.device.port);
   this.localListeningPort = this.sonosService.grabLocalListeningPort();

   // XX TODO Remove hack
   var SonosListener = require('./node_modules/sonos/lib/events/listener');
   this.sonosListener = new SonosListener(this.device, { port: this.localListeningPort });
   this.sonosListener.listen(function(_err, _result) {

      if (_err) {
         console.error(that.uName + ": ***** Unable to start Sonos listener: " + _err);
         process.exit(1);
      }

      that.startSyncingStatus();
   });
};

function internalListener(_owner, _endpoint, _handler) {

   _owner.sonosListener.addService(_endpoint, function(_err, _sid) {

      if (_err) {
         console.error(_owner.uName + ": Unable to sync device status! Error: ", _err);
      }
      else {
         _owner.notifications[_sid] = _handler;
      }
   });
};

SonosPlayer.prototype.startSyncingStatus = function() {
   var that = this;

   var renderingControlListener =  new internalListener(this, '/MediaRenderer/GroupRenderingControl/Event', SonosPlayer.prototype.processRenderControlChange);
   var avTransportControlListener = new internalListener(this, '/MediaRenderer/AVTransport/Control', SonosPlayer.prototype.processAVTransportControlChange);

   this.sonosListener.on('serviceEvent', function(_endpoint, _sid, _data) {
      console.log(that.uName + ": Received notifcation from device. Endpoint="+_endpoint+" Sid="+_sid+" Data=",_data);

      if (that.notifications[_sid]) {
         that.notifications[_sid].call(that, _data);
      }
      else {
         console.error(that.uName + ": Received notification for sid that has no handler. Sid=", _sid);
      }
   });
};

SonosPlayer.prototype.processRenderControlChange = function(_data) {
   console.log(this.uName + ": processRenderControlChange()");
   this.props['volume'].setProperty(_data.GroupVolume, { sourceName: this.uName });
   this.props['muted'].setProperty((_data.GroupMute != 0), { sourceName: this.uName });
   this.props['volume-writable'].setProperty((_data.GroupVolumeChangeable == 0), { sourceName: this.uName });
};

SonosPlayer.prototype.processAVTransportControlChange = function(_data) {
   console.log(this.uName + ": processAVTransportControlChange()");
};

SonosPlayer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   var that = this;

   if (this.sonos) {

      switch (_propName) {
      case "volume": 
         if (this.props['volume-writable'].value) this.setVolume(_propValue);
         break;

      case "muted": 
         this.setMuted(_propValue);
         break;

      case "playing":
         (_propValue) ? this.play() : this.pause();
         break;

      case "current-track":
         this.play(_propValue);
         break;

      case "fire-alarm":
      case "alarm":
         this.alarm(_propName, _propValue);
         break;

      default:
      }
   }
};

SonosPlayer.prototype.setVolume = function(_level) {
   var that = this;

   this.sonos.setVolume(_level, function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to set Volume!");
      }
   });
};

SonosPlayer.prototype.setMuted = function(_muted) {
   var that = this;

   this.sonos.setMuted(_muted, function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to set mute!");
      }
   });
};

SonosPlayer.prototype.pause = function(_level) {
   var that = this;

   this.sonos.pause(_level, function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to pause!");
      }
   });
};

SonosPlayer.prototype.play = function(_url) {
   var that = this;

   if (url) {
      this.sonos.queueNext(_url, function(_err, _playing) {

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

SonosPlayer.prototype.playNext = function(_stopIfFail) {
   var that = this;

   this.sonos.next(function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to play next track!");
      }

      if (!_result && _stopIfFail) {
         that.stop();
      }
   });
};

SonosPlayer.prototype.stop = function() {
   var that = this;

   this.sonos.stop(function(_err, _result) {
      console.log(that.uName + ": Unable to stop music from playing!");
   });
};

SonosPlayer.prototype.saveCurrentState = function(_property) {
   this.savedStatus = { volume: this.props['volume'].value,
                        muted: this.props['muted'].value,
                        playing: this.props['playing'].value };

   if (this.props['muted'].value) {
      this.props['muted'].setProperty(false);
   }

   this.props['volume'].setProperty(this.alarmVolumes[_property]);
};

SonosPlayer.prototype.restoreSavedState = function() {

   if (this.props['volume'].value !== this.savedStatus.volume) {
      this.props['volume'].setProperty(this.savedStatus.volume);
   }

   if (this.props['muted'].value !== this.savedStatus.muted) {
      this.props['muted'].setProperty(this.savedStatus.muted);
   }

   if (this.savedStatus.playing) {
      this.playNext(true);
   }
   else {
      this.stop();
   }
};

SonosPlayer.prototype.alarm = function(_propName, _propValue) {

   if (this.inAlarmStatus === _propValue) {
      return;
   }

   this.inAlarmStatus = _propValue;

   if (_propValue) {
      this.saveCurrentState(_propName);
      this.play(this.alarmUrls[_propName]);
      this.replayAfterTimeout(this.alarmUrls[_propName], this.alarmRepeatTimes[_propName]);
   }
   else {
      clearTimeout(this.repeatTimer);
      this.restoreSavedState();
   }
};

SonosPlayer.prototype.replayAfterTimeout = function(_url, _timeout) {

   this.repeatTimer = setTimeout(function(_this) {

      if (_this.inAlarmStatus) {

         this.sonos.previous(function(_err, _result) {

            if (err) {
               console.log(this.uName + ": Unable to call previous track");
            }
         });

         _this.replayAfterTimeout(_url, _timeout);
      }
   }, _timeout, this);
};

SonosPlayer.prototype.getPlayMode = function(_callback) {
   var endpoint = '/MediaRenderer/AVTransport/Control';
   var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportSettings"'
   var body = '<u:GetTransportSettings xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetTransportSettings>'
   var state = null;
   var responseTag = 'u:GetTransportSettingsResponse'
   return this.sonos.request(endpoint, action, body, responseTag, function (_err, _data) {

      if (_err) {
         _callback(_err);
         return;
      }

      if (JSON.stringify(_data[0].PlayMode) === '["NORMAL"]') {
         state = 'normal';
      } else if (JSON.stringify(_data[0].PlayMode) === '["REPEAT_ALL"]') {
         state = 'repeat_all';
      } else if (JSON.stringify(_data[0].PlayMode) === '["SHUFFLE"]') {
         state = 'shuffle';
      } else if (JSON.stringify(_data[0].PlayMode) === '["SHUFFLE_NOREPEAT"]') {
         state = 'shuffle_norepeat';
      } else if (JSON.stringify(_data[0].PlayMode) === '["NO_MEDIA_PRESENT"]') {
         state = 'no_media';
      }

      return _callback(_err, state);
  });
};

module.exports = exports = SonosPlayer;
