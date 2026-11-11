export function initializeExperience(config) {
  const style=document.createElement('style');
  style.textContent='.connect-experience-link{display:flex;align-items:center;justify-content:center;min-height:44px;max-width:240px;margin:12px auto;padding:8px 16px;border:1px solid #276f91;border-radius:999px;color:#8fe8ff;font:600 12px Montserrat,Arial,sans-serif;text-decoration:none}.connect-experience{box-sizing:border-box;width:calc(100% - 24px);max-width:440px;max-height:calc(100dvh - 24px);overflow:auto;padding:24px 20px;background:#071b36;color:#e7f5ff;border:1px solid #3287a8;border-radius:22px;font:14px/1.6 Montserrat,Arial,sans-serif}.connect-experience::backdrop{background:#020914ed}.connect-experience h2{font-size:22px;color:#80e8ff;margin:0 0 12px}.connect-experience button,.connect-experience a{min-height:44px}.connect-experience button{padding:10px 14px;border:1px solid #3c96b8;border-radius:10px;background:#0a3c5c;color:white;font:inherit;cursor:pointer}.connect-experience a{display:inline-flex;align-items:center;color:#9feaff;margin-right:12px}.connect-experience input:not([type=checkbox]),.connect-experience textarea{display:block;box-sizing:border-box;width:100%;padding:12px;margin:6px 0 14px;min-height:46px;border:1px solid #43809a;border-radius:10px;background:#0b2947;color:white;font:16px Arial,sans-serif}.connect-experience label{display:block;margin:12px 0}.connect-experience .experience-check{display:flex;gap:10px;align-items:flex-start;font-size:12px}.experience-check input{width:20px;height:20px;flex-shrink:0}.connect-experience .experience-close{float:right;width:44px;margin:-12px -10px 0 0;background:transparent;border:0;font-size:24px}.experience-message{white-space:pre-wrap;overflow-wrap:anywhere;background:#10314d;border-radius:12px;padding:12px;margin:10px 0;font-size:13px}.experience-message.user{background:#08516b}.connect-experience button:disabled{opacity:.5}.experience-chat{max-height:35dvh;overflow:auto;overscroll-behavior:contain}.experience-small{font-size:11px;color:#b4cbdc}';
  document.head.append(style);
  const root=document.getElementById('root');
  function home(){
    if(!root||!['','#/'].includes(location.hash)||document.getElementById('connect-games-link'))return;
    const site=Array.from(root.querySelectorAll('a')).find(a=>a.getAttribute('href')===config.channels.website_url);
    if(site){const games=document.createElement('a');games.id='connect-games-link';games.className='connect-experience-link';games.textContent='Jugar · Snake y Bloques';games.href='/connect/'+config.slug+'/juegos';site.insertAdjacentElement('afterend',games);}
  }
  if(root)new MutationObserver(home).observe(root,{subtree:true,childList:true});
  window.addEventListener('hashchange',home);home();
  function makeDialog(title,closable=true){
    const dialog=document.createElement('dialog');dialog.className='connect-experience';dialog.dataset.connectPrivate='';
    dialog.setAttribute('aria-label',title);
    if(closable){const close=document.createElement('button');close.textContent='×';close.className='experience-close';close.setAttribute('aria-label','Cerrar '+title);close.onclick=()=>dialog.close();dialog.append(close);}
    const heading=document.createElement('h2');heading.textContent=title;dialog.append(heading);document.body.append(dialog);return dialog;
  }
  const paragraph=(text,host)=>{const p=document.createElement('p');p.textContent=text;host.append(p);return p;};
  const link=(text,url,host)=>{if(!url)return;const a=document.createElement('a');a.textContent=text;a.href=url;host.append(a);return a;};
  let termsAccepted=!config.terms;
  if(config.terms){
    const terms=makeDialog('Bienvenido a CONNECT',false);
    terms.addEventListener('cancel',e=>e.preventDefault());
    paragraph('Antes de continuar, revisa las condiciones de uso y cómo tratamos tus datos.',terms);
    for(const [label,url] of [['Leer términos y condiciones',config.terms.url],['Leer política de privacidad',config.terms.privacyUrl]]){const a=link(label,url,terms);a.target='_blank';a.rel='noopener noreferrer';}
    const form=document.createElement('form');
    const label=document.createElement('label');label.className='experience-check';
    const check=document.createElement('input');check.type='checkbox';check.required=true;label.append(check,document.createTextNode('He leído y acepto los términos y condiciones y la política de privacidad.'));form.append(label);
    paragraph('Esto no te suscribe a publicidad. ORIÉNTAME consulta respuestas y fuentes aprobadas de NOVOGEN.',form).className='experience-small';
    const status=paragraph('',form);status.setAttribute('role','status');
    const submit=document.createElement('button');submit.type='submit';submit.textContent='Aceptar y continuar';form.append(submit);terms.append(form);link('Salir',config.channels.website_url,terms);
    terms.showModal();submit.disabled=true;
    const checkAccess=()=>fetch('/api/app-consent').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(data.accepted){termsAccepted=true;terms.close();direct();if(new URL(location.href).searchParams.get('next')==='juegos')location.assign('/connect/'+config.slug+'/juegos');}else submit.disabled=false;}).catch(()=>{status.textContent='No pudimos comprobar el acceso. Revisa tu conexión y vuelve a intentarlo.';submit.disabled=false;});
    void checkAccess();
    form.onsubmit=async e=>{e.preventDefault();if(!check.checked)return;submit.disabled=true;try{const r=await fetch('/api/app-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted:true,version:config.terms.version}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();termsAccepted=true;terms.close();direct();if(new URL(location.href).searchParams.get('next')==='juegos')location.assign('/connect/'+config.slug+'/juegos');}catch{status.textContent='No pudimos registrar la aceptación. Intenta de nuevo.';submit.disabled=false;}};
  }
  const assistant=makeDialog('ORIÉNTAME');
  const content=document.createElement('div');assistant.append(content);

  let opened=false;
  function showOrientation(){
    if(!termsAccepted || !config.assistantAvailable || config.slug!=='novogen')return;
    content.replaceChildren();
    paragraph('Consulta información aprobada de NOVOGEN. No necesitas entregar datos de contacto para hacer preguntas.',content).className='experience-small';
    const frame=document.createElement('iframe');
    frame.src='https://www.novogensalud.cl/?orientame_embed=1';
    frame.title='ORIÉNTAME · orientación documental de NOVOGEN';
    frame.referrerPolicy='no-referrer';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    frame.style.cssText='display:block;width:100%;height:62dvh;min-height:320px;border:0;border-radius:12px;background:#f6faf8';
    content.append(frame);
    const fallback=link('Abrir ORIÉNTAME en una pestaña nueva',frame.src,content);fallback.target='_blank';fallback.rel='noopener noreferrer';
    paragraph('Si la conexión no permite mostrar el asistente aquí, utiliza el enlace anterior. No ingreses datos personales ni antecedentes de salud.',content).className='experience-small';
    if(!assistant.open)assistant.showModal();opened=true;
  }
  document.addEventListener('click',e=>{
    const a=e.target instanceof Element?e.target.closest('a'):null;
    if(!a||a.getAttribute('href')!=='#/orientame'||!config.assistantAvailable||config.slug!=='novogen')return;
    e.preventDefault();e.stopImmediatePropagation();showOrientation();
  },true);
  const direct=()=>{if(location.hash==='#/orientame'&&!opened)showOrientation();};
  assistant.addEventListener('close',()=>{opened=false;if(location.hash==='#/orientame')location.hash='#/';});
  window.addEventListener('hashchange',direct);direct();
}

