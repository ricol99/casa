# Casa Configuration Authoring Guide — v0.3

Runtime reference: Casa device repository at `1200b041dc3ebf81c2d369f1d66892aeeb1b8faa`. Unified deployment model reference: schema `0.1`.

The v0.2 device review is by **Casa Codex**. This revision adds composition guidance and the Thing catalogue by **Hannah**, 25 November 2026.

Repository edition updated by Casa Codex on 26 November 2026 from Hannah’s [v0.3 Drive guide](https://drive.google.com/file/d/1cSkNKQ-7aVjjxeGhPNJ04sRiQf_M9_69/view). This copy incorporates the later generic scene and manual-control interface changes. The Drive document is not modified by this repository update.

This revision builds on [Casa Codex’s v0.2 review draft](https://drive.google.com/file/d/1-gra6rUCZ9B7LEzeyNoB96e1qWWVZLrc/view). Use the device revision above when evaluating runtime behaviour and adapter availability.

**Evidence labels:** “implemented” describes inspected source; “verified” describes an executed check listed in section 9; “model convention” describes the separate management/export format. Hardware adapters are inventoried, not certified against attached devices. Fields without a documented default below must be supplied or checked against the named adapter; absence is not a promise of validation.

Device-fix update by **Casa Codex (device software only)**, 25 November 2026: incorporates fixes 1–5 committed and pushed in `5388f0c`, fixes 6–10 in `e9ba6e9`, fixes 11–12 in `c296910`, and the zero-duration timeout action change in `a7aec20`. Hannah’s v0.3 composition guidance and Thing catalogue are retained. The subsequent device MCP and manual console-command update is committed and pushed in `eb4d2a5` (25 November 2026). Casa Codex remains responsible for device software only; Casa Cloud Codex covers cloud software.

Scene update by **Casa Codex (device software only)**, 25 November 2026: scene/counting fixes are committed and pushed in `c1b93c5`; the building scene MCP tools, paired APIs and console commands are committed and pushed in `61852e2`.

## Start here

This guide has two uses. Use the authoring sections to write Casa runtime configuration. Use the export section to turn existing deployment files into the unified, read-only model. For a new config, first define the outcome, identify the gang, choose the Things and their hosts, resolve the input and output names, and then write the tests. For an export, first establish which files are deployed and read them in place. Keep any generated artefact separate from the deployment inputs.

**Start with the behaviour the occupant should experience.** Most of the design lives in small state machines that respond to sensor inputs and can compete for control. Normal operation should work from context. Scenes and manual overrides give occupants a way to express an intention when needed.

## 1. The site, runtime and namespace

| Concept | Meaning in Casa |
| --- | --- |
| Site or gang | A gang is the runtime namespace and peer group. A deployment can use a gang as its site boundary. Inside a gang, `:` is the root. |
| Casa and Pi | A Casa is a named runtime instance. A Pi is one possible host for it. A Casa sits directly under the gang root, for example `:casa-demo`. Record physical deployment constraints separately from the logical address. |
| Thing | A logical object. It can represent a device, a concept such as occupancy, or a compound such as a room. It owns properties, events and child Things. |
| Service | An integration that runs under the Casa hosting it. It manages external protocol and device I/O and exposes mirror properties and events to Things. A Thing can have placements on several Casas. A Service that requires particular hardware stays with the Casa that can reach that hardware. |
| Property and event | A property holds a typed value and can be invalid or cold. An event signals an occurrence. A state-machine property holds its current state name as a value. |

### Addresses, ownership and placement

Use a single leading colon for absolute addresses. A room declared at the gang root is `:training-room`, its child is `:training-room:lamp`, and a hosted Service could be `:casa-demo:hue`. A listener specifies the owning Thing's `uName` and the `property` or `event` it wants. A property or state listener can omit `uName` when it refers to its own Thing. For a cross-gang reference specify `gang` as well. Example:

```json
{
  "gang": "gang-workshop",
  "uName": ":workshop",
  "property": "occupied"
}
```

Within a gang, Casa peers share eligible sources over the LAN. Between gangs, listeners subscribe to selected properties or events through the configured transport, such as Pusher. A reference to a global Thing keeps its logical address when a different Casa supplies the live instance. Preserve the configured host and source priority for each declaration. Verify the live source from runtime observations when it matters.

**Locality and propagation are separate.** A directly gang-owned or Casa-owned Thing is non-local by default in this runtime. The latter is a constructor-level top Thing even though its address includes the Casa. A Thing nested within another Thing defaults to local. A declaration can set `local` explicitly. The constructor rejects a non-local Thing directly owned by a local Thing. A local child can contribute to a compound Thing's exposed behaviour through propagation. Its presence in a configuration export has no effect on what peers receive.

### Compound Things and propagation

Use the `things` array to express ownership. Use listeners to express dependencies across the tree. For example, a room can own its lamp and subscribe to a separate building Thing. A child lamp can also read an explicit source on the room. That wiring is useful when the relationship should be obvious in the configuration.

- `propagateToParent` and `propagateToChildren` specify outgoing directions. `ignoreParent` and `ignoreChildren` describe what the Thing ignores. Things enable both outgoing directions by default and ignore neither. Review the settings at the property or event as well as the owning Thing, since a member can have explicit propagation settings.
- `propagation` and `ignorePropagation` are shorthand. Their direction mapping is `public` and `both` for both directions, `private` for neither, `parent` for parent only, and `children` or `protected` for children only. Use the explicit directional flags when intent matters. Keep the exact runtime spelling `propagateToChildren`.
- During inheritance, a Thing can acquire a property of the same name from an ancestor or descendant. An existing declaration at the receiving Thing takes precedence over creating an inherited property. An inherited `stateproperty` with `globalPriority: true` can preserve state names and priorities. Check who is meant to act on the state on each Thing.
- Use a global compound Thing as the surface peers observe. A sensor child can contribute `movement` or a well-named event to it. Check the actual member name and propagation settings at each boundary rather than assuming the child's address is directly visible to peers.

### When to compound a Thing

**Compound Things that form one unit of behaviour. Link Things that coordinate and have an independent life.**

A building and its rooms should usually be **peers at the gang root**. Give each room a `building` reference to the building Thing. This is the deployed design Richard uses. It keeps room addresses short and stable, makes room placement independent, and gives both the room and building a deliberate shared interface. Treat this as the default authoring pattern. A site can still describe its floor plan separately from the runtime ownership tree.

| Use a child Thing when | Use a separate root Thing and a reference when |
| --- | --- |
| The child implements part of the parent's behaviour and can normally share its Casa placement. A room-owned light or a private touch switch fits here. | The object needs its own placement, fallback, or a gang-visible address. A room, a building, or a sensor hosted on a different Casa may fit here. |
| The parent should publish the few properties or events that peers need. A sensor child can contribute movement through its room. | Other compounds reuse the object's output, and the object should expose that output independently. A building's night-time signal is shared across rooms. |
| The child needs its own control boundary but still belongs to the compound. Two locally controlled lights can each arbitrate their own actions. | The relationship describes coordination or physical location. Sharing the same floor plan or building address does not by itself require runtime ownership. |

Before nesting, ask where the child can actually run, which Things need to observe it, and whose state machines own its outputs. Prefer a short tree with explicit references where the objects only exchange context. A Service remains under the Casa that hosts it even when a Thing can be placed elsewhere. Check that a child still has access to the required Service on each intended placement.

#### Worked example: two rooms and a shared building

The three entries in `gang.things` are siblings. `:lounge` and `:study` each refer to `:example-building`. The paths `:lounge:light` and `:study:light` express ownership by their respective rooms and default to local. Each light follows its room's occupancy state in this synthetic example. The building's `low-light` value is shared with both rooms. A real site can combine that input with occupancy in its lighting state machines and bind the lights to the appropriate Service.

```json
{
  "casa": {
    "name": "casa-config-guide",
    "type": "casa",
    "listeningPort": 50997,
    "services": [],
    "scenes": [],
    "things": []
  },
  "gang": {
    "name": "gang-composition-guide",
    "things": [
      {
        "name": "example-building",
        "type": "building",
        "users": [],
        "scenes": [],
        "properties": [
          {
            "name": "daylight",
            "valueType": "boolean",
            "initialValue": true
          },
          {
            "name": "low-light",
            "valueType": "boolean",
            "initialValue": false
          }
        ]
      },
      {
        "name": "lounge",
        "type": "room",
        "building": ":example-building",
        "users": [],
        "properties": [
          {
            "name": "movement",
            "valueType": "boolean",
            "initialValue": false
          }
        ],
        "things": [
          {
            "name": "light",
            "type": "lightgroup",
            "properties": [
              {
                "name": "power",
                "valueType": "boolean",
                "initialValue": false,
                "propagation": "private",
                "source": {
                  "uName": ":lounge",
                  "property": "users-present-state",
                  "transformMap": {
                    "no-users-present": false,
                    "users-present": true
                  },
                  "valueType": "boolean"
                }
              }
            ]
          }
        ]
      },
      {
        "name": "study",
        "type": "room",
        "building": ":example-building",
        "users": [],
        "properties": [
          {
            "name": "movement",
            "valueType": "boolean",
            "initialValue": false
          }
        ],
        "things": [
          {
            "name": "light",
            "type": "lightgroup",
            "properties": [
              {
                "name": "power",
                "valueType": "boolean",
                "initialValue": false,
                "propagation": "private",
                "source": {
                  "uName": ":study",
                  "property": "users-present-state",
                  "transformMap": {
                    "no-users-present": false,
                    "users-present": true
                  },
                  "valueType": "boolean"
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Build a companion gang config named `gang-composition-guide` in the disposable test environment described in section 6. The verification case changed the building's `low-light` and observed that value on both rooms. It then drove movement in each room in turn and observed only the corresponding light turn on. The two room observations from the building change were grouped in a `simultaneous` block.

### Thing type reference

Use the exact `type` shown. An **interface** lists the members most useful to a config author. Custom declarations and options can add or override members, so use the configured Thing's exposed properties and events when wiring a specific site. The catalogue covers the generic `thing` and all 52 entries shipped in the pinned device Thing directory. It identifies base types, protocol helpers and experimental entries so an AI can choose an appropriate configuration type. Hardware integrations require the site's actual devices and supported bindings.

#### General, building and room Things

| Type | Purpose | Configure and connect |
| --- | --- | --- |
| `thing` | General-purpose logical or compound object. | Declare `properties`, `events`, optional child `things`, and the desired locality and propagation. Start here for custom behaviour built from state machines. |
| `location` | Represents a place and tracks named users present there. | Supply `users` entries with `uName`s and optional latitude/longitude. Provides `<user>-present` and the configured location properties. |
| `building` | Supplies building-wide occupancy, time-of-day context and scenes. | Supply `users` (an empty array is valid for a synthetic example), daylight and any shared inputs the rooms expect. Optional `scenes` and evening/bedtime schedules. Key interfaces include `dark`, `night-time`, `users-state`, `SCENE` and `alarm-state`. Declare `low-light` when rooms should follow that value. |
| `room` | Combines room occupancy, time of day, scenes and overrides. | Set `building` to the building Thing's address and supply `movement`. Use `movementTimeout` or `movementTimeouts` for occupancy hold time. Key interfaces include `day-state`, `users-present-state`, `room-state`, `BUILDING-SCENE` and `room-switch-event`. |
| `bedroom` | Extends room behaviour with occupied bed, bedtime, sleep and waking context. | Use the building and room inputs plus the relevant `users`; reading and awake hold times can be set separately. Provides bed and user-state properties and wake-up/bedtime events. |
| `car` | Represents occupancy of a car and can relate it to named locations. | Provide `users` and optionally `locations`. Supply the real inputs that indicate users aboard. Exposes `occupied`, per-user aboard properties and location-specific occupancy properties when configured. |
| `agent` | Legacy rule dispatcher based on an event property and source mapping. | Uses `eventProp` and `sourceMap` in its intended configuration. In this revision it cannot be loaded from the standard Thing directory. Use `stateproperty` on a `thing` for new logic. |

#### Lighting, controls and media

| Type | Purpose | Configure and connect |
| --- | --- | --- |
| `lightgroup` | Generic light group with typed local controls. | Provides `power`, optional brightness and colour members, and `scene`. Wire these values to the appropriate children or an integration explicitly. The synthetic example uses it without hardware. |
| `huelight` | Represents one Hue light. | Set `deviceId` and provide a reachable Hue Service. Uses `power`, optional `brightness`, and device-dependent colour properties. Verify whether the configuration expects reported state as well as writes. |
| `huelightgroup` | Represents a group on a Hue bridge. | Select the bridge group with `lightGroupId` and an available Hue Service. Exposes power, brightness, supported colour controls and a scene selector. |
| `hueroom` | Represents a Hue bridge room as a group. | Uses `hueRoomName` for the Hue group label and the supported Hue group configuration and outputs. Use a separate Casa `room` when occupancy and room state machines are needed. |
| `lightwaverfaccessory` | Represents a LightwaveRF device or mood-controlled group. | Use the deployed Service and device or room identifiers. Provides `power`, optional `brightness`, and `mood` when using configured moods. |
| `kasaplug` | Represents an individual Kasa plug. | Set the deployed `host` and optional `port` or `alias`. Requires a reachable Kasa Service and exposes `power`. |
| `touchswitch` | Converts a GPIO touch input into a switch intent or event, with optional feedback and hold behaviour. | Bind `gpioTouchPin` on the hosting Casa. Choose stateful `switchProp` or stateless `eventName`. Optional feedback uses `gpioFeedbackPin`. Configure hold and debounce only where needed. |
| `sonoszone` | Represents playback and controls for a Sonos zone. | Name the `zone` and provide a reachable Sonos Service. Key interfaces include `playing`, `volume`, `muted`, playlist/track and play mode. |
| `hifi` | Hi-fi shelf control model that derives lighting colour from amplifier temperature. | Supply the temperature and colour limits appropriate to the installation. Interfaces include `power-amp-temperature`, `shelf-hue` and `shelf-saturation`. Wire actual inputs and actuators separately. |
| `sevensegmentdisplay` | Four-digit display model with brightness and an optional clock presentation. | Configure its role and bind display outputs to hardware separately. Exposes `brightness`, `digit-0` through `digit-3`, decimal points, `colon` and clock controls. |

#### Scheduling, weather and presence

| Type | Purpose | Configure and connect |
| --- | --- | --- |
| `clock` | Publishes date and time components at the chosen resolution. | Configure `resolution` and optional events. Exposes seconds, minutes, hours, day, month and year according to the clock configuration. |
| `scheduler` | Raises named events at configured times. | Supply `events` and a Schedule Service. Listeners can use the resulting event and optional value. |
| `alarm` | Scheduled alarm or reminder gated by its `ACTIVE` property. | Supply scheduled `events` and a Schedule Service. Use the security-specific types below for security system state. |
| `currentweather` | Supplies weather observations for a location. | Supply the location and Weather Service. Interfaces include temperature, feels-like temperature, wind, humidity, precipitation and UV index. |
| `last24hoursweather` | Weather Service view using the previous 24-hour period. | Uses the same location and weather property interface as `currentweather`, with a different observation period. |
| `lastweekweather` | Weather Service view using the previous week. | Uses the same location and weather property interface as `currentweather`, with a weekly observation period. |
| `simoutdoorlightsensor` | Estimates outdoor light using a schedule, location and cloud cover. | Provide position, optional `cloud-cover` input and a Schedule Service. Read `light-level` as simulated. Use the built-in schedule for this revision. |
| `btledevice` | Represents availability of a BLE device by address. | Set `macAddress` through private site config and use the BLE Service. Exposes `available`. |
| `btleeddybeacon` | Represents availability of an Eddystone beacon. | Supply the beacon's namespace/instance or configured advertisement identifiers and a BLE Service. Exposes `available`. |
| `btleibeacon` | Represents availability of an iBeacon. | Provide `uuid` and the relevant major/minor identifiers and a BLE Service. Exposes `available`. |
| `btlenearbydevice` | Represents nearby-device availability via the BLE Service. | Set the deployed `macAddress` and the BLE Service. Subscribe to `available`. |
| `btnearbydevice` | Checks nearby-device availability via the Bluetooth Service. | Set `macAddress`, optional `interval` and the Bluetooth Service. Exposes `available` and `interval`. |
| `broadbandspeedtester` | Runs a broadband speed measurement and publishes the result. | Uses an external speed test. Specify relevant timing and use the deployed trigger pattern. Exposes `download-speed`, `upload-speed`, `ping-time` and `test-result`. |

#### HomeKit representations

These Things expose selected Casa behaviour through the HomeKit integration. Place them where the configured integration can serve them and wire their members to the authoritative Casa Things.

| Type | Purpose | Configure and connect |
| --- | --- | --- |
| `hkaccessory` | Common HomeKit accessory settings used by the specialised types. | Supplies shared metadata, Service selection and manual mode options. Choose a specialised accessory for an actual device interface. Keep pairing values in private config. |
| `hkswitchaccessory` | Exposes a retained on/off switch or a stateless press. | Choose `stateless`, optional `switchProp` or `eventName`, and the intended manual-mode behaviour. |
| `hklightaccessory` | Exposes a light to HomeKit. | Select `powerProp` and supported brightness, hue, saturation or colour temperature features as applicable. Connect those members to the corresponding Casa lighting controls. |
| `hklightsensoraccessory` | Exposes a light-level sensor reading. | Bind the numeric `light-level` to the intended source. |
| `hktempsensoraccessory` | Exposes a temperature sensor reading. | Bind the numeric `temperature` to the chosen sensor. |
| `hkspeakeraccessory` | Exposes speaker mute and optionally volume. | Wire `muted` and optional `volume` to the device and set `volumeSupported` where appropriate. |
| `hkgaragedooropeneraccessory` | Represents garage door target, observed state and obstruction in HomeKit. | Use the existing supervised access integration. Interfaces include `target-state`, `current-state` and `obstruction-detected`. Verify observed state separately. |
| `hkhumidifierdehumidifieraccessory` | Represents humidity-control equipment in HomeKit. | Bind humidity and equipment state to the real device. Interfaces include `current-relative-humidity`, `active-state`, `target-state`, `current-state` and `water-level`. |
| `hksecuritysystem` | Mirrors a Casa security system's state into HomeKit. | Use the installed system's approved bindings for `current-state`, `target-state`, fault and tamper. Review the intended manual-mode interaction. |

#### Hardware, security, and other integrations

| Type | Purpose | Configure and connect |
| --- | --- | --- |
| `access` | Coordinates a door or gate's movement, access state, faults and configured control requests. | Use site-verified sensors and actuator bindings. Configuration covers opening/closing timeouts and optional simulation. Interfaces include `target`, `access-state`, movement state and outputs for the connected mechanism. |
| `housealarm` | Runs a home security state model and coordinates configured sentries. | Provide `sentries`, `mainSentry` and the site's `armModes`. Exposes `current-state`, `target-state` and fault reporting. Use existing approved site definitions as the basis for any changes. |
| `housealarmsensor` | Expresses whether a configured security sensor is currently active. | Bind the sensor input and choose `activeTimeout` for its hold behaviour. Exposes `active` and `active-state`. |
| `housealarmwiredsensor` | Interprets readings from a supervised wired security sensor. | Bind the deployed analogue reading and the panel's approved circuit parameters. Exposes `sensor-state`, activity, fault and tamper. Verify applicable input states in isolation. |
| `alarmtexecom` | Integrates an installed Texecom alarm panel. | Use the site's authorised panel connection and credentials from private config. Exposes current/target state and individual alarm, fault and connection properties. |
| `securityspycamera` | Represents a camera managed through SecuritySpy. | Use its configured `id`, Service and optional `triggerSource`. Interfaces include capture modes and actions. |
| `ipcamera` | Experimental ONVIF camera network demo. | Its endpoint and listener are fixed by the demo. It has no general site-level device configuration contract. Use an established camera integration for a new config. |
| `contactidprotocol` | Helper that handles Contact ID protocol messages. | Invoked by an integration that needs the protocol. It has no standalone Thing configuration contract. |
| `siaprotocol` | Helper that handles SIA protocol message framing and parsing. | Invoked by an integration that needs the protocol. It has no standalone Thing configuration contract. |
| `sumppump` | Models sump level, pump behaviour and monitoring. | Use the deployed level input, configured `levels` and approved pump bindings. Inspect `sump-level-state`, `pump-state` and watchdog outcomes. |
| `mcpspiadcchannel` | Exposes an MCP SPI ADC input channel. | Set `channelId`, the intended polling interval and an MCP SPI ADC Service. Key members are `reading` and `interval`. |
| `widgetlordchannel` | Exposes an input from a Widgetlords hardware channel. | Set `channelId` and provide the Widgetlords Service. Key members include `reading` and `interval`. |
| `onewirethermometer` | Exposes a temperature reading from a one-wire sensor. | Set `deviceId`, optional `pollDuration` and provide the one-wire Service on the connected Casa. Read `temperature`. |
| `mqtttopic` | Represents a single MQTT topic as Casa properties. | Set `topic` and declare the property list with the expected member names and types. The members use the MQTT Property wrapper and require an MQTT Service. |

The test-only types `tester` and `testthing` use `loadPath: "test/things"`. `tester` injects inputs and checks the resulting property/event sequence. `testthing` is a minimal synthetic Thing used to exercise configured action handlers.

## 2. Files the Casa loader consumes

Use JSON or JSON5 accepted by `src/utils/createdb.js`. Deployable source files can have a `casa` section, a `gang` section, or both, subject to the loader's existing format.

| Source location | Typical contents |
| --- | --- |
| Standalone `gang` file | Gang metadata, shared Users and service definitions, plus any shared Thing declarations. |
| `casa` section on a Casa file | Casa identity and settings. `services`, `scenes`, `things` and possibly `users` belong to that Casa's configuration. A Casa-scoped Thing starts under that Casa's address. |
| `gang` section on a Casa file | Gang association and this Casa's declarations in the shared namespace. `gang.things` supplies Things with addresses directly under `:`, even though this file tells one Casa to host them. |
| Top-level arrays such as `casaThings` and `gangThings` | Legacy forms the DB builder accepts for its supported collections. Where both forms are accepted, the builder selects the top-level array first. Follow the relevant Casa-file or standalone-gang branch of `createdb.js`. |

Without an explicit gang association, the database builder can create a gang named after the Casa with `-gang` appended. An inherited gang Service can run on each applicable Casa that lacks a same-named local declaration. Record where each definition comes from.

A Casa loads database files produced by `createdb.js`. The console can inspect and transfer configuration databases. The unified export later in this guide is a management representation with its own schema. Use separately authored runtime configs for the database builder.

### Builder and loader rules that affect reconstruction

The builder branches on the presence of `casa`. In that branch it persists Casa metadata (`name`, `type`, `displayName`, `location`, `listeningPort`) and the Casa/Gang collection arrays. An embedded `gang` selects its name and this Casa's `gangThings`, `gangServices`, `gangScenes`; it does **not** create the standalone gang DB merely because that section is present. Supply the companion gang file. Automatic gang DB creation applies when there is no gang association at all.

A standalone gang file persists `name`, `type`, `displayName`, `organisation`, `discoverable`, `publicDiscoverable`, `allowedSubscriberGangs`, `parentCasa` and its Users/Services/Scenes/Things collections. Metadata fields outside these builder lists are not automatically persisted. Top-level collection arrays take precedence over nested arrays, including an explicitly empty top-level array.

When the loader combines a per-Casa gang collection with a standalone gang collection, a same-named Thing or Service can gain missing properties by name. The existing destination properties take precedence. The merge covers properties only. Check the loaded result when using overlapping definitions, especially where children, events, priority or scenes matter.

Casa adds inherited Services where a Casa has no same-named Service. It also supplies system Services for messaging, discovery, databases, scheduling and event logging. A normal node also gets the console API and ramp Services, plus its main WebService. In the unified export, record automatic Services as generated runtime entries. Avoid naming a shared Service after a system Service.

`name`, `type`, `displayName` and `loadPath` describe a named child. When `type` is absent, the collection's base type is used. `NamedObject.require()` resolves a specialised type from `properties/`, `events/`, `things/`, etc.; `loadPath` replaces that default (for example `test/things`). These are executable JavaScript modules, not a closed declarative schema. Only use trusted reviewed types and paths. Absolute names are resolved through existing tree ownership; relative child names are usually clearer. Two different declarations at one owner/name are not two independent identities.

Startup uses `src/app.js`, not the legacy package `main` entry. `--config <dir>` chooses the runtime DB directory; `createdb.js` has no equivalent directory flag and defaults to `~/.casa-keys/secure-config`. The isolated runner in section 6 redirects the builder in its own process. It does not repurpose HOME or touch deployed DBs. `--nopeer` disables same-gang peer connections, not all network activity: discovery and the web server need separate isolation for a network-free test. Hot-state loading is distinct from a cold start and consumes the matching hot-state file from the selected config directory.


## 3. Properties and events

A Thing's property names depend on its type and configuration. `power` is common on a light, but an arbitrary Thing can declare another name. Read the deployed declarations, the Thing constructor and the resolved runtime tree to learn the actual interface. Classes such as `room` and `huelight` use `ensurePropertyExists` to add defaults. For example, `room` normally provides `day-state`, `users-present-state`, `room-state` and `BUILDING-SCENE`. `huelight` adds `power` and usually `brightness`, with other controls depending on device flags and configuration.

For a plain property, omit `type` or use `"type": "property"`. Declare `name`, `valueType` and an `initialValue` when you know the starting value. The base types are `boolean`, `number` and `string`. `writable` defaults true in the base class. Computed subclasses often set it false. `source` attaches one listener and `sources` attaches several. Use one form. The base property defaults `allSourcesRequiredForValidity` to true and `ignoreInvalid` to false. Some subclasses set different rules. Where an input can disappear, decide what should become invalid and what has a justifiable fallback. Treat validity and the last reported value as separate facts.

| Listener field | Purpose |
| --- | --- |
| `uName`, `gang` | Resolve the source Thing locally or in a named remote gang. `uName` is the Thing address. |
| `property` or `event` | Subscribe to one named member. A property provides state and can already match at entry. An event acts when raised. |
| `value`, `invert` | Match an expected value, with optional inversion in contexts that support it. Prefer explicit values where a machine needs two transitions from one property. |
| `transform`, `transformMap` | Transform incoming values in the appropriate listener or property configuration. Validate the resulting type and use simple mappings where possible. |
| `maskInvalidValue`, `maskInvalidTimeout` | SourceListener fallback controls. Use only with an explicit expected behaviour for loss and recovery. |
| `priority` | Listener-specific ordering where the property class uses it. Check the class. The direction differs from state-machine and Thing-instance priority in `topvalidproperty`. |

A plain event goes in `events` with a `name` and optional source and propagation settings. Add a named event before a state machine raises or listens for it. Specialised events are implemented under `src/events/`, including `scheduleevent`, `confirmevent`, `pushoverevent`, `serviceevent`, `smeeevent` and `whrelayevent`. `servicenodeevent` is part of the service mirror framework.

### Property types in this revision

Start with `property`, `stateproperty`, `combinestateproperty` and `serviceproperty`. The specialised modules below are available in the device tree. Read the matching constructor and a deployed example before using one in a new config, especially for defaults, timing units, supported payloads and runtime dependencies.

| Property type | What it does |
| --- | --- |
| `property` | Holds or follows a typed value. The base implementation also provides transformation, validity and propagation. |
| `stateproperty` | Named states, transitions, actions and priorities. Use it for normal behaviour, scenes and overrides. |
| `combinestateproperty` | Builds a combined state string from several property values and resolves that string through the normal state matcher. `separator` defaults to `:`. |
| `modeproperty` | Builds a resting mode and mutually exclusive alternatives with active and duration controls. |
| `modelproperty` | Builds a companion `<name>-model` state machine using `modelStates` and `modelInitialState`. Subclasses can translate its actions into property outputs. |
| `andproperty`, `orproperty`, `xorproperty`, `invertproperty` | Compute Boolean results; `invertproperty` also negates numbers. Review source validity. The pinned XOR implementation checks whether at least one but not all inputs are true, so use two-input XOR or test the intended multi-input rule. |
| `topproperty`, `topvalidproperty` | Choose among sources. The former selects the first valid source in configured order using the full listener key. The latter prefers the valid listener with the smallest numeric source priority. |
| `evalproperty` | Computes an output from inputs with its configured `expression`. Use expressions from trusted, reviewed configuration. |
| `confirmproperty`, `counterproperty` | Confirm repeated inputs within a configured window, or count received updates. `confirmproperty` now consistently uses its confirmation buffer. Review reset, polarity and uniqueness behaviour for the intended case. |
| `debounceproperty`, `delayproperty`, `latchproperty` | Filter short input changes, delay propagation, or hold a Boolean output for a minimum period. |
| `edgeproperty`, `eventproperty` | Map leading or trailing changes to configured output values, or raise an event from a value or `eventMap`. |
| `lineartransformproperty`, `quantiseproperty` | Scale a value between ranges, or map a numeric input to labelled bands. |
| `rollingaverageproperty`, `smootherproperty`, `thresholdproperty` | Average samples, limit change rate or gate numeric updates around threshold crossings. |
| `scheduleproperty` | Publishes scheduled values using the schedule service and its configured events. |
| `serviceproperty` | Bridge from a Thing to a service-owned mirror property. Configure the target integration, entity, member and data direction. |
| `gpioproperty`, `onewireproperty`, `mcpspiadcproperty` | Service-backed adapters for GPIO, one-wire and an MCP SPI ADC channel. The ADC name refers to hardware. |
| `i2cbusproperty`, `i2cproperty`, `spiproperty` | Hardware-specific bus and channel readers. Use a verified board and its deployed parameters. |
| `mqttproperty`, `pusherproperty`, `smeeproperty`, `whrelayproperty` | Integration-specific bridges for MQTT, Pusher, Smee and Webhook Relay. The pinned MQTT wrapper sets `sync` to `readwrite`. Check wrapper defaults before assuming the direction. |
| `pushoverproperty` | Outbound notification binding using the configured Pushover Service and addressing. |
| `devicepresentproperty`, `cameraproperty` | Device presence and camera integration properties. Inspect the corresponding adapter and the site's permitted scope. |

### Base member and listener reference

| Field | Default / precise meaning |
| --- | --- |
| Property `valueType` | Required unless supplied by the subclass: `boolean`, `number`, `string`. Constructor diagnostics are not a comprehensive schema validator. |
| `initialValue` | Presence sets the initial-value flag, including `false`/`0`. No value is invented when omitted. Cold start publishes a declared initial value; it is not a proof that external input is valid. |
| `writable` | Base property `true`; many calculated subclasses force `false`. Internal setters can still update these properties: this flag is not an access-control boundary. |
| `local` | Base property/event `false`, independent of the owning Thing's locality. Peering/filtering also considers ownership and source locality. |
| `cold` | Property defaults `true`; listeners are cold until a source value is known. Events start cold and clear this during cold start. |
| `allSourcesRequiredForValidity` | Base property `true`: all listeners must be valid. `false`: any valid listener suffices. No listeners is valid when validity is evaluated. |
| `ignoreInvalid` | Base property `false`; `true` bypasses the validity aggregation, not the physical loss of the input. |
| `generateNewTransaction` | Optional; if truthy a property update starts a transaction on its owner. Otherwise normal owner transaction handling applies. |
| `transform`, `transformMap` | Property/listener transforms use `$value`; expression then map. A map replaces only entries it contains. Expressions execute JavaScript in the runtime: do not accept arbitrary untrusted text. |
| `source` / `sources` | Singular replaces the plural array in the base constructor. Choose one. `uName` normally defaults to the owning Thing during source creation. |
| Listener `property` / `event` | Choose one exact name. Missing both enables an internal mirror/all-event path locally; it is not the supported cross-gang subscription form. |
| Listener `value`, `invert` | Filter against the raw source value using strict equality/inequality. Transformation does not redefine the raw matching predicate. |
| Listener `valueType` | Declare transformed output type when using `transform`, `transformMap` or `outputValues`; ordinary listeners derive it from the source. |
| Listener `outputValues` | Event-name to output-value mapping; used before transform fallback in listener delivery. Default empty map. |
| Listener `priority` | Default `0`; only classes that select by priority give it arbitration meaning. |
| Listener `ignoreSourceUpdates` | Default `false`; suppress delivery (used by write-only service bridges). |
| Listener `subscription` | Adapter metadata; includes member/source identity and listening source. Do not confuse this with authorisation. |
| `maskInvalidValue` | Optional fallback value during invalidity masking. Without one the last value can be retained. |
| `maskInvalidTimeout` | Seconds; default `-1` means no expiry. Presence of either masking option activates masking. A finite timer eventually reports invalidity if the source remains unavailable. |
| `alwaysUpdate` | Repeat updates even when the value is unchanged; default false. The configuration field remains `alwaysUpdate`; the internal Boolean is `_alwaysUpdate`, so the `alwaysUpdate()` method remains callable. |

For propagation shorthand, `ignorePropagation` specifies directions to **ignore**, not directions to permit. Thus `ignorePropagation: "public"` ignores both directions while `propagation: "public"` sends both. Member-level explicit flags take precedence where inheritance consults them. A field named `local` is not a synonym for `propagation: "private"`.

A plain event forwards occurrences, including an optional payload value, and has no base `valueType` contract like a property. State actions normally address local member names. For remote effects, wire a supported service/event bridge rather than inventing an `action.uName` field. `SourceListener` preserves causal transaction metadata; it is diagnostic lineage, not a distributed ACID transaction.

Sources: `src/property.js`, `src/event.js`, `src/sourcelistener.js`, `src/thing.js`.

### Detailed calculated-property catalogue

Each type below maps to `src/properties/<type>.js`. Read-only here means the constructor sets `writable: false`, not that every internal setter rejects writes. Timing values are seconds unless explicitly marked otherwise.

| Type | Fields, defaults, semantics and limits |
| --- | --- |
| `andproperty` | Forces Boolean/read-only/all-inputs-valid. Computes conjunction of listener values. |
| `orproperty` | Forces Boolean/read-only/any-input-valid. Computes disjunction. |
| `xorproperty` | Forces Boolean/read-only/any-input-valid. True when some but not all inputs are true; not odd-parity XOR for three or more inputs. |
| `invertproperty` | Read-only; supply `valueType`. Boolean negation or numeric sign reversal; no string inversion. |
| `evalproperty` | Read-only/all-inputs-valid; `expression` uses `$values` in listener iteration order; supply result `valueType`. Repeated equivalent listener keys can collapse inputs, so do not assume a distinct array position for duplicate subscriptions. |
| `counterproperty` | Number/read-only; set `initialValue: 0`. Default `countPositives: false` increments on every non-cold-start input. With `true`, each notification recounts the current truthy source-listener values, including cold-start notifications. Repeated notifications do not accumulate drift; ordinary event counting is unchanged. |
| `topvalidproperty` | Read-only/any-input-valid; supply `valueType`. Lowest valid numeric listener priority wins; strict `<` retains the first enumerated equal-priority input. Search starts at `99999`, so priorities at or above that value are never selected. |
| `topproperty` | Selects the first valid source in configured order. Listener lookup includes the member, matching-value discriminator and remote gang where applicable, keeping different properties on the same source distinct. Returns false when none is valid. |
| `confirmproperty` | Boolean/read-only/any-input-valid; `confirmationInputs` threshold and `confirmationTimeout` seconds. Truthy input adds its listener to the confirmation buffer; repeated input from that listener restarts its window without increasing the count. Expired entries stop contributing to the threshold. Expiry recalculates the output and publishes a change when the count drops below the threshold. Expiry while still at or above the threshold, or while already false, does not publish a duplicate update. |
| `debounceproperty` | Boolean model wrapper; required `threshold` seconds; `ignoreUnderThreshold` default `false`. False emits the first edge then holds through the threshold; true requires the input to persist before either edge is emitted. Uses a companion model and its first configured source. |
| `delayproperty` | Read-only; supply `valueType`; `delay` default `0` seconds. Queues every received update separately, not only the latest. |
| `latchproperty` | Boolean/read-only; `minOutputTime` seconds. A true input starts/restarts the minimum-on timer; false is held until that timer permits release. Supply a deliberate finite duration. |
| `edgeproperty` | Read-only; supply `valueType`; optional `leadingEdgeOutput`, `trailingEdgeOutput`. Tests current output truthiness against incoming value, not a separately stored previous input. Non-Boolean output choices need explicit testing. |
| `eventproperty` | Base property with optional `eventMap` from value to event name; without map raises the value as the event name. Does not raise during cold-start updates. Declare output events. |
| `lineartransformproperty` | Number/read-only; `inputMin`, `inputMax`, `outputMin`, `outputMax`; `floorOutput` default `false`. Linear interpolation/extrapolation, no clamp; avoid equal input bounds. |
| `quantiseproperty` | String/read-only; `quanta` maps labels to ascending numeric lower bounds after sorting. Below the lowest bound selects the first label. `bufferTimers` maps labels to dwell seconds (default 0); candidate changes cancel/restart pending buffering. |
| `rollingaverageproperty` | Number/read-only; `periods` default `5` samples, `floorOutput` default `false`. Sample-count mean, not a time-weighted average. Use positive integer periods. |
| `smootherproperty` | Number/read-only; required `rate` units/second; `resolution` default `1` value increment. First cold input is direct. Omitted `floorOutput` floors; supplying the field, even `true`, selects identity in this code. |
| `thresholdproperty` | Number/read-only; `threshold` or `thresholds`, required `buffer` in input units. Holds output at a crossed threshold while within its buffer; not a Boolean comparator. Buffers should not overlap. |
| `scheduleproperty` | Read-only; supply `valueType` and `events` schedule definitions. Requires `scheduleservice`. Selects initial value from schedule history (or single-rule shortcut), which may replace the configured initial value. |
| `modelproperty` | Read-only; supply `valueType`, `modelStates`, `modelInitialState`. Creates `<name>-model` stateproperty with `ignoreControl: true`. A singular model source without `property` borrows the first configured source; a singular action without `property` targets the public property. This is not a generic recursive rewrite of arbitrary source/action arrays. |
| `stateproperty`, `combinestateproperty`, `modeproperty` | Full configuration and lifecycle reference follows in section 4. |

### Hardware and integration property catalogue

These wrappers inherit the base/service fields, except where they explicitly overwrite them. Service-name defaults search the local Casa by service type. Host the required service where the hardware or account is reachable. Do not infer hardware support merely from a successful config parse.

| Type | Configuration and dependency |
| --- | --- |
| `serviceproperty` | Required `id`, `serviceType`, `serviceName`; `serviceProperty` defaults to property `name`; `serviceArgs` defaults `{}`; `sync` defaults `read`; supply `valueType`. See section 5. |
| `gpioproperty` | `gpioPin`; Boolean pin `state`; `direction` default `in`, exact `out` means write; `triggerLow` default false; write initial value defaults false. Requires `gpioservice`. |
| `mcpspiadcproperty` | `channel`; numeric channel `reading`; forces read; `interval` wrapper default `10000` passed in `serviceArgs`. Requires `mcpspiadcservice`. Node polling uses milliseconds and reads `subscription.args.interval`; the wrapper default is 10 seconds. A smaller requested interval reduces the current polling interval; a slower or unspecified interval leaves it unchanged. Hardware timing was not exercised. |
| `onewireproperty` | `deviceId`, `deviceType`; member defaults `state`; `sync` defaults read and `serviceArgs` defaults `{}`. Requires `onewireservice`; verify the node's actual member (e.g. temperature) and polling argument. |
| `mqttproperty` | `topic`; derives mirror id from topic; forces readwrite. Requires `mqttservice`. The member override is mistakenly named `smeeProperty` in this revision, otherwise `name`; `serviceArgs` defaults `{topic}`. Use explicit generic bridge if this wrapper is unsuitable. |
| `pusherproperty` | Required `pusherSource`; source mirror; forces read; `serviceArgs` defaults `{pusherSource}`; requires `pusherservice`. |
| `smeeproperty` | `smeeSource` defaults owner address; `smeeProperty` defaults name; args default source; forces readwrite; requires `smeeservice`. |
| `whrelayproperty` | `whRelaySource` defaults owner address; `whRelayProperty` defaults name; args default source; forces readwrite; requires `whrelayservice`. Spelling/case is significant. |
| `pushoverproperty` | `userGroup`, `msgFormat`, optional notification `priority` default 0; group mirror id is final colon segment; forces write/any-input-valid. Requires `pushoverservice`. Notification priority is unrelated to state control. |
| `devicepresentproperty` | Boolean/read-only; `host`, `interval` default 60 seconds; uses `ping`. Reachability is not authenticated occupancy. |
| `cameraproperty` | Boolean; `cctvHostname`, `cctvPort`, `cameraId`, private `userId`/`password`; direct HTTP camera integration, not generic camera discovery. |
| `i2cbusproperty` | Number/read-only; `bus` default 0, `address`, `channel`, `period` default 0.5 seconds, `precision` default 10. Requires `i2c-bus` and actual supported ADC wiring. |
| `i2cproperty` | Number/read-only; `address1`, `address2`, `channel`, `interval` default 5 seconds; optional `maxChange`, `maxIgnore`, `inputDeltaMinimum`, `outputResolution`, `floorOutput`. Presence of `inputMin` enables scaling with `inputMax`, `outputMin` default 0 and `outputMax` default 100. Uses bundled ABElectronics ADC Pi library. |
| `spiproperty` | Number/read-only; `device`, `channel`, `period` default 0.5 seconds, `vdd` default 3.3, `precisionDivider` default 1, `precisionDelta` default 0.02, `mcpDevice` default 3008 selects bus speed. Requires `mcp-spi-adc` and matching hardware. |

### Event catalogue

Each specialised type is `src/events/<type>.js`; plain `event` is `src/event.js`.

| Type | Configuration and dependency |
| --- | --- |
| `event` | `name`, optional `source`/`sources`, locality and propagation fields. Forwards matching source occurrences; callers can include payload values. |
| `scheduleevent` | Schedule fields (`rule`/`rules`, optional `value`, `active`) plus base event fields; requires `scheduleservice`, registers on cold start, raises its own name when fired. |
| `confirmevent` | `confirmationInputs` distinct listeners within `confirmationTimeout` seconds; repeated source restarts its window. When the threshold is met, it calls the inherited `raise()` method. Further input while the threshold remains met can raise another event. |
| `serviceevent` | `id`, `serviceType`, `serviceName`; `serviceEvent` defaults name; `serviceArgs` `{}`; `sync` read by default. Read/write/readwrite bridge analogous to serviceproperty. |
| `servicenodeevent` | Internal service mirror event; `serviceEventName` routes subscriber events to its owning service node. Prefer serviceevent on ordinary Things. |
| `pushoverevent` | `userGroup`, `msgFormat`, notification `priority` default 0; forces write; requires `pushoverservice`. |
| `smeeevent` | `smeeSource` defaults owner, `smeeEvent` defaults name, default args source; `sync` defaults readwrite but may be overridden; requires `smeeservice`. |
| `whrelayevent` | `whRelaySource` defaults owner, `whRelayEvent` defaults name, default args source; `sync` defaults readwrite but may be overridden; requires `whrelayservice`. |

## 4. State properties, scenes and manual override

A `stateproperty` is a state machine whose current state name is itself a property. Give each machine one concern and let several machines act on the same Thing. An occupancy machine can keep tracking the room while a movie scene controls the lamp. A temporary manual override can take precedence over both. On release, the next controlling machine can reapply what its current state calls for.

### Author a machine

1. Give the property a name, an `initialValue`, an optional base `priority`, and an array of `states`. Put an explicit initial state and its intended output in the example. Exact state names match first, then `regEx` states in declaration order, then `DEFAULT`.
2. Use `source` or `sources` on a state to define transitions with `nextState`. A matching property can trigger a transition immediately on entry. Events trigger on occurrence. `PREVIOUS-STATE` can return from a temporary detour.
3. Use `action` or `actions` for the state entry output. An action can set a property to `value`, use `fromProperty` or a source to compute its input, or raise a declared event. The runtime also supports `apply` with `$value` and `$stateDuration` and Thing-specific `handler` methods. Verify each method and expression against trusted source. By default, buffered duplicate actions within a transition are deduplicated by target name.
4. Use source or action `guards` to express a condition. Property guards are live-watched by default. Set `active: false` when the condition should only be evaluated as part of the enclosing action or source. Use explicit Boolean flags and avoid a transition loop when a property already matches on entry.
5. Use `timeout: { "duration": 30, "nextState": "inactive" }` for a timed return, with duration in seconds. The runtime also supports a property or source duration and inherited remaining time. A state can use a schedule or a counter where that represents the intent. With a scheduled transition, the named event is raised before guards determine whether to transition.
6. Verify startup, competing control, release, missing inputs and any timeout. State-entry guards, dynamic source removal, timeout/counter action copying and restored timeout actions have been corrected. Check the remaining timing and action-path limitations in section 9 before introducing advanced behaviour.

### Which kind of priority?

| Priority | What it decides |
| --- | --- |
| Thing or source-instance priority | Which available instance supplies a logical source within the gang. A standby instance can bow to the higher-priority active source. A different logical name describes a different Thing. |
| State-machine and state priority | Which controller can perform actions on the owning source. A state can override the machine’s base priority. Machines are still free to track their own states while another controls the source. |
| Source-listener priority on `topvalidproperty` | Which valid input supplies a property value. Smaller numbers have precedence in this implementation. |

Use distinct priority bands for normal behaviour, scenes and manual override. The numbers are local design choices. In the example below they are 10, 50 and 100, respectively. A scene or override can use `takeControlOnTransition: true` to re-evaluate control on entering a low-priority inactive state even when that state has no actions. Use `ignoreControl: true` where bypassing arbitration is intentional; it permits the action even after a failed control attempt and does not make the attempt side-effect-free. For ordinary supervised lighting, let the real controllers compete.

Use `combinestateproperty` when a behaviour genuinely depends on several current states. For example, define `day-state` and `users-present-state` independently, then derive `room-state` from both. The time-of-day logic can evolve without duplicating every occupancy transition. When defining a combined property, check the separator, state names, cold-start initialisation and the fallback case.

When using `modeproperty`, define `restingMode` and the alternate `modes`. A mode normally provides `<MODE>-MODE-ACTIVE` and `<MODE>-MODE-DURATION`, with the duration in seconds. `modeName` changes the middle segment of the generated names. Use the active control to request a mode. A timed mode normally clears its active flag while retaining the duration. A mode with `triggerOnDurationChange: true` can be retriggered through its duration, which resets after expiry. Check the deployed definition before using the generated properties.

### State-property field reference

Sources: `src/properties/stateproperty.js` and `src/state.js`. This is the shared state engine; a wrapper may force different defaults.

| Location / field | Default and behaviour |
| --- | --- |
| Property `valueType` | Forced `string`. State values can match exact names, regex definitions or DEFAULT. |
| `initialValue` | Optional; without one, cold start does not call `setState()` until a value arrives. Set an explicit state for a standalone controller. |
| `states` | Array; empty/omitted creates DEFAULT. Missing exact DEFAULT is appended even with regex states. |
| `priority` | Default 0. Each state inherits this unless it declares its own priority. An explicitly supplied property priority also marks state priority as defined, preventing parent-priority substitution. |
| `ignoreControl` | Default false; true permits actions despite arbitration loss. The normal control bookkeeping still runs. |
| `takeControlOnTransition` | Default false. When entry has no property/event actions, true uses this state's priority for a control attempt; false uses incoming parent priority if supplied, otherwise 0. |
| `allSourcesRequiredForValidity` | StateProperty defaults false; distinct from the base Property default true. State-owned listeners are shared across state definitions. This is not an assertion that every possible state input is currently present. |
| `removeDuplicates` | Default true; buffers property and event actions during immediate transition resolution, later target-name writes replacing earlier ones. Property and event buffers are separate. It does not deduplicate future unrelated transactions. |
| `globalPriority` | Default false; when propagated parent state is inherited into a child, preserves exact state names/priorities and control flags. It is not a copy of all actions, guards, regex definitions and transition logic. |
| State `name`, `regEx` | Name identifies the definition. `regEx` creates a regex matcher; its definition is also registered by name in `states` through NamedObject ownership. First regex match wins when no exact name matches. DEFAULT handles unmatched values. |
| State `priority` | Overrides base priority. Use distinct numeric bands for different controllers; larger is stronger. Negative values are allowed. |
| State `source`/`sources` | Conditions with exact property/event subscription, optional value/invert, guards, count, actions, nextState or handler. Singular normalises to an array. |
| State `action`/`actions` | Entry actions; singular normalises to array. Source-triggered actions also work but handler dispatch differs (below). |
| State `guard`/`guards` | Checked on entry: a matching guard with its own `nextState` requests an immediate transition, unless the destination is the current state name. First eligible guard wins. No corresponding source is required. Specify `value` explicitly; these are distinct from active source/action guards. |
| State `timeout` | Duration/property/source/from, actions and nextState; details below. |
| State `counter` | limit/unique/from/actions/nextState; counts marked source hits. |
| State `schedule`/`schedules` | Schedule definitions registered at state construction; callback acts only while this definition is current. |
| State `actionHandler` | Stored by the constructor but not dispatched by the inspected state engine. Use a supported action `handler`, not this field as a promise of execution. |

### Transition, guard and action semantics

A state is entered by matching the new property value. On entry Casa checks state guards, matching property sources and inherited counters; sources take precedence in the resulting immediate-transition choice. Entry actions are still considered during this process. Immediate transitions can chain, but exceeding ten nested transitions terminates the process with exit code 3; a matching input loop is a configuration fault, not a scheduler.

A property source with an explicit `value` is checked on entry against the live source property and may transition immediately. An event source waits for an occurrence. Source `nextState` wins over source `handler` when both are set. A source handler calls a method on the owning Thing with `(currentState, eventData)`; it is not routed through the action arbitration gate. `PREVIOUS-STATE` means the previous matched state's **definition name**, which may be a regex definition or DEFAULT rather than the previous raw property value.

A request to transition to the current definition's name resets its timer through `moveToNextState()`, rather than running all entry actions again. Changes matching the same regex definition do not generally re-enter it; DEFAULT-to-DEFAULT is specially reinitialised. Test dynamic/regex state names when their entry effects matter.

Guards accept `property`, expected `value` (default true for source/action property guards), `invert`, or `previousState`. Property guards inspect the **owning Thing's** property; they are not generic remote `uName` lookups. For remote context first expose a local property via a listener. All guards on one source/action must pass. Property guards default `active: true`; non-property guards are not live-watched. An active guard can re-evaluate a previously queued source/action when it changes, so avoid thinking of it as a passive filter on the original event only.

| Action form | Meaning |
| --- | --- |
| `{property, value}` | Set an existing property on the owning source if control is permitted. No implicit remote target field. |
| `{property, fromProperty}` | Read another property on the same source. Takes precedence over action source/apply. |
| `{property, source:{uName?, property,...}}` | Use a source-listener value; entry action sources are registered and can drive further updates while that state is current. Source-based action updates take their own path; do not assume guards/delay are reapplied on every such update. |
| `{property, apply}` | JavaScript expression using `$value` (current target value) and `$stateDuration` (seconds, rounded to tenths). Evaluated when resolving actions. |
| `{event, value?}` | Raise a local named event, subject to action control; declare it in `events`. |
| `{handler}` | A state-entry action calls the Thing method with `currentState` if `takeControl()` permits. This is distinct from a source handler. |
| `guard`/`guards` | Filter entry actions; active property guards permit later re-evaluation. |
| `delay` | Delays an action by the specified number of seconds. The callback uses its own queued action index; leaving the state cancels pending delayed actions. Handler dispatch and multiple queued actions are covered by the focused check. |

Use handlers only where the Thing class implements them. `State.launchActionHandlers()` runs on state entry; source/counter/timeout action lists go directly through `alignActions()` and should use property/event actions. Do not promise handler execution or guard/delay processing uniformly in all these containers. The top-level action processing paths are not a single recursive action interpreter.

### Ownership, release and tie behaviour

Controller ownership is for the **whole Source/Thing**, not separately for each property. Two machines on a Thing can therefore contend even if they write different outputs. Split independent actuators into child Things when they need independent control authority.

A new controller can take over at an equal or higher priority. An incumbent that changes its own priority retains control when it ties the highest waiting controller. The order in which contenders request control can affect which one wins a tie. Use distinct priority bands such as 10, 50 and 100 for normal automation, scenes and manual overrides.

A waiting controller takes over when the active controller drops below it. The new controller reapplies its current state’s actions asynchronously if that state is still current. It can restore its current intent without another sensor event. Allow for that delay in tests. Waiting state machines may continue tracking their inputs and states while a higher-priority controller governs the output.

This differs from same-address source-instance arbitration across Casas. `SourceBase.shouldBowTo()` uses strict greater-than priority, and a local-only source bows to a shared/global one regardless of priority. Equal-priority instance replacement should not be treated as deterministic failover policy. The preview engine's lexical tie-break is a preview rule, not proof of identical runtime ordering. Use unique priorities for redundant non-local placements and retain live owner observations separately.

### Timers, counters, schedules and startup

| Feature | Authoring contract |
| --- | --- |
| Fixed timer | `timeout: {duration: 5, nextState: "idle"}`; seconds, converted to milliseconds internally. Positive schedules, negative leaves unscheduled. Zero processes timeout actions before requesting an immediate transition, without scheduling a timer. |
| Property timer | `timeout: {property: "hold-seconds", nextState: "idle"}` reads local value when timer is set; no dedicated live listener is created for this form. Numeric strings are parsed with `parseInt`, not floating-point parsing. |
| Source timer | `timeout: {source: {property: "hold-seconds"}, nextState: "idle"}` registers a listener. Its updates can reset the timer while active. Avoid reusing that exact listener as an ordinary state source if relying on the separate reset branch. |
| Inherited timer | `timeout: {from: ["pending"], nextState: "idle"}` uses remaining time when entered from a listed state. An explicit duration/property cap can limit remaining time. Avoid combining `from` with `source`: the constructor skips source-listener creation when `from` is present. |
| Timer actions | Applied before timer transition for positive and zero-duration timeouts. `action` is normalised and `actions` is copied independently of state entry actions. Restored positive timers pass their actions to the callback before transitioning. Zero-duration timeouts process their actions synchronously before returning the immediate destination; this also applies to property, source and inherited durations resolving to zero. |
| State counter | Mark input sources `count: true`; configure `counter: {limit: 2, unique: true, nextState: "confirmed"}`. `unique` default false counts every matching hit; true counts each marked source once. Re-entering normally resets counts. |
| Counter inheritance | `counter.from` lists prior state names. Matches counted source listener identity and equal guard configuration, carrying counts for corresponding sources. Both counter `action` and `actions` are copied independently of the enclosing state's entry actions. |
| Schedules | `rule` or `rules`, `name`, `active` default true, optional `value` or ramp where supported. Uses `scheduleservice`. State schedules raise the event first and only then guard a transition. |
| Sun schedules | SunCalc names with optional colon-separated offset in seconds, e.g. `sunset:600`; schedule service latitude/longitude default London (51.5, -0.1). Set actual location. Colon `random` parsing exists but the random rule implementation is incomplete. |
| Cron schedules | Use the bundled node-schedule/cron-parser syntax and runtime timezone; do not assume an independent per-rule timezone option. Scheduleproperty infers an initial value from history; inspect startup separately from future triggers. |
| Ramps | Property/tester/schedule ramp configs use `endValue`, `duration` seconds, and `step` or `interval` seconds; optional `startValue`, `floorOutput` default true, `ramps` sequence, `iterations` default 1, `loop` default false. Requires rampservice. Custom `rampFunction` depends on the owner callback. Normal direct updates cancel a current ramp. |
| Cold start | Initial values are published through normal propagation; combined properties wait for non-cold sources if no initial value was given. Cold input is excluded from ordinary counterproperty event increments and tester verification; `countPositives: true` includes startup values in its current-source recount. |
| Hot start | Imported state/timers follow separate restoration paths; restoration is not equivalent to constructing the cold initial state. Current and previous regex definition references restore through the name-indexed `states` collection; the concrete property value restores separately. The earlier regex-lookup warning was incorrect. The restored timeout payload now uses `actions`, matching the callback. Each restored delayed action uses its own queue index. An absent saved state timer is not restarted; a saved remaining duration of zero is still scheduled. Verification boundaries are listed in section 9. |

### Built-in MODE, scenes and custom overrides

Every ordinary Source creates a `MODE` modeproperty unless one already exists. Its resting `auto` mode has priority -100; its `manual` alternative has priority 100, `triggerOnDurationChange: true`, and `manualOverrideTimeout` seconds (default -1). Source-level `modes` append other alternatives. This built-in mode is additional to any custom `manual-lighting` state machine in the worked example.

`modeproperty` is a generated state machine, not just an enum. It forces read-only public value, `takeControlOnTransition: true` and `ignoreControl: true`; `globalPriority` defaults true. Each alternative priority defaults 100; `timeout` defaults -1. Generated `<MODE>-<modeName>-ACTIVE` Boolean and `...-DURATION` numeric properties use uppercased alternative names; `modeName` defaults `MODE`. Internal `<PROPERTY>-ACTIVES-POSITIVE-COUNT` and `...-ACTIVES-VALID` track exclusivity. Transitions use `settle-invalid` (0.1 seconds) and `invalid` before returning through the resting state. Activations received during settling/invalid clear competing selectors, so the last processed activation wins rather than leaving two buttons on. The 100 ms settling timer remains unchanged. The resting-mode configuration is copied before normalising singular `source`/`action` into plural arrays; generated transitions/reset actions are retained and reusing the original configuration does not accumulate entries.

Normal expiry clears active while retaining duration. Duration-triggered alternatives consume the duration back to -1 so that another equal request can be seen as a change. `setManualMode(duration)` only acts if MODE is not already manual, so it is not a general “extend active timer” command. `setAutoMode()` clears active mode flags. Nested Things treat inherited MODE specially as passive state; inspect child inheritance before adding another local MODE declaration. MODE is explicitly given propagation flags by Source even when other members are private.

A scene implemented as a priority-50 stateproperty, as below, participates in controller arbitration and has explicit active/inactive states. The separate `Scene` class (`src/scene.js`, configured in `scenes`) instead uses `sources` entries as target property/value pairs, tracks whether all match, and on true `sceneProp` (default `ACTIVE`) writes those values to resolved sources. It requires its source list; turning its active flag off is not an automatic restore of previous values. These two scene mechanisms have different release semantics. Use competing state machines for persistent scene intent and deliberate override handover.

### Worked example with three competing machines

This synthetic Casa source config lets an AI practise without hardware. Save it under a disposable name. The parent owns the three machines and their requested output. Its local lamp mirrors only that explicitly named output.

```json
{
  "casa": {
    "name": "casa-config-guide",
    "type": "casa",
    "listeningPort": 50998,
    "services": [],
    "scenes": [],
    "things": []
  },
  "gang": {
    "name": "gang-config-guide",
    "things": [
      {
        "name": "training-room",
        "type": "thing",
        "propagation": "private",
        "events": [
          { "name": "movie-start" },
          { "name": "movie-end" },
          { "name": "manual-on" },
          { "name": "manual-release" }
        ],
        "properties": [
          { "name": "occupied", "valueType": "boolean", "initialValue": false },
          { "name": "dark", "valueType": "boolean", "initialValue": true },
          {
            "name": "lighting-needed",
            "type": "andproperty",
            "sources": [{ "property": "occupied" }, { "property": "dark" }]
          },
          { "name": "requested-power", "valueType": "boolean", "initialValue": false },
          {
            "name": "normal-lighting",
            "type": "stateproperty",
            "initialValue": "off",
            "priority": 10,
            "states": [
              {
                "name": "off",
                "source": { "property": "lighting-needed", "value": true, "nextState": "on" },
                "action": { "property": "requested-power", "value": false }
              },
              {
                "name": "on",
                "source": { "property": "lighting-needed", "value": false, "nextState": "off" },
                "action": { "property": "requested-power", "value": true }
              }
            ]
          },
          {
            "name": "movie-scene",
            "type": "stateproperty",
            "initialValue": "inactive",
            "takeControlOnTransition": true,
            "states": [
              {
                "name": "inactive",
                "priority": -100,
                "source": { "event": "movie-start", "nextState": "active" }
              },
              {
                "name": "active",
                "priority": 50,
                "source": { "event": "movie-end", "nextState": "inactive" },
                "action": { "property": "requested-power", "value": false }
              }
            ]
          },
          {
            "name": "manual-lighting",
            "type": "stateproperty",
            "initialValue": "inactive",
            "takeControlOnTransition": true,
            "states": [
              {
                "name": "inactive",
                "priority": -100,
                "source": { "event": "manual-on", "nextState": "forced-on" }
              },
              {
                "name": "forced-on",
                "priority": 100,
                "source": { "event": "manual-release", "nextState": "inactive" },
                "timeout": { "duration": 30, "nextState": "inactive" },
                "action": { "property": "requested-power", "value": true }
              }
            ]
          }
        ],
        "things": [
          {
            "name": "lamp",
            "type": "thing",
            "propagation": "private",
            "properties": [
              {
                "name": "power",
                "valueType": "boolean",
                "writable": false,
                "source": { "uName": ":training-room", "property": "requested-power" }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Expected behaviour to confirm in the harness:

| Input | Expected lamp power | Controlling machine |
| --- | --- | --- |
| Occupied while dark | On | Normal lighting |
| Raise `movie-start` | Off | Movie scene |
| Raise `manual-on` | On | Manual override |
| Raise `manual-release` while the movie continues | Off | Movie scene |
| Raise `movie-end` while the room is still occupied and dark | On | Normal lighting |
| Mark the room empty | Off | Normal lighting |

### Device MCP tools and manual console commands — commit eb4d2a5

When configured, the device MCP service accepts JSON-RPC at `/mcp` by default. These commands use the existing Console API framework: the real Casa, gang or source is paired with its API object, and MCP invokes the corresponding command. Existing MCP authentication applies. This is a device interface, not a Casa Cloud implementation.

| MCP tool | Arguments and behaviour |
| --- | --- |
| `casa.get_control_status` | `{uName}`: read current MODE, controller identity/state, live manual countdown and expected return to auto. |
| `casa.set_mode_manual` | `{uName, duration?}`: enter manual mode; positive finite seconds when supplied, otherwise the configured default. An already-active manual override is unchanged. |
| `casa.renew_manual_override` | `{uName, duration}`: replace the remaining time of an active manual state with this many positive finite seconds from now. Repeating the same duration restarts its timer. |
| `casa.release_manual_override` | `{uName}`: clear only the manual active flag and duration. Other modes remain intact; release does not guarantee auto if another mode takes control. |
| `casa.export_config` | `{scope: "casa" \| "gang"}`: export local stored database documents, database name and revision. |
| `casa.preview_config` | `{options}`: invoke the existing configuration preview command with its documented options/patch format. |
| `casa.deploy_config` | `{scope, expectedRevision, docs}`: replace one local configuration database using edited export records and the current revision; back up first and read back afterwards. |
| `casa.restart` | `{casaName}`: request restart of this endpoint's Casa process using its exact name. This does not reboot the Pi. |

Existing `casa.get_named_object_tree` and `casa.set_property({uName, property, value})` remain available. Property writes now invoke the paired `setProperty` API command and retain MCP source attribution. Reading the runtime tree and exporting stored configuration are distinct operations.

#### Explain control in human terms

Control status returns identity/display name, `observedAt`, `mode`, `modeValid`, `timingAuthority`, and controller identity/state without numeric priorities. `manualOverride.status` is `inactive`, `timed`, `indefinite` or `unknown`. Timed status includes `remainingSeconds`, rounded up from the owner’s published expiry, and UTC `endsAt`. It never presents the configured duration as a live countdown.

`returnToAuto.status` is `already_auto`, `expected`, `not_scheduled` or `unknown`. A timed mode with published MODE-RESTING-STATE equal to auto supplies `expectedAt`: manual expiry followed by settling, provided another mode or override does not intervene. Suitable wording is “The room is in manual mode; automatic control is expected to resume in about two minutes.” Unknown timing must remain unknown. Local and peer sources use MODE-EXPIRES-AT and MODE-RESTING-STATE through generic property reads. Missing or invalid/cold state or expiry metadata yields unknown timing.

The three MCP manual-write tools require valid MODE and manual duration/active properties and return `{ok: true, completed, controlStatus}` in text and structured content. Local sources and PeerSource mirrors use shared `SourceBaseConsoleApi` commands through generic property reads/writes. Renewal writes the duration with `forceUpdate: true`, including equal durations, without accessing the owner's state machine. Concrete type and locality do not gate these commands. They observe mode processing for up to one second; `completed: false` means completion could not be observed. Peer mirrors receive the owner’s expiry timestamp, enabling remote renewal completion checks. Older owners without expiry metadata still yield unknown timing and cannot confirm renewal completion. Do not automatically repeat renewal because of that observation limit. Acceptance and observed mode do not confirm physical outputs.

#### Manual console commands

At the selected source's console-command scope:

| Console command | Paired Source Console API method |
| --- | --- |
| `setManualMode [seconds]` | `setManualMode` |
| `renewManualOverride <seconds>` | `renewManualOverride` |
| `releaseManualOverride` | `releaseManualOverride` |

All three support `--help` and `--usage`. Supplied durations must be positive finite seconds. The semantics match the manual operations above, but these console API commands return command success/error; the MCP wrapper adds bounded observation and control status. Entering manual mode does not itself set a device output.

#### Editing and deploying configuration

Export the appropriate local database, edit its records, deploy using the exported revision, then separately request restart when ready. Preserve each unique `_id`, its `_collection`, and the target's identity record. Raw exports may contain configured credentials; they are not the sanitised unified model in section 7 and must not be inserted into this guide.

Deployment rejects a stale revision, writes a private backup, calls the existing `replaceDb` command and verifies saved records by readback. A replacement failure triggers an attempted rollback with its outcome reported. Success returns the new revision, backup path, `restartRequired: true` and `appliedToRuntime: false`. It neither hot-applies nor automatically restarts, and it does not distribute files to other Pis. Preview uses its own patch schema; it is not full validation of exported database records.

Restart respects `ignoreRestart` and sends acceptance before invoking the existing process-exit command. A supervisor must relaunch Casa; acceptance does not confirm recovery. MCP excludes overlapping deployment/restart requests within this service, not concurrent writes by separate console clients. Database replacement is not crash-atomic. Backups and structural/readback checks do not establish that the configuration will start or operate hardware correctly. Building scene tools were subsequently added in `61852e2`, as described below.

### Building scenes through MCP and the console — commit 61852e2

Casa owns the scene state. HomeKit can invoke a single Boolean scene selector instead of issuing an unrelated batch of device-property writes. Building `SCENE` is a `modeproperty`; room `BUILDING-SCENE` state properties follow it and can define different outputs for each room. Scene state machines have their own states and control priorities: selecting a scene does **not** require manual mode. Configure a HomeKit scene-selector accessory with `invokeManualMode: false` when it should not independently request manual control.

The four tools use the existing paired Console API framework, via `BuildingConsoleApi`. Matching commands live in `BuildingConsoleCmd` and operate at the selected building's console scope.

| MCP tool | Arguments | Console command | Result |
| --- | --- | --- | --- |
| `casa.list_scenes` | `{uName}` | `listScenes` | Scene names, configured default durations, and current `sceneStatus`. A default duration of -1 means no timeout. |
| `casa.get_scene_status` | `{uName}` | `getSceneStatus` | Current building selection, expiry and observed room control. |
| `casa.set_scene` | `{uName, scene}` | `setScene <name>` | Select the named scene through its Boolean selector; return `{ok, completed, sceneStatus}`. |
| `casa.release_scene` | `{uName}` | `releaseScene` | Clear the building's configured scene selectors; return `{ok, completed, sceneStatus}`. |

All four console commands support `--help` and `--usage`. Unknown scene names and unsupported targets return errors. BuildingConsoleApi uses generic SCENE and selector property reads/writes for local buildings and peer mirrors. Scene names are case-insensitive. The room's separate `scene-state` cycling mechanism is outside this tool contract.

Set and release leave building and room manual overrides unchanged. Selecting an already active scene does not renew its timer. Both transports observe the requested state for up to one second; `completed: false` means it was not observed within that window. Poll scene status afterwards. Selection or completion is not confirmation that physical outputs have updated. Release allows the remaining state machines to compete; it does not force auto or clear a manual override.

`sceneStatus` contains `state`, `selectedScene`, `valid`, `settling`, `observedAt`, `timingAuthority`, `expiry` and `rooms`. Expiry is `timed` with live `remainingSeconds` and UTC `endsAt`, `indefinite`, `inactive` or `unknown`. It does not confuse the settling timer with a scene's expiry or infer authoritative timing from a peer copy.

The observed rooms include each room's scene, MODE, controller identity/state and `sceneHasControl`. For a local valid room scene property, that flag compares the actual controller with BUILDING-SCENE; unknown/peer control is null. This supports “Movie is selected for the building; the lounge is in manual mode.” The list is derived from visible runtime objects referencing the building, not a guarantee that all remote rooms are reachable or following the scene.

## 5. Connect Things to Services

Put a Service declaration in the Casa that can reach the relevant integration. A supported shared Service can instead be declared in the gang config, with the loader instantiating it under participating Casas. Check the actual host for a device-bound Service before assigning any Thing placement.

A generic `serviceproperty` requires an `id`, `serviceType`, `serviceName` and `valueType`. It can also set `serviceProperty` when the mirror name differs from the Thing property name, and `serviceArgs` when the adapter needs additional parameters. Use the service’s resolved name and verify the adapter-specific entity identifier. `sync` determines direction:

| Value | Purpose |
| --- | --- |
| `read` | Report the Service’s mirror state to the Thing. This is the generic default. |
| `write` | Send the Thing’s changes to the Service. A write-only mirror does not provide input updates to this property. |
| `readwrite` | Send the Thing’s changes and receive state reports. |

The bridge derives a Service mirror address from the service name, service type and normalised entity ID. Prefer existing adapter wrappers when they match the device. The Service queues outbound work and can coalesce related changes from the same transaction. A configured action, dispatch, and device feedback are different observations to check when a change involves hardware.

Supply site identifiers and credentials through the site's private configuration. In examples, use synthetic IDs. `secureConfig` in the legacy DB builder can load additional private configuration. A `$localConfig` marker from the model export is a reference for an export consumer, with resolution required before that value could be used by the legacy runtime.

### Service dispatch and dependencies

Service nodes lazily materialise from requested mirror names. `serviceName:serviceType-id` removes hyphens from the supplied id, and wrapper types may further normalise addresses/topics before that. Check for identifier collisions. `deviceTypes` on the service maps the mirror type to a node constructor; `Service.createNode()` loads from `services/nodes` unless an explicit load path is supplied.

Service defaults: `local: true`, `propagateToChildren: false`, `ignoreChildren: true`, `localThings: true`, `optimiseTransactions: true`, `queueQuant: 100` milliseconds and `queueRetryLimit: 5`. Same-node, same-transaction, same-action changes can merge before dispatch. Queuing serialises dispatch opportunities, not completion of external calls; a node's `transactionReadyForProcessing()` must gate protocols requiring one in-flight request. `serviceArgs` travels in subscription metadata. An outbound request is not proof of physical actuation; observe device feedback where available.

Implemented integrations include GPIO, one-wire, MCP SPI ADC, Widgetlords, MQTT, Hue, Kasa, HomeKit, Sonos, LightwaveRF, Bluetooth/BLE, weather, camera/SecuritySpy, Pushover/Pushcut, Pusher, Smee and Webhook Relay. Their constructor and node fields remain adapter-specific. The property/event tables cover every top-level configurable module in those two directories at this revision; they do not claim every third-party device or Thing subclass has been tested. There is no implemented `smhubservice` in this revision.

Cross-gang interest is an exact `{gang, uName, property}` or `{gang, uName, event}`. Discovery resolves a serving Casa, a session subscribes, and property subscriptions send a current-value snapshot then matching updates; events only forward occurrences. Duplicate server-side subscriptions are reference-counted. Disconnect invalidates affected sources and discovery/resubscription handles transient recovery. Same-gang peer formation currently accepts LAN-tier discovery only; cloud bearer support elsewhere does not change that rule. Cross-gang receiving sessions are subscription-oriented and do not register general write-command handlers. Login currently checks target gang, not authenticated organisation membership; declarations such as organisation or subscriber lists are not proof of enforcement on this path.

Sources: `src/service.js`, `src/servicenode.js`, `src/properties/serviceproperty.js`, `src/events/serviceevent.js`, `src/peergang.js`, `src/peergangcasa.js`, `src/casa.js::casaUp`.


### Cloudflare tunnel and hosted Casa Home OAuth — 26 November 2026

Device implementation reference: [57f670e908020c994ac4b5b5c17193ecd80f3c2f](https://github.com/ricol99/casa/commit/57f670e908020c994ac4b5b5c17193ecd80f3c2f), committed and pushed. The [service reference](https://github.com/ricol99/casa/blob/57f670e908020c994ac4b5b5c17193ecd80f3c2f/src/docs/cloudflare-tunnel-service.md) and [implementation](https://github.com/ricol99/casa/blob/57f670e908020c994ac4b5b5c17193ecd80f3c2f/src/services/cloudflaretunnelservice.js) describe the configuration contract. This is device-runtime connectivity, not the separate Casa Cloud software.

**Tunnel configuration and ownership.** The optional `cloudflaretunnelservice` uses the installed cloudflared executable through the pinned npm wrapper `cloudflared@0.7.3`. Methods and callbacks remain on the prototype. `binaryPath` selects the executable; the operator supplies parameters rather than configuration-file paths. A remotely managed tunnel uses `token`. An existing locally managed tunnel instead uses `credentials` (AccountTag, TunnelID, TunnelSecret) and ordered `ingress` rules with a final catch-all; these modes are mutually exclusive. Preserve necessary originRequest settings. Casa generates a private temporary configuration (0700 directory, 0600 file), removes it on normal cleanup, starts/stops the connector with Casa, and retries after exit. Defaults are enabled=true, restartDelay=10000 ms and stopTimeout=5000 ms. Abrupt power loss/SIGKILL can leave the private temporary file. Credentials remain sensitive in the source configuration and backups; general exports are not a redaction boundary. No deployed configuration or credential values are reproduced here.

**Deployment evidence.** Richard deployed the service and restarted Casa on pi-garden. The npm wrapper was installed in ~/dev/casa/src with its download script disabled, using the working installed executable. The former independent cloudflared service on pi-wifi was stopped and disabled at boot at Richard's request. No Pi was rebooted. The existing locally managed tunnel was retained; Casa's origin is http://localhost:8047 and its public MCP endpoint is https://casa.collin.me.uk/mcp. The running connector and public OAuth discovery were checked; unauthenticated MCP requests correctly returned 401. An already running Casa process needed Richard's restart after dependency installation before the tunnel came up.

**Hosted OAuth setup now working.** [Casa Home](https://chatgpt.com/plugins/plugin_asdk_app_6b083772da00819195e1fa40d950e8f5) is the working hosted plugin, version 1.0.0 at creation. In the signed-in ChatGPT website, Plugins → Add → Add custom MCP server opened the hosted URL/OAuth form. It was configured with the public endpoint above, OAuth, User-Defined OAuth Client and token-endpoint authentication method `none`, using Richard's existing Auth0 public client with PKCE and no client secret. OAuth discovery supplied the Auth0 authorize/token endpoints. Selected default scopes were openid, profile, email and offline_access.

The exact hosted callback displayed by this setup is:

```text
https://chatgpt.com/connector/oauth/bUwIGLgSzjsZ
```

Richard added that URL to the existing Auth0 application's Allowed Callback URLs, then completed sign-in through Casa Home's Connect control. Use the actual callback shown for any future connection rather than assuming all plugins share this one. The public MCP URL is the resource endpoint, not the OAuth callback. Cloudflare transports requests; Auth0 issues tokens and Casa validates them. This does not use Cloudflare Managed OAuth or establish a Cloudflare Access policy.

The earlier uploaded skill/package did not expose a hosted Connect control and was deleted by Richard. Its settings and the separate local `codex mcp add` attempt are not the working hosted setup. The local command configured a desktop OAuth client with a loopback callback; that callback must not be substituted for the hosted callback above. The local `casa` MCP entry added during troubleshooting was removed at Richard's request on 26 November 2026 using `codex mcp remove casa`. Verification with `codex mcp get casa` reported that no MCP server named `casa` was found. The working hosted Casa Home plugin was left unchanged, and all 14 Casa Home tools remained available in the chat.

**Executed end-to-end verification.** After sign-in, all 14 tools became available to this chat (six read tools and eight write tools). A real `casa.get_named_object_tree` request succeeded and returned gang-collin from casa-garden. At Richard's explicit request, `casa.set_mode_manual` on the garden room reported valid manual mode with an indefinite override; `casa.set_property` accepted downlighter brightness 50 and power true. `casa.release_manual_override` then reported valid auto mode, inactive manual override and room controller state users-present-day at 13:49:38 UTC on 26 November. Richard confirmed that it worked. These observations establish hosted OAuth and the tunnel-to-device control path for this specific live exercise. The room was left in auto mode.

**Verification limits.** The Node 16.9 wrapper/lifecycle tests used a test connector, including startup, shutdown and failed spawn; the live Pi was running Node 16.19.0. A fresh complete test-suite run was not performed for this documentation update. Live renewal/expiry, scene switching, configuration replacement/rollback, network-loss recovery and restart/shutdown recovery under the final deployed setup remain separate checks. The successful room exercise does not certify every adapter or tool. Tree responses can contain configuration and sensitive fields: prefer narrowly scoped status calls and do not reproduce raw exports in shared guides. Casa Codex remains responsible for device code only; Casa Cloud Codex reports on Casa Cloud software.


## 6. Validate before using a config

- Parse the exact JSON or JSON5. Resolve expected Thing, property and event names, allowed value types, host and Service dependencies. Check duplicate names in the same owning scope and deliberate same-address placements on different Casas.
- Compile in a disposable configuration environment. From `src`, `node utils/createdb.js <file>` writes configuration databases. Build both the standalone gang config and the Casa config when the Casa refers to a separate gang file. For the synthetic case, the companion gang input can be `{"gang":{"name":"gang-config-guide","type":"gang","displayName":"Guide test gang"}}`. Use an isolated Casa name and port, and a disposable environment in which the builder’s default private configuration directory is separate from the deployed databases. Use `node app.js --nopeer --logs error casa-config-guide` on that test environment. Keep the working site out of the test.
- For automated scenarios, add a `tester` Thing with `loadPath: "test/things"`, a `targetUnderTest`, a `sources` array for observed properties/events, a `testRun`, and `testCases` containing `driveSequence` and `expectedSequence`. Drive properties with `property` and `value`, or raise a declared `event`. Give successive handovers enough time to settle. For the example above, observe `:training-room:lamp` / `power`, and test scene release, override release, and timeout in separate cases.
- To author expectations, set `generateExpectedOutput` to the 1-based case number, run capture mode, and review what the output means. Outputs from a common transaction can become a `simultaneous` block. Verification uses the declared block to tolerate ordering differences among its members. The matcher checks source, member and value. It does not independently assert transaction IDs. Remove the capture flag for verification and use a run deadline when automating the harness.
- Check the intent against observed behaviour. A passed schema check shows that the format is consistent. A harness trace shows what the runtime actually did with those inputs.

Append this second Thing to the synthetic file’s `gang.things` array to exercise the complete handover. The value in each `expectedSequence` item is a prediction to verify in Casa.

```json
{
  "name": "training-room-tester",
  "type": "tester",
  "loadPath": "test/things",
  "targetUnderTest": ":training-room",
  "sources": [
    {
      "uName": ":training-room:lamp",
      "property": "power"
    }
  ],
  "testRun": {
    "testCases": [
      1
    ]
  },
  "testCases": [
    {
      "name": "Scene and manual override handover",
      "driveSequence": [
        {
          "property": "occupied",
          "value": true
        },
        {
          "wait": 1,
          "event": "movie-start"
        },
        {
          "wait": 1,
          "event": "manual-on"
        },
        {
          "wait": 1,
          "event": "manual-release"
        },
        {
          "wait": 1,
          "event": "movie-end"
        },
        {
          "wait": 1,
          "property": "occupied",
          "value": false
        }
      ],
      "expectedSequence": [
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": true
        },
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": false
        },
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": true
        },
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": false
        },
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": true
        },
        {
          "source": ":training-room:lamp",
          "property": "power",
          "value": false
        }
      ]
    }
  ]
}
```

### Reproducible isolated example

The full three-case runner and companion files are in Casa Codex’s source checkout. This repository guide contains the inline introductory case and tracks these companions:

- `examples/configuration-authoring/competing-machines.json`: synthetic room and tester, with three cases.
- `examples/configuration-authoring/gang.json`: standalone gang metadata needed by the builder.
- `examples/configuration-authoring/run-isolated.js`: bounded test driver.

From repository root:

```sh
node src/docs/examples/configuration-authoring/run-isolated.js
node src/docs/examples/configuration-authoring/run-isolated.js capture 1
```

The runner creates a fresh OS-temporary directory, redirects only the DB builder's constructor destination in its child process, and launches the actual `app.js --nopeer --logs error --config <temporary-db>` path. In the runtime child it replaces only WebService `startListening` and discovery `coldStart` with no-ops. It keeps the real loader, object tree, state machines, timers, source/property propagation and tester. No site configs, hardware bindings or credentials are used; no production source file is patched. Each child has a 90-second deadline. It prints the evidence directory and preserves DBs and logs there for inspection. This verifies local behaviour, not HTTP, discovery or hardware integration.

The inline testcase above remains the introductory handover case. The companion tester uses `testRun.testCases: []` and adds (2) manual override expiring after its real 30-second timeout to unoccupied normal state, and (3) occupancy changing while the movie scene controls the lamp, followed by manual release, scene release and a fresh occupancy change. Expected sequences are authored from intent, then checked against capture and verification; capture mode is not a pass/fail test.

Tester reference (`src/test/things/tester.js`): `targetUnderTest` defaults to the tester's own address; observed `sources` default to that target. `driveSequence` entries accept `target`, property/value or ramp, event, and `wait` seconds before an input. Expected entries use source/property-or-event/value; source defaults to the target. `settleTime` defaults to 3 seconds before every case. `testRun.delayStart` is seconds; otherwise startup delay depends on peer mode and loader settle time. `testCases` selection is 1-based, `[]` means all. `preAmble`/`postAmble` wrap first/last selected cases; named `testSteps`/`testCase` references compose subsequences. Keep sequences nonempty and references acyclic.

`generateExpectedOutput` selects capture mode by **field presence**, even if its value is false or zero; set a valid 1-based number and remove the field afterward. Capture exits after 15 seconds of output inactivity, not necessarily after a long pending timer. Choose capture scenarios accordingly. Verification ignores cold-start updates, exits on unexpected output or invalid observed source, and checks that the drive sequence has completed when final expected output arrives. Missing output can leave it waiting indefinitely, hence the external deadline. `simultaneous` is a bounded reordering window, not a transaction-ID assertion. Transaction IDs are printed, and capture uses them for grouping.

## 7. Rebuild the unified deployment model

**Model convention, not runtime configuration:** `preferredCasa`, `instances`, `hostCasa`, `definitionRef`, `$localConfig` and schema `0.1` belong to the supplied guide's unified deployment representation. They are not consumed as such by `createdb.js` or the runtime. The separate ChatGPT Library model was referenced by the baseline, but its complete schema was not available through the connected Drive folder in this review; schema compatibility beyond the guide's stated conventions remains unverified. Do not silently promote these conventions into a new authoritative schema.

Use the actual, authorised deployment config directory. Read JSON or JSON5 inputs for the target deployment and retain its own file list. Keep deployment inputs separate from test fixtures.

1. **Index by gang.** Read explicit gang declarations and Casa-to-gang associations. Apply the loader’s derived `<casa-name>-gang` convention where the input supplies no association. Each gang record has `root.uName: ":"`, a `root.children` map and `sharedServiceDefinitions`. Keep standalone gang metadata under `definition` and per-Casa gang metadata under that Casa’s `gangDeclaration`.
2. **Place the enumerated objects.** Put each Casa and each logical gang Thing under `root.children`, keyed by absolute `uName`. Keep gang Users and shared Scenes at that level if they are declared there. A Casa node owns its `children` for Casa-scoped Things, Users, Scenes and hosted Services. Use the runtime’s membership and array precedence rules. Preserve source file and JSON Pointer on each declaration. Explicit `local` overrides and implicit defaults must be distinguished. Nested children inherit host placement but retain their own locality and config. Never merge equal textual addresses across different gangs.
3. **Preserve each Thing placement.** Put each declared root Thing placement in the logical Thing's `instances` map under its `hostCasa`. Include its `kind`, `uName`, `hostCasa`, effective `local`, `sourcePriority`, source reference, and its original sanitised `config`. Move the `things` array into `children` keyed by the children's absolute addresses on that placement. Keep property/event arrays, state priorities, actions, references and propagation with the original definitions. Keep one placement per source declaration and preserve its owning Casa. If two declarations map to the same gang/uName/hostCasa key, report a conflict or preserve both as provenance records: the sample host-keyed map cannot represent both by overwriting one. Keep raw declarations separate from effective loader-merged definitions. A local-only placement remains distinct from the non-local placement with the same name.
4. **Record normal hosting.** Honour an explicit valid model-level `preferredCasa` that resolves to a placement. Otherwise choose the sole non-local instance, or the unique highest-priority non-local instance when several are configured. Leave the preference unresolved when none is eligible or when the highest priority ties. Record the currently live instance separately if an authorised runtime observation is available.
5. **Resolve shared Services.** Represent each shared Service definition once. Under each applicable Casa, create a hosted Service node with `hostCasa` and a `definitionRef` to the shared definition. A local same-name declaration wins on that Casa for Services the loader handles this way. Check the effective configuration before flattening same-named per-Casa gang additions. Surface any remaining ambiguities.
6. **Export strict JSON and keep connection values private.** Store secret and site-local values as `$localConfig` references containing the source file, JSON Pointer and reference kind. Escape `~` as `~0` and `/` as `~1` in JSON Pointer segments. Use sorted file iteration for a reproducible export and preserve semantic array order. Runtime-created Services and inferred property instances are separate observations, so preserve what the deployment files explicitly describe.
7. **Verify coverage and write separately.** Check that every input declaration maps to an output node or shared definition, all host and definition references resolve, locality survives at each placement, and configured priorities and observed runtime state remain distinct. Check for credential leaks in the export. Compare input file hashes before and after to confirm the reconstruction used them read-only.

For example, a logical entry in the resulting model can look like this:

```json
{
  "kind": "Thing",
  "uName": ":training-room",
  "preferredCasa": ":casa-config-guide",
  "instances": {
    ":casa-config-guide": {
      "kind": "Thing",
      "uName": ":training-room",
      "hostCasa": ":casa-config-guide",
      "local": false,
      "sourcePriority": 0,
      "source": {
        "file": "guide/training-room.json",
        "pointer": "/gang/things/0"
      },
      "config": { "name": "training-room", "type": "thing" }
    }
  }
}
```

The example abbreviates the `config` and `children` from the full room definition. A real export retains those fields as described above. Store the complete model as one portable JSON export. A potential Firestore representation can use the gang as the model boundary with individually addressable objects and placements; this is a design recommendation, not a verified Casa Cloud storage contract.

## 8. Source of truth

- [State machine guide](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/docs/state-machine-guide.md), [state implementation](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/state.js), and [source control](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/source.js)
- [Thing composition and propagation](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/thing.js), [property types](https://github.com/ricol99/casa/tree/61852e25ef89a99742236c19c75050d4973f21be/src/properties), and [event types](https://github.com/ricol99/casa/tree/61852e25ef89a99742236c19c75050d4973f21be/src/events)
- [Service framework](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/docs/service-framework.md) and [peer transport](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/docs/peer-gang-transport.md)
- [Database builder](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/utils/createdb.js), [loader](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/loader.js) and [test harness authoring](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/docs/test-harness-authoring.md)
- [Console/MCP contract](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/docs/console-api-contract.md), [MCP implementation](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/services/mcpservice.js), [source API](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/consoleapis/sourceconsoleapi.js) and [manual console commands](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/consolecmds/sourceconsolecmd.js)
- [Building scene API](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/consoleapis/buildingconsoleapi.js), [building scene commands](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/consolecmds/buildingconsolecmd.js), and [mode implementation](https://github.com/ricol99/casa/blob/61852e25ef89a99742236c19c75050d4973f21be/src/properties/modeproperty.js)
- [Unified deployment model](https://chatgpt.com/library?file_id=libfile_fde3_f-22955afa02ac8191add8a84e9ff63733_d255a173e45881918045ea94147b1941&account_id=personal)


## 9. Verification, changes and remaining gaps

The historical checks in the table below ran on device revision `78310eb6523782eaf5a28b967417584bc1bef1b5` on 25 November 2026 with Node `v16.0.0`; they have not all been rerun against the new runtime reference. Casa Codex ran the v0.2 scenarios and focused device checks. Hannah ran the two-room case in v0.3. Both revisions used synthetic examples.

| Executed check | Result and boundary |
| --- | --- |
| Real DB builder, loader and tester: normal → scene → manual → release | PASS; six expected lamp transitions. |
| Manual override timeout | PASS; on then off after the configured 30 seconds. |
| Background occupancy change under scene/manual control | PASS. Six expected transitions, including resumed normal behaviour. |
| Root building, peer rooms and local child lights | PASS. Four assertions. Both rooms received the synthetic building’s low-light update in one transaction. Each room’s movement changed the power of its own child light. |
| Capture mode, introductory scenario | Completed; six captured values agree with the authored expectation. Capture alone is not a test assertion. |
| Existing focused device checks | All 13 passed: `modeproperty_timeout`, `namedobject_phase2`, `loader_identity`, `gang_config`, `sourcelistener_valuetype`, `previewconfigengine`, `peergang`, `peergangcasa`, `peercasa_lifecycle`, `peercasa_command_protocol`, `peercasa_subscription_protocol`, `peer_protocol_helpers`, `peergang_architecture_guard` (each under `src/test/*_test.js`). |

The isolated example suppresses HTTP listening and discovery startup inside its child process. These results cover local object construction, state transitions, timers, arbitration and propagation; they do not establish deployed LAN, hardware, service-provider or Casa Cloud behaviour. The accompanying `verification.txt` records the check summary; the runner prints fresh evidence paths when repeated.

v0.3 adds the compounding decision table, the peer-room example and the complete Thing catalogue. The v0.2 review draft retains the detailed implementation evidence for its findings.

Follow the remaining restrictions documented beside each field. The linked v0.2 review draft records historical findings; the resolved findings below supersede its corresponding warnings. Test any advanced field you adopt against the pinned runtime.

The unified-model schema had not been independently validated during the v0.2 review. Hardware adapters and external Services need checks in their intended environment.

### Five resolved device issues — commit 5388f0c

1. **Delayed actions:** corrected the queued callback index in `src/state.js`. `state_delayed_actions_test.js` passes for delayed dispatch, multiple actions, handlers and cancellation on state exit.
2. **Confirmation property/event:** corrected the buffer references in `src/properties/confirmproperty.js` and event dispatch in `src/events/confirmevent.js`. Focused in-memory checks passed for threshold, repeat-input reset and expired-entry exclusion. These were one-off checks, not added test files; immediate property-output reset on expiry was not included in that commit; it was subsequently added in fix 10 (`e9ba6e9`).
3. **alwaysUpdate:** renamed only the internal Boolean in `src/property.js`; the configuration name and public method remain unchanged. One-off checks passed for absent, false and true flags and callable method preservation; a full repeated-output integration scenario was not run.
4. **Top property:** uses the canonical listener key in `src/properties/topproperty.js`. `topproperty_test.js` passes for distinct members on one source, remote-gang identity, configured order, validity fallback and singular source configuration.
5. **SPI ADC polling:** reads the requested interval from subscription arguments in `src/services/nodes/mcpspiadcchannel.js`. `mcpspiadc_interval_test.js` passes for milliseconds, the 10000 ms property default request, faster/slower subscribers and missing interval. The timer and hardware dependency were simulated; no physical ADC was tested.

The three new focused test files above, plus existing `modeproperty_timeout_test.js` and `sourcelistener_valuetype_test.js`, passed before push. The subsequent fixes 6–10 are recorded below; the earlier warnings about those resolved paths no longer apply to this guide's runtime reference. This update does not validate Casa Cloud behaviour.


### Hot-start review correction — 25 November 2026

Casa Codex traced actual construction, export, import and hot start. Regex states are present both in `regExStates` and in the name-indexed `states` collection because `NamedObject.addChildNamedObject()` registers them. An isolated check restored current and previous regex definition references and concrete value `item-42`, with 3500 ms remaining. The earlier regex-restoration warning is withdrawn; no regex-lookup code change was needed.

The separate timeout-action defect was confirmed: `hotStart()` supplied `action`, while `timeoutInternal()` reads `actions`. Casa Codex changed that field to `actions` in pushed commit `e9ba6e9`. `stateproperty_hotstart_test.js` passes for named and regex states, remaining duration, and actions executed before the timeout transition; existing mode-timeout checks also pass. This correction is included in this guide's pinned `61852e2` runtime. It is a focused check with simulated timers, not a full deployed restart test.


### Fixes 6–10 — pushed commit e9ba6e9

6. **State-entry guards:** use the guard's own destination, without looking up an unrelated source. `state_entry_guards_test.js` passed for optional/empty guards, matching and nonmatching values, no sources, unrelated sources, self-targets, absent destinations and first eligible match.
7. **Dynamic source removal:** removes one matching source from the source list, event mapping and active-guard queue, and releases its main/active-guard listener references. Shared listeners remain until their last reference is released. `state_dynamic_sources_test.js` passed for middle mapping removal, sharing across states, final shutdown and repeated removal.
8. **Timeout/counter action copying:** plural-action checks inspect the timeout or counter object, not the enclosing state. One-off constructor checks passed for absent, singular and plural actions with and without state entry actions; these checks were not added as a standalone test file.
9. **Restored timeout actions:** corrected the callback payload to `actions`. `stateproperty_hotstart_test.js` passed for named and regex references, preserved concrete value, remaining timer duration, and actions before transition. The regex warning was a review error, not a runtime defect.
10. **Confirmation expiry:** recalculates and publishes output changes when confirmations expire. `confirmproperty_expiry_test.js` passed for threshold crossing, no duplicate updates above/below threshold and repeated-input timer refresh.

These focused checks and neighbouring guard, listener, delayed-action and mode-timeout checks passed during implementation. The complete device suite and all worked configurations were not rerun on this revision. Timer-based checks use simulated timers; no deployed restart, live hardware or cloud validation is implied. Earlier scenario results above remain attributed to their original revision.

### Remaining limitations and verification boundaries

- Zero-duration timeout actions use the ordinary timeout action path: control arbitration and buffering still apply, so processed actions do not necessarily produce separate physical updates.
- Entry, source, counter and timeout actions follow different processing paths; handlers, guards and delays are not interpreted uniformly across all containers. Source-based action updates also bypass ordinary entry guard/delay processing.
- Hot-start fixes 11–12 below have focused simulated-timer coverage. A full deployed shutdown/restart cycle has not been tested; the complete device suite and all worked configurations were not rerun at `c296910`.
- Hardware adapters/external services need environment-specific validation. The separate unified deployment schema remains independently unverified, and Casa Cloud behaviour is outside Casa Codex's device-code scope.


### Fixes 11–12 — pushed commit c296910

Both previously suspected hot-start defects were reproduced in isolated traces, then corrected in `c2969104d9f803c6b6dc5c42bbf7770b39c59062`.

11. **Restored delayed-action index:** `State.hotStart()` now passes the current queue index `i` to each callback instead of the final queue index. Before the fix, the first timer executed the last action and a later callback could throw after that entry was cleared. The regression check restores distinct actions with a cleared slot between them, verifies their individual remaining durations, and confirms each action executes correctly.
12. **Inactive state timer restoration:** `StateProperty.hotStart()` now requires a restored timer value that is neither `null` nor `undefined`, as well as a current state with a timeout definition. A snapshot with no active timer remains inactive. A saved remaining duration of `0` remains valid and is scheduled, as is a positive duration. This differs from authoring a zero-duration timeout, which takes the synchronous immediate-transition path and, from `a7aec20`, processes timeout actions before that transition.

The expanded `src/test/stateproperty_hotstart_test.js` passed for absent, zero and positive remaining state timers and distinct delayed-action indices. Existing `state_delayed_actions_test.js` and `modeproperty_timeout_test.js` also passed. These are focused checks using simulated timers, not physical hardware or deployed restart verification. All twelve agreed fixes are committed and pushed; this statement does not imply that every runtime path is defect-free.


### Zero-duration timeout actions — pushed commit a7aec20

At Richard's request, `StateProperty.setStateTimer()` now processes `timeout.actions` through `alignActions()`, using the state's priority, when the resolved duration is zero, before returning the immediate destination. Singular `timeout.action` continues to be normalised by the State constructor. The behaviour applies to fixed, property-based, source-based and inherited zero durations. A zero timeout with actions but no destination still processes those actions; a negative duration remains unscheduled and does not execute timeout actions.

The focused `src/test/state_zero_timeout_test.js` passed for all four zero-duration forms and entry → timeout → destination action-processing order. It also checks actions without a destination and unchanged negative-duration behaviour. Existing `stateproperty_hotstart_test.js` and `modeproperty_timeout_test.js` passed. These checks validate processing order; arbitration and buffering can combine or suppress actual outputs. The immediate verification for `a7aec209027c2f081dba758461062a045f2d691d` was limited to those checks. Subsequent broader automated verification is recorded below; deployed restart and hardware remain unverified.

### Subsequent automated checks and MCP update — 25 November 2026

Before the MCP changes, Casa Codex ran all 38 standalone device test files at `a7aec20`; all passed, including the peer LAN check rerun with local socket access. Isolated loader/runtime suites also passed: property (17), stateproperty (35), housealarm (25), building (18), and guide scenarios (3). The housealarm fixture excluded the HomeKit accessory in a temporary copy, as Richard requested. Building dynamic subscription removal and re-addition were also exercised. These results do not include live hardware.

For the code committed and pushed as [`eb4d2a5`](https://github.com/ricol99/casa/commit/eb4d2a561bdccbf208240f49209b8a1bc4b365c1), Casa Codex verified:

- `mcp_control_status_test.js`: dispatch, live countdown, auto/indefinite/unknown modes and errors.
- `mcp_manual_control_test.js`: paired API dispatch, asynchronous set/renew/release, unchanged-duration renewal and validation.
- `mcp_management_test.js`: paired export/preview/replacement commands, stale revision rejection, private backup, simulated replacement failure/rollback and deferred restart dispatch. Database storage and restart were stand-ins; backup files were temporary real files.
- `console_manual_commands_test.js`: console-to-API dispatch, numeric duration parsing, rejected arguments and help.
- Existing `console_db_push_test.js`, `consoleapi_progress_integration_test.js`, `previewconfigengine_test.js` and `consoleapi_unregistered_test.js` passed.
- An isolated real Casa runtime passed enter-manual (30 seconds), renew (60 seconds), renew again with the same duration, and release to auto through the paired Console API. HTTP listening and discovery were suppressed; no live outputs were exercised.

The four new test files are committed. The one-off isolated runtime runner and log remain local evidence, not packaged reproducibility assets. The broader 38-test run belongs to the preceding revision; it was not repeated in full after the MCP additions. No live Pi configuration deployment, Pi reboot, supervised restart/recovery, attached-hardware validation or Casa Cloud validation was performed.


### Scene/counting fixes — pushed commit c1b93c5

Casa Codex reproduced and corrected the following in [`c1b93c56fa81464a502098456543aebdafd9b1d2`](https://github.com/ricol99/casa/commit/c1b93c56fa81464a502098456543aebdafd9b1d2):

- Positive-source counting ignored initially true cold-start inputs, then could subtract to -1 when a button turned off. `countPositives: true` now recounts current source-listener values, including startup. Ordinary event counting still increments once per non-cold notification.
- A resting mode's singular `source` or `action` could overwrite generated arrays during State construction. Normalisation now removes those singular fields from a copied resting configuration, preserving the generated entries and leaving caller configuration reusable.
- Alternating scene buttons every 10 ms could leave both active and SCENE stuck in `invalid` after input stopped. Activations during settling/invalid now clear competing buttons, retaining the existing 100 ms settle timer and last-processed-activation behaviour.

`counterproperty_positives_test.js` passed for startup, repeated notifications, overlapping buttons, handover and unchanged ordinary counting. `modeproperty_resting_config_test.js` passed singular, plural, both and neither forms through real State normalisation, repeated construction and nested-copy independence. Existing mode-timeout and MCP manual-control checks passed.

The committed `scene_switching_runtime_test.js` runs a synthetic real building and two rooms with temporary databases. Selection A→B, simultaneous selections in both orders, rapid 10 ms switching ending in either scene, release, timeout and return to normal room outputs passed. An existing building manual override was preserved, including during rapid switching. These cases exercise the runtime without connected HomeKit or other hardware.

### Scene MCP/API/console verification — pushed commit 61852e2

At [`61852e25ef89a99742236c19c75050d4973f21be`](https://github.com/ricol99/casa/commit/61852e25ef89a99742236c19c75050d4973f21be), Casa Codex extended that runtime test to exercise all four MCP tools and all four console commands through the paired Building Console API. Checks passed for listing, status, selecting/releasing, unknown scenes, missing arguments, unsupported room targets, help and argument validation. Building manual mode remained unchanged. A separate room manual override was preserved and correctly reported as not controlled by the selected building scene.

`building_scene_status_test.js` passed for live countdown, room ownership, indefinite/inactive/settling/unknown status, peer/cold write restrictions and MCP tool discovery. Existing MCP control-status, manual-control, management and manual-console-command tests also passed.

This evidence covers isolated runtime behaviour and dispatch, not an end-to-end HomeKit session, live hardware, deployed HTTP/authentication or remote-Pi operation. HTTP listening and discovery were suppressed in the integration child; temporary synthetic configurations were used. The full device suite was not rerun for these two commits. Casa Codex's responsibility remains device software; no Casa Cloud validation is claimed.



### Live connectivity evidence update — 26 November 2026

The Cloudflare/Casa Home section above adds live Pi, hosted OAuth, tree-read and user-confirmed room-control evidence at device commit 57f670e. Earlier statements about no deployed HTTP/authentication or hardware verification describe their historical test runs; they are superseded only for the specific live exercise recorded above. All other historical test attribution and outstanding verification boundaries remain unchanged.


### Generic control interface update — 26 November 2026

Building scenes use the generic property interface on local and peer sources (`afea602`), with case-insensitive scene names (`198c1c0`). `1784c48` adds per-write boolean `forceUpdate: true` through Property, Thing, Source, PeerSource and Socket.IO, and fixes the Property gate that previously blocked configured `alwaysUpdate`. The force flag is removed from emitted notifications and does not alter persistent configuration. Write metadata is preserved without mutating caller data.

The MCP changes committed in `33a0fe7` move manual commands to shared SourceBaseConsoleApi and console commands to SourceBaseConsoleCmd. Set leaves an existing manual override unchanged; release clears only manual duration/active properties; renewal forces a duration write. Existing local runtime helper methods remain for internal callers, but the MCP/console API no longer invokes them. Read-only control status uses mirrored expiry and resting-state properties for local and remote sources.

Focused verification covers generic local/peer manual dispatch, validation and immediate write rejection, console command parsing, control status, management, and building scenes. The synthetic building/two-room runtime exercises MCP set, equal-duration renewal and release on local and PeerSource targets over a real loopback Socket.IO connection, and confirms the owner timer changes without changing room overrides. These tests do not contact deployed Pis or hardware. The packaged authoring examples and their latest results are recorded in `examples/configuration-authoring/verification.txt`; earlier test tables retain their historical dates and attribution.


### Mirrored mode expiry — 26 November 2026

Modeproperty generates `<NAME>-EXPIRES-AT` (number, UTC epoch milliseconds) and `<NAME>-RESTING-STATE` (string), e.g. MODE-EXPIRES-AT and MODE-RESTING-STATE. These read-only metadata properties follow the mode's propagation settings and ordinary peer mirroring. An expiry of -1 means no active mode timer. Entry and renewal publish the real timer deadline; release/expiry clear it, settling timers are excluded, and hot start republishes from the restored remaining duration. Control status needs no concrete property type, timer object or remote configuration. Remote countdowns assume clocks agree. Missing metadata on an older owner remains unknown.

`modeproperty_expiry_test.js` covers publication, cancellation, indefinite and settling modes, and hot-start restoration. Control-status checks cover local/peer values and missing/invalid metadata. The Socket.IO runtime test sends writes to the owner and property notifications back to the mirror, verifies equal-duration renewal completion, and checks timestamp clearing after release and actual timeout. No deployed hardware was exercised.


### Peer property validity — 26 November 2026

Peer validity fix commit: [d6ce0fff96ecf577d584674280ae0908e294958d](https://github.com/ricol99/casa/commit/d6ce0fff96ecf577d584674280ae0908e294958d), “Propagate owner validity in existing peer property updates”.

**Observed issue.** The hosted Casa Home readback showed Dumgoyne’s `richard-present` and `natalie-present` values as true but valid=false after successful writes. A direct read-only Socket.IO console request to pi-env confirmed that `:dumgoyne` was the active local building on casa-env (fromPeer=false, bowed=false), with both values true and valid=true. The invalid flags were stale on the peer mirror. This was a presence-property validity issue, distinct from the earlier Cinema command-dispatch error.

**Narrow fix.** `Source.updateProperty()` adds the owning property’s current Boolean `valid` state to its existing outgoing property-change notification. `PeerSource.sourceHasChangedProperty()` applies that metadata before value equality can suppress the update. Both false→true and true→false validity can therefore be reflected when an existing notification arrives, even if the value is unchanged. Messages without a Boolean validity field preserve the peer’s current validity; successful writes do not automatically make properties valid.

This is six production lines in Source and PeerSource. SourceBase, Property, SourceListener and PeerGangSource are unchanged by this commit. It introduces no validity event, no `validityOnly` notification, no additional notification emission and no new race-prone shared receiver path. An earlier broader uncommitted approach was reverted at Richard’s request and is not part of the pushed change.

**Verification and boundary.** `src/test/peer_property_validity_test.js` passed for owner-supplied validity (rather than caller-supplied metadata), both validity transitions with an unchanged value and zero extra notifications, ordinary changed-value notification behaviour, and compatibility with messages lacking valid Boolean metadata. These are focused in-process checks; a full suite was not run for this commit. Subsequent user-confirmed live verification is recorded below. Standalone validity changes are not newly broadcast: synchronization occurs on the next existing property notification or peer snapshot. The owning and receiving Casas need the corresponding updated code for notification-based synchronization.

**Live verification — 26 November 2026.** Richard subsequently tested the presence values and confirmed that Dumgoyne’s `richard-present` and `natalie-present` are both set and valid. This verifies the reported presence write/readback problem is resolved in live use. This is Richard’s live confirmation, not a new independent Casa Codex test or verification of the exact revision running on every Pi. False→true and true→false transitions at an unchanged value remain covered by the focused automated test rather than this user report.

The source reference for this presence fix is `d6ce0fff96ecf577d584674280ae0908e294958d`. Earlier sections retain their historical test and deployment attribution; this live result supersedes the previous absence of post-fix presence verification only for the two properties above. This repository update preserves Hannah’s composition guidance and catalogue.


### Peer Console API management routing — 26 November 2026

MCP can inspect and write compound members without changing `local` or creating PeerSources. `casa.describe_thing` invokes the existing `describeThing` Console API command to discover children; `casa.describe_source_state` invokes `describeSourceState` to read current properties and validity. Both accept `uName` and an optional `casa` hosting-Casa name. `casa.set_property` also accepts `casa`. If omitted, command routing uses the object's existing Casa ownership, or the nearest visible ancestor's ownership for an unmirrored child. Supply `casa` explicitly when no visible ancestor identifies the host or the desired host differs. Child descriptions retain their object addresses and owner-Casa information. Descriptions can include configuration; they are management responses, not public discovery records.

Local commands use the paired local Console API. Remote commands use `console-command-req` / `console-command-resp` on the existing peer Socket.IO connection, reusing request IDs, requestor matching, pending callbacks and the 30-second timeout. The destination uses a separate Console API session per request and its existing `executeCommand` dispatcher; completion closes that session without touching interactive console sessions. Command errors are serialized separately from results. No extra property mirroring, subscriptions, Internet listeners or SourceBase changes are introduced.

Management requests are not automatically replayed after reconnect, because their effects may already have occurred. A timeout is an unknown outcome, not proof that a write failed; read back before retrying. Existing property-command replay is unchanged. Both endpoints need the new transport handlers; an older host will time out. The original console connection and wire protocol are unchanged.

The four building scene tools also accept explicit `casa` routing. Without it they retain the existing generic mirrored-property path. Manual command dispatch uses the new host route where ownership identifies a peer, while manual status/settling observation still uses the existing local object or mirror. This change does not extend manual status to wholly unmirrored targets, redirect the existing filtered tree tool, or change the local scope of configuration deployment/restart tools. Use the new description tools for on-demand compound-member discovery and state inspection.

`peer_console_management_test.js` exercises a real loopback Socket.IO connection, a child absent from the gateway tree, explicit and ancestor-derived routing, property writes, concurrent reads, an independent interactive console session, command errors, timeout, no replay and local dispatch. These are isolated tests, not deployment or physical-hardware verification.

### Parallel management discovery — 26 November 2026

`casa.discover_objects` provides one MCP call for discovery across the gateway and its known peer Casas. Each host runs the same `CasaConsoleApi.discoverObjects` command through the existing local/peer console route. Requests are dispatched in parallel. Results are grouped in `casas`, with each successful entry containing `casa` and `objects`; failures contain `casa` and `error`. Top-level `complete` is false if any host failed or timed out. Optional `timeoutSeconds` is 1–30 seconds, default 5. Late replies do not revise the returned result; peer request cleanup retains the existing transport timeout.

The command reuses the configured local-tree filter and `NamedObject.iterate` over the active gang tree and local bowed root. It includes `local = true` compound members, excludes peer mirrors and transient/configuration-excluded nodes, and selects source records using the host's authoritative `sources` registry. Records contain `uName`, `parent`, `name`, `displayName`, `type`, `local` and `active`; there are no property values or configuration payloads. Bowed instances are marked inactive. Results remain grouped by Casa rather than merged; use the group's Casa name with the discovered address for subsequent description or control. The matching manual console command is `discoverObjects` on a Casa.

This is on-demand management traffic: no new PeerSources, subscriptions, cached trees, or changed mirroring/export handshakes. Older hosts may report unsupported commands or time out. `mcp_discovery_test.js` verifies real loopback console transport, parallel dispatch, nested local compound discovery, bowed records, exclusion of mirrors/property payloads, partial errors/deadlines, late replies, console command dispatch, and console-only socket traffic with unchanged PeerSource registries. No live Pis or hardware were contacted.

### Live MCP discovery and remote read — 26 November 2026

After Richard reported deployment and the refreshed Casa Home tool list became available, Casa Codex called `casa.discover_objects` through the hosted MCP connection with `timeoutSeconds: 10`. The result returned `complete: true`, with all queried Casas responding. It discovered `:lounge:christmas-tree` under `:lounge` on `casa-env`, named “Living Room - Christmas Tree Lights”, type `kasaplug`, with `local: true` and `active: true`.

Casa Codex then called `casa.describe_source_state` through the same MCP connection with `casa: "casa-env"` and `uName: ":lounge:christmas-tree"`. The owner returned `fromPeer: false`, `bowed: false`, `power: true` and `MODE: "auto"`; both power and mode were valid. `MANUAL-MODE-ACTIVE` was false and `BUILDING-SCENE` was `none`. These values describe the observation at test time, not a promise of the current state.

This verifies end-to-end hosted MCP discovery and a read from the remote hosting Casa for a local compound member. The checks were read-only: no properties, modes, configurations or mirroring settings were changed. The unchanged mirror/subscription behavior is covered by the automated tests; live network traffic was not separately instrumented. This exercise does not verify remote writes or physically confirm the lights were illuminated. Source reference remains `1200b041dc3ebf81c2d369f1d66892aeeb1b8faa`; the exact running revision on every Pi was not independently checked. Earlier no-live-verification statements describe their historical test runs and are superseded only for this discovery/read exercise.
