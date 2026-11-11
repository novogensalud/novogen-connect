begin;

create table public.connect_xp_rules (
 organization_id uuid not null references public.organizations(id),
 activity text not null check (activity in ('education.completed','mission.completed','referral.verified','game.verified')),
 xp integer not null check (xp > 0),
 primary key (organization_id, activity)
);
create table public.connect_xp_levels (
 organization_id uuid not null references public.organizations(id),
 threshold bigint not null check (threshold >= 0),
 label text not null check (length(label) between 1 and 60),
 primary key (organization_id, threshold)
);
create table public.connect_xp_events (
 organization_id uuid not null references public.organizations(id),
 activity text not null,
 source_reference text not null check (length(source_reference) between 1 and 128),
 subject_id uuid not null,
 occurred_at timestamptz not null,
 xp integer not null check (xp > 0),
 primary key (organization_id, activity, source_reference)
);
create index connect_xp_events_period on public.connect_xp_events(organization_id, occurred_at, subject_id);

alter table public.connect_xp_rules enable row level security;
alter table public.connect_xp_levels enable row level security;
alter table public.connect_xp_events enable row level security;
revoke all on public.connect_xp_rules, public.connect_xp_levels, public.connect_xp_events from public, anon, authenticated, service_role;

-- Only a trusted server that verified subject and source may request an award.
create function public.record_connect_xp(p_org uuid, p_activity text, p_reference text, p_subject uuid, p_occurred timestamptz)
returns integer language plpgsql security definer set search_path='' as $$
declare saved public.connect_xp_events%rowtype;
begin
 if p_subject is null or p_occurred is null or p_occurred > statement_timestamp() then
   raise exception 'invalid_xp_event';
 end if;
 -- Serialize requests for the same source record, including retries after rule removal.
 perform pg_advisory_xact_lock(hashtextextended(concat_ws(':', p_org, p_activity, p_reference), 0));
 select * into saved from public.connect_xp_events
 where organization_id=p_org and activity=p_activity and source_reference=p_reference;
 if found then
   if saved.subject_id <> p_subject or saved.occurred_at <> p_occurred then raise exception 'xp_event_conflict'; end if;
   return saved.xp;
 end if;
 insert into public.connect_xp_events(organization_id, activity, source_reference, subject_id, occurred_at, xp)
 select p_org, p_activity, p_reference, p_subject, p_occurred, xp
 from public.connect_xp_rules where organization_id=p_org and activity=p_activity returning * into saved;
 if not found then raise exception 'xp_rule_not_configured'; end if;
 return saved.xp;
