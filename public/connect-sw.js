// No fetch cache: authenticated pages and personal data must never be cached here.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
  const target=event.notification.data?.url==='/equipo'?'/equipo':'/';
  event.notification.close();
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){await existing.navigate(target);return existing.focus();}
    return self.clients.openWindow(target);
  })());
});
