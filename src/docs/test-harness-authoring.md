# Writing Tests With The Casa Harness

This guide is for building or extending automated tests that use the Casa runtime harness described in [Casa Test Harness Notes](test-harness-notes.md).

It focuses on practical authoring: how to structure a config, how to choose expectations, and how to run the result.

## Core Idea

You are not writing a separate unit-test runner.

You are configuring the real Casa runtime so that a `tester` Thing:

- injects external stimuli into the live system
- listens to selected outputs
- verifies the resulting sequence of property changes and events

That means a good harness testcase is really a carefully staged runtime scenario.

## Before You Start

Decide these first:

- What Thing or subtree is the target under test?
- Which output properties or events prove the behavior is correct?
- Which inputs should be treated as external causes?
- Which outputs must be strictly ordered, and which are only ordered up to transaction boundaries?

If those answers are fuzzy, the testcase will usually become flaky or hard to maintain.

## Where Tests Live

Automated harness scenarios are typically stored in the local directory linked at `src/test/configs`. The link and its fixtures are maintained outside Git, so these examples require access to that local fixture directory.

Examples:

- `test-property.json`
- `test-access.json`
- `rtest-building.json`

These files are parsed as JSON5 by `createdb`, so comments and trailing commas are allowed.

## Minimal Structure

A typical config includes the following tester definition. Define the target Thing separately in the same config or the shared gang config, with the input and output names referenced by the tester.

```json5
{
  "casa": {
    "name": "casa-my-test",
    "type": "casa",
    "listeningPort": 8085,
    "services": [],
    "scenes": [],
    "things": [
      {
        "name": "my-test-runner",
        "type": "tester",
        "loadPath": "test/things",
        "targetUnderTest": ":casa-my-test:thing-under-test",
        "sources": [
          { "property": "state" },
          { "property": "alarm" },
          { "event": "completed-event" }
        ],
        "testRun": {
          "testCases": []
        },
        "testCases": [
          {
            "name": "1) Example scenario",
            "driveSequence": [
              { "property": "input-a", "value": true },
              { "wait": 1.0, "property": "input-a", "value": false }
            ],
            "expectedSequence": [
              { "property": "state", "value": "active" },
              { "property": "state", "value": "idle" }
            ]
          }
        ]
      }
    ]
  }
}
```

## The `tester` Thing

The harness Thing should usually look like this:

- `type: "tester"`
- `loadPath: "test/things"`
- `targetUnderTest` set to the Thing you want to drive and observe
- `sources` listing the outputs you want the harness to listen for
- `testRun` controlling which cases are executed
- `testCases` defining the scenarios

If `driveSequence` entries omit `target`, the harness defaults them to `targetUnderTest`.

If `expectedSequence` entries omit `source`, the harness also defaults them to `targetUnderTest`.

That keeps most single-target tests compact.

## Choosing `sources`

Choose only the outputs that are meaningful for the scenario.

Good `sources` usually:

- expose the state transitions you care about
- include user-visible outputs or stable internal outputs
- avoid noisy properties that change for unrelated reasons

If you listen to too much, tests become harder to understand and easier to break accidentally.

If you listen to too little, you risk missing a regression.

## `testRun`

`testRun` controls which cases execute and how the run starts.

Useful fields:

- `testCases`
- `preAmble`
- `postAmble`
- `delayStart`

### `testRun.testCases`

This is a list of testcase numbers, not testcase names.

Important details:

- numbering is 1-based
- `[]` means run all testcases in the file
- `generateExpectedOutput` also uses a testcase number

Examples:

```json5
"testRun": {
  "testCases": []
}
```

```json5
"testRun": {
  "testCases": [2, 5, 6]
}
```

### `preAmble` and `postAmble`

These let you add common setup or cleanup sequences around the selected run.

`preAmble` is prepended to the first selected case. `postAmble` is appended to the last selected case.

They can include both:

- `driveSequence`
- `expectedSequence`

## Writing `driveSequence`

`driveSequence` defines the external stimuli sent into the system.

Supported patterns include:

- property write with `value`
- property ramp with `ramp`
- event raise with `event`
- delay before a step with `wait`
- explicit target override with `target`

Examples:

```json5
{ "property": "present", "value": true }
```

```json5
{ "wait": 1.5, "property": "fire-alarm", "value": true }
```

```json5
{ "event": "motion-detected" }
```

```json5
{
  "property": "brightness",
  "ramp": { "startValue": 0, "endValue": 100, "step": 10, "duration": 5 }
}
```

Each input step creates a new transaction at the target before the property change or event is injected. That is why follow-on outputs are expected to group causally around that step.

## Writing `expectedSequence`

`expectedSequence` is the observable transcript you expect back from the system.

Each entry is usually one of:

- a property assertion
- an event assertion
- a `simultaneous` block

Examples:

```json5
{ "property": "alarm-state", "value": "armed" }
```

```json5
{ "event": "opened", "value": true }
```

```json5
{
  "simultaneous": [
    { "property": "movement", "value": true },
    { "property": "alarm-state", "value": "stay-armed-animals-present" }
  ]
}
```

The matcher compares:

- source
- property or event name
- value

So expectations should be written against stable, meaningful outputs rather than transient implementation noise.

## When To Use `simultaneous`

Use `simultaneous` when multiple outputs are causally part of the same transaction but their internal order is not stable.

Verification only checks that the group's outputs match in some order. Transcript capture groups by transaction ID, which is also printed in verification logs.

Use it when:

- the system is fully asynchronous
- outputs may race within one transaction
- the exact order is not part of the intended behavior

Do not use it to hide real uncertainty across transaction boundaries.

A good rule is:

- same transaction and same meaning: maybe `simultaneous`
- different transaction or different causal phase: keep them ordered

## Reusable `testSteps`

