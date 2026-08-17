const CACHE='dswf-v12';
const ASSETS=['./','./index.html','./styles.css','./journal.css','./insights.css','./app.js','./journal.js','./insights.js','./insights-extra.js','./leaderboard.js','./daily-checkin.js','./daily-checkin-polish.js','./notifications.js','./version.js','./manifest.webmanifest','./icons/DSWF.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const clone=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,clone));
    return response;
  }).catch(()=>caches.match('./index.html'))));
});

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?event.data.json():{};}catch{payload={body:event.data?.text?.()||''};}
  const title=payload.title||'Days Since We Fought';
  const defaultAppUrl=new URL('app/',self.registration.scope).href;
  const iconUrl=new URL('icons/DSWF.png',self.registration.scope).href;
  const suppliedUrl=payload.url||payload.data?.url||defaultAppUrl;
  const resolvedUrl=new URL(suppliedUrl,self.registration.scope).href;
  const options={
    body:payload.body||'You have a DSWF reminder.',
    icon:iconUrl,
    badge:iconUrl,
    tag:payload.tag||'dswf-reminder',
    data:{...(payload.data||{}),url:resolvedUrl}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const defaultAppUrl=new URL('app/',self.registration.scope).href;
  const target=new URL(event.notification.data?.url||defaultAppUrl,self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients){
      if(client.url.startsWith(self.registration.scope)&&'focus'in client){
        if('navigate'in client && client.url!==target) client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  }));
});
