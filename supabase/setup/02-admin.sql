-- Ejecutar DESPUÉS de crear la cuenta de la aplicación en Authentication > Users.
-- No crea contraseñas ni reutiliza las credenciales del dashboard de Supabase.
begin;
do $$
declare account_id uuid; org_id uuid;
begin
 select id into strict account_id from auth.users where lower(email)='novogen.temuco@gmail.com';
 select id into strict org_id from public.organizations where slug='novogen';
 insert into public.memberships(organization_id,user_id,role)
 values(org_id,account_id,'admin')
 on conflict(organization_id,user_id) do update set role='admin';
exception when no_data_found then
 raise exception 'Falta la cuenta de la aplicación en Authentication > Users o la organización NOVOGEN. No se realizaron cambios.';
end;
$$;
commit;
-- Solo muestra el resultado para esta cuenta; no lista otros usuarios.
select o.name as organization,m.role
from public.memberships m
join public.organizations o on o.id=m.organization_id
join auth.users u on u.id=m.user_id
where lower(u.email)='novogen.temuco@gmail.com' and o.slug='novogen';
