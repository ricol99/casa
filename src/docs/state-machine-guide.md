# Casa State Machine Guide

This guide documents how Casa state machines are defined today using:

- `stateproperty`
- `combinestateproperty`
- `state`
- helper wrappers such as `modeproperty` and `modelproperty`

The implementation lives in:

- `src/properties/stateproperty.js`
- `src/properties/combinestateproperty.js`
- `src/state.js`

Representative examples live in:

- `src/things/room.js`
- `src/things/access.js`
- `src/things/housealarm.js`
- `src/things/car.js`
- `src/test/configs/test-stateproperty.json`
- `src/test/configs/test-combinestateproperty.json`

## Mental Model

A Casa state machine is just a property whose value is the current state name.

- The property type is `stateproperty`.
- Each named state is represented by a `State` object.
- Entering a state can:
  - apply actions
  - start a timer
  - subscribe to source events/properties
  - react to schedules
- count repeated source hits
- change controller priority
- Leaving a state clears active guarded state and delayed actions for that state.

The current state name is still just a normal property value, so other properties can read it, transform it, combine it, or expose it externally.

## Core Design Principle

Casa is not built around the idea that one giant state machine should describe everything a Thing can do.

In practice, that kind of total machine becomes too complex:

- too many cross-cutting concerns
- too many combined states
- too many transient cases
- too much hidden coupling between unrelated behaviors

Instead, Casa treats these as critical, first-class design ideas:

- state competition
- state combining

### State competition

Different `stateproperty` machines inside the same Thing can compete to drive behavior.

They do that through:

- actions
- controller ownership
- priority arbitration

This lets you model concerns separately, for example:

- mode selection
- safety
- occupancy
- override
- retry/watchdog behavior
- pulse or transition sequencing

Each machine stays small and focused, while priority/controller logic decides which one gets to drive shared outputs at a given moment.

### State combining

Small machines often need to be observed together without being collapsed into one giant graph.

That is what `combinestateproperty` is for:

- keep the underlying machines separate
- publish their combined state as a normal property
- attach extra logic only where the combination actually matters

This avoids state explosion while still letting the system react to meaningful joint conditions.

### Why this matters

This means the goal in Casa is usually not:

- define one machine that cares for everything

It is instead:

- define several smaller machines that each care about one concern
- let them compete where intent conflicts
- let them combine where joint state matters

That pattern is central to how Casa models complex Things.

## Thing Composition

Another major source of power in Casa is that state-machine composition is not limited to one flat Thing.

Because Things can be composed from child Things, parts of a Thing can define:

- properties
- events
- local state machines

and state models defined above them can react to those signals.

This means behavior can be assembled structurally as well as logically:

- leaf Things describe local device/part behavior
- parent Things observe and compose those outputs
- higher-level state machines turn part-level signals into aggregate behavior

### Why this is important

Without Thing composition, state competition and state combining would still be useful, but mostly within one object.

With Thing composition, you get another level:

- the internals of a Thing can contribute signals upward
- parent-level machines can coordinate several parts
- parent state can also propagate back down where that makes sense

So Casa can express:

- local behavior inside each part
- aggregate behavior across the whole Thing
- shared control intent across the tree

### Property propagation is the key mechanism

The implementation in:

- `src/thing.js`
- `src/property.js`

lets properties move through the Thing tree using propagation rules such as:

- `propagateToParent`
- `propagateToChildren`
- `ignoreParent`
- `ignoreChildren`

That means a child Thing can expose a property which becomes available to a parent-level state model, and a parent Thing can publish properties downward for children to use as inputs.

In practical terms:

- a child sensor/actuator Thing can define the raw state
- a parent controller Thing can define a higher-level `stateproperty`
- sibling behavior can be coordinated indirectly through parent-visible properties/events

### How this relates to state machines

This composition model amplifies the state-machine design described above:

- small machines can live close to the behavior they model
- parent machines do not need to re-implement child detail
- combined and competing state can happen across a Thing hierarchy, not just inside one flat object

So the full Casa pattern is not just:

- small state machines compete
- small state machines combine

It is also:

