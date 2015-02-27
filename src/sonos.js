var util = require('util');
var Sonos = require('sonos');
var search = Sonos.search();

function SonosAction(_config) {
   this.zone = _config.zone;
   this.host = null;

   this.timeout = setTimeout(function() {
      console.log('Zone Not found');
   }, 10000);

   var that = this;

   search.on('DeviceAvailable', function(device, model) {
     device.getZoneAttrs(function(err, attrs) {

        if (attrs.CurrentZoneName == that.zone) {
           that.host = device.host;
           clearTimeout(that.timeout);
           var sonos = new Sonos.Sonos(that.host);

           //sonos.play('https://archive.org/download/testmp3testfile/mpthreetest.mp3', function(err, playing) {
              //console.log([err, playing]);
           //});

           var text = 'House secured for the night';

           //Replace all spaces with a _ because Sonos doesn't support spaces
           text = text.replace(/ /g,'_');

           //For supported languages see www.voicerss.org/api/documentation.aspx
           //This url just redirects to voicerss because of the specific url format for the sonos
           var url = 'http://i872953.iris.fhict.nl/speech/en-gb_' + encodeURIComponent(text)+'.mp3';

           sonos.play(url, function(err, playing) {
             console.log([err, playing]);
           });

        }
     });
   });
}


var player = new SonosAction( { zone: 'Living Room' });
