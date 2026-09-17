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
npm test          # the engine, against both real events
npm run typecheck
npm run dev       # http://localhost:3000
```

Before Supabase is wired, `/` lists the two fixture engagements and
`/engagements/ledgebrook` renders the coordination doc from the template. The
page is print-clean and works in light and dark.

Copy `.env.example` to `.env.local` when connecting Supabase and HubSpot. The
HubSpot token needs `crm.objects.deals.read` and nothing else.

## Status

Done:

- The generation engine, validated against both real events
- The Build A Dream template
- The coordination doc renderer, contractor and owner audiences
- Database schema with row-level security and the owner-only P&L view

Next:

- Supabase client wiring and magic-link auth
- Owner screens: create an engagement, assign contractors, fill resources
- Contractor screens: my tasks, mark done
- HubSpot deal pull, on demand rather than automatic
- The remaining programs, as JSON files
- A morning digest email, which is the thing a spreadsheet cannot do