- composed Things contribute properties/events upward
- higher-level state machines use those contributions to model the whole

That is a big part of why Casa can model fairly rich systems without collapsing into one enormous state graph.

### `globalPriority` and inherited state properties

There is an especially important detail here.

When a propagated parent property is itself a `stateproperty` and `globalPriority` is enabled, `Thing.inheritParentProps()` recreates it in children as a state property with the same state names and priorities, instead of reducing it to a plain value property.

That means composed Things can share not just state values, but also state-priority semantics across the tree.

This makes composition stronger because:

- parent-defined intent can stay state-aware in children
- the priority model can remain meaningful across Thing boundaries

### Short assessment

This is one of the reasons Casa feels more powerful than a normal FSM framework.

The model is not only:

- stateful
- competitive
- combinational

It is also compositional in the object-tree sense.

That lets parts of a Thing define behavior locally while still feeding a larger state model above them.

## Minimal Example

```json
{
  "name": "door-state",
  "type": "stateproperty",
  "initialValue": "closed",
  "ignoreControl": true,
  "takeControlOnTransition": true,
  "states": [
    {
      "name": "closed",
      "sources": [
        { "event": "open-requested", "nextState": "opening" }
      ]
    },
    {
      "name": "opening",
      "actions": [
        { "property": "motor-open", "value": true }
      ],
      "sources": [
        { "property": "fully-open", "value": true, "nextState": "open" }
      ]
    },
    {
      "name": "open",
      "actions": [
        { "property": "motor-open", "value": false }
      ],
      "sources": [
        { "event": "close-requested", "nextState": "closing" }
      ]
    },
    {
      "name": "closing",
      "actions": [
        { "property": "motor-close", "value": true }
      ],
      "sources": [
        { "property": "fully-closed", "value": true, "nextState": "closed" }
      ]
    }
  ]
}
```

## Top-Level `stateproperty` Options

Common options:

- `name`: property name.
- `type`: must be `stateproperty`.
- `initialValue`: initial state name.
- `states`: array of state definitions.
- `priority`: default priority for the property if a state does not override it.
- `ignoreControl`: if `true`, actions bypass normal source control arbitration.
- `takeControlOnTransition`: if `true`, the state property may take control even when a transition itself does not emit actions.
- `allSourcesRequiredForValidity`: passed through to the underlying property validity model.
- `removeDuplicates`: defaults to `true`; property/event actions emitted during a transition are buffered and deduplicated by target name.
- `globalPriority`: used when this property is propagated to children and should keep state priorities there too.

Behavior notes:

- If `states` is omitted, Casa creates a synthetic `DEFAULT` state.
- If `DEFAULT` is not provided, Casa adds one automatically.
- Exact state-name matches win first.
- If no exact match exists, regex states are checked in declaration order.

## State Definition Shape

Each entry in `states` is a `State` config. Supported fields:

- `name`: state name.
- `regEx`: regular expression for matching dynamic state names.
- `priority`: per-state priority override.
- `source` or `sources`: transitions and source-driven reactions.
- `action` or `actions`: actions applied on entry or when guards become true.
- `guard` or `guards`: state-level guards.
- `timeout`: timer definition.
- `counter`: cross-source counting rule.
- `schedule` or `schedules`: scheduled events tied to the active state.
- `actionHandler`: stored on the state, but action handlers are usually expressed on actions with `handler`.

Single-item forms are normalized internally:

- `source` becomes `sources: [source]`
- `action` becomes `actions: [action]`
- `guard` becomes `guards: [guard]`
- `schedule` becomes `schedules: [schedule]`

## Sources: How States Transition

State transitions usually happen through `sources`.

Each source can listen to:

- a property change
- an event
- a source on another Thing via `uName`

Examples:

```json
{ "property": "movement", "value": true, "nextState": "occupied" }
```

```json
{ "event": "button-pressed", "nextState": "active" }
```

```json
{ "uName": ":building-1", "property": "alarm-state", "value": "armed", "nextState": "locked" }
```

Useful source fields:

