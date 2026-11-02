create table if not exists public.user_tts_quotas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  package_id text not null check (package_id in ('starter', 'pro')),
  quota_limit integer not null check (quota_limit >= 0),
  characters_used integer not null default 0 check (characters_used >= 0),
  characters_reserved integer not null default 0 check (characters_reserved >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.tts_quota_reservations (
  job_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  characters integer not null check (characters > 0),
  state text not null default 'reserved'
    check (state in ('reserved', 'charged', 'released')),
  created_at timestamptz not null default now()
);

create index if not exists tts_quota_reservations_user_state_idx
  on public.tts_quota_reservations (user_id, state);

alter table public.user_tts_quotas enable row level security;
alter table public.tts_quota_reservations enable row level security;

revoke all on public.user_tts_quotas from anon, authenticated;
revoke all on public.tts_quota_reservations from anon, authenticated;
grant all on public.user_tts_quotas to service_role;
grant all on public.tts_quota_reservations to service_role;

create or replace function public.reserve_tts_quota(
  p_user_id uuid,
  p_job_id uuid,
  p_characters integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  quota public.user_tts_quotas%rowtype;
begin
  if p_characters <= 0 then
    raise exception 'Character amount must be positive';
  end if;

  select *
    into quota
    from public.user_tts_quotas
    where user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'PACKAGE_REQUIRED');
  end if;

  if quota.quota_limit - quota.characters_used - quota.characters_reserved < p_characters then
    return jsonb_build_object(
      'allowed', false,
      'code', 'QUOTA_EXCEEDED',
      'limit', quota.quota_limit,
      'used', quota.characters_used,
      'reserved', quota.characters_reserved
    );
  end if;

  insert into public.tts_quota_reservations (job_id, user_id, characters)
  values (p_job_id, p_user_id, p_characters);

  update public.user_tts_quotas
    set characters_reserved = characters_reserved + p_characters,
        updated_at = now()
    where user_id = p_user_id;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.settle_tts_quota(
  p_job_id uuid,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.tts_quota_reservations%rowtype;
begin
  select *
    into reservation
    from public.tts_quota_reservations
    where job_id = p_job_id
    for update;

  if not found or reservation.state <> 'reserved' then
    return;
  end if;

  update public.user_tts_quotas
    set characters_reserved = greatest(0, characters_reserved - reservation.characters),
        characters_used = characters_used + case when p_success then reservation.characters else 0 end,
        updated_at = now()
    where user_id = reservation.user_id;

  update public.tts_quota_reservations
    set state = case when p_success then 'charged' else 'released' end
    where job_id = p_job_id;
end;
$$;

revoke all on function public.reserve_tts_quota(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_tts_quota(uuid, boolean) from public, anon, authenticated;
grant execute on function public.reserve_tts_quota(uuid, uuid, integer) to service_role;
grant execute on function public.settle_tts_quota(uuid, boolean) to service_role;
