begin;
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
