# Casa Service Framework

This document explains how Casa services integrate with normal property/event flow, how service-owned mirror state works, and how internal Casa transactions become queued outbound calls to external systems.

It is intended as a development note for adding or refactoring services such as MQTT-backed, HTTP-backed, or hardware-backed integrations.

## Design Goal

Casa does not treat services as a separate communication plane.

Instead, service integrations are adapted into the same property/event machinery used elsewhere in the tree. This keeps:

- propagation rules
- transaction metadata
- source listeners
- validity handling
- event logging
- peer-Casa behavior

inside one unified model.

The key idea is:

- normal Things live in "property/event land"
- services own mirror nodes under the service tree
- `serviceproperty` and `serviceevent` bridge the two
- external I/O happens only at the service/service-node boundary

## Main Pieces

## `Service`

Base class for an integration provider.

Responsibilities:

- own service nodes
- maintain the outbound queue
- rate-limit outbound work
- coalesce multiple changes from the same Casa transaction
- dispatch queued work to service-node handlers

Key file:

- `src/service.js`

## `ServiceNode`

A service-owned mirror source for a specific external entity or endpoint.

Examples:

- a Hue light
- a GPIO pin
- an MQTT topic
- a Kasa plug

Responsibilities:

- hold mirror properties/events
- subscribe to normal Casa properties/events
- turn inbound property/event changes into queued service transactions
- receive external updates and apply them back into Casa through mirror state

Key file:

- `src/servicenode.js`

## `ServiceProperty` and `ServiceEvent`

These are the bridge objects used by normal Things.

They automatically create listeners aimed at a synthetic service-owned source:

`serviceName:serviceType-id`

So a Thing can expose a normal property like `power`, while the real service interaction is routed through a mirror property on the matching service node.

Key files:

- `src/properties/serviceproperty.js`
- `src/events/serviceevent.js`

## `SourceListener`

This is the plumbing that connects a property/event to another source's property/event.

It is the mechanism used by service properties/events to bind normal Things to service-node mirrors.

Key file:

- `src/sourcelistener.js`

## Mirror Model

The normal Casa Thing does not directly call the external API.

Instead:

1. A Thing exposes a normal property or event.
2. That property/event is implemented as a `serviceproperty` or `serviceevent`.
3. The service property/event listens to a mirror property/event on a service node.
4. The service node translates changes to external I/O.

This gives a stable boundary:

- property/event land stays declarative and composable
- service code handles protocol details

## Direction Semantics

Direction is controlled by `sync`.

The implementation uses string checks:

- inbound support when `sync.startsWith("read")`
- outbound support when `sync.endsWith("write")`

So the supported modes are:

- `read`
- `write`
- `readwrite`

## `read`

Inbound only.

Meaning:

- the normal Thing property/event listens to the service-node mirror
- external updates can flow into Casa
- local Casa changes do not become outbound service commands

This is used for sensors, readings, presence detection, and other service-fed state.

Examples:

- current weather values
- BLE presence
- one-wire readings

## `write`

Outbound only.

Meaning:

- local Casa changes flow into the service-node mirror
- the service node turns those changes into outbound transactions
- updates from the service-node mirror are ignored by the bridge property/event

This is used for command-style outputs where Casa drives the external system but does not mirror state back from the service node.

Examples:

- a GPIO output-style property
- notification/event emitters

## `readwrite`

Bidirectional.

Meaning:

- local Casa changes can go out through the service node
- external updates can come back in through the same mirror surface

This is used when Casa wants both command capability and mirrored state.

Examples:

- Hue lights
- MQTT-backed properties
- integrations that both accept commands and report state

## How The Bridge Is Created

`ServiceProperty` and `ServiceEvent` synthesize a source name from:

- `serviceName`
- `serviceType`
- `id`

and then create a `SourceListener` against the relevant service-node property or event.

For properties this is effectively:

1. build `serviceName:serviceType-id`
2. listen to `serviceProperty`
3. attach subscription metadata:
   - `subscriber`
   - `sync`
   - `serviceProperty`
   - optional `subscriberProperty`
   - optional `serviceArgs`

The same pattern applies to events with `serviceEvent`.

That subscription metadata is what the service node uses to create the correct mirror surface and understand direction.

## What `serviceProperty` / `serviceEvent` Mean

The Thing-side property/event name does not have to match the service-side mirror name.

These fields let the bridge map at the boundary.

Examples:

- Thing property `available` may map to service property `state`
- Thing event `pressed` may map to service event `button`

This keeps one canonical service-side wire shape while allowing nicer Thing-side naming.

## Transaction Flow

The transaction model matters because services are intentionally fed through ordinary property/event updates.

## Step 1: A normal Casa change occurs

When a `Source` property changes, Casa emits a `property-changed` event with transaction metadata.

If no transaction is already present, the source creates or reuses one via `checkTransaction()`.

Key files:

- `src/source.js`
- `src/sourcebase.js`

