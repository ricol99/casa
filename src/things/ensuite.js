var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement - true when there is movement detected (room.js)
// low-light - true when light levels are low enough to switch on lights (room.js)
// bedroom - bedroom adjoined to the ensuite
// room-switch-event - room entrance switch

// Resulting ensuite-state
// no-users-present-awake - no users present and no users are worried about lighting or noise
// users-present-awake - users present but no users are worried about lighting or noise
// no-users-present-asleep - no users present but users are worried about lighting or noise
// users-present-asleep - users present and users are worried about lighting or noise

function Ensuite(_config) {
   Room.call(this, _config);

   this.bedroomName = _config.bedroom;

   this.ensurePropertyExists('user-sensitivity-state', 'combinestateproperty', { name: "user-sensitivity-state", type: "combinestateproperty", separator: "-", 
                                                                                 sources: [{ property: "users-present-state" },
                                                                                           { uName: this.bedroomName, property: "users-sensitive",
                                                                                             transformMap: { false: "normal", true: "sensitive" }}] }, _config);
}

util.inherits(Ensuite, Room);

module.exports = exports = Ensuite;
