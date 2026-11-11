-- CONNECT: instalación inicial para un proyecto sin tablas CONNECT.
-- Generado desde migraciones canónicas; ejecutar una sola vez.
begin;
-- 202610270001_connect_core.sql

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
-- 202610270002_manual_contacts.sql

-- Authenticated staff capture is separate from anonymous campaign submissions.
create function public.create_commercial_contact(p_org uuid,p_name text,p_email text,p_phone text,p_service uuid,p_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare contact_id uuid;
begin
 if not public.is_member(p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_consent is distinct from true then raise exception 'Consent required'; end if;
 if p_name is null or p_email is null or p_phone is null then raise exception 'Invalid contact'; end if;
 if p_service is not null and not exists(select 1 from public.services where id=p_service and organization_id=p_org and active) then raise exception 'Invalid service'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text || lower(trim(p_email)),0));
 if exists(select 1 from public.leads where organization_id=p_org and lower(email)=lower(trim(p_email)) and created_at>now()-interval '1 hour') then raise exception 'Contact already received recently'; end if;
 insert into public.leads(organization_id,name,email,phone,service_id,consent_version)
 values(p_org,trim(p_name),lower(trim(p_email)),trim(p_phone),p_service,'staff-attested-commercial-contact-v1') returning id into contact_id;
 insert into public.opportunities(organization_id,lead_id) values(p_org,contact_id);
 return contact_id;
end;
$$;
revoke all on function public.create_commercial_contact(uuid,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.create_commercial_contact(uuid,text,text,text,uuid,boolean) to authenticated;
-- 202610270003_followup_and_interactions.sql

-- Catalog hierarchy: clinical follow-up is a commercial service, not a CRM stage.
alter table public.services drop constraint services_category_check;
alter table public.services add constraint services_category_check check(category in ('CHECK','VITA','BODY','COMPRENDE','OPTIMIZA','SEGUIMIENTO'));
alter table public.services add column subcategory text check(subcategory in ('SUPLE','RECOVERY','GLOW'));
alter table public.services add constraint services_subcategory_parent check(subcategory is null or category='OPTIMIZA');
grant insert(subcategory),update(subcategory) on public.services to authenticated;

create table public.followup_settings (
 organization_id uuid primary key references public.organizations(id),
 reminder_minutes integer not null default 60 check(reminder_minutes between 15 and 43200)
);
create table public.followup_tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 opportunity_id uuid not null unique references public.opportunities(id),
 due_at timestamptz not null default (now()+interval '1 hour'), red_at timestamptz not null default (now()+interval '24 hours'), state text not null default 'pending' check(state in ('pending','done','cancelled')),
 human_required boolean not null default false, assigned_to uuid,
 foreign key(organization_id,assigned_to) references public.memberships(organization_id,user_id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,id)
);
create table public.commercial_notifications (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 recipient_id uuid not null,task_id uuid not null,kind text not null check(kind in ('new_request','reminder','human_handoff')),
 created_at timestamptz not null default now(),read_at timestamptz, cycle bigint not null default 0,
 foreign key(organization_id,recipient_id) references public.memberships(organization_id,user_id),
 foreign key(organization_id,task_id) references public.followup_tasks(organization_id,id),
 unique(recipient_id,task_id,kind,cycle)
);
create table public.interaction_events (
 id uuid primary key,organization_id uuid not null references public.organizations(id),session_id uuid not null,
 kind text not null check(kind in ('page_view','service_view','whatsapp_click','email_click','website_click','contact_started')),
 service_id uuid,point_id uuid,consent_version text not null default 'anonymous-metrics-v1',created_at timestamptz not null default now(),
 foreign key(organization_id,service_id) references public.services(organization_id,id),
 foreign key(organization_id,point_id) references public.connect_points(organization_id,id)
);
create table public.contact_receipts (
 organization_id uuid not null references public.organizations(id),lead_id uuid not null,
 token_hash text primary key,created_at timestamptz not null default now(),
 foreign key(organization_id,lead_id) references public.leads(organization_id,id)
);
alter table public.opportunities add column updated_at timestamptz not null default now();
create index followup_due on public.followup_tasks(organization_id,state,due_at);
create index notifications_recipient on public.commercial_notifications(recipient_id,created_at desc);
create index interactions_org on public.interaction_events(organization_id,created_at desc);
create index interactions_rate on public.interaction_events(organization_id,session_id,created_at);

