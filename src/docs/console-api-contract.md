# Casa Console API Contract

This document covers source inspection and configuration preview in the Casa device repository.

## Interfaces

| Interface | Entry point | Implementation |
| --- | --- | --- |
| Runtime console | `/consoleapi/io` on a running Casa | [`src/services/consoleapiservice.js`](../services/consoleapiservice.js) |
| Browser console | `/webui/index.html` and `/webuiapi/io` on the global console | [`src/console.js`](../console.js), [`src/webui/app.js`](../webui/app.js) |
| MCP | HTTP at `/mcp` by default when configured | [`src/services/mcpservice.js`](../services/mcpservice.js) |

The MCP service has its own tool contract. It exposes `casa.get_named_object_tree`, `casa.get_control_status`, `casa.set_mode_manual`, `casa.release_manual_override`, `casa.renew_manual_override` `casa.set_property`, `casa.export_config`, `casa.preview_config`, `casa.deploy_config` and `casa.restart`.

`casa.get_control_status` is read-only and requires `{ "uName": ":room" }`. Its text and structured results contain the same status object: object identity/display name, `observedAt` (UTC ISO timestamp), current `mode`, `modeValid`, `timingAuthority` (`local` or `peer`), and controller identity/state without numeric priorities.

`manualOverride.status` is `inactive`, `timed`, `indefinite` or `unknown`. A timed override includes `remainingSeconds` (rounded up from the live timer) and `endsAt` (UTC ISO timestamp); otherwise those fields are null. The configured duration is never presented as a countdown. Invalid/cold mode values, inherited plain MODE properties and peer/bowing objects do not provide authoritative local manual timing.

`returnToAuto.status` is `already_auto`, `expected`, `not_scheduled` or `unknown`. `expectedAt` is populated only for a timed local mode machine whose resting mode is auto. It estimates manual expiry, followed by normal settling, provided no other mode or override intervenes. An indefinite local override reports `not_scheduled`. This supports wording such as “The room is in manual mode; automatic control is expected to resume in about two minutes.” It does not promise a particular output or hardware state. The tool does not change mode, renew timers, set properties or start a transaction. Missing arguments, unknown targets and targets without MODE return JSON-RPC errors. Focused coverage: `src/test/mcp_control_status_test.js`.

## MCP configuration management

MCP resolves each real object to its paired Console API object through `ConsoleApiService.findOrCreateConsoleApiObject`. Configuration operations invoke the existing `exportDb`, `previewConfig`, `replaceDb` and `restart` commands. Manual writes invoke `SourceConsoleApi.setManualMode`, `releaseManualOverride` and `renewManualOverride`; property writes invoke `setProperty`, retaining MCP source attribution.

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

All three require a valid local modeproperty and return `{ok: true, completed, controlStatus}` in both text and structured content. `ok` acknowledges the request, not physical device completion. They observe asynchronous mode processing for up to one second; `completed: false` means the requested state was not observed within that window, and the accompanying status is the actual latest snapshot. Poll `get_control_status` to follow it. Peer/bowing sources and inherited plain MODE properties must be addressed through the owning source/Casa. Invalid arguments or unsupported targets return JSON-RPC errors. These tools do not set device outputs.

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
