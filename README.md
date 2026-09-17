# Be Legendary Service Delivery

Program templates that generate an engagement's task timeline, material
quantities, resource requirements, both run-of-show tracks and the logistics
and coordination doc. Built so contractors can execute a delivery without a
HubSpot seat.

Target deployment: `delivery.belegendary.org` on Vercel.

## Why this exists

At two or three engagements a year the sequence lived in James's head. At five
concurrent it does not fit there. The 2011 DeVry "Building a Dream" agenda is
the proof that the right artifact already existed: resource blocks with vendor,
contact and confirmation number, a materials table with quantities, and a
two-track timed logistics grid. The 2026 Ledgebrook run of show had the grid and
nothing else, which is how a paid-for limousine ended up in no document at all.

This repo makes that document impossible to lose, because it is generated rather
than written.

## The core idea

A program is **data**, not code. `programs/build-a-dream.json` holds the whole
template: parameters, quantity formulas, conditional resource blocks, the
run-of-show spine with durations, the task list with day offsets, and the cost
lines. Adding a program means adding a JSON file. It never means changing the
engine.

Two rules do most of the work:

**Backward anchoring.** If an engagement has a hard beneficiary departure
deadline, the reveal is pinned at `deadline - 30 minutes` and every step before
it is laid out backward. This is the rule stated in prose on the Ledgebrook
document: the children being gone by 5:00 fixes the reveal at 4:30 and sets the
length of everything ahead of it. With no deadline the schedule runs forward
from participant arrival.

**Conditional inclusion.** Tasks and resource blocks carry boolean conditions
over the engagement's parameters. Thirteen children get one limousine; 108 get
three buses and a materials van. One technician versus four. No mechanics task
at all when only one person is coming. Same template, different engagement.

## Validation

The engine is tested by regenerating both real events and diffing against the
clock times printed on their source documents.

```
npm test
```

60 tests. Every Ledgebrook time in both tracks, DeVry's arrival, opening, reveal
and presentation, DeVry's stated 3 buses, 4 mechanics and 110 bicycles, and the
conditional branches in both directions.

Honest caveat: the step durations were read off the Ledgebrook document, so
reproducing Ledgebrook is a consistency check rather than a prediction. DeVry is
the more independent result, since it anchors in the opposite direction. The real
test is the next live event.

Three quantities are inferred rather than documented and are tagged
`"confidence": "low"` or `"medium"` in the template so they surface on the doc as
"confirm ratio" until corrected: floor pumps, the brief-sheet basis (per
participant or per team), and the technician-per-bicycle ratio.

## Layout

```
programs/build-a-dream.json     the program template
src/lib/expr.ts                 small safe expression language for formulas
src/lib/generate.ts             the engine
src/lib/types.ts                template and output types
src/fixtures/known-events.ts    the two real events plus their printed times
src/components/CoordinationDoc  the generated document
supabase/migrations/0001_init.sql   schema, RLS, P&L view
```

### Why a hand-written expression parser

Template formulas arrive as strings (`"ceil(bikes / 30)"`,
`"not bikes_go_home_same_day"`). Evaluating them with `eval` would let anyone who
can edit a program definition run arbitrary code. `src/lib/expr.ts` is a
recursive-descent parser over a fixed grammar with six allowed functions, no
property access, no calls into host objects, and own-property lookups only, so
identifiers like `constructor` and `__proto__` are rejected rather than resolved.

## Access model

The boundary is deliberate:

- **HubSpot** owns the client, the deal and the revenue. One-way pull in, keyed
  on `hubspot_deal_id`. This app never writes to HubSpot.
- **This database** owns programs, engagements, tasks, vendors, costs and the
  document.

Contractors sign in with a magic link and see only the engagements they are
assigned to. They can update task status and fill in resource details, including
vendor confirmation numbers and costs, because they are the people making those
bookings. They cannot create or delete tasks, since tasks come from the template.

Client fee and margin live in `engagement_financials`, a separate owner-only
table. Postgres row-level security is row-level, so hiding a column means giving
it its own row. Cost lines carry a `visibility` of `contractor` or `owner`, and
the contractor policy filters on it in both `using` and `with check`, so a
contractor can neither read an owner line nor relabel one.

## Running it

```
npm install
npm test            # the engine, against both real events
npm run typecheck
npm run dev         # http://localhost:3000
npm run seed:sql    # regenerate supabase/seed/0002_seed.sql
```

With no Supabase configured the app runs in **fixture-preview mode**: `/` lists
the two regression fixtures and `/engagements/ledgebrook` renders the
coordination doc from the template alone. Nothing is gated and no database is
needed, so the engine can be worked on offline.

## Connecting Supabase

1. Copy `.env.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The URL is already there.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor. Tables, policies,
   the P&L view.
3. Run `supabase/seed/0002_seed.sql`. One program, five engagements, 205 tasks,
   30 resource slots, 60 cost lines. Idempotent, so re-running after a template
   change re-dates tasks without resetting a status a contractor already set.
4. Create yourself in Authentication -> Users, then run the owner-bootstrap
   statement commented at the bottom of the seed file. **Until that profile row
   exists with `role = 'owner'`, `is_owner()` is false and every policy will
   correctly refuse you access to everything.** That is the design, not a bug.
5. Add each contractor the same way with a non-owner role, then insert an
   `engagement_assignments` row. A contractor with no assignment sees an empty
   list, which is also correct.

Auth is magic-link only, with `shouldCreateUser: false`: the owner creates
accounts, so holding the publishable key is not enough to mint one. The login
form's failure message is deliberately generic, because a distinct "no such
user" would turn it into a way to test whether an address is a Be Legendary
contractor.

## Status

Done and verified:

- The generation engine, validated against both real events. 60 tests.
- The Build A Dream template.
- The coordination doc renderer, contractor and owner audiences.
- Schema with row-level security and the owner-only P&L view.
- Supabase browser, server and middleware clients; magic-link sign-in; session
  refresh and route gating.
- Database reads with fixture fallback, and `materializeEngagement` to write the
  generated tasks, resource slots and cost lines.
- Generated seed SQL for the program and the five live engagements.
- `npm test`, `npm run typecheck`, `npx next build` clean. Routes smoke-tested
  in fixture mode: index, both engagement docs, login, and a 404 for an unknown
  engagement.

**Not verified, and you should assume it is unproven:** every code path that
actually talks to Supabase. The environment this was built in blocks
`*.supabase.co` at the egress proxy, so no query, no policy and no magic link
has run against a live project. The first person to run step 2 above is also
the first person to test it.

Next:

- Owner screens: create an engagement, assign contractors, fill resources
- Contractor screens: my tasks, mark done
- HubSpot deal pull, on demand rather than automatic
- The remaining programs, as JSON files
- A morning digest email, which is the thing a spreadsheet cannot do

## Known gaps in the Build A Dream data

- Four of the five seeded engagements carry **placeholder** participant, team
  and beneficiary counts and `beneficiary_org: "TBC"`, and are marked
  `planning` rather than `confirmed`. Only Ledgebrook is real. McKesson may not
  be a Build A Dream at all.
- Floor pumps, the brief-sheet basis and the technician ratio are inferred, and
  surface on the doc as "confirm ratio" or "confirm basis" until corrected.
