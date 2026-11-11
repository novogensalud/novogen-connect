begin;
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 slug text not null unique check(slug ~ '^[a-z0-9-]{1,60}$'), published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('admin','agent')), primary key(organization_id,user_id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 2 and 80), category text not null check(category in ('CHECK','VITA','BODY','COMPRENDE','OPTIMIZA')),
 description text not null check(length(description) between 5 and 500), active boolean not null default true,
 created_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.connect_points (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null unique check(code ~ '^[a-f0-9]{32}$'), name text not null check(length(name) between 2 and 80),
 active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 2 and 100), email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(length(phone)<=30 and phone ~ '^[+0-9 ()-]*$'),
 service_id uuid, point_id uuid, consent_at timestamptz not null default now(),
 consent_version text not null default 'commercial-contact-v1', created_at timestamptz not null default now(),
 unique(organization_id,id), foreign key(organization_id,service_id) references public.services(organization_id,id),
 foreign key(organization_id,point_id) references public.connect_points(organization_id,id)
);
create table public.opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), lead_id uuid not null unique,
 stage text not null default 'new' check(stage in ('new','contacted','qualified','booked','closed_lost')),
 next_action text check(length(next_action)<=240), created_at timestamptz not null default now(),
 foreign key(organization_id,lead_id) references public.leads(organization_id,id)
);
create table public.events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 point_id uuid, kind text not null check(kind in ('point_access','lead_submitted')),
 created_at timestamptz not null default now(), foreign key(organization_id,point_id) references public.connect_points(organization_id,id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_id uuid, entity text not null, record_id uuid not null, operation text not null,
 created_at timestamptz not null default now()
);
create index leads_org_created on public.leads(organization_id,created_at desc);
create index leads_rate_limit on public.leads(organization_id,lower(email),created_at);
create index events_org_kind on public.events(organization_id,kind);
create index audit_org_created on public.audit_logs(organization_id,created_at desc);
create index opportunities_org on public.opportunities(organization_id);
create index memberships_user on public.memberships(user_id);

create function public.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid());
$$;
create function public.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and role='admin');
$$;
revoke all on function public.is_member(uuid), public.is_admin(uuid) from public,anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.services enable row level security;
alter table public.connect_points enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.events enable row level security;
alter table public.audit_logs enable row level security;

create policy org_public on public.organizations for select to anon,authenticated using(published);
create policy org_member on public.organizations for select to authenticated using(public.is_member(id));
create policy membership_self on public.memberships for select to authenticated using(user_id=auth.uid());
create policy service_public on public.services for select to anon,authenticated using(active and exists(select 1 from public.organizations o where o.id=organization_id and o.published));
create policy service_member on public.services for select to authenticated using(public.is_member(organization_id));
create policy service_insert on public.services for insert to authenticated with check(public.is_admin(organization_id));
create policy service_update on public.services for update to authenticated using(public.is_admin(organization_id)) with check(public.is_admin(organization_id));
create policy point_member on public.connect_points for select to authenticated using(public.is_member(organization_id));
create policy point_insert on public.connect_points for insert to authenticated with check(public.is_admin(organization_id));
create policy point_update on public.connect_points for update to authenticated using(public.is_admin(organization_id)) with check(public.is_admin(organization_id));
create policy lead_member on public.leads for select to authenticated using(public.is_member(organization_id));
create policy opportunity_member on public.opportunities for select to authenticated using(public.is_member(organization_id));
create policy opportunity_update on public.opportunities for update to authenticated using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy event_member on public.events for select to authenticated using(public.is_member(organization_id));
create policy audit_admin on public.audit_logs for select to authenticated using(public.is_admin(organization_id));

-- Explicit grants: clients cannot create memberships, move records between tenants,
-- insert events directly, or write audit history.
revoke all on public.organizations,public.memberships,public.services,public.connect_points,public.leads,public.opportunities,public.events,public.audit_logs from anon,authenticated;
grant select on public.organizations,public.services to anon,authenticated;
grant select on public.memberships,public.connect_points,public.leads,public.opportunities,public.events,public.audit_logs to authenticated;
grant insert(organization_id,name,category,description,active) on public.services to authenticated;
grant update(name,category,description,active) on public.services to authenticated;
grant insert(organization_id,name,code,active) on public.connect_points to authenticated;
grant update(name,active) on public.connect_points to authenticated;
grant update(stage,next_action) on public.opportunities to authenticated;

