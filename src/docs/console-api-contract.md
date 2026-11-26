# Casa Console API Contract

This document covers source inspection and configuration preview in the Casa device repository.

## Interfaces

| Interface | Entry point | Implementation |
| --- | --- | --- |
| Runtime console | `/consoleapi/io` on a running Casa | [`src/services/consoleapiservice.js`](../services/consoleapiservice.js) |
| Browser console | `/webui/index.html` and `/webuiapi/io` on the global console | [`src/console.js`](../console.js), [`src/webui/app.js`](../webui/app.js) |
| MCP | HTTP at `/mcp` by default when configured | [`src/services/mcpservice.js`](../services/mcpservice.js) |

The MCP service has its own tool contract. It exposes `casa.get_named_object_tree`, `casa.get_control_status`, `casa.set_mode_manual`, `casa.release_manual_override`, `casa.renew_manual_override`, `casa.set_property`, `casa.export_config`, `casa.preview_config`, `casa.deploy_config` `casa.restart`, `casa.list_scenes`, `casa.get_scene_status`, `casa.set_scene` and `casa.release_scene`.

`casa.get_control_status` is read-only and requires `{ "uName": ":room" }`. Its text and structured results contain the same status object: object identity/display name, `observedAt` (UTC ISO timestamp), current `mode`, `modeValid`, `timingAuthority` (`local` or `peer`), and controller identity/state without numeric priorities.

`manualOverride.status` is `inactive`, `timed`, `indefinite` or `unknown`. A timed override includes `remainingSeconds` (rounded up from the owning mode’s published expiry) and `endsAt` (UTC ISO timestamp); otherwise those fields are null. The configured duration is never presented as a countdown. The owner publishes `MODE-EXPIRES-AT` (UTC epoch milliseconds; -1 means no active mode timer) and `MODE-RESTING-STATE`. Both are ordinary mirrored properties. Missing, cold or invalid metadata yields unknown timing, including peers running older code.

`returnToAuto.status` is `already_auto`, `expected`, `not_scheduled` or `unknown`. `expectedAt` is populated when the published expiry is timed and `MODE-RESTING-STATE` is auto. It estimates manual expiry, followed by normal settling, provided no other mode or override intervenes. An indefinite override reports `not_scheduled`. This supports wording such as “The room is in manual mode; automatic control is expected to resume in about two minutes.” It does not promise a particular output or hardware state. The tool does not change mode, renew timers, set properties or start a transaction. Missing arguments, unknown targets and targets without MODE return JSON-RPC errors. Focused coverage: `src/test/mcp_control_status_test.js`.

## Generic property writes across Casas

Control implementations use the generic source interface for local sources and `PeerSource` mirrors. A remote object's `type` is `peersource`, regardless of whether the owner is a building, room or device. Domain commands remain in their appropriate Console API, but must not depend on the owner's concrete class or local state-machine methods.

```js
source.setProperty('MANUAL-MODE-DURATION', 300, {
   sourceName: 'console',
   forceUpdate: true
});
```

Boolean `forceUpdate: true` makes an unchanged value follow the normal property-update notification path for this write. For an active mode whose timeout listens to that duration property, the notification resets its timer. It does not change the persistent `alwaysUpdate` configuration or enter manual mode by itself. Ordinary subsequent equal-value writes remain suppressed. The Property gate also honours configured `alwaysUpdate`, matching the existing Thing and Source checks.

PeerSource copies the caller data; PeerCasa passes it to `PeerSourceCommandProtocol`, which preserves metadata for ordinary and ramped writes across Socket.IO. The method arguments supply the target/property/value or ramp, and the request layer supplies request identity. The receiver passes the request data to the generic owning-source method. Source removes `forceUpdate` from emitted notifications so listeners do not inherit a forced-write instruction. This is a write option, not a new remote renewal command. MCP manual tools use these generic property writes through the shared SourceBaseConsoleApi for local and peer targets.

Coverage includes `peercasa_command_protocol_test.js` for metadata and dispatch, and `scene_switching_runtime_test.js` for local and real loopback Socket.IO timer renewal, ordinary equal-value suppression, and preservation of manual mode. No physical hardware is used.

## Building scenes: MCP and console commands

Scene commands use `BuildingConsoleApi` through the building's generic property interface, including peer mirrors. They operate the existing `SCENE` modeproperty buttons, without entering, renewing or releasing manual mode. The separate room `scene-state` cycle is not exposed by these tools.

