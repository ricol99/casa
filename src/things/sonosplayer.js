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

   this.ensurePropertyExists('volume', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('volume-writable', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('muted', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('playing', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('current-track', 'property', { initialValue: "" }, _config);
   this.ensurePropertyExists('play-mode', 'property', { initialValue: "" }, _config);

   if (_config.alarmUrl) {
      this.alarmUrls['alarm'] = _config.alarmUrl;
      this.alarmRepeatTimes['alarm'] = _config.alarmRepeatTime;
      this.alarmVolumes['alarm'] = _config.hasOwnProperty("alarmVolume") ? _config.alarmVolume : 60;
      this.ensurePropertyExists('alarm', 'property', { initialValue: false }, _config);
   }

   if (_config.fireAlarmUrl) {
      this.alarmUrls['fire-alarm'] = _config.fireAlarmUrl;
      this.alarmRepeatTimes['fire-alarm'] = _config.fireAlarmRepeatTime;
      this.alarmVolumes['fire-alarm'] = _config.hasOwnProperty("fireAlarmVolume") ? _config.fireAlarmVolume : 60;
      this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false }, _config);
   }
}

util.inherits(SonosPlayer, Thing);

SonosPlayer.prototype.coldStart = function() {

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

      this.sonosService.registerForHostForZone(this.zone, (_err, _device) => {

         if (!_err) {
            this.createDevice(_device);
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
   this.uName = _player.uName + ":" + _device.host;
   this.notifications = {};
   this.player = _player;
   this.device = _device;
   this.sonos = new Sonos.Sonos(this.device.host, this.device.port);
   this.localListeningPort = this.player.sonosService.grabLocalListeningPort();

   // XX TODO Remove hack
   this.createListener();
}

SonosDevice.prototype.createListener = function() {
   var SonosListener = require('../node_modules/sonos/lib/events/listener');

   try {
      this.sonosListener = new SonosListener(this.device, { port: this.localListeningPort });

      this.sonosListener.listen( (_err, _result) => {

         if (_err) {
            console.error(this.uName + ": ***** Unable to start Sonos listener: " + _err);
            process.exit(1);
         }

         this.startSyncingStatus();
      });
   }
   catch (_err) {
      console.error(this.uName + ": Caught exception " + _err + " from Sonos listener, restarting in 5 seconds...");

      setTimeout(function(_this) {
         console.error(_this.uName + ": Restarting Sonos listener");
         _this.createListener();
      }, 5000, this);
   }
};

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
   var groupRenderingControlListener =  new InternalListener(this, '/MediaRenderer/GroupRenderingControl/Event', SonosPlayer.prototype.processGroupRenderControlChange);
   var renderingControlListener =  new InternalListener(this, '/MediaRenderer/RenderingControl/Event', SonosPlayer.prototype.processRenderControlChange);
   var avTransportListener = new InternalListener(this, '/MediaRenderer/AVTransport/Event', SonosPlayer.prototype.processAVTransportChange);
   var devicePropertiesListener = new InternalListener(this, '/DeviceProperties/Event', SonosPlayer.prototype.processDevicePropertiesChange);

   this.sonosListener.on('serviceEvent', (_endpoint, _sid, _data) => {
      console.log(this.uName + ": Received notifcation from device.");

      if (this.notifications[_sid]) {
         this.notifications[_sid].call(this.player, _data);
      }
      else {
         console.error(this.uName + ": Received notification for sid that has no handler. Sid=", _sid);
      }
   });
};

SonosPlayer.prototype.processRenderControlChange = function(_data) {
   console.log(this.uName + ": processRenderControlChange() data=",_data);

};

SonosPlayer.prototype.processGroupRenderControlChange = function(_data) {
   console.log(this.uName + ": processGroupRenderControlChange()", _data);
   this.alignPropertyValue('volume', _data.GroupVolume);
   this.alignPropertyValue('volume-writable', (_data.GroupVolumeChangeable != 0));
   this.alignPropertyValue('muted', (_data.GroupMute != 0));
};

SonosPlayer.prototype.processAVTransportChange = function(_data) {
   console.log(this.uName + ": processAVTransportChange() data=",_data);
};

SonosPlayer.prototype.processDevicePropertiesChange = function(_data) {
   console.log(this.uName + ": processDevicePropertiesChange() data=",_data);

   switch (_data.LastChangedPlayState) {
      case 'PLAYING':
         this.alignPropertyValue('playing', true);
         break;
      case 'PAUSED_PLAYBACK':
         this.alignPropertyValue('playing', false);
         break;
      default:
         console.log(this.uName + ": Playstate not processed, state="+_data.LastChangedPlayState);
         break;
   }
};

SonosPlayer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (this.sonos && _data.alignWithParent) {

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

   this.sonos.setVolume(_level, (_err, _result) => {

      if (_err) {
         console.log(this.uName + ": Unable to set Volume!");
      }
   });
};

SonosPlayer.prototype.setMuted = function(_muted) {

   this.sonos.setMuted(_muted, (_err, _result) => {

      if (_err) {
         console.log(this.uName + ": Unable to set mute!");
      }
   });
};

SonosPlayer.prototype.pause = function() {

   this.sonos.pause( (_err, _result) => {

      if (_err) {
         console.log(this.uName + ": Unable to pause!");
      }
   });
};

SonosPlayer.prototype.play = function(_url) {

   if (_url) {
      this.sonos.play(_url, (_err, _result) => {

         if (_err) {
            console.log(this.uName + ": Unable to play "+_url+"!");
         }
      });
   }
   else {
      this.sonos.play( (_err, _result) => {

         if (_err) {
            console.log(this.uName + ": Unable to play!");
         }
      });
   }
};

SonosPlayer.prototype.playNext = function(_stopIfFail) {

   this.sonos.next( (_err, _result) => {

      if (_err) {
         console.log(this.uName + ": Unable to play next track!");
      }

      if (!_result && _stopIfFail) {
         this.stop();
      }
   });
};

SonosPlayer.prototype.stop = function() {

   this.sonos.stop( (_err, _result) => {
      console.log(this.uName + ": Unable to stop music from playing!");
   });
};

SonosPlayer.prototype.saveCurrentState = function(_property) {
   this.savedStatus = { volume: this.props['volume'].value,
                        muted: this.props['muted'].value,
                        playing: this.props['playing'].value };

   if (this.getProperty("muted")) {
      this.alignPropertyValue("muted", false);
   }

   this.alignPropertyValue("volume", this.alarmVolumes[_property]);
};

SonosPlayer.prototype.restoreSavedState = function() {

   if (this.props['volume'].value !== this.savedStatus.volume) {
      this.alignPropertyValue("volume", this.savedStatus.volume);
   }

   if (this.props['muted'].value !== this.savedStatus.muted) {
      this.alignPropertyValue("muted", this.savedStatus.muted);
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
