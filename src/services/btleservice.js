var util = require('util');
var Service = require('../service');
const BeaconScanner = require('node-beacon-scanner');
 
function BtleService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.advertisementPresenceTimeout = _config.hasOwnProperty("advertisementPresenceTimeout") ? _config.advertisementPresenceTimeout : 20;

   this.advertisementTypes = {
      "device": "btledevice",
      "ibeacon": "btleibeacon"
   };

   this.scanFieldList = {};
   this.scanFieldListLength = 0;
   this.scanner = new BeaconScanner();
}

util.inherits(BtleService, Service);

function AdvertisementMatcher(_owner, _serviceNode, _matchString) {
   this.owner = _owner;
   this.serviceNode = _serviceNode;
   this.match = _match;
   this.present = false;
   this.timeout = null;
}

AdvertisementWatcher.prototype.clearTimeout = function() {
   console.log(this.owner.owner.uName + ": Timer cleared for BTLE advertisement " + this.owner.field + "=" + this.match);
   clearTimeout(this.timeout);
};

AdvertisementWatcher.prototype.resetTimeout = function() {
   clearTimeout(this.timeout);

   this.timeout = setTimeout( () => {
      console.log(this.owner.owner.uName + ": Advertisement lost " + this.owner.field + "=" + this.match);
      this.present = false;
      this.serviceNode.advertisementLost(this.owner.field, this.match);
   }, this.owner.owner.advertisementPresenceTimeout * 1000);
};

AdvertisementWatcher.prototype.processAdvert = function(_advert) {

   if (!this.present) {
      console.log(this.owner.owner.uName + ": Advertisement found " + this.owner.field + "=" + this.match);
      this.present = true;
      this.serviceNode.advertisementFound(this.field, this.match);
   }

   this.resetTimeout();
};

function ScanField(_owner, _field) {
   this.owner = _owner;
   this.field = _field;
   this.matchFields = {};
   this.noOfadvertisementWatchers = 0;
}

