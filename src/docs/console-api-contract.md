# Console API Contract (UI/MCP)

This document defines the current command/API contract for source inspection and config preview used by UI and MCP clients.

Related implementation guide:
- `src/docs/ui-react-component-map.md`

## Transport

### Socket.IO namespace
- Connect to `/consoleapi/io`.

### Execute a command
- Emit event: `executeCommand`
- Payload:

```json
{
  "obj": ":gang",
  "method": "previewConfig",
  "arguments": [ { "patch": { "changes": [] } } ]
}
```

- Final response event: `execute-output`
- Final payload:

```json
{ "result": { "ok": true } }
```

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
- `output` may contain multiple progress messages before completion.

## Contexts and Methods

## Gang context (`obj = ":gang"`)
- `resolveSource(sourceUName)`
- `explainSource(sourceUName)`
- `sourceUsage(sourceUName, options?)`
- `sourceTrees()`
- `previewConfig(options)`

## Casa context (`obj = ":<casaName>"`)
- `resolveSource(sourceUName)`
- `explainSource(sourceUName)`
- `sourceUsage(sourceUName, options?)`
- `sourceTrees()`
- `previewConfig(options)`

## Source context (`obj = ":<...sourceUName>"`)
- `resolve()`
- `explain()`
- `usage(options?)`

Source-context methods are wrappers around the same source model methods and use the currently selected source object.

## Routing Semantics

Gang wrappers have two behaviors:
- `resolveSource`, `explainSource`, `sourceUsage`:
  - Without `--casa`, they resolve source owner first and route to the active owner casa when connected.
  - With `--casa`, routing is forced to that casa.
- `sourceTrees`, `previewConfig`:
  - Use current execution casa unless `--casa` is provided.

For deterministic UI behavior, always pass explicit casa selection where applicable.

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
- `patch: object`

Optional options:
- `includeUsage: boolean`
- `limit: number` (max impacted sources to process)
- `targetCasaName: string` (mainly gang context)
- `progress: boolean` (emit progress via `output` events)
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
- `resolve`
- `explain`
- `usage [--activeOnly] [--hasConsumers]`

## Recommended UI Sequence

1. Source browser list:
- `sourceTrees`

2. Source detail panel:
- `resolveSource`
- `explainSource`
- `sourceUsage`

3. Config editor:
- `previewConfig` with `progress=true`
- For low-memory views: `summaryOnly=true` or `topChanged=<N>`

4. Apply flow:
- use preview output for confirmation, then apply with existing config write/apply path.
