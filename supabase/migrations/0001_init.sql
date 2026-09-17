-- Be Legendary service delivery: initial schema.
--
-- Boundary: HubSpot owns the client, the deal and the revenue. This database
-- owns programs, engagements, tasks, vendors, costs and the coordination doc.
-- The only thing that crosses is hubspot_deal_id, and the sync is one-way in.
--
-- Access model: the owner sees everything. Contractors see only the
-- engagements they are assigned to, and never the client fee or margin. That
-- last rule is why financials live in their own table rather than as a column
-- on engagements: Postgres RLS is row-level, so a hidden column needs its own
-- row to hide.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- people ----

create type app_role as enum ('owner', 'coordinator', 'logistics', 'technician', 'contractor');

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null unique,
  full_name   text,
  role        app_role not null default 'contractor',
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table profiles is
  'One row per person who can sign in. Contractors are created here before they first use a magic link.';

-- Is the caller the owner? SECURITY DEFINER so policies can call it without
-- recursing through profiles'' own RLS.
create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'owner' and active
  );
$$;

-- ------------------------------------------------------------- programs ----

create table programs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  family      text,
  summary     text,
  -- The whole template: parameters, quantities, resources, run_of_show, tasks,
  -- cost_lines. Validated in the app against src/lib/types.ts before write.
  definition  jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column programs.definition is
  'The program template. Adding a program is a row here, never a code change.';

-- --------------------------------------------------------- engagements ----

create type engagement_status as enum ('planning', 'confirmed', 'delivered', 'closed', 'cancelled');

