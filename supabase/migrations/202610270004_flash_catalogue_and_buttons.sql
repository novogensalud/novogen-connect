begin;
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
commit;
