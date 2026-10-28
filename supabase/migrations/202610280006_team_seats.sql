begin;
-- Reservations configure future access. They never create mailboxes, Auth users or memberships.
create table public.team_plans (
 organization_id uuid primary key references public.organizations(id),
 seat_limit integer not null default 5 check(seat_limit between 5 and 100)
);
create table public.team_seats (
 id uuid not null default gen_random_uuid() unique,
 organization_id uuid not null references public.team_plans(organization_id),
 seat_number integer not null check(seat_number between 1 and 100),
 display_name text not null default '' check(length(display_name)<=100),
 email text not null default '' check(length(email)<=254 and (email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 role text not null check(role in ('admin','agent')),
 user_id uuid references auth.users(id),
 primary key(organization_id,seat_number),unique(organization_id,user_id)
);
create unique index team_reserved_email on public.team_seats(organization_id,lower(email)) where email<>'';
alter table public.team_plans enable row level security;
alter table public.team_seats enable row level security;
revoke all on public.team_plans,public.team_seats from anon,authenticated;
grant select on public.team_plans,public.team_seats to authenticated;
create policy team_plan_admin on public.team_plans for select to authenticated using(public.is_admin(organization_id));
create policy team_seats_admin on public.team_seats for select to authenticated using(public.is_admin(organization_id));

create function public.ensure_team_plan(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare capacity integer;
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if exists(select 1 from public.team_plans where organization_id=p_org) then return;end if;
 capacity=greatest(5,(select count(*)::int from public.memberships where organization_id=p_org));
 insert into public.team_plans(organization_id,seat_limit) values(p_org,capacity) on conflict do nothing;
 perform 1 from public.team_plans where organization_id=p_org for update;
 if exists(select 1 from public.team_seats where organization_id=p_org) then return;end if;
 insert into public.team_seats(organization_id,seat_number,display_name,email,role,user_id)
 select p_org,row_number() over(order by m.role='admin' desc,m.user_id),case when m.role='admin' then 'Administrador' else 'Integrante comercial' end,coalesce(u.email,''),m.role,m.user_id
 from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_org;
 insert into public.team_seats(organization_id,seat_number,display_name,role)
 select p_org,n,'Comercial '||n,'agent' from generate_series(1,capacity) n where not exists(select 1 from public.team_seats where organization_id=p_org and seat_number=n);
end;
$$;
create function public.expand_team_plan(p_org uuid,p_limit integer) returns void language plpgsql security definer set search_path='' as $$
declare previous integer;
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 perform public.ensure_team_plan(p_org);
 select seat_limit into previous from public.team_plans where organization_id=p_org for update;
 if p_limit is null or p_limit<previous or p_limit>100 then raise exception 'Invalid capacity';end if;
 update public.team_plans set seat_limit=p_limit where organization_id=p_org;
 insert into public.team_seats(organization_id,seat_number,display_name,role)
 select p_org,n,'Comercial '||n,'agent' from generate_series(previous+1,p_limit) n;
 insert into public.audit_logs(organization_id,actor_id,entity,record_id,operation) values(p_org,auth.uid(),'team_plan',p_org,'EXPAND');
end;
$$;
create function public.configure_team_seat(p_org uuid,p_seat integer,p_name text,p_email text,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare seat public.team_seats;
begin
 if not public.is_admin(p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.team_plans where organization_id=p_org for update;
 select * into seat from public.team_seats where organization_id=p_org and seat_number=p_seat;
 if seat.id is null then raise exception 'Invalid seat';end if;
 if p_name is null or length(trim(p_name))<2 or p_email is null or p_role is null or p_role not in ('admin','agent') then raise exception 'Invalid configuration';end if;
 if seat.user_id is not null and (lower(trim(p_email))<>lower(seat.email) or p_role<>seat.role) then raise exception 'Linked account is read only';end if;
 if seat.role='admin' and p_role<>'admin' and (select count(*) from public.team_seats where organization_id=p_org and role='admin')<=1 then raise exception 'An administrator is required';end if;
 update public.team_seats set display_name=trim(p_name),email=lower(trim(p_email)),role=p_role where organization_id=p_org and seat_number=p_seat;
 insert into public.audit_logs(organization_id,actor_id,entity,record_id,operation) values(p_org,auth.uid(),'team_seat',seat.id,'CONFIGURE');
end;
$$;
revoke all on function public.ensure_team_plan(uuid),public.expand_team_plan(uuid,integer),public.configure_team_seat(uuid,integer,text,text,text) from public,anon;
grant execute on function public.ensure_team_plan(uuid),public.expand_team_plan(uuid,integer),public.configure_team_seat(uuid,integer,text,text,text) to authenticated;
commit;
