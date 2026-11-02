-- Public, read-only remote config: forced update + kill switches.
-- PostgreSQL / Supabase flavour. Anonymous clients can read; only the service role can write.
-- Never store secrets or per-user data here.

create table if not exists public.app_config (
  platform     text primary key check (platform in ('ios', 'android')),
  min_version  text not null default '1.0.0',   -- below this, the app shows a forced-update screen
  latest_version text,                           -- optional soft-update prompt
  flags        jsonb not null default '{}'::jsonb, -- {"new_tab_bar": false}; missing key = app default
  updated_at   timestamptz not null default now(),
  updated_note text                              -- who changed it and why
);

alter table public.app_config enable row level security;

drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
-- No insert/update/delete policies: only the service role (bypasses RLS) can write.

insert into public.app_config (platform) values ('ios'), ('android') on conflict do nothing;

-- Flip a switch off (record why):
-- update public.app_config
--    set flags = flags || '{"new_tab_bar": false}', updated_at = now(), updated_note = 'crash spike on 1.4.0'
--  where platform = 'ios';
-- Back to the app default:
-- update public.app_config set flags = flags - 'new_tab_bar', updated_at = now() where platform = 'ios';