- `uName`: optional source owner; defaults to the current Thing.
- `property`: property to watch.
- `event`: event to watch.
- `value`: value that must match.
- `invert`: invert the value comparison.
- `nextState`: target state when the source matches.
- `handler`: owner method to call instead of transitioning.
- `action` or `actions`: actions to apply when the source matches.
- `guard` or `guards`: extra conditions gating the source.
- `count`: mark this source as part of a state counter.

Behavior notes:

- For property sources, Casa also checks on state entry whether the property already matches; this can cause an immediate transition.
- For event sources, the transition happens when the event arrives.
- `nextState` may use the special value `PREVIOUS-STATE`.

## Guards

Guards are additional conditions checked before a source or action fires.

Guard fields:

- `property`: property to inspect.
- `value`: required value. Defaults to `true`.
- `invert`: invert the equality check.
- `previousState`: require a specific previous state.
- `active`: if `true`, the guard is live-watched as its own source listener.

Example:

```json
{
  "event": "arm-requested",
  "guards": [
    { "property": "tamper", "value": false },
    { "property": "power-ok", "value": true }
  ],
  "nextState": "armed"
}
```

### Active vs non-active guards

This distinction matters a lot.

- `active: false`:
  - the guard is only checked when the enclosing source/action is being evaluated
  - this is the simpler default
- `active: true`:
  - Casa creates a listener for the guard property itself
  - if the guard flips into a matching value while the state is active, Casa can immediately re-evaluate the guarded source/action

This is what powers patterns like “stay in this state, but if guard X becomes true later, immediately transition/apply action.”

### State-level guards

States also support top-level `guard` / `guards`.

In practice, the clearer and more common pattern in this codebase is to put guards on:

- a source
- an action

State-level guards are best treated as an advanced facility for immediate-on-entry checks.

## Actions

Actions are things a state machine does. They are most often used to:

- set a property
- raise an event
- call an owner method

Basic property action:

```json
{ "property": "target", "value": "closed" }
```

Basic event action:

```json
{ "event": "confirm-event" }
```

Handler action:

```json
{ "handler": "testActionFunction" }
```

Action fields:

- `property`: property to set.
- `event`: event to raise.
- `value`: literal value.
- `fromProperty`: copy from another local property before applying.
- `source`: read the action value from another source listener before applying.
- `apply`: expression evaluated against the current property value.
- `delay`: defer the action by N seconds.
- `guard` or `guards`: action-level guards.
- `handler`: call `owner[handler](currentState)` if this state property can take control.

### `fromProperty`

```json
{ "property": "entry-timeout", "fromProperty": "night-entry-timeout" }
```

### `source`

```json
{ "property": "entry-timeout", "source": { "property": "config-timeout" } }
```

### `apply`

`apply` is evaluated dynamically. The implementation substitutes:

- `$value`: current value of the target property
- `$stateDuration`: seconds since the current state was entered

Example:

```json
{ "property": "retry-count", "apply": "++$value" }
```

Example using state duration:

```json
{ "property": "elapsed-seconds", "apply": "$stateDuration" }
```

## Timers and Timeouts

States can define a `timeout`.

Supported forms:

- fixed duration
- duration from a property
- duration from another source
- inherited remaining time from previous states

### Fixed duration

```json
{ "timeout": { "duration": 5, "nextState": "timed-out" } }
```

### Duration from property

```json
{ "timeout": { "property": "movement-timeout", "nextState": "idle" } }
```

### Duration from source

```json
{ "timeout": { "source": { "property": "external-timeout" }, "nextState": "idle" } }
```

### Inherited timer

```json
{
  "name": "confirmed",
  "timeout": { "from": ["triggered"], "nextState": "timed-out" }
}
```

With `from`, Casa carries over the previous state's remaining time instead of restarting from scratch.

### Timeout actions

Timeouts can also emit actions before the transition:

```json
{
  "timeout": {
    "duration": 2,
    "action": { "property": "pulse", "value": false },
    "nextState": "idle"
  }
}
```

Notes:

- `duration` is in seconds.
- `0` means transition immediately.
- negative durations effectively behave like “do not schedule a timer.”
- if a timeout uses `source`, updates from that source while the state is active reset the timer.

