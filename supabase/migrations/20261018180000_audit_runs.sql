-- One row per audit run (src/app/api/audit/route.ts), read by /status.
-- Plain `create table`, not `if not exists`, so a name collision fails loudly
-- rather than silently doing nothing.
create table audit_runs (
  id        bigserial primary key,
  ran_at    timestamptz not null default now(),
  mode      text not null,
  failures  integer not null,
  checks    jsonb not null,
  summary   text
);

create index audit_runs_ran_at_idx on audit_runs (ran_at desc);

-- No policies. Only the service role reads or writes this table.
alter table audit_runs enable row level security;
