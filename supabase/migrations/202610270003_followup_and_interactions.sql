begin;
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
commit;
