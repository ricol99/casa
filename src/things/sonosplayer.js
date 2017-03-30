var util = require('util');
var Thing = require('../thing');
var Sonos = require('sonos');

function SonosPlayer(_config) {
   Thing.call(this, _config);

   this.zone = _config.zone;
   this.host = _config.host;
   this.port = _config.port;
   this.alarmUrls = {};
   this.alarmRepeatTimes = {};
   this.alarmVolumes = {};
   this.inAlarmStatus = false;
   this.devices = [];

   this.ensurePropertyExists('volume', 'property', { initialValue: 0 });
   this.ensurePropertyExists('volume-writable', 'property', { initialValue: 0 });
   this.ensurePropertyExists('muted', 'property', { initialValue: false });
   this.ensurePropertyExists('playing', 'property', { initialValue: false });
   this.ensurePropertyExists('current-track', 'property', { initialValue: "" });
   this.ensurePropertyExists('play-mode', 'property', { initialValue: "" });

   if (_config.alarmUrl) {
      this.alarmUrls['alarm'] = _config.alarmUrl;
      this.alarmRepeatTimes['alarm'] = _config.alarmRepeatTime;
      this.alarmVolumes['alarm'] = _config.hasOwnProperty("alarmVolume") ? _config.alarmVolume : 60;
      this.ensurePropertyExists('alarm', 'property', { initialValue: false });
   }

   if (_config.fireAlarmUrl) {
      this.alarmUrls['fire-alarm'] = _config.fireAlarmUrl;
      this.alarmRepeatTimes['fire-alarm'] = _config.fireAlarmRepeatTime;
      this.alarmVolumes['fire-alarm'] = _config.hasOwnProperty("fireAlarmVolume") ? _config.fireAlarmVolume : 60;
      this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false });
   }
}

util.inherits(SonosPlayer, Thing);

SonosPlayer.prototype.coldStart = function() {
   var that = this;

   if (this.host) {
      this.createDevice({ host: this.host, port: this.port });
      this.sonos = this.devices[0].sonos;
   }
   else {
      this.sonosService = this.casaSys.findService("sonosservice");

      if (!this.sonosService) {
         console.error(this.uName + ": ***** Sonos service not found! *************");
         process.exit(1);
      }

      this.sonosService.registerForHostForZone(this.zone, function(_err, _device) {

         if (!_err) {
            that.createDevice(_device);
         }
      });
   }

   Thing.prototype.coldStart.call(this);
};

SonosPlayer.prototype.createDevice = function(_device) {
   this.devices.push(new SonosDevice(this, _device));

   if (this.devices.length == 1) {
      this.props['ACTIVE'].set(true, { sourceName: this.uName, coldStart: true });
   }
};

function SonosDevice(_player, _device) {
   var that = this;

   this.notifications = {};
   this.player = _player;
   this.device = _device;
   this.sonos = new Sonos.Sonos(this.device.host, this.device.port);
   this.localListeningPort = this.player.sonosService.grabLocalListeningPort();

   // XX TODO Remove hack
   var SonosListener = require('../node_modules/sonos/lib/events/listener');
   this.sonosListener = new SonosListener(this.device, { port: this.localListeningPort });
   this.sonosListener.listen(function(_err, _result) {

      if (_err) {
         console.error(that.uName + ": ***** Unable to start Sonos listener: " + _err);
         process.exit(1);
      }

      that.startSyncingStatus();
   });
}

function InternalListener(_owner, _endpoint, _handler) {

   _owner.sonosListener.addService(_endpoint, function(_err, _sid) {

      if (_err) {
         console.error(_owner.uName + ": Unable to sync device status! Error: ", _err);
      }
      else {
         _owner.notifications[_sid] = _handler;
      }
   });
};

SonosDevice.prototype.startSyncingStatus = function() {
   var that = this;

   var groupRenderingControlListener =  new InternalListener(this, '/MediaRenderer/GroupRenderingControl/Event', SonosPlayer.prototype.processGroupRenderControlChange);
   var renderingControlListener =  new InternalListener(this, '/MediaRenderer/RenderingControl/Event', SonosPlayer.prototype.processRenderControlChange);
   var avTransportListener = new InternalListener(this, '/MediaRenderer/AVTransport/Event', SonosPlayer.prototype.processAVTransportChange);
   var devicePropertiesListener = new InternalListener(this, '/DeviceProperties/Event', SonosPlayer.prototype.processDevicePropertiesChange);

   this.sonosListener.on('serviceEvent', function(_endpoint, _sid, _data) {
      console.log(that.uName + ": Received notifcation from device.");

      if (that.notifications[_sid]) {
         that.notifications[_sid].call(that.player, _data);
      }
      else {
         console.error(that.uName + ": Received notification for sid that has no handler. Sid=", _sid);
      }
   });
};

SonosPlayer.prototype.processRenderControlChange = function(_data) {
   console.log(this.uName + ": processRenderControlChange() data=",_data);

};

SonosPlayer.prototype.processGroupRenderControlChange = function(_data) {
   console.log(this.uName + ": processGroupRenderControlChange()", _data);
   this.updateProperty('volume', _data.GroupVolume, { sourceName: this.uName }, true);
   this.updateProperty('volume-writable', (_data.GroupVolumeChangeable != 0), { sourceName: this.uName }, true);
   this.updateProperty('muted', (_data.GroupMute != 0), { sourceName: this.uName }, true);
};

SonosPlayer.prototype.processAVTransportChange = function(_data) {
   console.log(this.uName + ": processAVTransportChange() data=",_data);
};

SonosPlayer.prototype.processDevicePropertiesChange = function(_data) {
   console.log(this.uName + ": processDevicePropertiesChange() data=",_data);

   switch (_data.LastChangedPlayState) {
      case 'PLAYING':
         this.updateProperty('playing', true, { sourceName: this.uName }, true);
         break;
      case 'PAUSED_PLAYBACK':
         this.updateProperty('playing', false, { sourceName: this.uName }, true);
         break;
      default:
         console.log(this.uName + ": Playstate not processed, state="+_data.LastChangedPlayState);
         break;
   }
};

SonosPlayer.prototype.updateProperty = function(_propName, _propValue, _data, _receivedFromDevice) {
   var that = this;

   if (this.sonos && !_receivedFromDevice) {

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

   Thing.prototype.updateProperty.call(this, _propName, _propValue, _data);
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

SonosPlayer.prototype.pause = function() {
   var that = this;

   this.sonos.pause(function(_err, _result) {

      if (_err) {
         console.log(that.uName + ": Unable to pause!");
      }
   });
};

SonosPlayer.prototype.play = function(_url) {
   var that = this;

   if (_url) {
      that.sonos.play(_url, function(_err, _result) {

         if (_err) {
            console.log(that.uName + ": Unable to play "+_url+"!");
         }
      });
   }
   else {
      that.sonos.play(function(_err, _result) {

         if (_err) {
            console.log(that.uName + ": Unable to play!");
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
      this.props['muted'].set(false, { sourceName: this.uName });
   }

   this.props['volume'].set(this.alarmVolumes[_property], { sourceName: this.uName });
};

SonosPlayer.prototype.restoreSavedState = function() {

   if (this.props['volume'].value !== this.savedStatus.volume) {
      this.props['volume'].set(this.savedStatus.volume, { sourceName: this.uName });
   }

   if (this.props['muted'].value !== this.savedStatus.muted) {
      this.props['muted'].set(this.savedStatus.muted, { sourceName: this.uName });
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

         _this.sonos.play(_url, function(_err, _result) {

            if (_err) {
               console.log(_this.uName + ": Unable to replay alarm sound");
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
