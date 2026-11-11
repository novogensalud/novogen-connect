begin;
alter table public.public_channels add column youtube_url text not null default '' check(length(youtube_url)<=2048 and (youtube_url='' or youtube_url ~ '^https://((www\.)?youtube\.com|youtu\.be)/'));
grant insert(youtube_url),update(youtube_url) on public.public_channels to authenticated;
update public.public_channels set youtube_url='https://www.youtube.com/@novogensalud' where organization_id=(select id from public.organizations where slug='novogen') and youtube_url='';
alter table public.interaction_events drop constraint interaction_events_kind_check;
alter table public.interaction_events add constraint interaction_events_kind_check check(kind in ('youtube_click','page_view','service_view','preference_view','whatsapp_click','email_click','website_click','contact_started','agenda_click','instagram_click','tiktok_click','button_click'));
alter table public.interaction_events drop constraint interaction_events_target_check;
alter table public.interaction_events add constraint interaction_events_target_check check(target in ('youtube','preference_info','store','navigation','detail_open','detail_close','orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));
do $youtube$
declare definition text;
begin
 select pg_get_functiondef('public.record_interaction(text,uuid,uuid,text,uuid,text,text,uuid)'::regprocedure) into definition;
 if position('when ''youtube_click''' in definition)=0 then
  if position('when ''tiktok_click'' then ''tiktok''' in definition)=0 then raise exception 'Review record_interaction before applying YouTube';end if;
  definition=replace(definition,'when ''tiktok_click'' then ''tiktok''','when ''tiktok_click'' then ''tiktok'' when ''youtube_click'' then ''youtube''');
  definition=replace(definition,'p_target in (''agenda'',''instagram'',''tiktok'',''whatsapp''','p_target in (''agenda'',''instagram'',''tiktok'',''youtube'',''whatsapp''');
  execute definition;
 end if;
end;
$youtube$;
commit;