Scanfield.prototype.addAdvertisementWatcher = function(_serviceNode, _match) {
   var matchField = this.createMatchField(_match);
   var matchString = this.createMatchString(_match);

   if (this.matchFields.hasOwnProperty(matchField)) {

      if (this.matchFields[matchField].hasOwnProperty(matchString)) {
         this.matchFields[matchField][matchString].push(new AdvertisementWatcher(this, _serviceNode, _match);
      }
      else {
          this.matchFields[matchField][matchString] = [ new AdvertisementWatcher(this, _serviceNode, _match) ];
      }
   }
   else {
      this.matchfields[matchField] = {};
      this.matchfields[matchField][matchString] = [ new AdvertisementWatcher(this, _serviceNode, _match) ];
   }

   this.noOfadvertisementWatchers = this.noOfadvertisementWatchers + 1;
};

Scanfield.prototype.removeAdvertisementWatcher = function(_serviceNode, _match) {
   var matchField = this.createMatchField(_match);
   var matchString = this.createMatchString(_match);

   if (this.matchFields.hasOwnProperty(matchField)) {

      if (!this.matchFields[matchField].hasOwnProperty(matchString)) {
         return false;
      }

      for (var i = 0; i < this.matchFields[matchField][matchString].length; ++i) {

         if (this.matchFields[matchField][matchString][i].serviceNode === _serviceNode) {
            this.matchFields[matchField][matchString].splice(i, 1);

            if (this.matchFields[matchField][matchString].length === 0) {
               delete this.matchFields[matchField][matchString];
            }

            this.noOfadvertisementWatchers = this.noOfadvertisementWatchers - 1;
            return true;
         }
      }
   }

   return false;
};

ScanField.prototype.processAdvert = function(_advert) {

   if (_advert.hasOwnProperty(this.field)) {

      if (typeof _advert[this.field] === "object") {

         for (var matchField in this.matchFields) {
            var matchFields = matchField.split("@@@");
            var obj = {};
            var match = true;

            for (var i = 0; i < matchFields.length; ++i) {

               if (_advert[this.field].hasOwnProperty(matchFields[i])) {
                  obj[matchFields[i]] = _advert[this.field][matchFields[i]];
               }
               else {
                  match = false;
                  break;
               }
            }

            if (match) {
               var matchString = this.createMatchString(obj)

               if (this.matchFields[matchField].hasOwnProperty(matchString)) {

                  for (var i = 0; i < this.matchfields[matchField][matchString].length; ++i) {
                     this.matchFields[matchField][matchString][i].processAdvert(_advert);
                  }
               }
            }
         }
      }
      else if (this.matchfields.hasOwmProperty(_advert[this.field]) && this.matchfields[_advert[this.field]].hasOwnProperty(_advert[this.field])) {

         for (var i = 0; i < this.matchfields[_advert[this.field]][_advert[this.field]].length; ++i) {
            this.matchFields[_advert[this.field]][_advert[this.field]][i].processAdvert(_advert);
         }
      }
   }
};

ScanField.prototype.createMatchField = function(_match) {

   if (typeof _match === "string") {
      return _match;
   }

   if (typeof _match === 'object') {
      var str = "";

      for (var member in _match) {

         if (_match.hasOwnProperty(member)) {
            str.concat(member + "@@@");
         }
      }

      return str.slice(0, -3);
   }

   return String(_match);
};

ScanField.prototype.createMatchString = function(_match) {

   if (typeof _match === "string") {
      return _match;
   }

   if (typeof _match === 'object') {
      var str = "";

      for (var member in _match) {

         if (_match.hasOwnProperty(member)) {
            str.concat(member + ":" + _match[member] + "@@@");
         }
      }

      return str.slice(0, -3);
   }

   return String(_match);
};

BtleService.prototype.coldStart = function() {

   this.scanner.onadvertisement = (_advert) => {

      for (var field in this.scanFieldList) {
         this.scanFieldList[field].processAdvert(_advert);
      }
    };
};

BtleService.prototype.addAdvertisementToScan = function(_serviceNode, _field, _match, _interval) {
   console.log(this.uName + ": Requested to scan for bluetooth advertisement with field=" + _field + " and match=" + _match);
   var newlyCreated = false;

   if (!this.scanFieldList.hasOwnProperty(_field)) {
      this.scanFieldList[_field] = new ScanField(this, _field);
      this.scanFieldListLength = this.scanFieldListLength + 1;
      newlyCreated = true;
   }

   this.scanFieldList[_field].addAdvertisementWatcher(_serviceNode, _match);

   if ((this.scanFieldListLength === 1) && newlyCreated) {
 
      // Start scanning
      this.scanner.startScan().then(() => {
         console.log(this.uName + ": Starting to scan for bluetooth LE advertisements");
      }).catch((_error) => {
        console.error(this.uName + ": An error has occurred while trying to start scanning: " + _error);
      });
   }

   return true;
};

BtleService.prototype.removeAdvertisementFromScan = function(_serviceNode, _field, _match) {
   console.log(this.uName + ": Requested to stop scanning for bluetooth advertisement with field=" + _field + " and match=" + _match);

   if (!this.scanFieldList.hasOwnProperty(_field)) {
      return false;
   }

   this.scanFieldList[_field].removeAdvertisementWatcher(_serviceNode, _match);

   if (this.scanFieldList[_field].noOfAdvertismentWatchers === 0) {
      delete this.scanFieldList[_field];
      this.scanFieldListLength = this.scanFieldListLength - 1;
   }

   if (this.scanFieldListLength === 0) {
      // Stop scanning
      this.scanner.stopScan();
      console.log(this.uName + ": Stopped scanning for bluetooth LE advertisements");
   }

   return true;
};

BtleService.prototype.scanOnce = function(_duration, _callback) {

   if (this.tempScanning) {
      _callback("Currently scanning for another client");
      return;
   }
   else {
      this.tempScanning = true;
   }

   var scanDuration = _duration ? _duration : 10;
   var tempScanner = new BeaconScanner();

   tempScanner.onadvertisement = (_advert) => {
      clearTimeout(this.scanOnceTimeout);
      tempScanner.stopScan();
      this.tempScanning = false;
      _callback(null, _advert);
   };

   tempScanner.startScan().then(() => {

      this.scanOnceTimeout = setTimeout( () => {
         tempScanner.stopScan();
         this.tempScanning = false;
         _callback(null, []);
      }, scanDuration * 1000);

   }).catch((_error) => {
      this.tempScanning = false;
      _callback("Unable to start scan. Error: " + _error);
   });
};

module.exports = exports = BtleService;