alter table public.followup_settings enable row level security;
alter table public.followup_tasks enable row level security;
alter table public.commercial_notifications enable row level security;
alter table public.interaction_events enable row level security;
alter table public.contact_receipts enable row level security;
revoke all on public.followup_settings,public.followup_tasks,public.commercial_notifications,public.interaction_events,public.contact_receipts from anon,authenticated;
grant select on public.followup_settings,public.followup_tasks,public.commercial_notifications,public.interaction_events to authenticated;
grant insert(organization_id,reminder_minutes),update(reminder_minutes) on public.followup_settings to authenticated;
grant update(state,due_at,assigned_to) on public.followup_tasks to authenticated;
grant update(read_at) on public.commercial_notifications to authenticated;
create policy followup_settings_read on public.followup_settings for select to authenticated using(public.is_member(organization_id));
create policy followup_settings_add on public.followup_settings for insert to authenticated with check(public.is_admin(organization_id));
create policy followup_settings_edit on public.followup_settings for update to authenticated using(public.is_admin(organization_id)) with check(public.is_admin(organization_id));
create policy followup_tasks_read on public.followup_tasks for select to authenticated using(public.is_member(organization_id));
create policy followup_tasks_edit on public.followup_tasks for update to authenticated using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy notifications_own on public.commercial_notifications for select to authenticated using(recipient_id=auth.uid() and public.is_member(organization_id));
create policy notifications_read on public.commercial_notifications for update to authenticated using(recipient_id=auth.uid() and public.is_member(organization_id)) with check(recipient_id=auth.uid() and public.is_member(organization_id));
create policy interactions_read on public.interaction_events for select to authenticated using(public.is_member(organization_id));

create function public.followup_for_opportunity() returns trigger language plpgsql security definer set search_path='' as $$
declare task public.followup_tasks; minutes integer;
begin
 if tg_op='UPDATE' then new.updated_at=now(); end if;
 if tg_op='INSERT' then
  select coalesce((select reminder_minutes from public.followup_settings where organization_id=new.organization_id),60) into minutes;
  insert into public.followup_tasks(organization_id,opportunity_id,due_at) values(new.organization_id,new.id,now()+make_interval(mins=>minutes)) returning * into task;
  insert into public.commercial_notifications(organization_id,recipient_id,task_id,kind)
  select new.organization_id,user_id,task.id,'new_request' from public.memberships where organization_id=new.organization_id;
 elsif old.stage is distinct from new.stage then
  if new.stage='closed_lost' then
   update public.followup_tasks set state='cancelled',updated_at=now() where opportunity_id=new.id;
  else
   select coalesce((select reminder_minutes from public.followup_settings where organization_id=new.organization_id),60) into minutes;
   update public.followup_tasks set state='pending',due_at=now()+make_interval(mins=>minutes),red_at=now()+interval '24 hours',updated_at=now() where opportunity_id=new.id returning * into task;
   delete from public.commercial_notifications where task_id=task.id and kind='reminder';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.followup_for_opportunity() from public,anon,authenticated;
create trigger followup_opportunity before insert or update on public.opportunities for each row execute function public.followup_for_opportunity();
-- The opportunity must exist before the task FK can be checked: defer that FK until statement completion.
alter table public.followup_tasks drop constraint followup_tasks_opportunity_id_fkey;
alter table public.followup_tasks add constraint followup_tasks_opportunity_id_fkey foreign key(opportunity_id) references public.opportunities(id) deferrable initially deferred;

-- Internal generation can be called by a scheduled database job, without a user session.
create function public.generate_due_commercial_reminders(p_org uuid) returns void language sql security definer set search_path='' as $$
 insert into public.commercial_notifications(organization_id,recipient_id,task_id,kind,cycle)
 select t.organization_id,m.user_id,t.id,'reminder',floor(extract(epoch from(now()-t.due_at))/(coalesce(s.reminder_minutes,60)*60))::bigint
 from public.followup_tasks t join public.memberships m on m.organization_id=t.organization_id
 join public.opportunities o on o.id=t.opportunity_id and o.organization_id=t.organization_id
 left join public.followup_settings s on s.organization_id=t.organization_id
 where (p_org is null or t.organization_id=p_org) and o.stage<>'closed_lost' and t.state='pending' and t.due_at<=now() and t.created_at<now()-interval '1 minute' and (t.assigned_to is null or t.assigned_to=m.user_id)
 on conflict(recipient_id,task_id,kind,cycle) do nothing;
$$;
revoke all on function public.generate_due_commercial_reminders(uuid) from public,anon,authenticated;
create function public.run_due_commercial_reminders() returns void language sql security definer set search_path='' as $$
 select public.generate_due_commercial_reminders(null);