| MCP tool and arguments | Building-scope console command | Result |
| --- | --- | --- |
| `casa.list_scenes({uName})` | `listScenes` | Configured scene names/default durations and current `sceneStatus`. A default of -1 means no timeout. |
| `casa.get_scene_status({uName})` | `getSceneStatus` | Current scene status. |
| `casa.set_scene({uName, scene})` | `setScene <name>` | Select a configured scene through its Boolean selector, returning `{ok, completed, sceneStatus}`. Selecting an already active scene does not renew its timer. |
| `casa.release_scene({uName})` | `releaseScene` | Clear configured scene selectors, returning `{ok, completed, sceneStatus}`. |

Console commands support `--help` and `--usage`. The API method names match the console commands. Commands use the building's SCENE property and scene selector properties for both local buildings and peer mirrors. Scene names are case-insensitive; unknown scene names return errors. Remote writes use the generic peer transport. Both transports use the same API observation: up to one second for the requested state. `completed: false` means it was not observed within that period. No result confirms physical hardware output.

Status includes `state`, `selectedScene`, `valid`, `settling`, `observedAt`, `timingAuthority` and `expiry`. Expiry is `timed` with live `remainingSeconds`/UTC `endsAt`, `indefinite`, `inactive` or `unknown`. The settling timer is not presented as scene expiry. Peer/bowing timing and invalid/cold state are not reported as authoritative local countdowns.

`rooms` lists observed room objects referencing this building, with their scene, MODE, controller identity/state and `sceneHasControl`. For local valid room scene properties, this flag compares the actual room controller with its BUILDING-SCENE property; unknown/peer ownership is null. This distinguishes “Movie is selected” from “The lounge is in manual mode.” It is an observed runtime view, not confirmation that every remote room or physical output has updated. Scene selection and release preserve existing building and room manual overrides; release permits whichever remaining controller wins, rather than guaranteeing auto.

Coverage: `building_scene_status_test.js` tests timing, unknown states, ownership and tool discovery. `scene_switching_runtime_test.js` uses a real isolated building/two-room runtime, paired API dispatch, all four MCP tools and console commands, and checks manual mode remains unchanged. Casa HTTP listening/discovery are disabled; the transport regression starts a temporary loopback Socket.IO listener. No HomeKit hardware is connected.

## MCP configuration management

MCP resolves each real object to its paired Console API object through `ConsoleApiService.findOrCreateConsoleApiObject`. Configuration operations invoke the existing `exportDb`, `previewConfig`, `replaceDb` and `restart` commands. Manual writes invoke inherited `SourceBaseConsoleApi.setManualMode`, `releaseManualOverride` and `renewManualOverride`; property writes invoke `setProperty`, retaining MCP source attribution.

- `casa.export_config({scope: "casa" | "gang"})` returns local stored database `docs`, `dbName`, and `revision`. These are configuration records, not live runtime state, and can include configured credentials.
- `casa.preview_config({options})` passes the existing preview options described below to `previewConfig`. It previews supported ownership/source changes; it is not a validator for a complete exported database. Its patch format is separate from the raw documents used for deployment.
- `casa.deploy_config({scope, expectedRevision, docs})` saves edited exported records to one local database. Preserve the unique `_id`, `_collection`, and target identity record. A stale revision is rejected. The tool writes a private backup, uses the existing database replacement command and reads back the saved configuration. On replacement failure it attempts to restore the backup and reports whether restoration succeeded. Success returns the new revision, backup path, `restartRequired: true` and `appliedToRuntime: false`.
- `casa.restart({casaName})` requires the exact name of this endpoint's Casa. It replies before requesting process exit through the existing restart command; a supervisor must relaunch Casa. It respects `ignoreRestart`. Acceptance does not confirm recovery. It does not reboot the Pi.

The normal edit flow is export, edit the records, deploy using the exported revision, then separately request restart when ready. Deployment does not hot-apply or restart automatically. Operations target the Casa serving this endpoint; they do not distribute configuration to other Pis. Existing MCP authentication applies. MCP prevents overlapping deployment/restart requests, but this is not a transaction across separate console clients or multiple databases. Database replacement is not crash-atomic; the backup is available for recovery. Structural checks and readback do not prove that a configuration will start successfully or operate hardware correctly.

Focused checks cover paired command dispatch, revision rejection, backup/rollback and deferred restart in `src/test/mcp_management_test.js`, and manual operations in `src/test/mcp_manual_control_test.js`.

## Runtime console transport

### MCP manual control

