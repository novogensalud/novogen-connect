-- Prepared for review. Applying this migration does not enable the integration.
begin;

create table public.booking_integration_credentials (
 organization_id uuid primary key references public.organizations(id),
 secret_hash text not null unique check(secret_hash ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table public.commercial_bookings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 source text not null check(source='agendalite'), external_booking_id text not null check(external_booking_id ~ '^[1-9][0-9]{0,19}$'),
 revision bigint not null check(revision>0), snapshot_hash text not null check(snapshot_hash ~ '^[a-f0-9]{64}$'),
 external_service_id text not null check(external_service_id ~ '^[1-9][0-9]{0,19}$'),
 service_name text not null check(length(service_name) between 1 and 100),
 external_professional_id text check(external_professional_id ~ '^[1-9][0-9]{0,19}$'),
 start_at timestamptz not null,end_at timestamptz not null check(end_at>start_at),
 status text not null check(status in ('pending','confirmed','cancelled','expired','deleted')),
 contact_reference text not null check(contact_reference ~ '^(booking|client):[1-9][0-9]{0,19}$'),
 contact_name text not null check(length(contact_name) between 1 and 100),
 contact_email text not null check(length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 contact_phone text not null check(length(contact_phone)<=30 and contact_phone ~ '^[+0-9 ()-]*$'),
 purpose text not null default 'reservation_management' check(purpose='reservation_management'),
 marketing_consent boolean check(marketing_consent is null),
 latest_event_id uuid not null, updated_at timestamptz not null default now(),
 unique(organization_id,source,external_booking_id)
);
create table public.booking_integration_events (
 organization_id uuid not null references public.organizations(id),event_id uuid not null,
 external_booking_id text not null,revision bigint not null check(revision>0),
 payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$'),
 state text not null check(state in ('accepted','ignored')),occurred_at timestamptz not null,received_at timestamptz not null default now(),
 primary key(organization_id,event_id)
);
create index commercial_bookings_org_start on public.commercial_bookings(organization_id,start_at);
alter table public.booking_integration_credentials enable row level security;
alter table public.commercial_bookings enable row level security;
alter table public.booking_integration_events enable row level security;
revoke all on public.booking_integration_credentials,public.commercial_bookings,public.booking_integration_events from anon,authenticated;
grant select on public.commercial_bookings,public.booking_integration_events to authenticated;
create policy commercial_bookings_member on public.commercial_bookings for select to authenticated using(public.is_member(organization_id));
create policy booking_integration_events_admin on public.booking_integration_events for select to authenticated using(public.is_admin(organization_id));

-- An administrator provisions only the hash, never the plaintext key, in storage.
create function public.configure_agendalite_integration(p_org uuid,p_hash text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden';end if;
 insert into public.booking_integration_credentials(organization_id,secret_hash,enabled)
 values(p_org,p_hash,p_enabled)
 on conflict(organization_id) do update set secret_hash=excluded.secret_hash,enabled=excluded.enabled,updated_at=now();
end;$$;
revoke all on function public.configure_agendalite_integration(uuid,text,boolean) from public,anon;
grant execute on function public.configure_agendalite_integration(uuid,text,boolean) to authenticated;

create function public.ingest_agendalite_booking(p_slug text,p_secret text,p_event jsonb,p_digest text)
returns text language plpgsql security definer set search_path='' as $$
declare
 org uuid;event_uuid uuid;booking_id text;event_revision bigint;prior_digest text;snapshot_digest text;
 current_booking public.commercial_bookings%rowtype;record_uuid uuid;outcome text:='accepted';
begin
 if p_secret is null or length(p_secret) not between 32 and 256 then raise exception 'Integration unauthorized';end if;
 select c.organization_id into org from public.booking_integration_credentials c
 join public.organizations o on o.id=c.organization_id
 where o.slug=p_slug and c.enabled and c.secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex') for share of c;
 if org is null then raise exception 'Integration unauthorized';end if;
 if jsonb_typeof(p_event) is distinct from 'object' or p_event->>'source' is distinct from 'agendalite'
 or p_event->>'schema_version' is distinct from '1' or p_event->>'event_type' is distinct from 'booking.snapshot'
 or p_event->>'purpose' is distinct from 'reservation_management'
 or jsonb_typeof(p_event->'booking') is distinct from 'object' or jsonb_typeof(p_event->'contact') is distinct from 'object'
 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid integration payload';end if;
 if exists(select 1 from jsonb_object_keys(p_event) k where k not in ('schema_version','source','event_type','event_id','revision','occurred_at','purpose','booking','contact'))
 or exists(select 1 from jsonb_object_keys(p_event->'booking') k where k not in ('id','service_id','service_name','professional_id','start_at','end_at','status'))
 or exists(select 1 from jsonb_object_keys(p_event->'contact') k where k not in ('reference','name','email','phone')) then raise exception 'Invalid integration payload';end if;
 event_uuid:=(p_event->>'event_id')::uuid;booking_id:=p_event->'booking'->>'id';event_revision:=(p_event->>'revision')::bigint;
 if event_uuid is null or booking_id is null or booking_id !~ '^[1-9][0-9]{0,19}$' or event_revision is null or event_revision<1 then raise exception 'Invalid integration payload';end if;
 -- One booking is serialized even when its first two messages arrive concurrently.
 perform pg_advisory_xact_lock(hashtext(org::text),hashtext(booking_id));
 select payload_digest into prior_digest from public.booking_integration_events where organization_id=org and event_id=event_uuid;
 if found then
  if prior_digest<>p_digest then raise exception 'integration_conflict';end if;
  return 'duplicate';
 end if;
 snapshot_digest:=encode(sha256(convert_to((p_event->'booking')::text||(p_event->'contact')::text,'UTF8')),'hex');
 select * into current_booking from public.commercial_bookings where organization_id=org and source='agendalite' and external_booking_id=booking_id for update;
 if current_booking.id is not null then
  if event_revision<current_booking.revision then outcome:='ignored';
  elsif event_revision=current_booking.revision then
   if snapshot_digest<>current_booking.snapshot_hash then raise exception 'integration_conflict';end if;
   outcome:='ignored';
  end if;
 end if;
 insert into public.booking_integration_events(organization_id,event_id,external_booking_id,revision,payload_digest,state,occurred_at)
 values(org,event_uuid,booking_id,event_revision,p_digest,outcome,(p_event->>'occurred_at')::timestamptz);
 if outcome='ignored' then return outcome;end if;
 insert into public.commercial_bookings(organization_id,source,external_booking_id,revision,snapshot_hash,external_service_id,service_name,
 external_professional_id,start_at,end_at,status,contact_reference,contact_name,contact_email,contact_phone,latest_event_id)
 values(org,'agendalite',booking_id,event_revision,snapshot_digest,p_event->'booking'->>'service_id',p_event->'booking'->>'service_name',
 p_event->'booking'->>'professional_id',(p_event->'booking'->>'start_at')::timestamptz,(p_event->'booking'->>'end_at')::timestamptz,
 p_event->'booking'->>'status',p_event->'contact'->>'reference',trim(p_event->'contact'->>'name'),
 lower(trim(p_event->'contact'->>'email')),p_event->'contact'->>'phone',event_uuid)
 on conflict(organization_id,source,external_booking_id) do update set
 revision=excluded.revision,snapshot_hash=excluded.snapshot_hash,external_service_id=excluded.external_service_id,service_name=excluded.service_name,
 external_professional_id=excluded.external_professional_id,start_at=excluded.start_at,end_at=excluded.end_at,status=excluded.status,
 contact_reference=excluded.contact_reference,contact_name=excluded.contact_name,contact_email=excluded.contact_email,
 contact_phone=excluded.contact_phone,latest_event_id=excluded.latest_event_id,updated_at=now()
 returning id into record_uuid;
 insert into public.audit_logs(organization_id,entity,record_id,operation) values(org,'commercial_bookings',record_uuid,'agendalite_snapshot');
 return 'accepted';
end;$$;
revoke all on function public.ingest_agendalite_booking(text,text,jsonb,text) from public;
grant execute on function public.ingest_agendalite_booking(text,text,jsonb,text) to anon,authenticated;
commit;