## Counters

States can count source hits across one or more sources.

Source-level requirement:

```json
{ "event": "trip-1", "count": true }
```

State-level counter:

```json
{
  "counter": {
    "limit": 3,
    "nextState": "confirmed",
    "action": { "event": "confirm-event" }
  }
}
```

Counter fields:

- `limit`: threshold that triggers the counter.
- `nextState`: optional transition after the threshold is met.
- `action` or inherited `actions`: actions to apply when the threshold is met.
- `unique`: if `true`, each counted source only contributes once.
- `from`: inherit count state from specific previous states.

Behavior:

- per-source counts live on the counted sources
- total count lives on the state-level `counter`
- inheritance lets follow-on states continue the count instead of resetting it

This is used heavily in `housealarm` for “confirm after N trips” style behavior.

## Schedules

States can register scheduled events through the `scheduleservice`.

Example:

```json
{
  "name": "armed",
  "schedules": [
    {
      "name": "night-check",
      "rule": "0 0 * * * *",
      "nextState": "verify"
    }
  ]
}
```

Important schedule fields:

- `name`: event name to raise.
- `rule` or `rules`: cron-like rule or rules.
- `active`: optional, defaults to `true`.
- `value`: optional event value.
- `nextState`: optional transition if the schedule fires while this state is current.
- `guard` or `guards`: optional guards checked when the schedule fires.

Schedule behavior:

- schedules are registered once when the `State` is created
- the callback only takes effect if this is still the current state
- on trigger, Casa starts a scheduled transaction, raises the named event, and optionally transitions
- using schedules requires `scheduleservice`

## Regex States

States can match by regex instead of by exact name.

Example:

```json
{
  "name": "test-regex-matched-state-1",
  "regEx": "^[A-Za-z]+$",
  "action": { "event": "matched", "value": true }
}
```

Rules:

- exact state names are checked first
- regex states are checked second, in declaration order
- if nothing matches, Casa falls back to `DEFAULT`

Regex states are useful when:

- a combined state produces many dynamic values
- you only care about families of names

## `PREVIOUS-STATE`

`nextState` can use the special token `PREVIOUS-STATE`.

Casa resolves it to the previous matched state's name at transition time.

This is useful for temporary detours such as:

- pause states
- retry wrappers
- “pulse then resume”

## Action Buffering and Deduplication

By default, `stateproperty` buffers actions while a transition is being resolved.

Why:

- a transition may immediately chain into another transition
- multiple states/sources may write the same property in one logical move

With `removeDuplicates: true`:

- property actions are deduplicated by property name
- event actions are deduplicated by event name
- later writes win

This keeps multi-step immediate transitions from spamming repeated writes.

## Control and Priority Model

Casa state machines are tied into the normal source control system.

Key points:

- a `stateproperty` has a base `priority`
- each `state` can override that priority
- before applying actions, the state property tries to take control of the owning source
- if it cannot take control, property/event actions are suppressed
- `ignoreControl: true` bypasses that arbitration

Important behaviors:

- entering a state with actions usually causes a control attempt
- entering a state with no actions still calls `takeControl` if needed so that control ownership stays aligned
- if control later moves back to this state property, Casa re-applies the current state's actions via `becomeController()`

### Parent-priority inheritance

If a state does not define its own priority, it inherits the parent property priority in contexts where that priority was supplied during the transition.

### `globalPriority`

When a `stateproperty` is propagated to children and `globalPriority` is true, `Thing.inheritParentProps()` recreates it as a child `stateproperty` with the same state names and per-state priorities instead of flattening it to a plain property.

This is mainly used by `modeproperty`.

## `combinestateproperty`

`combinestateproperty` is a thin wrapper around `stateproperty`.

It:

- watches multiple source properties
- builds one combined state string
- feeds that string back through the normal state matching logic

Config:

```json
{
  "name": "room-state",
  "type": "combinestateproperty",
  "separator": "-",
  "sources": [
    { "property": "users-present-state" },
    { "property": "day-state" }
  ],
  "states": [
    { "name": "users-present-night", "priority": 20 },
    { "name": "DEFAULT", "action": { "event": "room-state-changed" } }
  ]
}
```

