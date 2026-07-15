-- two-cats · Phase 3.5 schema: server-authoritative cat state, no auth yet.
-- Run this once in the Supabase dashboard -> SQL Editor -> New query -> Run.
--
-- What it sets up:
--   1. a `cats` table with exactly two rows (black, orange)
--   2. a trigger so the SERVER stamps state_started_at whenever state changes
--      (clients never send timestamps -> no phone-clock skew)
--   3. RLS with permissive anon policies (pre-auth; Phase 4 replaces these
--      with couple-scoped policies)
--   4. realtime replication so both phones hear every update

-- 1 · the table ---------------------------------------------------------------
create table if not exists public.cats (
  id text primary key,
  -- the CHECK mirrors CAT_STATES in src/features/cat/fsm.ts — one source of
  -- truth on each side of the wire, kept in sync by hand until Phase 4 codegen
  state text not null default 'idle'
    check (state in ('idle', 'eating', 'grooming_self', 'grooming_other', 'sleeping')),
  state_started_at timestamptz not null default now()
);

insert into public.cats (id)
values ('black'), ('orange')
on conflict (id) do nothing;

-- 2 · server-side timestamping ------------------------------------------------
create or replace function public.stamp_state_started_at()
returns trigger
language plpgsql
as $$
begin
  if new.state is distinct from old.state then
    new.state_started_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists cats_stamp_state on public.cats;
create trigger cats_stamp_state
  before update on public.cats
  for each row
  execute function public.stamp_state_started_at();

-- 3 · row level security (permissive pre-auth policies) ------------------------
-- CAVEAT: until Phase 4 auth, anyone holding the anon key can read/update the
-- two cats. Acceptable for a private two-person test project; NOT a pattern
-- for anything public. No insert/delete policies exist, so the two rows are
-- the only rows there will ever be.
alter table public.cats enable row level security;

drop policy if exists "anon can read cats" on public.cats;
create policy "anon can read cats"
  on public.cats for select
  using (true);

drop policy if exists "anon can update cats" on public.cats;
create policy "anon can update cats"
  on public.cats for update
  using (true)
  with check (true);

-- 4 · realtime ----------------------------------------------------------------
alter publication supabase_realtime add table public.cats;
