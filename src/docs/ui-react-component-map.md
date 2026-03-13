# React UI Component Map (MVP)

This document maps the current console API contract to a concrete React implementation for a web/MCP client.

## Stack

1. React + TypeScript
2. React Router
3. TanStack Query (server state)
4. Zustand (UI/session state)
5. Socket.IO client

## Route Map

1. `/` -> redirect to `/topology`
2. `/topology`
3. `/sources`
4. `/sources/:sourceUName`
5. `/changes`
6. `/jobs` (optional placeholder)

## App Shell

## `AppShell`
Responsibilities:
1. Render top nav tabs (`Topology`, `Sources`, `Changes`, `Jobs`)
2. Render global selectors:
   - `scopeMode`: `gang | casa`
   - `selectedCasa`: casa name or `all`
3. Host connection status and toast area

Children:
1. `TopNav`
2. `ScopeSelector`
3. `CasaSelector`
4. `Outlet` (route content)
5. `SocketStatusBadge`

## State Model

## Zustand store: `useUiSessionStore`
Fields:
1. `scopeMode: 'gang' | 'casa'`
2. `selectedCasa: string | null`
3. `sourceFilters: { mode: 'exports'|'local'|'both'; prefix: string; search: string }`
4. `previewOptions: { includeUsage: boolean; progress: boolean; summaryOnly: boolean; topChanged: number; limit: number }`
5. `activeSourceUName: string | null`

Actions:
1. `setScopeMode`
2. `setSelectedCasa`
3. `setSourceFilters`
4. `setPreviewOptions`
5. `setActiveSourceUName`

## Query Keys

1. `['topology', scopeMode, selectedCasa]`
2. `['sourceInventory', scopeMode, selectedCasa, filters]`
3. `['resolveSource', scopeMode, selectedCasa, sourceUName]`
4. `['explainSource', scopeMode, selectedCasa, sourceUName]`
5. `['sourceUsage', scopeMode, selectedCasa, sourceUName, usageFilters]`
6. `['previewConfig', scopeMode, selectedCasa, requestHash]`

## API Layer

## `ConsoleApiClient`
Single abstraction used by all pages.

Core methods:
1. `execute<T>(req: ExecuteRequest): Promise<T>` via socket `executeCommand`/`execute-output`
2. `onOutput(handler)` subscribe to socket `output`

Typed wrappers:
1. `getTopology()`
2. `getSourceInventory(options)`
3. `resolveSource(sourceUName, casa?)`
4. `explainSource(sourceUName, casa?)`
5. `sourceUsage(sourceUName, options, casa?)`
6. `previewConfig(options, casa?)`

Routing behavior:
1. If `scopeMode='gang'`, default `obj=':gang'`
2. If `scopeMode='casa'`, default `obj=':<selectedCasa>'`
3. For deterministic reads in gang mode, pass explicit casa where supported (`--casa` equivalent)

## Socket Event Handling

## `useConsoleSocket()`
Responsibilities:
1. Manage socket lifecycle (`/consoleapi/io`)
2. Expose `connected`, `latency`, reconnect state
3. Expose `executeCommand` promise helper

## `usePreviewProgress()`
Responsibilities:
1. Subscribe to `output`
2. Filter `result.type === 'previewConfigProgress'`
3. Maintain in-memory map by `requestId` or active preview run token
4. Provide progress model to preview panel:
   - `event`, `processed`, `total`, `percent`, `changedSourceCount`

Note:
1. `execute-output` remains completion signal.

## Page/Component Breakdown

## Topology Page

Page:
1. `TopologyPage`

Components:
1. `TopologyHeader` (gang name, connected count)
2. `CasaHealthTable`
3. `TopologyActions` (`Open Sources`, `Open Changes`)

Data:
1. Query `getTopology()`

## Sources Page

Page:
1. `SourcesPage`

Components:
1. `SourceFiltersBar`
2. `SourceInventoryTable`
3. `SourceListRow`
4. `SourceDetailDrawer` (optional split pane)

Data:
1. Query `getSourceInventory({ mode, prefix })`
2. Row click navigate `/sources/:sourceUName` or open drawer

## Source Detail Page

Page:
1. `SourceDetailPage`

Components:
1. `SourceHeader`
2. `ResolvePanel`
3. `ExplainPanel`
4. `UsagePanel`

Data:
1. `resolveSource(sourceUName, casa?)`
2. `explainSource(sourceUName, casa?)`
3. `sourceUsage(sourceUName, { activeOnly, hasConsumers }, casa?)`

UX:
1. Place resolve/explain/usage side-by-side so precedence logic is visible immediately.

## Changes Page (Preview-first)

Page:
1. `ChangesPage`

Components:
1. `PatchInputModeToggle` (`Form Builder` | `Raw JSON`)
2. `OperationBuilderList`
3. `PreviewOptionsPanel`
4. `PreviewProgressBar`
5. `PreviewSummaryCards`
6. `PreviewChangedSourcesTable`
7. `PreviewSourceDiffDrawer`
8. `ApplyPanel` (disabled for MVP if preview-only)

Data flow:
1. Build patch object
2. Run `previewConfig({ patch, progress: true, summaryOnly: true, ... })`
3. On demand run detail preview:
   - `summaryOnly=false`
   - `topChanged=N`

Guardrail defaults:
1. `summaryOnly=true`
2. `topChanged=25`
3. `limit=200`

## Type Definitions (frontend)

Core types:
1. `ResolveResult`
2. `ExplainResult`
3. `UsageResult`
4. `SourceInventoryResult`
5. `PreviewResult`
6. `PreviewProgressMessage`

Recommended placement:
1. `src/types/consoleApi.ts`

## Suggested File Structure

1. `src/app/AppShell.tsx`
2. `src/app/router.tsx`
3. `src/lib/consoleApiClient.ts`
4. `src/lib/socket.ts`
5. `src/store/uiSessionStore.ts`
6. `src/features/topology/TopologyPage.tsx`
7. `src/features/sources/SourcesPage.tsx`
8. `src/features/sources/SourceDetailPage.tsx`
9. `src/features/changes/ChangesPage.tsx`
10. `src/features/changes/components/*`
11. `src/types/consoleApi.ts`

## Implementation Sequence

1. Build shell + socket connection + execute helper
2. Implement `TopologyPage` read-only
3. Implement `SourcesPage` with `sourceInventory` filters
4. Implement `SourceDetailPage` (`resolve/explain/usage`)
5. Implement `ChangesPage` preview-only with progress stream
6. Add detail drill-down (`topChanged`) and diff drawer
7. Add apply workflow

## Acceptance Criteria (MVP)

1. User can list sources and filter by mode/prefix/casa.
2. User can inspect one source and understand active/bowed rationale.
3. User can submit preview and see progress without polling.
4. User can run low-memory preview (`summaryOnly` / `topChanged`).
5. UI remains responsive when impacted source count is high.