$$;
revoke all on function public.run_due_commercial_reminders() from public,anon,authenticated;
create function public.sync_reminders(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform public.generate_due_commercial_reminders(p_org);
end;
$$;
revoke all on function public.sync_reminders(uuid) from public,anon;
grant execute on function public.sync_reminders(uuid) to authenticated;

create function public.record_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_service uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;pt uuid;
begin
 select id into org_id from public.organizations where slug=p_slug and published;
 if org_id is null then raise exception 'Unavailable'; end if;
 if p_session is null then raise exception 'Invalid session'; end if;
 if p_service is not null and not exists(select 1 from public.services where organization_id=org_id and id=p_service and active) then raise exception 'Invalid service'; end if;
 if p_code is not null then select id into pt from public.connect_points where organization_id=org_id and code=p_code and active; if pt is null then raise exception 'Invalid point'; end if; end if;
 perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_session::text,1));
 if (select count(*) from public.interaction_events where organization_id=org_id and session_id=p_session and created_at>now()-interval '1 day')>=100 then raise exception 'Event limit'; end if;
 insert into public.interaction_events(id,organization_id,session_id,kind,service_id,point_id) values(p_id,org_id,p_session,p_kind,p_service,pt) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_interaction(text,uuid,uuid,text,uuid,text) from public;
grant execute on function public.record_interaction(text,uuid,uuid,text,uuid,text) to anon,authenticated;

create function public.capture_connect_request(p_slug text,p_name text,p_email text,p_phone text,p_service uuid,p_code text,p_consent boolean,p_request_type text,p_receipt text) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;contact_id uuid;task_id uuid;
begin
 if p_request_type is null or p_request_type not in ('information','subscription','human') then raise exception 'Invalid request type';end if;
 if p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' then raise exception 'Invalid receipt';end if;
 perform public.capture_lead(p_slug,p_name,p_email,p_phone,p_service,p_code,p_consent);
 select id into org_id from public.organizations where slug=p_slug;
 select id into contact_id from public.leads where organization_id=org_id and lower(email)=lower(trim(p_email)) order by created_at desc limit 1;
 insert into public.contact_receipts(organization_id,lead_id,token_hash) values(org_id,contact_id,encode(sha256(convert_to(p_receipt,'UTF8')),'hex'));
 if p_request_type='human' then
  update public.followup_tasks t set human_required=true,due_at=now(),updated_at=now() from public.opportunities o where t.opportunity_id=o.id and o.lead_id=contact_id returning t.id into task_id;
  insert into public.commercial_notifications(organization_id,recipient_id,task_id,kind)
  select org_id,user_id,task_id,'human_handoff' from public.memberships where organization_id=org_id;
 end if;
end;
$$;
revoke all on function public.capture_connect_request(text,text,text,text,uuid,text,boolean,text,text) from public;
grant execute on function public.capture_connect_request(text,text,text,text,uuid,text,boolean,text,text) to anon,authenticated;

create function public.get_contact_status(p_slug text,p_receipt text) returns table(stage text,updated_at timestamptz) language sql security definer set search_path='' as $$
 select o.stage,o.updated_at from public.contact_receipts r join public.organizations org on org.id=r.organization_id join public.opportunities o on o.lead_id=r.lead_id and o.organization_id=r.organization_id
 where org.slug=p_slug and r.token_hash=encode(sha256(convert_to(p_receipt,'UTF8')),'hex') and r.created_at>now()-interval '30 days';
$$;
revoke all on function public.get_contact_status(text,text) from public;
grant execute on function public.get_contact_status(text,text) to anon,authenticated;
create trigger audit_followup_tasks after update on public.followup_tasks for each row execute function public.audit_change();

create function public.reset_task_reminders() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.updated_at=now();
 if new.due_at is distinct from old.due_at then delete from public.commercial_notifications where task_id=new.id and kind='reminder'; end if;
 return new;
end;
$$;
revoke all on function public.reset_task_reminders() from public,anon,authenticated;
create trigger reset_task_reminders before update on public.followup_tasks for each row execute function public.reset_task_reminders();

-- Existing opportunities become pending tasks without duplicate campaign events.
insert into public.followup_tasks(organization_id,opportunity_id,created_at,due_at,red_at,state)
select organization_id,id,created_at,created_at+interval '1 hour',created_at+interval '24 hours',case when stage='closed_lost' then 'cancelled' else 'pending' end from public.opportunities;
insert into public.followup_settings(organization_id) select id from public.organizations;
-- Only known pilot service names are seeded, without prices or clinical contents.
insert into public.services(organization_id,name,category,subcategory,description)
select o.id,s.name,s.category,s.subcategory,s.description from public.organizations o cross join (values
 ('SUPLE','OPTIMIZA','SUPLE','Solicita información comercial sobre SUPLE.'),
 ('RECOVERY','OPTIMIZA','RECOVERY','Solicita información comercial sobre RECOVERY.'),
 ('GLOW','OPTIMIZA','GLOW','Solicita información comercial sobre GLOW.'),
 ('SEGUIMIENTO','SEGUIMIENTO',null,'Solicita información comercial sobre el servicio de seguimiento y su inclusión en suscripciones. No envíes antecedentes clínicos.')
) as s(name,category,subcategory,description) where o.slug='novogen' and not exists(select 1 from public.services x where x.organization_id=o.id and x.name=s.name);
-- 202610270004_flash_catalogue_and_buttons.sql

