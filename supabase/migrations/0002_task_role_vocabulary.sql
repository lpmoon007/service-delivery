-- Fix: engagement_tasks.role holds the program template's vocabulary, not an
-- app permission level.
--
-- The first version of 0001_init.sql typed this column as the app_role enum.
-- That was wrong: the template's roles include 'JC' and 'all', which describe a
-- job on the delivery rather than a permission level, so the seed fails with
--
--   ERROR: 22P02: invalid input value for enum app_role: "JC"
--
-- 0001_init.sql was corrected in place, so a database created from the current
-- file already has the right shape. This migration exists for databases created
-- from the earlier version. It is idempotent and safe to run either way.
--
-- Permissions still live on app_role, on profiles.role and
-- engagement_assignments.role. The person responsible for a task is `assignee`.

do $$
begin
  -- 1. Enum to text, only if the column is still the enum.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'engagement_tasks'
      and column_name  = 'role'
      and udt_name     = 'app_role'
  ) then
    alter table public.engagement_tasks
      alter column role type text using role::text;

    raise notice 'engagement_tasks.role converted from app_role to text';
  else
    raise notice 'engagement_tasks.role is already text; nothing to convert';
  end if;

  -- 2. Constrain it to the template vocabulary, only if that is not already
  --    enforced. Postgres names an inline column check exactly this, so a
  --    database built from the corrected 0001 skips this branch.
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.engagement_tasks'::regclass
      and conname  = 'engagement_tasks_role_check'
  ) then
    alter table public.engagement_tasks
      add constraint engagement_tasks_role_check
      check (role in ('JC', 'coordinator', 'logistics', 'technician', 'all'));

    raise notice 'engagement_tasks_role_check added';
  else
    raise notice 'engagement_tasks_role_check already present';
  end if;
end
$$;

-- Verify before re-running the seed. Expect: data_type = text, and the check
-- constraint listed.
--
--   select data_type, udt_name
--   from information_schema.columns
--   where table_name = 'engagement_tasks' and column_name = 'role';
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.engagement_tasks'::regclass and contype = 'c';
