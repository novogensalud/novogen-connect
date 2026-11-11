begin;
-- Consent-based interaction targets used by the recovered mobile interface.
alter table public.interaction_events drop constraint interaction_events_target_check;
alter table public.interaction_events add constraint interaction_events_target_check check(target in ('navigation','detail_open','detail_close','orientame','services','promos','agenda','instagram','tiktok','whatsapp','email','website','service_info','service_contact','service_close','contact_submit','team_access','crm_access','device_enable','device_pause','install_app','install_close'));
commit;