create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,actor_id,entity,record_id,operation)
 values(new.organization_id,auth.uid(),tg_table_name,new.id,tg_op);
 return new;
end;
$$;
revoke all on function public.audit_change() from public,anon,authenticated;
create trigger audit_services after insert or update on public.services for each row execute function public.audit_change();
create trigger audit_points after insert or update on public.connect_points for each row execute function public.audit_change();
create trigger audit_opportunities after insert or update on public.opportunities for each row execute function public.audit_change();
create trigger audit_leads after insert on public.leads for each row execute function public.audit_change();

create function public.resolve_point(p_code text) returns text language plpgsql security definer set search_path='' as $$
declare p public.connect_points; org_slug text;
begin
 select cp.* into p from public.connect_points cp join public.organizations o on o.id=cp.organization_id where cp.code=p_code and cp.active and o.published;
 if p.id is null then return null; end if;
 select slug into org_slug from public.organizations where id=p.organization_id;
 insert into public.events(organization_id,point_id,kind) values(p.organization_id,p.id,'point_access');
 return org_slug;
end;
$$;

create function public.capture_lead(p_slug text,p_name text,p_email text,p_phone text,p_service uuid,p_code text,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid; point_id uuid; lead_id uuid;
begin
 select id into org_id from public.organizations where slug=p_slug and published;
 if org_id is null then raise exception 'Unavailable'; end if;
 if p_consent is distinct from true then raise exception 'Consent required'; end if;
 if p_name is null or p_email is null or p_phone is null then raise exception 'Invalid contact'; end if;
 -- Serialize submissions per organization/email to prevent concurrent duplicate bypass.
 perform pg_advisory_xact_lock(hashtextextended(org_id::text || lower(trim(p_email)),0));
 if exists(select 1 from public.leads where organization_id=org_id and lower(email)=lower(trim(p_email)) and created_at>now()-interval '1 hour') then raise exception 'Contact already received recently'; end if;
 if (select count(*) from public.leads where organization_id=org_id and created_at>now()-interval '1 hour')>=100 then raise exception 'Submission limit reached'; end if;
 if p_service is not null and not exists(select 1 from public.services where id=p_service and organization_id=org_id and active) then raise exception 'Invalid service'; end if;
 if p_code is not null then
  select id into point_id from public.connect_points where code=p_code and organization_id=org_id and active;
  if point_id is null then raise exception 'Invalid point'; end if;
 end if;
 insert into public.leads(organization_id,name,email,phone,service_id,point_id) values(org_id,trim(p_name),lower(trim(p_email)),trim(p_phone),p_service,point_id) returning id into lead_id;
 insert into public.opportunities(organization_id,lead_id) values(org_id,lead_id);
 insert into public.events(organization_id,point_id,kind) values(org_id,point_id,'lead_submitted');
end;
$$;
revoke all on function public.resolve_point(text), public.capture_lead(text,text,text,text,uuid,text,boolean) from public;
grant execute on function public.resolve_point(text), public.capture_lead(text,text,text,text,uuid,text,boolean) to anon,authenticated;

-- Pilot stays unpublished until an administrator has reviewed its content.
insert into public.organizations(name,slug) values('NOVOGEN','novogen');
insert into public.services(organization_id,name,category,description)
select id, s.name,s.name,s.description from public.organizations cross join (values
 ('CHECK','Solicita información comercial sobre CHECK.'),
 ('VITA','Solicita información comercial sobre VITA.'),
 ('BODY','Solicita información comercial sobre BODY.'),
 ('COMPRENDE','Solicita información comercial sobre COMPRENDE.'),
 ('OPTIMIZA','Conoce SUPLE, RECOVERY y GLOW. Solicita orientación comercial.')
) s(name,description) where slug='novogen';
commit;