create table engagements (
  id               uuid primary key default gen_random_uuid(),
  hubspot_deal_id  text unique,
  client_name      text not null,
  program_id       uuid not null references programs on delete restrict,
  delivery_date    date not null,
  status           engagement_status not null default 'planning',
  -- participants, teams, beneficiaries, event_start, beneficiary_depart_by, etc.
  params           jsonb not null default '{}'::jsonb,
  -- per-engagement run-of-show tweaks: { durations: {...}, skip: [...] }
  ros_overrides    jsonb not null default '{}'::jsonb,
  venue_name       text,
  venue_address    text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on engagements (delivery_date);
create index on engagements (status);

-- Owner-only financials. Separate table so contractor policies cannot reach
-- the client fee at all, rather than relying on the app to omit a column.
create table engagement_financials (
  engagement_id uuid primary key references engagements on delete cascade,
  client_fee    numeric(12, 2),
  notes         text
);

comment on table engagement_financials is
  'Owner-only. Client fee and margin. Never exposed to contractor sessions.';

create table engagement_assignments (
  engagement_id uuid not null references engagements on delete cascade,
  profile_id    uuid not null references profiles on delete cascade,
  role          app_role not null,
  created_at    timestamptz not null default now(),
  primary key (engagement_id, profile_id)
);

-- Does the caller have any assignment on this engagement?
create or replace function is_assigned(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from engagement_assignments
    where engagement_id = target and profile_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------- tasks ----

create type task_status as enum ('not_started', 'in_progress', 'done', 'na');

create table engagement_tasks (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  -- Stable key from the template, e.g. 'BAD:travel-booked-for-facilitation-team'.
  -- Regeneration upserts on this so re-running never duplicates or loses status.
  source_key    text not null,
  phase         text not null,
  title         text not null,
  offset_days   integer not null,
  due_date      date not null,
  role          app_role not null,
  assignee      uuid references profiles on delete set null,
  status        task_status not null default 'not_started',
  note          text,
  completed_at  timestamptz,
  completed_by  uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (engagement_id, source_key)
);

create index on engagement_tasks (engagement_id, due_date);
create index on engagement_tasks (assignee) where status <> 'done';

-- Keep the completion audit fields honest regardless of what the client sends.
create or replace function touch_task()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and coalesce(old.status, 'not_started'::task_status) <> 'done' then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

create trigger engagement_tasks_touch
  before update on engagement_tasks
  for each row execute function touch_task();

-- ----------------------------------------------------------- resources ----

-- Transportation, technicians, venue, beneficiary site, photography. The
-- template decides which blocks exist and how many are needed; these rows hold
-- the actual vendor, confirmation number and cost.
create table engagement_resources (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  resource_key  text not null,
  label         text not null,
  computed_note text,
  fields        jsonb not null default '{}'::jsonb,
  cost          numeric(12, 2),
  updated_at    timestamptz not null default now(),
  unique (engagement_id, resource_key)
);

-- --------------------------------------------------------------- costs ----

create type cost_visibility as enum ('contractor', 'owner');

create table engagement_costs (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  line_key      text not null,
  label         text not null,
  amount        numeric(12, 2),
  visibility    cost_visibility not null default 'contractor',
  note          text,
  updated_at    timestamptz not null default now(),
  unique (engagement_id, line_key)
);

create index on engagement_costs (engagement_id, visibility);

-- Owner-only P&L. Direct cost is every contractor-visible line; margin needs
-- the client fee, which contractors cannot read, so this view is owner-only.
create view engagement_pnl
with (security_invoker = true)
as
select
  e.id                     as engagement_id,
  e.client_name,
  e.delivery_date,
  f.client_fee,
  coalesce(c.direct_cost, 0)                     as direct_cost,
  f.client_fee - coalesce(c.direct_cost, 0)      as gross_margin,
  case
    when coalesce(f.client_fee, 0) = 0 then null
    else round((f.client_fee - coalesce(c.direct_cost, 0)) / f.client_fee, 4)
  end                                            as margin_pct
from engagements e
left join engagement_financials f on f.engagement_id = e.id
left join (
  select engagement_id, sum(coalesce(amount, 0)) as direct_cost
  from engagement_costs
  where visibility = 'contractor'
  group by engagement_id
) c on c.engagement_id = e.id;

-- ----------------------------------------------------------------- RLS ----

alter table profiles               enable row level security;
alter table programs               enable row level security;
alter table engagements            enable row level security;
alter table engagement_financials  enable row level security;
alter table engagement_assignments enable row level security;
alter table engagement_tasks       enable row level security;
alter table engagement_resources   enable row level security;
alter table engagement_costs       enable row level security;

-- profiles: you can read yourself; the owner reads and writes everyone.
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_owner());
create policy profiles_owner_write on profiles
  for all using (is_owner()) with check (is_owner());

-- programs: any signed-in user may read the catalog; only the owner edits it.
create policy programs_read on programs
  for select using (auth.uid() is not null);
create policy programs_owner_write on programs
  for all using (is_owner()) with check (is_owner());

-- engagements: assigned contractors read; only the owner creates or edits.
create policy engagements_read on engagements
  for select using (is_owner() or is_assigned(id));
create policy engagements_owner_write on engagements
  for all using (is_owner()) with check (is_owner());

-- financials: owner only, no exceptions.
create policy financials_owner_only on engagement_financials
  for all using (is_owner()) with check (is_owner());

-- assignments: you can see your own; the owner manages all.
create policy assignments_read on engagement_assignments
  for select using (is_owner() or profile_id = auth.uid());
create policy assignments_owner_write on engagement_assignments
  for all using (is_owner()) with check (is_owner());

-- tasks: read if assigned to the engagement. Contractors may update a task's
-- working fields but cannot create or delete tasks, because tasks come from the
-- template. The trigger above owns completed_at and completed_by.
create policy tasks_read on engagement_tasks
  for select using (is_owner() or is_assigned(engagement_id));
create policy tasks_contractor_update on engagement_tasks
  for update using (is_assigned(engagement_id)) with check (is_assigned(engagement_id));
create policy tasks_owner_write on engagement_tasks
  for all using (is_owner()) with check (is_owner());

-- resources: assigned contractors read and fill them in. They are the people
-- booking the limo, so they record the confirmation number and the cost.
create policy resources_read on engagement_resources
  for select using (is_owner() or is_assigned(engagement_id));
create policy resources_contractor_update on engagement_resources
  for update using (is_assigned(engagement_id)) with check (is_assigned(engagement_id));
create policy resources_owner_write on engagement_resources
  for all using (is_owner()) with check (is_owner());

-- costs: contractors see and edit contractor-visible lines only. The `using`
-- clause hides owner lines from reads; the `with check` stops a contractor
-- relabelling a line as owner-visible or editing one that already is.
create policy costs_read on engagement_costs
  for select using (
    is_owner() or (is_assigned(engagement_id) and visibility = 'contractor')
  );
create policy costs_contractor_update on engagement_costs
  for update using (is_assigned(engagement_id) and visibility = 'contractor')
  with check (is_assigned(engagement_id) and visibility = 'contractor');
create policy costs_owner_write on engagement_costs
  for all using (is_owner()) with check (is_owner());

-- ------------------------------------------------------------ hardening ----

-- Views do not carry RLS of their own; security_invoker makes engagement_pnl
-- run as the caller, so its joins still obey the policies above. Revoking
-- anon keeps it off the public API surface entirely.
revoke all on engagement_pnl from anon;
grant select on engagement_pnl to authenticated;

revoke all on engagement_financials from anon;
