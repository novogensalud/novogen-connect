begin;
-- SQL LIKE '_' matched the SERVICES navigation button as though it were a service-specific action.
do $repair$
declare definition text;
 old_check text := 'if p_target like ''service_%'' and p_service is null';
 new_check text := 'if p_target in (''service_info'',''service_contact'',''service_close'') and p_service is null';
begin
 select pg_get_functiondef('public.record_interaction(text,uuid,uuid,text,uuid,text,text)'::regprocedure) into definition;
 if position(old_check in definition)>0 then
  execute replace(definition,old_check,new_check);
 elsif position(new_check in definition)=0 then
  raise exception 'Review record_interaction before applying navigation fix';
 end if;
end;
$repair$;
commit;
