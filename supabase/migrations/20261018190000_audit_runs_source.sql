-- Where a run came from: 'production' (Vercel Cron against the live site) or
-- 'local' (a dev run against localhost). /status shows production runs only.
-- Existing rows default to 'local'.
alter table audit_runs
  add column source text not null default 'local';
