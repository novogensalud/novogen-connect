begin;
-- All previous collectors belonged to FLASH. Outbound website clicks remain FLASH.
alter table public.interaction_events add column source text not null default 'flash' check(source in ('flash','web'));
create index interactions_source on public.interaction_events(organization_id,source,created_at desc);
-- Dedicated web collector: origin is checked again in the database, not supplied as an arbitrary source label.
create function public.record_web_interaction(p_slug text,p_id uuid,p_session uuid,p_kind text,p_target text,p_origin text) returns void language plpgsql security definer set search_path='' as $$
declare org_id uuid;website text;expected text;
begin
 select o.id,c.website_url into org_id,website from public.organizations o join public.public_channels c on c.organization_id=o.id where o.slug=p_slug and o.published;
 if org_id is null or website='' then raise exception 'Unavailable';end if;
 if p_origin is null or p_origin !~ '^https://[^/@[:space:]]+$' or regexp_replace(lower(split_part(website,'/',3)),'^www\.','') <> regexp_replace(lower(split_part(p_origin,'/',3)),'^www\.','') then raise exception 'Invalid origin';end if;
 if p_session is null then raise exception 'Invalid session';end if;
 expected=case p_kind when 'agenda_click' then 'agenda' when 'instagram_click' then 'instagram' when 'tiktok_click' then 'tiktok' when 'whatsapp_click' then 'whatsapp' when 'email_click' then 'email' when 'website_click' then 'website' else null end;
 if p_kind='page_view' then
  if p_target is not null then raise exception 'Invalid target';end if;
 elsif expected is null or p_target is distinct from expected then raise exception 'Invalid event';end if;
 perform pg_advisory_xact_lock(hashtextextended(org_id::text||p_session::text,1));
 if (select count(*) from public.interaction_events where organization_id=org_id and session_id=p_session and created_at>now()-interval '1 day')>=100 then raise exception 'Event limit';end if;
 insert into public.interaction_events(id,organization_id,session_id,kind,target,source) values(p_id,org_id,p_session,p_kind,p_target,'web') on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_web_interaction(text,uuid,uuid,text,text,text) from public;
grant execute on function public.record_web_interaction(text,uuid,uuid,text,text,text) to anon,authenticated;
commit;
