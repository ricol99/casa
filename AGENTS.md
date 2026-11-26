# Agent Guidelines (Export/Import Tree Work)

- Keep recursion centralized in `NamedObject` and keep derived classes focused on single-node `export`/`import` behavior.
- Prefer explicit context passing through traversal APIs (like `iterate`) over static/shared traversal context.
- Reuse existing tree infrastructure before adding new helpers: `iterate`, `createChildTree`, `addNamedObject`, `importTree`, and existing ownership APIs.
- Before adding helper functions, run a quick codebase check (`rg`) for equivalent capabilities already present.
- Design one canonical wire shape per flow and map types at the boundary, rather than maintaining parallel ad-hoc extraction paths.
- Keep filtering policy in one reusable predicate and apply it consistently across Casa, PeerCasa, and MCP outputs.
- Build from authoritative runtime structures (`sources`, named-object tree ownership) and avoid duplicating state derivations when existing models already track it.
- Prefer composition over special-case registries; use tree roots (for example bow roots) when that aligns with existing named-object mechanics.
- Prefer prototype methods for class/module behavior, including internal helpers when they operate on instance state, so `this` consistently means the object instance. Avoid free helper functions for instance behavior unless there is a clear reason to prefer lexical or stateless handling.
- Preserve behavior compatibility at handshake boundaries (`login` and `loginAACCKK`) whenever serialization format changes.
- Add targeted integration checks for peer login/ack import, bow/stand transitions, and tree reconstruction before/after refactors.
- Add lightweight guardrails for refactors: method-name checks, traversal coverage checks, and small focused tests to catch regressions early.
- Keep helper code minimal and justified: if a helper does not clearly reduce complexity or reuse existing primitives, do not add it.

## Generic source interface (26 November 2026)

- API and MCP control code must use the generic source/property interface (`getProperty`, `getAllProperties`, `setProperty`, and `setPropertyWithRamp`) for both local objects and peer mirrors. Remote buildings, rooms and devices appear as `PeerSource`; their runtime type is not a capability test. Do not reject generic operations because of `type`, `instanceof`, `fromPeer` or locality.
- Keep domain commands in their existing Console API (for example building scenes in `BuildingConsoleApi`), with matching console commands. Implement them through generic properties, not owner-specific methods or state-machine internals. Building scene operations must preserve manual mode.
- Extend the generic write data when new behaviour is needed, rather than inventing a remote command such as `renew`. An unchanged duration can restart its owning mode timer using `setProperty(name, duration, { forceUpdate: true })`.
- `forceUpdate` must be boolean `true`. It bypasses unchanged-value suppression for that write through Property, Thing and Source, without changing the configured `alwaysUpdate` flag. Consume it before emitting property-change notifications so listener writes do not inherit it. Ordinary subsequent writes still suppress unchanged values.
- Preserve write metadata through PeerSource, PeerCasa and the Socket.IO command serializer. Method arguments determine the destination/property/value or ramp; transport fields determine request identity. Do not mutate the caller's data or silently discard generic write options.
- Treat writes and observations as asynchronous. Request acceptance is not confirmation of observed state or physical hardware output. Do not infer remaining time from a configured duration or assume a peer mirror exposes the owner's live timer; report unknown timing when authoritative data is unavailable.
- Test local and peer paths, including a real loopback Socket.IO write, equal-value forced renewal, ordinary equal-value suppression, caller-data preservation, and unchanged manual mode. Existing MCP manual-control restrictions are still pending migration; the generic transport fix alone does not remove them.
