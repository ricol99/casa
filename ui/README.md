# Casa UI (Scaffold)

React + TypeScript frontend scaffold for the Casa config workflow.

## What is included

- App shell and routing
- Scope/casa selectors
- Topology page (`topology`)
- Sources page (`sourceInventory`)
- Source detail page (`resolveSource`, `explainSource`, `sourceUsage`)
- Changes page (`previewConfig`) with progress stream support (`previewConfigProgress`)

## Start

```bash
cd ui
npm install
npm run dev
```

Node version:
- use Node `16.x` or newer (Node `16.0+`).

Default dev URL:

- `http://localhost:5174`

## Backend URL

By default, socket URL uses `window.location.origin`.

Set explicit backend URL with:

```bash
VITE_CONSOLE_URL=http://<casa-host>:<port> npm run dev
```

## Notes

- Command execution is serialized in the socket client because `execute-output` does not include a request id.
- This is an MVP scaffold intended to be extended with richer diff/apply workflow.
- Gang-based casa discovery is exposed at `POST /api/discovery/casas` in the UI dev server and used by the header `Gang discovery` control.