Use `testSteps` when several testcases share the same sub-sequence.

This helps when:

- an interaction has a common setup or completion flow
- hardware simulation needs several repeated phases
- the same expectation block appears in many cases

`test-access.json` is a good example of this style.

A `testStep` can be referenced from both:

- `driveSequence`
- `expectedSequence`

That makes it useful for reusable stimulus/expectation pairs.

## Using `generateExpectedOutput`

This is the safest way to bootstrap a new testcase expectation.

Workflow:

1. Add or update your `driveSequence`.
2. Temporarily enable `generateExpectedOutput` with the testcase number you want to inspect.
3. Run the harness.
4. Capture the emitted JSON entries. The harness emits entries without the enclosing array brackets.
5. Review it carefully.
6. Copy only the correct parts into `expectedSequence`.
7. Remove or comment out `generateExpectedOutput`.
8. Run again in normal verification mode.

Set this field on the `tester` Thing, alongside `testRun` and `testCases`. The field's presence selects capture mode.

```json5
"generateExpectedOutput": 3,
```

Important:

- transcript mode is not verification mode
- do not paste transcript output blindly
- keep only outputs that express the behavior you actually want to lock in
- use error-only logging while generating transcript JSON so logs do not pollute the captured output

## Timing Advice

Timing is often the difference between a useful async test and a flaky one.

When choosing waits:

- leave enough time for the previous causal phase to settle
- avoid overlapping unrelated phases unless the test is specifically about overlap
- give ramps and timers enough time to complete
- keep waits short enough that tests are still practical to run

Useful habits:

- start with slightly generous waits
- tighten them only after the scenario is understood
- if a test flakes, first question the scenario timing, not just the matcher

## A Good Authoring Workflow

This is the workflow I’d recommend for most new tests.

1. Copy a nearby config that already tests a similar Thing type.
2. Add or update the target Thing setup.
3. Add a `tester` Thing with a minimal `sources` list.
4. Write the `driveSequence` for one scenario.
5. Use `generateExpectedOutput` to observe the live transcript.
6. Convert the transcript into a deliberate `expectedSequence`.
7. Introduce `simultaneous` only where order truly does not matter within a transaction.
8. Factor repeated sequences into `testSteps` only after the raw case is clear.
9. Run only the new testcase first.
10. When stable, re-run the whole config.

For isolated scenarios, use `--nopeer` in both transcript generation and verification. For transcript generation, also use `--logs error`.

## Running A Harness Config

Configs must be processed into DB files before the app can load them.

From `src`:

```bash
node utils/createdb.js test/configs/test-property.json
node utils/createdb.js test/configs/collin-test-gang.json
node app.js --nopeer --logs error casa-test-property
```

The first two commands rebuild the Casa database and its shared gang database in `~/.casa-keys/secure-config`.

### Shared gang configs

Some harness configs are layered on top of a shared gang definition.

In that case, you may need to process more than one config before running the Casa:

- the testcase config, which creates the Casa DB
- the shared gang config, which creates the gang DB referenced by the Casa config

If you skip the shared gang config, the loader may start and then fail to find the expected gang DB.

`test-bedroom` is a concrete example:

```bash
node utils/createdb.js test/configs/test-bedroom.json
node utils/createdb.js test/configs/collin-test-gang.json
node app.js --nopeer --logs error casa-test-bedroom
```

The reason is that `test-bedroom.json` names `gang-collin-test`, so the runtime needs both:

- `casa-test-bedroom-db.db`
- `gang-collin-test-db.db`

To run with a different database directory, place the generated database files there and pass the directory with `app.js --config`. `createdb.js` writes to the default directory.

To open the local console while exploring a scenario:

```bash
node app.js --nopeer --localconsole casa-test-property
```

Practical notes:

- `createdb` recreates the `.db` content for that config name
- some harness configs also require a shared gang config to be processed first
- `--nopeer` disables peer connections and removes the default peer-related startup delay. An explicit `testRun.delayStart` still applies.
- `--logs error` is the usual regression-testing mode
- `--logs info` is useful when you want to see events and property changes
- `--logs log`, or omitting `--logs`, gives full runtime logging
- `--localconsole` can be useful while exploring behavior interactively

## A Few Common Mistakes

- Using too many `sources` and then locking in irrelevant behavior.
- Using `simultaneous` across outputs that actually belong to different causal phases.
- Forgetting that testcase selection is 1-based.
- Leaving `generateExpectedOutput` enabled and thinking the run is verifying.
- Writing waits that are too short for timers, ramps, or async propagation.
- Copying transcript output without removing incidental noise.

## Choosing Between A Test Config And A Manual Config

Not every config in `src/test/configs` is an automated regression harness.

Use a harness config when you want:

- pass/fail verification
- reproducible regression coverage
- explicit expected output

Use a manual or integration config when you want:

- a live environment for exploration
- service integration setup
- ad hoc observation without strict assertions

Examples of manual/integration-style configs include:

- `test-mqtt.json`
- `test-mcp.json`
- `test-smee.json`

## Recommended Style

Aim for tests that are:

- causality-focused
- small enough to understand
- tolerant only where the runtime genuinely requires it
- authored from meaningful outputs rather than implementation noise

If a testcase is hard to explain in one or two sentences, it is often worth splitting it into smaller cases.

## Verification limits

The matcher checks source, property/event name and value; it does not assert transaction IDs. `simultaneous` is implemented as a bounded look-ahead/reordering window, so transaction boundaries are an authoring convention rather than an enforced assertion. Transcript generation uses transaction IDs for grouping.

Verification has no overall deadline for missing expected output: if an expected event never arrives, a run can remain waiting. Use an external timeout when running unattended. The tester also adds `settleTime` (default 3 seconds) before each case; `--nopeer` does not remove it.
