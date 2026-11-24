# Casa Test Harness Notes

This note describes how the Casa test harness runs and verifies scenarios. See [Writing Tests With The Casa Harness](test-harness-authoring.md) for configuration and commands.

## Purpose

The harness injects stimuli into a live Casa and checks the resulting property changes and events against an expected sequence.

## Runtime Shape

Tests are exercised through the real application startup path, not through a separate mock runner.

- `src/app.js` starts the normal Casa runtime.
- Configs are supplied through the normal config path selection.
- All configs must be processed by `src/utils/createdb.js` before they can be run.
- Run isolated scenarios with `--nopeer` to disable peer connections.

This applies both to automated harness configs and to manual/integration configs.

One important practical detail is that some harness configs are layered on top of a shared gang definition.

In those cases, processing only the testcase config is not enough. The shared gang config must also be processed so the loader can open both:

- the Casa DB for the testcase config
- the gang DB for the referenced gang

`test-bedroom.json` and `test-property.json` both use the shared gang DB produced from `collin-test-gang.json`.

## Useful Runtime Flags

Some `app.js` flags matter a lot when running the harness.

- `--nopeer` disables peer connections and removes the default peer-related startup delay. An explicit `testRun.delayStart` still applies, as does the per-case `settleTime`.
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
- tolerates unordered matching within an explicit `simultaneous` group

### `testthing.js`

`src/test/things/testthing.js` is a simpler test helper Thing.

It can be used when a scenario needs a custom Thing in the system, but it is not the main orchestration layer for the harness.

## Transaction Model

The `transaction` field in event metadata identifies the causal sequence for async work.

A fresh input, such as a sensor reading or service callback, can start a new transaction. Downstream effects carry that transaction's lineage.

Related async continuations may derive new transaction ids rather than starting unrelated ones.

- ramp steps append `R`
- timeout continuations append `T`
- scheduled continuations append `S`

This gives both grouping and lineage, which is important for debugging and for test expectations.

## What A Test Config Does

Automated harness configs typically define a Thing of type `tester` loaded from `test/things`.

Typical fields include:

- `targetUnderTest`
- `sources`
- `testRun`
- `testCases`
- optional `testSteps`
- optional `testRun.preAmble` and `testRun.postAmble`

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

Set `generateExpectedOutput` on the `tester` Thing to the 1-based case number to switch to capture mode for that case.

In this mode it:

- runs the testcase
- emits JSON entries for the observed property changes and events, ready to review for the `expectedSequence` array
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

In verification mode, `tester.js` matches entries in a `simultaneous` block in any order. The matcher compares source, name and value. Transaction IDs are recorded in the output for diagnosis.

## Timing Guidance

Timing is a real part of harness design.

- Race conditions should not make tests flaky.
- Acceptable races only change ordering within one transaction.
- Bad races change the actual behavior, outputs, or transaction grouping.
- Delays between injected inputs must be chosen carefully.

Too-short delays can create overlap between phases of a scenario and produce misleading failures.

## Config Types In `src/test/configs`

The linked `src/test/configs` directory points to local fixtures outside the Git checkout. It contains both automated and manual configurations.

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

## Verification limits

The matcher checks source, property/event name and value; it does not assert transaction IDs. `simultaneous` is implemented as a bounded look-ahead/reordering window, so transaction boundaries are an authoring convention rather than an enforced assertion. Transcript generation uses transaction IDs for grouping.

Verification has no overall deadline for missing expected output: if an expected event never arrives, a run can remain waiting. Use an external timeout when running unattended. The tester also adds `settleTime` (default 3 seconds) before each case; `--nopeer` does not remove it.
