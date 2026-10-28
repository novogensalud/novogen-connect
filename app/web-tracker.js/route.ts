export async function GET() {
  const script = `(() => {
  const script = document.currentScript;
  const slug = script?.dataset.slug;
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) return;
  if (window.CONNECTMetrics) return;
  const endpoint = new URL('/api/web-interactions', script.src).href;
  let consent = false, session, viewed = false;
  const pairs = {agenda:'agenda_click',instagram:'instagram_click',tiktok:'tiktok_click',whatsapp:'whatsapp_click',email:'email_click',website:'website_click'};
  function send(kind, target) {
    if (!consent) return;
    try {
      session = session || sessionStorage.getItem('connect-web-session-'+slug) || crypto.randomUUID();
      sessionStorage.setItem('connect-web-session-'+slug,session);
      fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({slug,id:crypto.randomUUID(),session,kind,target:target||null,consent:true})}).catch(()=>{});
    } catch {}
  }
  window.CONNECTMetrics = {setConsent(accepted) {
    consent = accepted === true;
    if (consent && !viewed) { viewed = true; send('page_view'); }
  }};
  document.addEventListener('click',event=>{
    const el = event.target instanceof Element ? event.target.closest('[data-connect-target],a[href]') : null;
    if (!el) return;
    let target = el.dataset.connectTarget;
    if (!target && el instanceof HTMLAnchorElement) {
      try {
        const u = new URL(el.href);
        const host = u.hostname.replace(/^www\\./,'');
        if (['wa.me','api.whatsapp.com','whatsapp.com'].includes(host)) target='whatsapp';
        else if (host==='instagram.com') target='instagram';
        else if (['tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(host)) target='tiktok';
        else if (u.protocol==='mailto:') target='email';
      } catch {}
    }
    if (pairs[target]) send(pairs[target],target);
  },true);
})();`;
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