- `casa.set_mode_manual({uName, duration?})` enters manual mode. A supplied duration must be positive finite seconds; omission uses the configured default. Calling it while already manual leaves that override unchanged.
- `casa.renew_manual_override({uName, duration})` requires an active manual state and replaces its remaining duration from now. Repeating the same duration restarts the timer too.
- `casa.release_manual_override({uName})` clears the manual duration/active flag without clearing other modes. Releasing an already inactive manual override is harmless; another mode can remain active.

All three require valid MODE and manual duration/active properties and return `{ok: true, completed, controlStatus}` in both text and structured content. The shared `SourceBaseConsoleApi` uses generic `getProperty`/`setProperty` for local sources and peer mirrors; renewal sets the duration with `forceUpdate: true`. No concrete source/property type or locality gate is used for control. Matching console commands are inherited from `SourceBaseConsoleCmd`.

`ok` acknowledges write submission, not physical device completion. Immediate write rejection returns an error. The tools observe asynchronous mode processing for up to one second. `completed: false` means completion could not be observed. For renewal, the observed timer deadline must change and match the requested duration. Peer mirrors observe the owner’s published expiry, so remote renewal can report completion too. Older owners without expiry metadata still return unknown timing and cannot confirm renewal completion. Do not retry a renewal solely because completion is unobservable. Set and release can be observed through mirrored mode values. These tools do not set device outputs or clear other modes.

Connect to `/consoleapi/io` over Socket.IO. The same command interface is available through configured Pusher and Webhook Relay message transports.

### Execute a command
- Emit event: `executeCommand`
- Payload:

```json
{
  "requestId": "preview-1",
  "obj": ":",
  "method": "previewConfig",
  "arguments": [ { "patch": { "changes": [] } } ]
}
```

- Final response event: `execute-output`
- Final payload (result abbreviated):

```json
{ "requestId": "preview-1", "result": { "ok": true } }
```

The server echoes `requestId` when supplied. `result` can contain a command error.

### Streaming output (non-final)
- Intermediate messages arrive on event: `output`
- For config preview progress (`progress: true`), payload shape:

```json
{
  "result": {
    "type": "previewConfigProgress",
    "scope": "gang",
    "targetCasa": "casa-a",
    "progress": {
      "event": "preview-progress",
      "total": 120,
      "processed": 50,
      "percent": 41
    }
  }
}
```

Notes:
- `execute-output` is still the authoritative completion signal.
- `output` may contain multiple progress messages before completion. It carries no `requestId`.

### Live runtime updates
- Emit event: `subscribeLiveUpdates`
- Optional unsubscribe event: `unsubscribeLiveUpdates`
- Subscription acknowledgement event: `live-update-subscription`
- Runtime update event: `live-update`
- Payload:

```json
{
  "type": "source-property-changed",
  "data": {
    "sourceName": ":thing:lamp",
    "name": "power",
    "value": true,
    "propertyOldValue": false,
      "transaction": ":thing:lamp-1730000000000"
  }
}
```

Update `type` values:
- `source-property-changed`
- `source-event-raised`

## Browser console transport

Start the global console with `node app.js --console <gang-name>` from `src`. It serves `/webui` as the setup page and `/webui/index.html` as the runtime console. Its browser socket uses `/webuiapi/io`.

- `executeCommand` accepts `{ id, targetCasa, obj, method, arguments }`. `targetCasa` is optional. `execute-output` echoes `id` and returns `ok` with a `result` or `error` as applicable. The `ok` flag describes command execution. A preview result can carry its own `ok: false` and `errors`.
- Structured browser commands return the final result. Browser console lines use `executeConsoleLine`, can stream `output`, and finish with `console-line-output`.
- The global console subscribes to connected runtime Casas and forwards their updates as `webui-live-update` with `{ casaName, type, data }`.
- `getUnregisteredCasas` lists discovered unregistered devices. `addUnregisteredCasa` takes the proposed `name` and the device `address` and invokes the console's `casas add` command. The replies are `unregistered-casas-output` and `add-unregistered-casa-output`.

## Configuration database sync

On a runtime console connection, `getCasaInfo` returns a `casa-info` event with `dbInfo` and `gangDbInfo`. Each available database entry includes `dbName`, `hash` and `lastModified`. When automatic sync is enabled and both entries are available, the global console checks them against its local copies and pulls missing or newer databases using `exportDb`. An explicit `pushDb` or `pushDbs` sends documents through `replaceDb` or `replaceDbs` over the existing console connection.