Behavior:

- on cold start, it reads all configured source properties and builds the initial combined value
- on source updates, it rebuilds the combined string and sets itself to that value
- the resulting value is then matched against exact states, regex states, or `DEFAULT`

This is how `room`, `access`, `housealarm`, and `sumppump` build higher-level states out of smaller state machines.

## `modeproperty`

`modeproperty` is a specialized wrapper that builds a `stateproperty` for mutually exclusive modes.

It adds patterns like:

- resting mode
- per-mode duration properties
- per-mode active flags
- optional “requires exactly one active mode” validation

Use it when the problem is “select one mode for a duration” rather than a free-form state machine.

## `modelproperty`

`modelproperty` creates a hidden companion state property named:

- `<name>-model`

It is useful when:

- a property has a state-machine-backed internal model
- you want the public property and the internal model to stay separate

## Mesh Machines: Composing Multiple State Machines In One Thing

One of Casa's strongest patterns is that a Thing can contain several smaller state machines instead of one giant one.

Examples in this repo:

- `room.js` combines day-state, users-present-state, scene-state, room-state, and override-related state
- `access.js` combines movement-state, access-state, alarm-state, access-alarm-state, auto-close-state, and start-pulse-state
- `housealarm.js` combines arm-mode-state, arm-state, and alarm-state

This is what is sometimes described as a "mesh machine".

The key idea is exactly this:

- each `stateproperty` models one concern
- machines communicate through normal Casa properties and events
- `combinestateproperty` exposes an emergent combined state when useful
- controller ownership and priority decide which machine is allowed to drive shared outputs

This is different from a classic single finite-state machine.

Instead of forcing all concerns into one graph, Casa lets you split them into:

- local machines with focused responsibilities
- derived properties that connect them
- combined-state machines that react to the cross-product only where needed

### Why this works well in Casa

Casa already has the right primitives for this style:

- normal properties/events as the wiring surface
- source listeners as the dependency mechanism
- `stateproperty` for local transition logic
- `combinestateproperty` for state composition
- source control arbitration for shared outputs

That means the "mesh" is not a special subsystem. It is built from the same primitives used elsewhere in the runtime.

### The role of controller and priority

The controller model is what stops a mesh from becoming pure chaos.

When multiple state machines in one Thing can influence the same output:

- each machine carries a current priority
- states may override the property's default priority
- a machine tries to take control before applying actions
- if it loses arbitration, its actions do not drive the target
- if it later regains control, Casa can re-apply the active state's actions

So priority is not just metadata. It is the conflict-resolution layer that lets several machines coexist safely around the same controlled source.

In practice this gives you a useful pattern:

- low-priority machines express default behavior
- medium-priority machines express situational behavior
- high-priority machines express safety, override, or explicit user intent

### What `combinestateproperty` adds

`combinestateproperty` is especially important in this model.

It lets you:

- keep the underlying machines separate
- observe their joint state as one property
- attach extra logic only where the combination matters

That avoids flattening everything into one huge state graph too early.

For example:

- one machine can represent motion
- one can represent access position
- one can represent alarm condition
- a combined machine can only step in for the specific mixed cases that matter operationally

### Why "mesh machine" is a fair name

I think the term fits because the behavior is:

- distributed across several state machines
- connected through shared state and events
- partially coordinated by derived/combined states
- stabilized by controller/priority arbitration

It is not merely "multiple FSMs." The interesting part is that they form a live network of constraints and intentions around the same Thing.

### Strengths of the approach

- It keeps each machine smaller and easier to reason about locally.
- It matches real device/process behavior, where concerns like safety, mode, occupancy, and timing often overlap rather than nest cleanly.
- It lets you add a new concern as a new machine instead of rewriting one central graph.
- It gives you a clean place to represent emergent state through combined properties.
- It works especially well for edge-control and automation problems, where many behaviors are layered.

### Risks of the approach