-- Commercial services recovered from the user's original published interface.
-- No prices, subscriptions, benefits or patient records are imported.
alter table public.interaction_events drop constraint interaction_events_kind_check;
alter table public.interaction_events add constraint interaction_events_kind_check check(kind in ('page_view','service_view','whatsapp_click','email_click','website_click','contact_started','agenda_click','instagram_click','tiktok_click','button_click'));
alter table public.interaction_events add column target text check(target in ('orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));
create index interactions_target on public.interaction_events(organization_id,target,created_at desc);
-- Keep the six-argument function for clients running the previous version.
create function public.record_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_service uuid,p_code text,p_target text) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;pt uuid; expected text;
begin
 select id into org_id from public.organizations where slug=p_slug and published;
 if org_id is null then raise exception 'Unavailable'; end if;
 if p_session is null then raise exception 'Invalid session'; end if;
 expected=case p_kind when 'agenda_click' then 'agenda' when 'instagram_click' then 'instagram' when 'tiktok_click' then 'tiktok' when 'whatsapp_click' then 'whatsapp' when 'email_click' then 'email' when 'website_click' then 'website' when 'service_view' then 'service_info' else null end;
 if expected is not null and p_target is distinct from expected then raise exception 'Invalid target';end if;
 if p_kind in ('page_view','contact_started') and p_target is not null then raise exception 'Invalid target';end if;
 if p_kind='button_click' and p_target in ('agenda','instagram','tiktok','whatsapp','email','website','service_info') then raise exception 'Invalid target';end if;
 if p_kind='button_click' and p_target is null then raise exception 'Missing target';end if;
 if p_target like 'service_%' and p_service is null then raise exception 'Missing service';end if;
 if p_service is not null and not exists(select 1 from public.services where organization_id=org_id and id=p_service and active) then raise exception 'Invalid service'; end if;
 if p_code is not null then select id into pt from public.connect_points where organization_id=org_id and code=p_code and active; if pt is null then raise exception 'Invalid point'; end if; end if;
 perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_session::text,1));
 if (select count(*) from public.interaction_events where organization_id=org_id and session_id=p_session and created_at>now()-interval '1 day')>=100 then raise exception 'Event limit'; end if;
 insert into public.interaction_events(id,organization_id,session_id,kind,service_id,point_id,target) values(p_id,org_id,p_session,p_kind,p_service,pt,p_target) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_interaction(text,uuid,uuid,text,uuid,text,text) from public;
grant execute on function public.record_interaction(text,uuid,uuid,text,uuid,text,text) to anon,authenticated;

