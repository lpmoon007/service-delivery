-- Staffing: who is actually working a delivery, by name.
--
-- The DeVry 2011 agenda opened with a FACILITATOR(S) line naming seven people.
-- Nothing in the schema held that, so the coordination doc could describe the
-- limousine but not the people driving the day. This adds it.
--
-- Deliberately not the same thing as `engagement_assignments`, which grants a
-- signed-in contractor access to an engagement. Most people named here never
-- log in: a client-side sponsor, a venue contact, a subcontracted mechanic.
-- Conflating access with staffing would mean every named person needs an
-- account, which is exactly the cost this app exists to avoid.

create table engagement_staff (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements on delete cascade,
  name          text not null,
  -- Free text rather than an enum: the roles on a delivery vary by program and
  -- the list would be wrong within a month.
  role          text,
  email         text,
  phone         text,
  -- The person on point that day, shown first on the coordination doc.
  is_lead       boolean not null default false,
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on engagement_staff (engagement_id, sort_order);

comment on table engagement_staff is
  'People working a delivery, named. Not an access grant; see engagement_assignments.';

alter table engagement_staff enable row level security;

-- Anyone assigned to the engagement can read and maintain the staff list: the
-- coordinator booking the technicians is usually not the owner.
create policy staff_read on engagement_staff
  for select using (is_owner() or is_assigned(engagement_id));
create policy staff_contractor_write on engagement_staff
  for all using (is_assigned(engagement_id)) with check (is_assigned(engagement_id));
create policy staff_owner_write on engagement_staff
  for all using (is_owner()) with check (is_owner());

-- Verify:
--   select name, role, is_lead from engagement_staff
--   join engagements using (id) order by sort_order;
