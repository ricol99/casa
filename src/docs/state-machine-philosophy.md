# Casa State Machine Philosophy

This note is the short version of how Casa thinks about state.

For implementation detail and config shape, see:

- `src/docs/state-machine-guide.md`

## The Problem With One Big State Machine

For non-trivial Things, one giant state machine usually becomes too complex to define and maintain.

That happens because one graph ends up trying to represent too many concerns at once:

- mode
- timing
- safety
- occupancy
- retry behavior
- user override
- transient sequencing
- external conditions

The result is state explosion.

Even if the machine is technically correct, it becomes hard to understand, extend, or trust.

## Casa's Alternative

Casa does not assume one state machine should care for everything.

Instead, Casa treats these as core design ideas:

- small state machines
- state competition
- state combining
- Thing composition

## Small State Machines

Each state machine should usually model one concern only.

Examples:

- day/night
- occupied/unoccupied
- armed/disarmed
- opening/open/closing/closed
- retry/watchdog state
- override active/not-active

This keeps each machine:

- smaller
- easier to reason about
- easier to test
- easier to reuse

## State Competition

Small machines are allowed to compete.

That is important because real systems often have overlapping concerns with different importance.

For example:

- a default behavior wants one outcome
- a user override wants another
- a safety machine wants a third

Casa handles this through:

- actions
- controller ownership
- priority arbitration

So the model is not just "what state am I in?"

It is also:

- which state machine currently has the right to drive this behavior?

## State Combining

Small machines also need to be observed together.

Casa does this with combined state:

- multiple state properties remain separate
- their values are combined into a higher-level state view
- extra logic can be attached only where the combination matters

This avoids flattening everything into one giant graph while still letting the system react to meaningful joint conditions.

## Thing Composition

Casa's model gets stronger because Things are composed from parts.

That means:

- child Things can define properties, events, and local state machines
- parent Things can observe and coordinate them
- higher-level state models can be defined above the parts they depend on

So behavior is composed both:

- logically, through competing and combined states
- structurally, through the Thing tree

## Why This Is Powerful

Taken together, these ideas let Casa model complex behavior without centralizing everything in one place.

The usual pattern is:

1. Define several small machines.
2. Let them compete where intent conflicts.
3. Let them combine where joint state matters.
4. Let composed Things contribute signals upward.
5. Use higher-level machines to coordinate the whole.

That is why Casa can describe rich systems without requiring one enormous top-level FSM.

## The Tradeoff

This style is powerful, but it requires discipline.

The design works best when:

- each machine has one clear concern
- priorities are deliberate
- combined state is used where it adds clarity
- shared outputs are limited and intentional
- the resulting behavior is made observable

Without that discipline, the system can become hard to debug because behavior emerges from interaction rather than from one explicit graph.

## Short Summary

Casa's philosophy is:

- do not force one state machine to care for everything
- define several focused machines instead
- let them compete
- let them combine
- let composed Things feed larger models above them

That is a big part of what makes Casa different from a conventional single-machine automation model.