create table public.public_channels (
 organization_id uuid primary key references public.organizations(id),
 website_url text not null default '',agenda_url text not null default '',instagram_url text not null default '',tiktok_url text not null default '',whatsapp_url text not null default '',email text not null default '',
 constraint channels_https check((website_url='' or website_url ~ '^https://[^/@[:space:]]+(/|$)') and (agenda_url='' or agenda_url ~ '^https://[^/@[:space:]]+(/|$)')),
 constraint channels_social check((instagram_url='' or instagram_url ~ '^https://(www\.)?instagram\.com/') and (tiktok_url='' or tiktok_url ~ '^https://((www\.)?tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/') and (whatsapp_url='' or whatsapp_url ~ '^https://(wa\.me|api\.whatsapp\.com|www\.whatsapp\.com)/')),
 constraint channels_length check(length(website_url)<=2048 and length(agenda_url)<=2048 and length(instagram_url)<=2048 and length(tiktok_url)<=2048 and length(whatsapp_url)<=2048 and length(email)<=254),
 constraint channels_email check(email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
alter table public.public_channels enable row level security;
revoke all on public.public_channels from anon,authenticated;
grant select on public.public_channels to anon,authenticated;
grant insert(organization_id,website_url,agenda_url,instagram_url,tiktok_url,whatsapp_url,email),update(website_url,agenda_url,instagram_url,tiktok_url,whatsapp_url,email) on public.public_channels to authenticated;
create policy channels_public on public.public_channels for select to anon,authenticated using(exists(select 1 from public.organizations o where o.id=organization_id and o.published));
create policy channels_member on public.public_channels for select to authenticated using(public.is_member(organization_id));
create policy channels_add on public.public_channels for insert to authenticated with check(public.is_admin(organization_id));
create policy channels_edit on public.public_channels for update to authenticated using(public.is_admin(organization_id)) with check(public.is_admin(organization_id));
create function public.audit_public_channels() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.audit_logs(organization_id,actor_id,entity,record_id,operation) values(new.organization_id,auth.uid(),'public_channels',new.organization_id,tg_op);return new;end;
$$;
revoke all on function public.audit_public_channels() from public,anon,authenticated;
create trigger audit_public_channels after insert or update on public.public_channels for each row execute function public.audit_public_channels();
insert into public.public_channels(organization_id,website_url,agenda_url,instagram_url,whatsapp_url,email)
select id,'https://novogensalud.cl/','https://www.novogensalud.cl/reservar/','https://www.instagram.com/novogen.temuco','https://wa.me/56944683094','novogen.temuco@gmail.com' from public.organizations where slug='novogen';

insert into public.services(organization_id,name,category,subcategory,description)
select o.id,s.name,'OPTIMIZA',s.subcategory,s.description
from public.organizations o cross join (values
 ('RECOVERY · Essential','RECOVERY','Vitaminas B por vía intramuscular.'),
 ('RECOVERY · Advance','RECOVERY','Vitaminas B por vía endovenosa.'),
 ('RECOVERY · Premium','RECOVERY','Evaluación y terapia personalizada.'),
 ('GLOW · Limpieza facial','GLOW','Limpieza profunda y cuidado facial profesional.'),
 ('GLOW · Regeneración y calidad de la piel','GLOW','Mejora la textura, hidratación y luminosidad.'),
 ('GLOW · Manchas y tono irregular','GLOW','Mejora la apariencia de manchas y unifica el tono.'),
 ('GLOW · Ojeras y bolsas','GLOW','Revitaliza la apariencia del contorno de ojos.'),
 ('GLOW · Regeneración labial','GLOW','Hidratación y calidad del labio, sin relleno.'),
 ('GLOW · Rojeces y apariencia vascular','GLOW','Cuida las pieles con tendencia al enrojecimiento.'),
 ('GLOW · Caída y fortalecimiento capilar','GLOW','Apoya la calidad del cuero cabelludo y del cabello.')
) s(name,subcategory,description)
where o.slug='novogen' and not exists(select 1 from public.services x where x.organization_id=o.id and x.name=s.name and x.subcategory=s.subcategory);
-- 202610280005_original_mobile_targets.sql

-- Consent-based interaction targets used by the recovered mobile interface.
alter table public.interaction_events drop constraint interaction_events_target_check;
alter table public.interaction_events add constraint interaction_events_target_check check(target in ('navigation','detail_open','detail_close','orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));

-- 202610280006_navigation_tracking_fix.sql

-- SQL LIKE '_' matched the SERVICES navigation button as though it were a service-specific action.
do $repair$
declare definition text;
 old_check text := 'if p_target like ''service_%'' and p_service is null';
 new_check text := 'if p_target in (''service_info'',''service_contact'',''service_close'') and p_service is null';
begin
 select pg_get_functiondef('public.record_interaction(text,uuid,uuid,text,uuid,text,text)'::regprocedure) into definition;
 if position(old_check in definition)>0 then
  execute replace(definition,old_check,new_check);
 elsif position(new_check in definition)=0 then
  raise exception 'Review record_interaction before applying navigation fix';
 end if;
end;
$repair$;

-- 202610280007_catalogue_hierarchy.sql

-- Preserve every existing UUID and commercial record; add explicit catalogue semantics.
alter table public.services add column catalog_type text not null default 'service' check(catalog_type in ('service','group'));
alter table public.services add column parent_id uuid;
alter table public.services add column action_url text not null default '' check(length(action_url)<=2048 and (action_url='' or action_url ~ '^https://[^/@[:space:]]+(/|$)'));
alter table public.services add column action_label text not null default '' check(length(action_label)<=60);
alter table public.services add constraint service_parent_same_org foreign key(organization_id,parent_id) references public.services(organization_id,id);
create index services_parent on public.services(organization_id,parent_id);
grant insert(catalog_type,parent_id,action_url,action_label),update(catalog_type,parent_id,action_url,action_label) on public.services to authenticated;

create function public.guard_catalogue_tree() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,7));
 if new.parent_id is not null then
  if new.parent_id=new.id then raise exception 'Catalogue cycle';end if;
  if not exists(select 1 from public.services where organization_id=new.organization_id and id=new.parent_id and catalog_type='group') then raise exception 'Parent must be a group in this organization';end if;
  if exists(with recursive chain as (select id,parent_id from public.services where organization_id=new.organization_id and id=new.parent_id union all select s.id,s.parent_id from public.services s join chain c on s.id=c.parent_id where s.organization_id=new.organization_id) select 1 from chain where id=new.id) then raise exception 'Catalogue cycle';end if;
 end if;
 if new.catalog_type='service' and exists(select 1 from public.services where organization_id=new.organization_id and parent_id=new.id) then raise exception 'A group with children cannot become a service';end if;
 return new;
end;
$$;
revoke all on function public.guard_catalogue_tree() from public,anon,authenticated;
create trigger guard_catalogue_tree before insert or update of parent_id,catalog_type,organization_id on public.services for each row execute function public.guard_catalogue_tree();

-- Known NOVOGEN hierarchy; SUPLE and COMPRENDE are individual services.
update public.services s set catalog_type='group' from public.organizations o where s.organization_id=o.id and o.slug='novogen' and upper(trim(s.name)) in ('OPTIMIZA','RECOVERY','GLOW');
insert into public.services(organization_id,name,category,description,catalog_type)
select id,'Evaluación','CHECK','Conoce tu estado de salud de forma integral.','group' from public.organizations o where slug='novogen' and not exists(select 1 from public.services s where s.organization_id=o.id and s.catalog_type='group' and lower(s.name)='evaluación');
update public.services s set parent_id=(select g.id from public.services g where g.organization_id=s.organization_id and g.catalog_type='group' and lower(g.name)='evaluación' order by g.created_at limit 1) from public.organizations o where s.organization_id=o.id and o.slug='novogen' and s.catalog_type='service' and s.category in ('CHECK','BODY','VITA');
update public.services s set parent_id=(select g.id from public.services g where g.organization_id=s.organization_id and g.catalog_type='group' and upper(g.name)='OPTIMIZA' order by g.created_at limit 1) from public.organizations o where s.organization_id=o.id and o.slug='novogen' and upper(trim(s.name)) in ('SUPLE','RECOVERY','GLOW');
update public.services s set parent_id=(select g.id from public.services g where g.organization_id=s.organization_id and g.catalog_type='group' and upper(g.name)=s.subcategory order by g.created_at limit 1) from public.organizations o where s.organization_id=o.id and o.slug='novogen' and s.catalog_type='service' and s.subcategory in ('RECOVERY','GLOW');
update public.services s set description='Educación sobre productos por todos los canales y acceso a NOVOGEN Store.',action_url='https://www.novogenstore.cl/',action_label='Ver productos' from public.organizations o where s.organization_id=o.id and o.slug='novogen' and upper(trim(s.name))='SUPLE';

create function public.catalogue_visible(p_org uuid,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 with recursive chain as (select id,parent_id,active from public.services where organization_id=p_org and id=p_id union all select s.id,s.parent_id,s.active from public.services s join chain c on s.id=c.parent_id where s.organization_id=p_org)
 select count(*)>0 and bool_and(active) from chain;
$$;
revoke all on function public.catalogue_visible(uuid,uuid) from public,anon,authenticated;
create function public.guard_concrete_service() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.service_id is not null and not exists(select 1 from public.services s where s.organization_id=new.organization_id and s.id=new.service_id and s.catalog_type='service' and public.catalogue_visible(s.organization_id,s.id)) then raise exception 'Select an active individual service';end if;
 return new;
end;
$$;
revoke all on function public.guard_concrete_service() from public,anon,authenticated;
create trigger guard_concrete_service before insert or update of service_id,organization_id on public.leads for each row execute function public.guard_concrete_service();

alter table public.interaction_events add column preference_id uuid;
alter table public.interaction_events add constraint preference_same_org foreign key(organization_id,preference_id) references public.services(organization_id,id);
alter table public.interaction_events add constraint separate_preference_service check(service_id is null or preference_id is null);
alter table public.interaction_events drop constraint interaction_events_kind_check;
alter table public.interaction_events add constraint interaction_events_kind_check check(kind in ('page_view','service_view','preference_view','whatsapp_click','email_click','website_click','contact_started','agenda_click','instagram_click','tiktok_click','button_click'));
alter table public.interaction_events drop constraint interaction_events_target_check;
alter table public.interaction_events add constraint interaction_events_target_check check(target in ('preference_info','store','navigation','detail_open','detail_close','orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));
create index interactions_preference on public.interaction_events(organization_id,preference_id,created_at desc);

create function public.record_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_service uuid,p_code text,p_target text,p_preference uuid) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;pt uuid;expected text;
begin
 select id into org_id from public.organizations where slug=p_slug and published;
 if org_id is null then raise exception 'Unavailable';end if;
 if p_session is null then raise exception 'Invalid session';end if;
 if p_service is not null and p_preference is not null then raise exception 'Separate service and preference';end if;
 if p_service is not null and not exists(select 1 from public.services where organization_id=org_id and id=p_service and catalog_type='service' and public.catalogue_visible(org_id,id)) then raise exception 'Invalid service';end if;
 if p_preference is not null and not exists(select 1 from public.services where organization_id=org_id and id=p_preference and catalog_type='group' and public.catalogue_visible(org_id,id)) then raise exception 'Invalid preference';end if;
 expected=case p_kind when 'preference_view' then 'preference_info' when 'service_view' then 'service_info' when 'agenda_click' then 'agenda' when 'instagram_click' then 'instagram' when 'tiktok_click' then 'tiktok' when 'whatsapp_click' then 'whatsapp' when 'email_click' then 'email' when 'website_click' then 'website' else null end;
 if expected is not null and p_target is distinct from expected then raise exception 'Invalid target';end if;
 if p_kind='preference_view' and p_preference is null then raise exception 'Missing preference';end if;
 if p_kind in ('page_view','contact_started') and p_target is not null then raise exception 'Invalid target';end if;
 if p_kind='button_click' and (p_target is null or p_target in ('agenda','instagram','tiktok','whatsapp','email','website','service_info','preference_info')) then raise exception 'Invalid target';end if;
 if p_target in ('service_info','service_contact','service_close') and p_service is null then raise exception 'Missing service';end if;
 if p_code is not null then select id into pt from public.connect_points where organization_id=org_id and code=p_code and active;if pt is null then raise exception 'Invalid point';end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_session::text,1));
 if (select count(*) from public.interaction_events where organization_id=org_id and session_id=p_session and created_at>now()-interval '1 day')>=100 then raise exception 'Event limit';end if;
 insert into public.interaction_events(id,organization_id,session_id,kind,service_id,point_id,target,preference_id) values(p_id,org_id,p_session,p_kind,p_service,pt,p_target,p_preference) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_interaction(text,uuid,uuid,text,uuid,text,text,uuid) from public;
grant execute on function public.record_interaction(text,uuid,uuid,text,uuid,text,text,uuid) to anon,authenticated;
-- Existing clients retain their signatures, with the same new service/group safeguards.
create or replace function public.record_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_service uuid,p_code text,p_target text) returns void language sql security definer set search_path='' as $$
 select public.record_interaction(p_slug,p_id,p_session,p_kind,p_service,p_code,p_target,null::uuid);
$$;
create or replace function public.record_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_service uuid,p_code text) returns void language sql security definer set search_path='' as $$
 select public.record_interaction(p_slug,p_id,p_session,p_kind,p_service,p_code,case p_kind when 'service_view' then 'service_info' when 'whatsapp_click' then 'whatsapp' when 'email_click' then 'email' when 'website_click' then 'website' else null end,null::uuid);
