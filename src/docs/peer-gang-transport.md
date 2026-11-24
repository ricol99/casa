# Peer Gang Transport

This guide describes cross-gang source discovery and subscriptions, and the session and protocol code shared with same-gang peers.

## Product Model

A `gang` is the runtime boundary used by Casa. A managed site can map to a gang, but the local runtime does not need the managed-site term.

Cross-gang communication is subscription-scoped. A local Casa asks for a specific remote source property or event; it does not receive all global source updates from the remote gang.

Same-gang `PeerCasa` exchanges normal peer/global updates within the gang. It shares the session and source protocol helpers with `PeerGangCasa` and keeps its own handshake, tree synchronisation and source ownership behaviour.

## Addressing

Cross-gang peer sessions use a gang-qualified casa address:

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

`WhRelayDiscoveryTransport`

Uses a Webhook Relay bucket for the same status and source-owner request/response flow as Pusher.

`IoMessageSocketService`

Provides socket-like sessions over bearer transports such as `http`, `pusher`, and `whrelay`.

`PeerSocketSession`

Owns socket listener registration and heartbeat timers for `PeerCasa` and `PeerGangCasa`.

`PeerSourceCommandProtocol`

Shares the command and response machinery for source writes. The peer classes configure their own wire events and handlers.

`PeerSourceSubscriptionProtocol`

Shares the source subscription and update machinery. Cross-gang events include `subscribe-source`, `unsubscribe-source`, `source-property-changed`, `source-event-raised`, and `source-invalid`. Same-gang peers retain their existing subscription registration and removal events.

`PeerGang`

Local representation of a remote gang namespace. It owns sparse `PeerGangSource` objects, source-owner mappings, remote source listeners, and `PeerGangCasa` sessions.

`PeerGangCasa`

A session to a remote casa in a remote gang. It handles login, subscriptions, event/property forwarding, and local subscription cleanup.

`PeerCasa`

A session to a casa in the same gang. It exchanges runtime configuration through the `login` / `loginAACCKK` handshake and manages peer source trees and ownership transitions.

## Pusher Flow

Gangs using the same Pusher app share the `control-channel` discovery channel.

Control events:

```text
status-request
status-update
source-owner-request
source-owner-response
```

Status messages include gang, casa name, concrete address, and status. `CasaDiscoveryService` emits `gang-casa-up` and `gang-casa-down` separately from same-gang `casa-up` and `casa-down`.

Message sessions use channel names derived from the gang-casa address. The address is base64url encoded internally so the public socket API can stay readable.

## Webhook Relay Flow

Webhook Relay can also act as an organisation-scoped cloud bearer when all gangs share the same bucket and API credentials. It does not require a Casa cloud host; it just carries discovery and socket envelopes through the existing Webhook Relay service.

Whrelay transport messages are normal webhook bodies with these additional fields:

```js
{
   __casaWhRelayTransport: true,
   whrelayKind: "discovery" // or "message"
}
```

Discovery uses the same logical control messages as Pusher:

```text
status-request
status-update
source-owner-request
source-owner-response
```

Message sessions use the readable gang-casa address directly in the envelope:

```js
{
   peerAddress: "gang-casa://main-house/:home-controller",
   destAddress: "gang-casa://farm-gate/:barn-controller"
}
```

Whrelay source routing is preserved. Existing whrelay property/event webhooks still route to registered whrelay sources; transport webhooks are identified by `__casaWhRelayTransport`.

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
   name: ":barn-controller",
   casaName: ":barn-controller",
   status: "up",
   address: { host: "barn.local", port: 50000 },
   discoveryTransportName: "mdns",
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

The `PeerGang` client treats these rejection reasons as hard failures:

```text
wrong-gang
unauthorized
forbidden
```

The current login handler emits `wrong-gang` when the requested target gang differs from the receiving gang. Hard rejects invalidate affected sources and remove the `PeerGangCasa` without immediate rediscovery. Other rejection reasons use the transient unavailable path.

## Write Policy

Cross-gang sessions support subscription-only propagation. `PeerGangCasa` defaults `allowWrites` to `false`. The flag gates outbound command helpers, while the receiving cross-gang session registers command-response listeners only. Same-gang `PeerCasa` handles remote source commands through its own listeners.

## Test Coverage

Important tests:

```text
npm run test:casadiscovery-source-owner
npm run test:peergang
npm run test:peergangcasa
npm run test:peergang-lan-integration
npm run test:peergang-architecture
npm run test:peer-protocol-helpers
npm run test:peercasa-lifecycle
npm run test:peercasa-command-protocol
npm run test:peercasa-subscription-protocol
npm run test:pusher-fragmentation
npm run test:whrelay-transport
```

The LAN integration test uses real source-owner HTTP handling, real `IoMessageSocketService`, and real `PeerGang` / `PeerGangCasa` subscription flow with a deterministic in-memory LAN bearer.
