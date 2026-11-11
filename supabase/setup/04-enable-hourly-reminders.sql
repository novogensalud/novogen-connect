-- Ejecutar después de la migración 003, desde SQL Editor como operador de la base.
-- No envía correos, WhatsApp ni Web Push: genera avisos internos del CRM cada hora.
-- Revisa cada minuto para respetar el vencimiento individual; la función deduplica cada ciclo horario.
begin;
do $$
begin
 if to_regprocedure('public.run_due_commercial_reminders()') is null then
  raise exception 'Primero ejecuta la migración 003 de seguimiento e interacciones.';
 end if;
end;
$$;
create extension if not exists pg_cron;
select cron.schedule(
 'connect-commercial-hourly',
 '* * * * *',
 'select public.run_due_commercial_reminders();'
);
commit;
-- Confirmación sin datos de contactos ni credenciales.
select jobname,schedule,active from cron.job where jobname='connect-commercial-hourly';