- The global behavior can become implicit and hard to see from any one state table.
- Priority mistakes are subtle and can look like "random" non-determinism unless you inspect control ownership.
- Too many machines writing the same outputs can make the design muddy.
- Cross-machine feedback loops are possible if transitions and actions are not carefully bounded.

### When this style is a good fit

Use the mesh-machine style when:

- the Thing genuinely has several overlapping concerns
- each concern can be expressed as a small local machine
- only a small number of outputs are actually contested
- priority ordering between concerns is meaningful

This is usually a very good fit for:

- access/gate/door controllers
- alarms and staged safety logic
- room/building behavior
- multi-mode automation
- edge-control systems with overrides, watchdogs, and retry logic

### Recommended discipline for mesh-machine designs

To keep this style understandable:

1. Give each state machine one concern only.
2. Use `combinestateproperty` for observation and exceptional combination logic, not for everything.
3. Reserve high priorities for true overrides, safety, or explicit user actions.
4. Avoid having many machines write the same output unless there is a clear arbitration story.
5. Expose derived diagnostic properties when the emergent behavior would otherwise be opaque.
6. Add focused integration tests around controller handoff and priority wins.

### Short assessment

My view is that this is one of Casa's most original ideas.

Done carefully, it is more expressive than a single big state machine and more maintainable than burying the same logic in ad hoc property transforms.

The tradeoff is that architecture matters more:

- good boundaries make it elegant
- weak boundaries make it hard to debug

## Runtime Extension Facilities

`State` also supports dynamic sources at runtime:

- `state.addNewSource(config)`
- `state.removeExistingSource(config)`

These dynamic sources:

- are not persisted
- create source listeners immediately
- can participate in guards, counters, and transitions

This is an advanced facility and is mostly useful when a Thing discovers new inputs after startup.

## Patterns Used in This Repo

### 1. Core machine + combined machine

Seen in `housealarm`, `access`, and `room`.

Pattern:

- build 2 or more small state machines
- combine them with `combinestateproperty`
- hang timeout/alarm/scene logic off the combined state

### 2. Pulse state

Seen in `car` and `access`.

Pattern:

- transition to a short-lived state
- emit one or more actions
- use a tiny timeout to move to the next stable state

### 3. Counter-confirmed transitions

Seen in `housealarm`.

Pattern:

- mark specific sources with `count: true`
- attach a state-level `counter`
- trigger confirmation after N hits

### 4. Guarded activation

Seen in `access`.

Pattern:

- enter a waiting state
- use `active: true` guards so later property changes can unlock a transition or action

## Practical Caveats

These are worth knowing when authoring configs:

- Exact state names are simpler than regex states; prefer exact names unless you truly need pattern matching.
- Source-level guards and action-level guards are more common and clearer than top-level state guards.
- If a timeout references a property or source, make sure the resolved value is numeric or a numeric string.
- Delayed actions belong to the state; they are cleared when the state exits.
- `ignoreControl: true` is common for internal orchestration state machines because it avoids fights with normal source controllers.
- `takeControlOnTransition: true` is useful when you want priority/controller state to follow the machine even when the transition itself does not emit property actions.

## Recommended Way To Author A New State Machine

1. Start with a plain `stateproperty`.
2. Keep the first version small: named states, direct `sources`, direct `actions`.
3. Add `timeout` only after the base transition graph is stable.
4. Use `combinestateproperty` to compose smaller machines rather than building one giant graph too early.
5. Use `active: true` guards only when you need a state to react to guard changes after entry.
6. Add counters only when you need multi-hit confirmation.
7. Reach for `modeproperty` only when the behavior is truly mode-like.

## Good Reference Files

- `src/test/configs/test-stateproperty.json`
  - dedicated coverage for regex states, guarded sources/actions, timeout inheritance, counters, `apply`, `fromProperty`, timeout-from-source, and control behavior
- `src/test/configs/test-combinestateproperty.json`
  - focused combined-state examples
- `src/things/room.js`
  - approachable real-world state composition
- `src/things/access.js`
  - advanced guarded and timeout-driven machine
- `src/things/housealarm.js`
  - counters, composition, and multi-stage orchestration
