# Agent Guidelines (Export/Import Tree Work)

- Keep recursion centralized in `NamedObject` and keep derived classes focused on single-node `export`/`import` behavior.
- Prefer explicit context passing through traversal APIs (like `iterate`) over static/shared traversal context.
- Reuse existing tree infrastructure before adding new helpers: `iterate`, `createChildTree`, `addNamedObject`, `importTree`, and existing ownership APIs.
- Before adding helper functions, run a quick codebase check (`rg`) for equivalent capabilities already present.
- Design one canonical wire shape per flow and map types at the boundary, rather than maintaining parallel ad-hoc extraction paths.
- Keep filtering policy in one reusable predicate and apply it consistently across Casa, PeerCasa, and MCP outputs.
- Build from authoritative runtime structures (`sources`, named-object tree ownership) and avoid duplicating state derivations when existing models already track it.
- Prefer composition over special-case registries; use tree roots (for example bow roots) when that aligns with existing named-object mechanics.
- Preserve behavior compatibility at handshake boundaries (`login` and `loginAACCKK`) whenever serialization format changes.
- Add targeted integration checks for peer login/ack import, bow/stand transitions, and tree reconstruction before/after refactors.
- Add lightweight guardrails for refactors: method-name checks, traversal coverage checks, and small focused tests to catch regressions early.
- Keep helper code minimal and justified: if a helper does not clearly reduce complexity or reuse existing primitives, do not add it.
