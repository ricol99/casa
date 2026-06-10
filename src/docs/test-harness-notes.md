# Casa Test Harness Notes

This note captures the current mental model of the Casa test harness so future work can reuse it consistently.

## Purpose

The harness is designed for testing an asynchronous system of Things, properties, and events.

A test run injects external stimuli into the live system and verifies the resulting outward behavior:

- property changes
- events
- transaction lineage

The goal is that tests should pass reliably. Acceptable nondeterminism is limited to ordering changes within a single transaction.

## Runtime Shape

Tests are exercised through the real application startup path, not through a separate mock runner.

- `src/app.js` starts the normal Casa runtime.
- Configs are supplied through the normal config path selection.
- All configs must be processed by `src/utils/createdb.js` before they can be run.
- Harness runs should normally use `--nopeer` so the test node does not try to talk to peer Casas.

This applies both to automated harness configs and to manual/integration configs.

One important practical detail is that some harness configs are layered on top of a shared gang definition.

In those cases, processing only the testcase config is not enough. The shared gang config must also be processed so the loader can open both:

- the Casa DB for the testcase config
- the gang DB for the referenced gang

`test-bedroom.json` is an example of this pattern: it needs both the Casa DB from `test-bedroom.json` and the gang DB from `collin-test-gang.json`.

## Useful Runtime Flags

Some `app.js` flags matter a lot when running the harness.

- `--nopeer` is required for harness work so the node does not try to connect to peers.
- `--nopeer` also removes the peer-related settling timeout from the harness startup path.
- `--logs error` is the usual regression-testing mode.
- `--logs info` is useful when you want to see property changes and events.
- `--logs log`, or omitting `--logs`, gives full logging.

When generating JSON output from a testcase, the practical convention is to use error-only logging so the transcript is not mixed with normal runtime logs.

## Main Harness Pieces

### `tester.js`

`src/test/things/tester.js` is the main harness engine.

It:

- listens to configured output sources
- drives input events and property changes
- supports selecting one, some, or all test cases from a config
- supports reusable `testSteps`
- supports `preAmble` and `postAmble`
- supports transcript generation with `generateExpectedOutput`
- verifies expected output in normal mode
- tolerates unordered matching inside a single transaction via `simultaneous`

### `testthing.js`

`src/test/things/testthing.js` is a simpler test helper Thing.

It can be used when a scenario needs a custom Thing in the system, but it is not the main orchestration layer for the harness.

## Transaction Model

`transactionId` is used as the causal boundary for async work.

- A new transaction usually starts when something external injects a fresh cause into the system.
- Examples include sensor input, service callbacks, timer expiry, and ramp progression.
- Downstream effects produced from that cause are expected to stay associated with that transaction lineage.

Related async continuations may derive new transaction ids rather than starting unrelated ones.

- ramp steps append `R`
- scheduler-driven continuations append `T`

This gives both grouping and lineage, which is important for debugging and for test expectations.

## What A Test Config Does

Automated harness configs typically define a Thing of type `tester` loaded from `test/things`.

Typical fields include:

- `targetUnderTest`
- `sources`
- `testRun`
- `testCases`
- optional `testSteps`
- optional `preAmble`
- optional `postAmble`

The harness drives the system with `driveSequence` and verifies `expectedSequence`.

If a step in `driveSequence` does not specify `target`, `tester.js` defaults it to `targetUnderTest`. Expected outputs similarly default their `source` to `targetUnderTest`.

## Reusable Steps

Reusable steps are defined with `testSteps`.

These can be referenced from:

- `driveSequence`
- `expectedSequence`

`tester.js` expands nested `testStep` and `testCase` references before execution so scenarios can be composed rather than duplicated.

## Two Main Modes

### Verification mode

This is the normal mode.

The harness:

- sends configured inputs
- listens to configured outputs
- matches outputs against `expectedSequence`
- fails immediately on mismatch or invalid source state

### Transcript mode

If a testcase enables `generateExpectedOutput`, the harness switches into capture mode for that testcase.

In this mode it:

- runs the testcase
- emits a JSON transcript of observed property changes and events
- groups same-transaction outputs into `simultaneous` blocks where appropriate
- does not verify expectations

This transcript is useful as a baseline when authoring a new testcase, but it must be reviewed before being copied into `expectedSequence`.

## `simultaneous`

`simultaneous` is used when order is not guaranteed within a single transaction.

This is important because a fully asynchronous system may produce several causally-related outputs in a nondeterministic order.

The intended rule is:

- order may vary inside one transaction
- transaction boundaries still matter

In transcript generation, transaction ids are used to decide when outputs belong in the same `simultaneous` block.

In verification mode, `tester.js` flattens `simultaneous` expectations into a local fuzzy matching window so the outputs can arrive in any order inside that block.

## Timing Guidance

Timing is a real part of harness design.

- Race conditions should not make tests flaky.
- Acceptable races only change ordering within one transaction.
- Bad races change the actual behavior, outputs, or transaction grouping.
- Delays between injected inputs must be chosen carefully.

Too-short delays can create overlap between phases of a scenario and produce misleading failures.

## Config Types In `src/test/configs`

The linked `src/test/configs` directory contains more than one kind of config.

### Automated harness configs

These include a `tester` Thing and define `testRun` / `testCases`.

Examples:

- `rtest-building.json`
- `test-access.json`
- `test-bedroom.json`
- `test-housealarm.json`
- `test-property.json`
- `test-stateproperty.json`

### Manual or integration setup configs

These set up a system for manual experimentation or integration checks and do not necessarily contain harness testcases.

Examples:

- `test-mqtt.json`
- `test-mcp.json`
- `test-smee.json`

These still need `createdb` processing before use, because they are normal Casa configs.

## Working Understanding To Preserve

When describing or extending this harness, the most important idea to preserve is:

The harness tests real asynchronous runtime behavior by injecting external causes into the live system and asserting the resulting event/property transcript, with transaction lineage used to model causality and with controlled tolerance for intra-transaction ordering differences.

## Good Follow-up Documentation

This note is a memory/reference note.

A separate authoring guide would also be valuable, focused on:

- how to create a new harness config
- how to choose `sources`
- how to structure `driveSequence` and `expectedSequence`
- when to use `testSteps`
- when to use `simultaneous`
- how to use `generateExpectedOutput` safely
- how to choose waits and settle timing
- how to process configs with `createdb` and then run them through `app.js`