end;
$$;
revoke all on function public.record_connect_xp(uuid,text,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.record_connect_xp(uuid,text,text,uuid,timestamptz) to service_role;

create function public.connect_xp_ranking(p_org uuid)
returns table(subject_id uuid, quarter_xp bigint, rolling_xp bigint, level_label text, rank_position bigint)
language plpgsql stable security definer set search_path='' as $$
declare
  local_now timestamp := statement_timestamp() at time zone 'America/Santiago';
  quarter_start timestamptz := date_trunc('quarter', local_now) at time zone 'America/Santiago';
  rolling_start timestamptz := (local_now - interval '12 months') at time zone 'America/Santiago';
begin
 if not public.is_admin(p_org) then raise exception 'forbidden'; end if;
 return query
 with scores as (
   select e.subject_id,
     coalesce(sum(e.xp) filter (where e.occurred_at >= quarter_start), 0) as quarter_xp,
     sum(e.xp) as rolling_xp
   from public.connect_xp_events e
   where e.organization_id=p_org and e.occurred_at >= rolling_start and e.occurred_at <= statement_timestamp()
   group by e.subject_id
 )
 select s.subject_id, s.quarter_xp, s.rolling_xp, l.label,
   dense_rank() over (order by s.quarter_xp desc)
 from scores s
 left join lateral (
   select label from public.connect_xp_levels
   where organization_id=p_org and threshold<=s.rolling_xp order by threshold desc limit 1
 ) l on true
 where s.quarter_xp>0
 order by s.quarter_xp desc, s.subject_id
 limit 100;
end;
$$;
revoke all on function public.connect_xp_ranking(uuid) from public, anon, authenticated, service_role;
grant execute on function public.connect_xp_ranking(uuid) to authenticated;

create table public.connect_rewards (
 organization_id uuid not null references public.organizations(id),
 id uuid not null default gen_random_uuid(),
 label text not null check (length(label) between 1 and 100),
 cost_points integer not null check (cost_points>0),
 active boolean not null default false,
 primary key (organization_id,id)
);
create table public.connect_redemptions (
 organization_id uuid not null references public.organizations(id),
 request_id uuid not null,
 subject_id uuid not null,
 reward_id uuid not null,
 reward_label text not null,
 cost_points integer not null check (cost_points>0),
 state text not null default 'pending' check (state in ('pending','approved','rejected','completed')),
 requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 finance_operation_id uuid,
 delivery_reference uuid,
 delivered_at timestamptz,
 primary key (organization_id,request_id),
 unique (organization_id,finance_operation_id),
 unique (organization_id,delivery_reference),
 check (finance_operation_id is null or state in ('approved','completed')),
 check ((state='completed') = (delivery_reference is not null and delivered_at is not null)),
 check (state<>'completed' or finance_operation_id is not null),
 foreign key (organization_id,reward_id) references public.connect_rewards(organization_id,id)
);
create index connect_redemptions_queue on public.connect_redemptions(organization_id,state,requested_at);
create table public.connect_redemption_reviewers (
 organization_id uuid not null,
 user_id uuid not null,
 primary key (organization_id,user_id),
 foreign key (organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table public.connect_rewards enable row level security;
alter table public.connect_redemptions enable row level security;
alter table public.connect_redemption_reviewers enable row level security;
revoke all on public.connect_rewards, public.connect_redemptions, public.connect_redemption_reviewers from public, anon, authenticated, service_role;
grant select on public.connect_redemptions to authenticated;
create policy connect_redemptions_admin on public.connect_redemptions
 for select to authenticated using (public.is_admin(organization_id));

create function public.request_connect_redemption(p_org uuid,p_request uuid,p_subject uuid,p_reward uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved public.connect_redemptions%rowtype;
begin
 if p_org is null or p_request is null or p_subject is null or p_reward is null then
   raise exception 'invalid_redemption';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws(':','redemption',p_org,p_request),0));
 select * into saved from public.connect_redemptions where organization_id=p_org and request_id=p_request;
 if found then
   if saved.subject_id<>p_subject or saved.reward_id<>p_reward then raise exception 'redemption_conflict'; end if;
   return saved.request_id;
 end if;
 insert into public.connect_redemptions(organization_id,request_id,subject_id,reward_id,reward_label,cost_points)
 select p_org,p_request,p_subject,id,label,cost_points from public.connect_rewards
 where organization_id=p_org and id=p_reward and active;
 if not found then raise exception 'reward_unavailable'; end if;
 return p_request;
end;
$$;
revoke all on function public.request_connect_redemption(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_connect_redemption(uuid,uuid,uuid,uuid) to service_role;

create function public.review_connect_redemption(p_org uuid,p_request uuid,p_decision text)
returns text language plpgsql security definer set search_path='' as $$
declare saved public.connect_redemptions%rowtype;
begin
 if not public.is_admin(p_org) or not exists (
   select 1 from public.connect_redemption_reviewers where organization_id=p_org and user_id=auth.uid()
 ) then raise exception 'forbidden'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
 select * into saved from public.connect_redemptions
 where organization_id=p_org and request_id=p_request for update;
 if not found then raise exception 'redemption_not_found'; end if;
 if saved.state=p_decision then return saved.state; end if;
 if saved.state<>'pending' then raise exception 'redemption_already_reviewed'; end if;
 update public.connect_redemptions set state=p_decision, reviewed_by=auth.uid(), reviewed_at=now()
 where organization_id=p_org and request_id=p_request;
 return p_decision;
end;
$$;
revoke all on function public.review_connect_redemption(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.review_connect_redemption(uuid,uuid,text) to authenticated;

-- A trusted integration worker records a verified FINANCE response. It must
-- send request_id as the idempotency key when asking FINANCE for the debit.
create function public.confirm_connect_redemption_debit(p_org uuid,p_request uuid,p_subject uuid,p_cost integer,p_operation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved public.connect_redemptions%rowtype;
begin
 if p_operation is null then raise exception 'invalid_finance_operation'; end if;
 select * into saved from public.connect_redemptions
 where organization_id=p_org and request_id=p_request for update;
 if not found or saved.state not in ('approved','completed') then raise exception 'redemption_not_approved'; end if;
 if saved.subject_id is distinct from p_subject or saved.cost_points is distinct from p_cost then
   raise exception 'finance_confirmation_conflict';
 end if;
 if saved.finance_operation_id is not null and saved.finance_operation_id<>p_operation then
   raise exception 'finance_confirmation_conflict';
 end if;
 if saved.finance_operation_id is null then
   update public.connect_redemptions set finance_operation_id=p_operation
   where organization_id=p_org and request_id=p_request;
 end if;
 return p_operation;
end;
$$;
revoke all on function public.confirm_connect_redemption_debit(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.confirm_connect_redemption_debit(uuid,uuid,uuid,integer,uuid) to service_role;

-- The delivery provider must deduplicate on request_id before this receipt.
create function public.complete_connect_redemption(p_org uuid,p_request uuid,p_delivery uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved public.connect_redemptions%rowtype;
begin
 if p_delivery is null then raise exception 'invalid_delivery_reference'; end if;
 select * into saved from public.connect_redemptions
 where organization_id=p_org and request_id=p_request for update;
 if not found or saved.finance_operation_id is null then raise exception 'finance_debit_required'; end if;
 if saved.delivery_reference is not null and saved.delivery_reference<>p_delivery then
   raise exception 'delivery_confirmation_conflict';
 end if;
 if saved.delivery_reference is null then
   update public.connect_redemptions set state='completed', delivery_reference=p_delivery, delivered_at=now()
   where organization_id=p_org and request_id=p_request;
 end if;
 return p_delivery;
end;
$$;
revoke all on function public.complete_connect_redemption(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_connect_redemption(uuid,uuid,uuid) to service_role;

commit;