## Step 2: The service-node mirror receives the change

If the bridge is outbound-capable (`write` or `readwrite`), the service-node mirror property/event is wired back to the Thing-side property/event through the subscription metadata.

When that mirror changes, `ServiceNode.propertyAboutToChange()` or `ServiceNode.eventReceivedFromSubscriber()` forwards the change to the owning service:

- `owner.notifyChange(...)`
- `owner.notifyEvent(...)`

Key file:

- `src/servicenode.js`

## Step 3: The service turns it into queued outbound work

`Service.notifyChange()` and `Service.notifyEvent()` create a service transaction object.

This includes:

- action type
- merged property/event payloads
- copied metadata
- subscriber context
- an outbound transaction key derived from service node + Casa transaction + action

If multiple updates arrive with the same internal Casa transaction id before dispatch, the service can merge them into one outbound transaction when `optimiseTransactions` is enabled.

Key file:

- `src/service.js`

## Step 4: The queue rate-limits dispatch

Each service owns a queue.

`queueQuant` controls pacing between dispatch attempts.

The queue is per-service, so all outbound work for a given service is serialized through one scheduling point.

This is how Casa prevents service code from being tightly coupled to raw property churn.

## Step 5: The service node maps to external I/O

The queued transaction is dispatched to a handler on the target service node, for example:

- `processPropertyChanged`
- `processEventRaised`
- `processSetState`
- `processGetState`

This is the point where Casa property/event changes become:

- an MQTT publish
- an HTTP call
- a hardware write
- a library call to an external system

Examples:

- `src/services/nodes/mqttservicetopic.js`
- `src/services/nodes/hueservicelight.js`
- `src/services/nodes/kasaserviceplug.js`

## Important Queueing Nuance

The base framework gives you:

- queued dispatch
- service-local pacing
- transaction coalescing before dispatch

It does not automatically guarantee "wait for previous external call to fully finish before allowing the next one".

If a service needs strict in-flight serialization or request/response gating, it should enforce that in:

- `transactionReadyForProcessing()`
- service-specific busy/in-flight state
- service-node logic

Do not assume the base queue alone gives protocol-level request/response sequencing.

## External To Internal Flow

The reverse path uses the same mirror model.

When an external system reports state:

1. the service/service node receives the update
2. the service node updates its mirror property/event
3. the Thing-side `serviceproperty` / `serviceevent` sees that update through its `SourceListener`
4. the Thing-side property/event updates normally

That means external state still arrives in Casa as ordinary property/event activity.

This is why service integrations benefit from:

- transforms
- validity handling
- propagation
- transaction logging
- consumer/source listener behavior

without inventing a parallel data path.

## Why This Works Across Casas

Because service interactions are expressed as standard source property/event changes, they naturally fit the existing Casa-to-Casa mechanisms.

The framework does not need a second peer protocol for services.

Instead:

- services update mirror state
- mirror state updates normal Things
- normal property/event traffic can participate in existing peer Casa propagation and arbitration

This is one of the main reasons the service framework is built around mirror properties/events instead of direct method calls.

## Practical Development Guidance

When adding a new service:

1. Keep protocol and transport details inside the service/service-node layer.
2. Expose normal Thing properties/events through `serviceproperty` and `serviceevent`.
3. Choose `sync` deliberately:
   - `read` for inbound-only readings
   - `write` for outbound-only commands
   - `readwrite` when both command and mirrored state are needed
4. Keep mirror naming canonical at the service boundary and map names there.
5. Use service-node handlers to translate merged property/event updates into one outbound call where possible.
6. Add readiness gating if the external protocol requires strict sequencing.

## Recommended Mental Model

Think of the service framework as:

- Casa graph on one side
- external protocol on the other
- service-node mirror state in the middle

The mirror is the handshake boundary.

Normal Casa code should mostly think in terms of properties and events.
Service code should mostly think in terms of translating mirror changes to and from the external system.

## Good Fit For `smhubservice`

An `smhubservice` should follow this model.

Recommended shape:

- keep MQTT transport logic generic in `mqttservice`
- let `smhubservice` own Zigbee2MQTT / SMHUB semantics
- model SMHUB/Zigbee devices as service nodes with mirror properties/events
- use `serviceproperty` / `serviceevent` on normal Things to bridge into those nodes

Examples of likely directions:

- sensor state like `battery`, `occupancy`, `temperature`: `read`
- commands like `permitJoin` or `removeDevice`: usually service methods or command-style events/properties, not free-form direct Thing properties unless there is a good reason
- controllable state like `power`, `brightness`, `colour-temp`: `readwrite`

## Summary

The Casa service framework exists so that communication between property/event land and integrations happens through ordinary property/event updates.

That gives Casa:

- one propagation model
- one transaction model
- one listener model
- one peer-compatible data model

The bridge objects are:

- `serviceproperty`
- `serviceevent`

The execution boundary is:

- `Service`
- `ServiceNode`

That is the pattern to preserve when extending Casa.
