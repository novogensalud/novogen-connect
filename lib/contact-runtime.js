// Commercial contact fields stay out of analytics and are never stored in browser storage.
export function initializeContact(config) {
  const leaves = config.catalogue.filter(s => s.type === 'service');
  const dialog = document.createElement('dialog');
  dialog.className = 'connect-contact';
  dialog.setAttribute('aria-labelledby', 'connect-contact-title');
  dialog.dataset.connectContact = '';
  dialog.innerHTML = `<form><button type="button" class="contact-close" aria-label="Cerrar solicitud">×</button><h2 id="connect-contact-title">Te orientamos</h2><p>Déjanos tus datos y el equipo de NOVOGEN te contactará.</p><label for="connect-contact-service">Servicio</label><select id="connect-contact-service" name="service"><option value="">Necesito orientación para elegir</option></select><label>Nombre<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Teléfono <span>(opcional)</span><input name="phone" type="tel" autocomplete="tel" maxlength="30" pattern="[+0-9 ()\\-]*"></label><label class="contact-trap" aria-hidden="true">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label><label class="contact-consent"><input type="checkbox" name="consent" required>Autorizo a NOVOGEN a contactarme sobre esta solicitud.</label><p class="contact-hint">No incluyas información clínica. Esto solicita contacto; para reservar una hora utiliza Agenda.</p><p role="status" aria-live="polite" class="contact-status"></p><button class="contact-submit" type="submit">Solicitar contacto</button><div class="contact-next"></div></form>`;
  const form = dialog.querySelector('form');
  const select = form.elements.service;
  leaves.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name;
    select.append(option);
  });
  const style = document.createElement('style');
  style.textContent = `.connect-contact{box-sizing:border-box;width:calc(100% - 24px);max-width:440px;max-height:calc(100dvh - 24px);padding:24px 20px;border:1px solid #287b9d;border-radius:22px;background:#071b36;color:#e7f5ff;font:14px/1.5 Montserrat,Arial,sans-serif;overflow:auto;overscroll-behavior:contain}.connect-contact::backdrop{background:#020914d9}.connect-contact h2{font-size:23px;margin:0 35px 8px 0;color:#7de4ff}.connect-contact p{margin:8px 0 15px}.connect-contact label{display:block;margin:12px 0}.connect-contact input:not([type=checkbox]),.connect-contact select{box-sizing:border-box;display:block;width:100%;max-width:100%;margin-top:5px;min-height:46px;background:#0c2947;color:white;border:1px solid #43809a;border-radius:10px;padding:10px;font:16px Arial,sans-serif}.connect-contact button,.connect-contact a{min-height:44px;cursor:pointer;font:inherit}.contact-submit{width:100%;border:1px solid #60dfff;background:#075274;color:white;border-radius:12px;padding:12px}.contact-submit:disabled{opacity:.6}.contact-close{position:absolute;right:10px;top:8px;width:44px;background:transparent;border:0;color:white;font-size:28px!important}.connect-contact .contact-consent{display:flex;align-items:flex-start;gap:10px;font-size:12px}.contact-consent input{width:20px;height:20px;flex-shrink:0}.connect-contact .contact-hint{font-size:11px;color:#b1cadc}.connect-contact .contact-trap{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.contact-next a{display:flex;align-items:center;justify-content:center;color:#7de4ff}.contact-status{color:#c3f3ff}body:has(.connect-contact[open]){overflow:hidden}.connect-contact-button{display:block;align-self:center;min-height:44px;background:transparent;color:#9deaff;border:1px solid #3186a7;border-radius:999px;padding:9px 18px;font:600 12px Montserrat,Arial,sans-serif;cursor:pointer}`;
  document.head.append(style);
  document.body.append(dialog);
  let trigger;
  let pending = false;
  let sent = false;
  const status = form.querySelector('[role=status]');
  const submit = form.querySelector('[type=submit]');
  const next = form.querySelector('.contact-next');
  function open(id, element) {
    if (dialog.open) return;
    trigger = element;
    if (!sent) select.value = leaves.some(s => s.id === id) ? id : '';
    dialog.showModal();
  }
  dialog.querySelector('.contact-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (trigger?.isConnected) trigger.focus(); });
  document.addEventListener('click', e => {
    const button = e.target instanceof Element ? e.target.closest('[data-connect-request]') : null;
    if (button) open(button.dataset.connectRequest, button);
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pending || sent || !form.reportValidity()) return;
    pending = true;
    submit.disabled = true;
    status.textContent = 'Enviando tu solicitud…';
    const data = new FormData(form);
    try {
      const response = await fetch('/api/contact', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({slug:config.slug,point:config.point,request_type:'information',
          name:data.get('name'),email:data.get('email'),phone:data.get('phone'),
          service:data.get('service'),consent:data.get('consent'),website:data.get('website')}),
        signal:AbortSignal.timeout(20000),
      });
      const result = await response.json();
      status.textContent = result.message || 'No pudimos confirmar el envío. Intenta de nuevo.';
      if (response.ok && result.received === true) {
        sent = true;
        submit.textContent = 'Solicitud recibida';
        for (const field of form.querySelectorAll('input,select')) field.disabled = true;
        for (const [label,url] of [['Abrir Agenda',config.channels.agenda_url],['Consultar por WhatsApp',config.channels.whatsapp_url]]) {
          if (!url) continue;
          const link = document.createElement('a');
          link.textContent = label; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          next.append(link);
        }
      }
    } catch {
      status.textContent = 'No pudimos confirmar el envío. Revisa tu conexión e intenta de nuevo. Si ya llegó, evitaremos duplicarlo.';
    } finally {
      pending = false;
      submit.disabled = sent;
    }
  });
  const params = new URL(location.href).searchParams;
  const service = leaves.find(s => s.id === params.get('service'));
  if (service) location.hash = service.route;
  if (params.get('contact') === '1') open(service?.id, null);
}

