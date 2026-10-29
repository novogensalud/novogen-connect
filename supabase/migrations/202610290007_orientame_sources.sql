begin;
create table public.orientame_sources (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 key text not null check(key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),title text not null check(length(title) between 2 and 160),
 type text not null check(type in ('text','url')),url text not null default '' check(length(url)<=2048),
 content text not null default '' check(length(content)<=20000),status text not null default 'draft' check(status in ('draft','approved','archived')),
 updated_at timestamptz not null default now(),unique(organization_id,key),
 check((type='text' and url='' and length(content)>=5) or (type='url' and url ~ '^https://[^/@[:space:]]+(/|\?|#|$)'))
);
alter table public.orientame_sources enable row level security;
revoke all on public.orientame_sources from anon,authenticated;
grant select on public.orientame_sources to authenticated;
create policy orientame_sources_admin on public.orientame_sources for select to authenticated using(public.is_admin(organization_id));
create function public.audit_orientame_source() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.audit_logs(organization_id,actor_id,entity,record_id,operation)values(new.organization_id,auth.uid(),'orientame_source',new.id,tg_op);return new;end;
$$;
revoke all on function public.audit_orientame_source() from public,anon,authenticated;
create trigger orientame_source_audit after insert or update on public.orientame_sources for each row execute function public.audit_orientame_source();
create function public.import_orientame_sources(p_org uuid,p_sources jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb;total integer;
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_sources is null or jsonb_typeof(p_sources)<>'array' then raise exception 'Invalid sources';end if;
 total=jsonb_array_length(p_sources);
 if total<1 or total>100 or octet_length(p_sources::text)>2097152 then raise exception 'Invalid batch size';end if;
 if (select count(distinct v->>'key') from jsonb_array_elements(p_sources) v)<>total then raise exception 'Duplicate or missing keys';end if;
 perform 1 from public.organizations where id=p_org for update;
 -- All rows commit together; the unique key identifies updates, never another organization.
 for item in select value from jsonb_array_elements(p_sources) loop
  if jsonb_typeof(item)<>'object' or item->>'key' is null or item->>'title' is null or item->>'type' is null then raise exception 'Invalid source';end if;
  insert into public.orientame_sources(organization_id,key,title,type,url,content,status)
  values(p_org,item->>'key',trim(item->>'title'),item->>'type',coalesce(item->>'url',''),trim(coalesce(item->>'content','')),'draft')
  on conflict(organization_id,key) do update set title=excluded.title,type=excluded.type,url=excluded.url,content=excluded.content,status='draft',updated_at=now();
 end loop;
 if (select count(*) from public.orientame_sources where organization_id=p_org)>100 then raise exception 'Source capacity exceeded';end if;
 if (select coalesce(sum(octet_length(row_to_json(s)::text)),0) from public.orientame_sources s where organization_id=p_org)>1800000 then raise exception 'Library size exceeded';end if;
 return total;
end;
$$;
create function public.review_orientame_source(p_org uuid,p_key text,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in ('draft','approved','archived') then raise exception 'Invalid status';end if;
 update public.orientame_sources set status=p_status,updated_at=now() where organization_id=p_org and key=p_key;
 if not found then raise exception 'Source not found';end if;
end;
$$;
revoke all on function public.import_orientame_sources(uuid,jsonb),public.review_orientame_source(uuid,text,text) from public,anon;
grant execute on function public.import_orientame_sources(uuid,jsonb),public.review_orientame_source(uuid,text,text) to authenticated;
commit;