## Contexts and Methods

### Gang context (`obj = ":"`)
- `resolveSource(sourceUName)`
- `explainSource(sourceUName)`
- `sourceUsage(sourceUName, options?)`
- `sourceTrees()`
- `previewConfig(options)`

### Casa context (`obj = ":<casaName>"`)
- `resolveSource(sourceUName)`
- `explainSource(sourceUName)`
- `sourceUsage(sourceUName, options?)`
- `sourceTrees()`
- `previewConfig(options)`

### Source context (`obj` is the source's absolute `uName`)
- `resolve()`
- `explain()`
- `usage(options?)`

Source-context methods are wrappers around the same source model methods and use the currently selected source object.

## Routing Semantics

- The runtime socket executes on the Casa handling the connection.
- The browser socket uses `targetCasa` when supplied. Otherwise the global console uses the selected or default connected Casa, or its offline console when no Casa is connected.
- The gang CLI commands `resolveSource`, `explainSource` and `sourceUsage` resolve the active source owner first and use it when connected. They fall back to the current Casa when needed. `sourceTrees` and `previewConfig` use the current execution Casa. All five commands accept `--casa` to select a connected Casa explicitly.
- `previewConfig`'s `targetCasaName` selects the Casa used by the preview engine for configuration evaluation. Use the socket connection, browser `targetCasa` or CLI `--casa` to select where the command runs.

## Source Contracts

## `resolveSource` / `resolve`
Returns instance-level ownership and active/bowed state.

```json
{
  "sourceUName": ":test-1-bedroom",
  "exists": true,
  "activeOwnerCasa": "casa-a",
  "activeProviderType": "casa",
  "instances": [
    {
      "ownerCasa": "casa-a",
      "providerType": "casa",
      "type": "bedroom",
      "superType": "thing",
      "priority": 10,
      "state": "active",
      "inSourcesMap": true,
      "inBowingMap": false,
      "connected": true,
      "scope": "casa"
    }
  ]
}
```

State values:
- `active`
- `bowed`
- `unavailable`
- `error` (invalid arbitration state: connected instance is neither active nor bowed)

Scope values:
- `gang`
- `casa`
- `runtime`
- `external-casa`

## `explainSource` / `explain`
Returns winner rationale and contender reasons.

```json
{
  "sourceUName": ":test-1-bedroom",
  "exists": true,
  "activeOwnerCasa": "casa-a",
  "activeProviderType": "casa",
  "activePriority": 10,
  "rule": "Highest priority connected instance wins; bowed instances are passive",
  "fallback": { "ownerCasa": "casa-b", "providerType": "peercasa", "priority": 0, "type": "peersource" },
  "contenders": [
    {
      "ownerCasa": "casa-a",
      "providerType": "casa",
      "priority": 10,
      "state": "active",
      "reasons": ["selected-active"]
    },
    {
      "ownerCasa": "casa-b",
      "providerType": "peercasa",
      "priority": 0,
      "state": "bowed",
      "reasons": ["bowed", "lower-priority-than-active"]
    }
  ]
}
```

## `sourceUsage` / `usage`
Options:
- `activeOnly: boolean`
- `hasConsumers: boolean`

Returns per-instance consumer and subscription info.

```json
{
  "sourceUName": ":test-1-bedroom",
  "exists": true,
  "activeOwnerCasa": "casa-a",
  "activeProviderType": "casa",
  "instanceCount": 2,
  "consumerCount": 3,
  "subscriptionCount": 5,
  "filters": { "activeOnly": false, "hasConsumers": false },
  "instances": [
    {
      "ownerCasa": "casa-a",
      "providerType": "casa",
      "priority": 10,
      "state": "active",
      "consumerCount": 2,
      "subscriptionCount": 4,
      "consumers": [ { "sourceUName": ":scene-x", "count": 2 } ]
    }
  ]
}
```

## Source Trees Contract

## `sourceTrees`
Returns authoritative runtime trees for source browsing.

```json
{
  "casaName": "casa-a",
  "activeTree": {
    "uName": ":",
    "myNamedObjects": {}
  },
  "localBowedTree": {
    "uName": ":",
    "myNamedObjects": {}
  },
  "peerTrees": [
    {
      "casaName": "casa-b",
      "connected": true,
      "tree": {
        "uName": ":",
        "myNamedObjects": {}
      }
    }
  ]
}
```

