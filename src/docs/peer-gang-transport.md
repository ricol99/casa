# Peer Gang Transport

This note captures the current cross-gang source transport architecture. It is intended as a checkpoint before refactoring `PeerCasa`; `PeerCasa` should move toward these primitives, but that refactor is deliberately out of scope for this phase.

## Product Model

A `gang` is the runtime boundary used by Casa. A managed site can map to a gang, but the local runtime does not need the managed-site term.

Cross-gang communication is subscription-scoped. A local Casa asks for a specific remote source property or event; it does not receive all global source updates from the remote gang.

Same-gang `PeerCasa` is still broader by policy today: casas within a gang can see normal peer/global updates. The future `PeerCasa` refactor should reuse the transport/session/protocol primitives, while preserving that same-gang policy distinction.

## Addressing

Peer casa sessions use a gang-qualified casa address:

```text
gang-casa://<gang>/<casa-uName>
```

Example:

```text
gang-casa://farm-gate/:barn-controller
```

Source-listener configuration does not use this URI. Remote source listeners identify a remote source by:

```js
{
   gang: "farm-gate",
   uName: ":building",
   property: "gate-open"
}
```

The source-owner discovery step resolves that logical source request to a serving casa endpoint.

## Main Classes

`CasaDiscoveryService`

Owns discovery as a Casa capability. It dispatches source-owner requests to any discovery transport that implements `discoverSourceOwner()`.

`MdnsDiscoveryTransport`

Discovers LAN gang-casa availability through mDNS adverts and queries LAN candidates for source ownership with `POST /casa/source-owner`.

`PusherDiscoveryTransport`

Uses the Pusher control channel for remote status and source-owner request/response.

`IoMessageSocketService`

Provides socket-like sessions over bearer transports such as `http` and `pusher`.

`PeerSocketSession`

Owns socket listener registration and heartbeat timers.

`PeerSourceCommandProtocol`

Carries remote source write commands. `PeerGangCasa` keeps writes disabled by default.

`PeerSourceSubscriptionProtocol`

Carries `subscribe-source`, `unsubscribe-source`, `source-property-changed`, `source-event-raised`, and `source-invalid`.

`PeerGang`

Local representation of a remote gang namespace. It owns sparse `PeerGangSource` objects, source-owner mappings, remote source listeners, and `PeerGangCasa` sessions.

`PeerGangCasa`

A session to a remote casa in a remote gang. It handles login, subscriptions, event/property forwarding, and local subscription cleanup.

## Pusher Flow

The Pusher app is currently treated as the organisation boundary. The control channel is still named `control-channel`; if a single Pusher app ever spans multiple organisations, this channel must become organisation-scoped.

Control events:

```text
status-request
status-update
source-owner-request
source-owner-response
```

Status messages include gang, casa name, concrete address, and status. `CasaDiscoveryService` emits `gang-casa-up` and `gang-casa-down` separately from same-gang `casa-up` and `casa-down`.

Message sessions use channel names derived from the gang-casa address. The address is base64url encoded internally so the public socket API can stay readable.

## LAN Flow

mDNS adverts publish:

```js
{
   id: casaName,
   casaUName: ":barn-controller",
   gang: "farm-gate"
}
```

When an advert is seen, `MdnsDiscoveryTransport` records a LAN candidate and emits `gang-casa-up` with:

```js
{
   gang: "farm-gate",
   casaName: ":barn-controller",
   address: { host: "barn.local", port: 50000 },
   messageTransportName: "http",
   tier: 1
}
```

Source-owner discovery over LAN is HTTP:

```http
POST /casa/source-owner
content-type: application/json
```

Request:

```js
{
   requestId: "main-house::home-controller:...",
   gang: "farm-gate",
   uName: ":building",
   property: "gate-open"
}
```

Success response:

```js
{
   ok: true,
   requestId: "...",
   gang: "farm-gate",
   uName: ":building",
   property: "gate-open",
   casaName: ":barn-controller",
   address: { host: "192.168.1.10", port: 50000 },
   messageTransportName: "http"
}
```

If the HTTP response does not include a usable host/port, the requester falls back to the mDNS candidate address.

## Subscription Flow

1. A local source listener requests a remote gang/source/property or event.
2. `PeerGang` asks `CasaDiscoveryService.discoverSourceOwner()`.
3. Discovery returns a serving casa name, address, and message transport.
4. `PeerGang` creates or reuses one `PeerGangCasa` for that casa.
5. `PeerGangCasa` opens a socket over `IoMessageSocketService`.
6. Peer-gang login completes.
7. `PeerGang` sends `subscribe-source` for listeners owned by that serving casa.
8. The remote `PeerGangCasa` attaches one local listener per source/property/event key.
9. Remote property/event changes are forwarded to the local `PeerGangSource`.

Duplicate remote-side subscriptions are ref-counted. The underlying local listener is removed only when the last matching `unsubscribe-source` arrives. Session teardown forces all local subscriptions to be removed regardless of ref-count.

## Lifecycle

`PeerGangCasa` currently uses these states:

```text
idle
connecting
connected
rejected
unavailable
```

`PeerGang` prevents duplicate pending sessions to the same remote casa. If a `PeerGangCasa` is already connected or connecting, new subscriptions reuse it.

Transient loss:

```text
disconnect / error / heartbeat-lost
```

The source-owner mapping is cleared, affected `PeerGangSource`s are invalidated, and source-owner discovery is retried.

`gang-casa-up`

Retries unresolved source-owner discovery for that remote gang.

`gang-casa-down`

Acts as an early availability hint. If it names a tracked `PeerGangCasa`, the socket is explicitly disconnected, affected sources are invalidated, the session is removed from `PeerGang`, and source-owner discovery is retried. Later socket-level disconnect/error events are ignored idempotently.

`login-rejected`

Hard reasons currently include:

```text
wrong-gang
unauthorized
forbidden
```

Hard rejects invalidate affected sources and remove the `PeerGangCasa` without immediate rediscovery. Other rejection reasons use the transient unavailable path.

## Write Policy

Remote writes through `PeerGangCasa` are disabled by default. `allowWrites` must be explicitly set on the `PeerGangCasa` config before command protocol calls can be sent.

The permission model for cross-gang writes is not yet designed. Until it is, subscription-only read propagation is the supported cross-gang behavior.

## Test Coverage

Important tests:

```text
npm run test:casadiscovery-source-owner
npm run test:peergang
npm run test:peergangcasa
npm run test:peergang-lan-integration
npm run test:peergang-architecture
npm run test:pusher-fragmentation
```

The LAN integration test uses real source-owner HTTP handling, real `IoMessageSocketService`, and real `PeerGang` / `PeerGangCasa` subscription flow with a deterministic in-memory LAN bearer.

## PeerCasa Refactor Direction

Do not refactor `PeerCasa` in this phase.

When that work starts, the first thin slice should be socket/session plumbing:

1. Add tests around current `PeerCasa` login and login ack behavior.
2. Move listener registration and heartbeat toward `PeerSocketSession`.
3. Keep current same-gang wire messages compatible.
4. Move source command/subscription behavior toward `PeerSourceCommandProtocol` and `PeerSourceSubscriptionProtocol`.

The goal is for `PeerCasa` and `PeerGangCasa` to become policy classes over the same discovery/session/protocol spine.
