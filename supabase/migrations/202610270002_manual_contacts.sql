begin;
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
commit;
