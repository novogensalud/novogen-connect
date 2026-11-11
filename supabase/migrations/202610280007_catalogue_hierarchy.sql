begin;
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
commit;
