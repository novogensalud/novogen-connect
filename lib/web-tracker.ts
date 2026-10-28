// Shared source for the hosted script and WordPress installation package.
export const webTrackerScript = String.raw`(() => {
  const script = document.currentScript;
  const slug = script?.dataset.slug;
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) return;
  if (window.CONNECTMetrics) return;
  const endpoint = new URL('/api/web-interactions', script.src).href;
  const managedConsent = script.dataset.consent === 'complianz';
  let consent = false, session, viewed = false;
  const pairs = {agenda:'agenda_click',instagram:'instagram_click',tiktok:'tiktok_click',whatsapp:'whatsapp_click',email:'email_click',website:'website_click'};
  function send(kind, target) {
    if (!consent || (managedConsent && !hasStatisticsConsent())) return;
    try {
      session = session || sessionStorage.getItem('connect-web-session-'+slug) || crypto.randomUUID();
      sessionStorage.setItem('connect-web-session-'+slug,session);
      fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({slug,id:crypto.randomUUID(),session,kind,target:target||null,consent:true})}).catch(()=>{});
    } catch {}
  }
  window.CONNECTMetrics = {setConsent(accepted) {
    consent = accepted === true && (!managedConsent || hasStatisticsConsent());
    if (consent && !viewed) { viewed = true; send('page_view'); }
  }};
  function hasStatisticsConsent() {
    try {
      // Do not inherit Complianz opt-out defaults, bot exemptions or forced statistics.
      return window.complianz?.consenttype === 'optin'
        && Number(window.complianz.forceEnableStats || 0) !== 1
        && typeof window.cmplz_get_cookie === 'function'
        && window.cmplz_get_cookie('statistics') === 'allow'
        && typeof window.cmplz_has_consent === 'function'
        && window.cmplz_has_consent('statistics') === true;
    } catch { return false; }
  }
  if (managedConsent) {
    const sync = () => window.CONNECTMetrics.setConsent(hasStatisticsConsent());
    for (const event of ['cmplz_status_change','cmplz_cookie_warning_loaded','cmplz_run_after_all_scripts','cmplz_banner_status']) document.addEventListener(event,sync);
    document.addEventListener('cmplz_revoke', () => window.CONNECTMetrics.setConsent(false));
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('pageshow',sync);
    sync();
  }
  document.addEventListener('click',event=>{
    const el = event.target instanceof Element ? event.target.closest('[data-connect-target],a[href]') : null;
    if (!el) return;
    let target = el.dataset.connectTarget;
    if (!target && el instanceof HTMLAnchorElement) {
      try {
        const u = new URL(el.href);
        const host = u.hostname.replace(/^www\./,'');
        if (['wa.me','api.whatsapp.com','whatsapp.com'].includes(host)) target='whatsapp';
        else if (host==='instagram.com') target='instagram';
        else if (['tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(host)) target='tiktok';
        else if (u.protocol==='mailto:') target='email';
      } catch {}
    }
    if (pairs[target]) send(pairs[target],target);
  },true);
})();`;