$$;

-- 202610280008_youtube_channel.sql

alter table public.public_channels add column youtube_url text not null default '' check(length(youtube_url)<=2048 and (youtube_url='' or youtube_url ~ '^https://((www\.)?youtube\.com|youtu\.be)/'));
grant insert(youtube_url),update(youtube_url) on public.public_channels to authenticated;
update public.public_channels set youtube_url='https://www.youtube.com/@novogensalud' where organization_id=(select id from public.organizations where slug='novogen') and youtube_url='';
alter table public.interaction_events drop constraint interaction_events_kind_check;
alter table public.interaction_events add constraint interaction_events_kind_check check(kind in ('youtube_click','page_view','service_view','preference_view','whatsapp_click','email_click','website_click','contact_started','agenda_click','instagram_click','tiktok_click','button_click'));
alter table public.interaction_events drop constraint interaction_events_target_check;
alter table public.interaction_events add constraint interaction_events_target_check check(target in ('youtube','preference_info','store','navigation','detail_open','detail_close','orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));
do $youtube$
declare definition text;
begin
 select pg_get_functiondef('public.record_interaction(text,uuid,uuid,text,uuid,text,text,uuid)'::regprocedure) into definition;
 if position('when ''youtube_click''' in definition)=0 then
  if position('when ''tiktok_click'' then ''tiktok''' in definition)=0 then raise exception 'Review record_interaction before applying YouTube';end if;
  definition=replace(definition,'when ''tiktok_click'' then ''tiktok''','when ''tiktok_click'' then ''tiktok'' when ''youtube_click'' then ''youtube''');
  definition=replace(definition,'p_target in (''agenda'',''instagram'',''tiktok'',''whatsapp''','p_target in (''agenda'',''instagram'',''tiktok'',''youtube'',''whatsapp''');
  execute definition;
 end if;
end;
$youtube$;

-- 202610280009_app_access_and_ai_quota.sql

-- Only records acceptance and request counts, never conversation text or clinical details.
create table public.app_consents(
 id uuid primary key,organization_id uuid not null references public.organizations(id),
 terms_version text not null check(terms_version ~ '^[a-zA-Z0-9._-]{1,80}$'),
 accepted_at timestamptz not null default now(),unique(organization_id,id)
);
create table public.ai_request_usage(
 id uuid primary key,organization_id uuid not null references public.organizations(id),lead_id uuid not null,consent_id uuid not null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,lead_id) references public.leads(organization_id,id),
 foreign key(organization_id,consent_id) references public.app_consents(organization_id,id)
);
create index ai_usage_quota on public.ai_request_usage(organization_id,created_at);
alter table public.app_consents enable row level security;
alter table public.ai_request_usage enable row level security;
revoke all on public.app_consents,public.ai_request_usage from anon,authenticated;
create function public.record_app_consent(p_slug text,p_id uuid,p_version text) returns void language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select id into org from public.organizations where slug=p_slug and published;
 if org is null then raise exception 'Unavailable';end if;
 insert into public.app_consents(id,organization_id,terms_version) values(p_id,org,p_version);
end;$$;
revoke all on function public.record_app_consent(text,uuid,text) from public;
grant execute on function public.record_app_consent(text,uuid,text) to anon,authenticated;
create function public.consume_ai_request(p_slug text,p_receipt text,p_consent uuid,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare org uuid;contact uuid;
begin
 select id into org from public.organizations where slug=p_slug and published;
 if org is null or p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' then return false;end if;
 select lead_id into contact from public.contact_receipts where organization_id=org and token_hash=encode(sha256(convert_to(p_receipt,'UTF8')),'hex') and created_at>now()-interval '30 days';
 if contact is null or not exists(select 1 from public.app_consents where organization_id=org and id=p_consent and accepted_at>now()-interval '30 days') then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('ai-quota-'||org::text,0));
 if exists(select 1 from public.ai_request_usage where id=p_id) then return false;end if;
 if (select count(*) from public.ai_request_usage where organization_id=org and created_at>=date_trunc('day',now()))>=200 then return false;end if;
 if (select count(*) from public.ai_request_usage where organization_id=org and lead_id=contact and created_at>=date_trunc('day',now()))>=30 then return false;end if;
 insert into public.ai_request_usage(id,organization_id,lead_id,consent_id) values(p_id,org,contact,p_consent);
 return true;
end;$$;
revoke all on function public.consume_ai_request(text,text,uuid,uuid) from public;
grant execute on function public.consume_ai_request(text,text,uuid,uuid) to anon,authenticated;
create function public.request_contact_handoff(p_slug text,p_receipt text,p_service uuid,p_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare org uuid;contact uuid;task uuid;
begin
 if p_kind is null or p_kind not in ('commercial','clinical') or p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' then return false;end if;
 select id into org from public.organizations where slug=p_slug and published;
 if org is null then return false;end if;
 select lead_id into contact from public.contact_receipts where organization_id=org and token_hash=encode(sha256(convert_to(p_receipt,'UTF8')),'hex') and created_at>now()-interval '30 days';
 if contact is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('handoff-'||contact::text,0));
 if p_service is not null then
  if not exists(select 1 from public.services where id=p_service and organization_id=org and catalog_type='service' and public.catalogue_visible(org,id)) then return false;end if;
  update public.leads set service_id=p_service where id=contact and organization_id=org;
 end if;
 update public.opportunities set stage=case when stage='closed_lost' then 'new' else stage end,next_action=case when p_kind='clinical' then 'Coordinar contacto con profesional habilitado; sin indicaciones clínicas desde ventas.' else 'Contacto comercial solicitado desde ORIÉNTAME.' end where organization_id=org and lead_id=contact;
 update public.followup_tasks t set human_required=true,due_at=now(),state='pending',updated_at=now() from public.opportunities o where t.organization_id=org and o.organization_id=org and t.opportunity_id=o.id and o.lead_id=contact returning t.id into task;
 if task is null then return false;end if;
 insert into public.commercial_notifications(organization_id,recipient_id,task_id,kind) select org,user_id,task,'human_handoff' from public.memberships where organization_id=org on conflict do nothing;
 return true;
end;$$;
revoke all on function public.request_contact_handoff(text,text,uuid,text) from public;
grant execute on function public.request_contact_handoff(text,text,uuid,text) to anon,authenticated;

commit;