Semantics:
- `activeTree`: active local and peer sources from the live gang tree
- `localBowedTree`: bowed local sources from `casa.bowingRoot`
- `peerTrees[*].tree`: bowed remote peer sources from each `peercasa.peerRoot`

## Preview Contract

## `previewConfig`
Required options:
- `patch: object` or a JSON5 string containing an object

Optional options:
- `includeUsage: boolean`
- `limit: number` (max impacted sources to process)
- `targetCasaName: string` (mainly gang context)
- `progress: boolean` (emit progress via runtime socket `output` events; `emitProgress` is also accepted)
- `summaryOnly: boolean` (return no per-source details)
- `topChanged: number` (return only first N changed source details)

Output:

```json
{
  "ok": true,
  "scope": { "mode": "gang", "targetCasa": "casa-a" },
  "summary": {
    "impactedSourceCount": 120,
    "changedSourceCount": 24,
    "changedActiveOwnerCount": 7,
    "changedStateCount": 30,
    "addedSourceCount": 8,
    "removedSourceCount": 2,
    "addedInstanceCount": 12,
    "removedInstanceCount": 4,
    "truncated": false
  },
  "output": {
    "mode": "top-changed",
    "impactedReturnedCount": 10,
    "impactedTotalCount": 120,
    "changedReturnedCount": 10,
    "changedTotalCount": 24
  },
  "impactedSources": [
    {
      "sourceUName": ":test-1-bedroom",
      "before": { "resolve": {}, "usage": null },
      "after": { "resolve": {}, "usage": null },
      "delta": {
        "changed": true,
        "activeOwnerChanged": false,
        "instanceStateChanges": [],
        "addedInstances": [],
        "removedInstances": [],
        "usageChanged": false
      }
    }
  ],
  "warnings": [],
  "errors": []
}
```

Guardrail behavior:
- `summaryOnly=true` returns `impactedSources: []` with full summary counters.
- `topChanged=N` returns at most `N` changed items in `impactedSources`.
- If both are set, `summaryOnly` wins.

## Explicit Patch Validation

`previewConfig` explicit mode supports `changes` or `operations` arrays (not both).
Unknown fields and invalid types are rejected with `ok=false` and `errors[]`.

Common validation errors:
- unknown field in operation entry
- `priority` not numeric
- invalid `scope`
- invalid `action/op`

## CLI Command Mapping (for manual testing)

Gang:
- `resolveSource :x [--casa <name>]`
- `explainSource :x [--casa <name>]`
- `sourceUsage :x [--activeOnly] [--hasConsumers] [--casa <name>]`
- `sourceTrees [--casa <name>]`
- `previewConfig '<json>' [--file path] [--include usage] [--limit N] [--progress] [--summaryOnly] [--topChanged N] [--casa <name>]`

Casa:
- `resolveSource :x`
- `explainSource :x`
- `sourceUsage :x [--activeOnly] [--hasConsumers]`
- `sourceTrees`
- `previewConfig '<json>' [--file path] [--include usage] [--limit N] [--progress] [--summaryOnly] [--topChanged N]`

Source scope:
- `setManualMode [seconds]` (default duration if omitted; existing manual override unchanged)
- `renewManualOverride <seconds>` (restart the active manual timer)
- `releaseManualOverride` (clear only the manual override)
- All three manual commands support `--help`; durations must be positive finite seconds.
- `resolve`
- `explain`
- `usage [--activeOnly] [--hasConsumers]`

## Source inspection workflow

1. Source browser list:
- `sourceTrees`

2. Source detail panel:
- `resolveSource`
- `explainSource`
- `sourceUsage`

3. Config editor:
- `previewConfig` with `progress=true` when the client consumes runtime progress events
- For low-memory views: `summaryOnly=true` or `topChanged=<N>`

4. Apply flow:
- use preview output for confirmation, then apply with existing config write/apply path.


### Mode timer metadata

Each modeproperty generates read-only `<NAME>-EXPIRES-AT` (number) and `<NAME>-RESTING-STATE` (string), using its property name, e.g. MODE or SCENE. The timestamp comes from the actual scheduled timer, not the configured duration. It changes on entry/renewal, clears to -1 on cancellation or transition to an untimed mode, excludes internal invalid/settling timers, and is recomputed from restored remaining time on hot start. These properties use the mode's composite propagation settings and ordinary peer mirroring. Control status reads them through the generic property interface. Countdown accuracy across hosts depends on their clocks agreeing; it is an observation, not a physical-output guarantee. Scene status currently retains its separate timing implementation.
