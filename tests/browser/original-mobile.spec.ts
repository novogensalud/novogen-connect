import { test, expect, type Page } from "@playwright/test";
import { originalConnectHtml } from "../../lib/original-connect";
import { novogenChannels } from "../../lib/channels";
import type { Service } from "../../lib/domain";
const ids = {
  optimiza: "10000000-0000-4000-8000-000000000010",
  recovery: "10000000-0000-4000-8000-000000000011",
  leaf: "10000000-0000-4000-8000-000000000012",
  suple: "10000000-0000-4000-8000-000000000013",
};
const rows: Service[] = [
  {
    id: ids.optimiza,
    name: "OPTIMIZA",
    category: "OPTIMIZA",
    description: "Explora las alternativas según tus intereses.",
    active: true,
    catalog_type: "group",
  },
  {
    id: ids.recovery,
    name: "RECOVERY",
    category: "OPTIMIZA",
    subcategory: "RECOVERY",
    description: "Elige una prestación de recuperación.",
    active: true,
    catalog_type: "group",
    parent_id: ids.optimiza,
  },
  {
    id: ids.leaf,
    name: "RECOVERY · Essential",
    category: "OPTIMIZA",
    subcategory: "RECOVERY",
    description: "Descripción sincronizada del CRM",
    active: true,
    catalog_type: "service",
    parent_id: ids.recovery,
  },
  {
    id: ids.suple,
    name: "SUPLE",
    category: "OPTIMIZA",
    subcategory: "SUPLE",
    description: "Educación sobre productos en todos los canales.",
    active: true,
    catalog_type: "service",
    parent_id: ids.optimiza,
    action_url: "https://www.novogenstore.cl/",
    action_label: "Ver productos",
  },
  {
    id: "10000000-0000-4000-8000-000000000014",
    name: "Servicio nuevo del CRM",
    category: "OPTIMIZA",
    subcategory: "RECOVERY",
    description: "Ficha creada automáticamente con el formato de FLASH.",
    active: true,
    catalog_type: "service",
    parent_id: ids.recovery,
  },
  {
    id: "10000000-0000-4000-8000-000000000015",
    name: "COMPRENDE",
    category: "COMPRENDE",
    description: "Servicio individual de interpretación.",
    active: true,
    catalog_type: "service",
  },
];
async function fixture(page: Page) {
  const events: any[] = [];
  await page.route("https://connect.test/**", async (route) => {
    if (route.request().url().endsWith("/api/interactions")) {
      events.push(route.request().postDataJSON());
      await route.fulfill({ status: 202, body: "{}" });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: originalConnectHtml(novogenChannels, {
        services: rows,
        demo: false,
      }),
    });
  });
  await page.goto("https://connect.test/fixture");
  return events;
}
async function openOptimiza(page: Page) {
  await page
    .getByRole("link", { name: "SERVICIOS", exact: true })
    .first()
    .click();
  await page.getByRole("link").filter({ hasText: "Bienestar" }).click();
}
for (const width of [320, 360, 390, 430])
  test("original hierarchy and mobile layout " + width, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 820 });
    await fixture(page);
    await page
      .getByRole("button", { name: "Solo lo necesario", exact: true })
      .click();
    await openOptimiza(page);
    await expect(page.getByRole("link", { name: /AGENDAR/ })).toHaveCount(0);
    await page.getByRole("link").filter({ hasText: "Recuperación" }).click();
    await expect(
      page.getByRole("heading", { name: "RECUPERACIÓN", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link")
      .filter({ hasText: "Servicio nuevo del CRM" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Servicio nuevo del CRM",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Ficha creada automáticamente con el formato de FLASH.", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "RECUPERACIÓN", exact: true }).click();
    await page
      .getByRole("link")
      .filter({ hasText: /ESSENTIAL/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "RECOVERY · Essential", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /AGENDAR/ }).first(),
    ).toHaveAttribute("href", novogenChannels.agenda_url);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    if (width === 390)
      await page.screenshot({
        path: "../../outputs/flash-ficha-servicio.png",
        fullPage: true,
      });
  });
test("group interests and concrete service demand are measured independently with consent", async ({
  page,
}) => {
  const events = await fixture(page);
  expect(events).toEqual([]);
  await page
    .getByRole("button", { name: "Permitir métricas", exact: true })
    .click();
  await expect.poll(() => events.length).toBe(1);
  await openOptimiza(page);
  await page.getByRole("link").filter({ hasText: "Recuperación" }).click();
  await expect
    .poll(() =>
      events.some(
        (e) =>
          e.kind === "preference_view" &&
          e.preference === ids.recovery &&
          e.service === null,
      ),
    )
    .toBe(true);
  expect(events.some((e) => e.kind === "service_view")).toBe(false);
  await page
    .getByRole("link")
    .filter({ hasText: /ESSENTIAL/i })
    .click();
  await expect
    .poll(() =>
      events.some(
        (e) =>
          e.kind === "service_view" &&
          e.service === ids.leaf &&
          e.preference === null,
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (e) => {
        if ((e.target as Element)?.closest("a")?.href.includes("/reservar/"))
          e.preventDefault();
      },
      true,
    ),
  );
  await page
    .getByRole("link", { name: /AGENDAR/ })
    .first()
    .click();
  await expect
    .poll(() =>
      events.some((e) => e.kind === "agenda_click" && e.service === ids.leaf),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Privacidad", exact: true }).click();
  await page
    .getByRole("button", { name: "Desactivar métricas", exact: true })
    .click();
  const before = events.length;
  await page
    .getByRole("link", { name: "SERVICIOS", exact: true })
    .first()
    .click();
  await page.waitForTimeout(150);
  expect(events.length).toBe(before);
  expect(events.every((e) => !(e.service && e.preference))).toBe(true);
});
test("SUPLE remains an individual educational service with a small separate Store button", async ({
  page,
}) => {
  const events = await fixture(page);
  await page
    .getByRole("button", { name: "Permitir métricas", exact: true })
    .click();
  await openOptimiza(page);
  await page.getByRole("link").filter({ hasText: "Productos" }).click();
  await expect(
    page.getByRole("heading", { name: "SUPLE", exact: true }),
  ).toBeVisible();
  const store = page.getByRole("link", { name: "Ver productos", exact: true });
  await expect(store).toHaveAttribute("href", "https://www.novogenstore.cl/");
  await expect(store).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: "CONSULTAR SOBRE PRODUCTOS", exact: true }),
  ).toHaveAttribute("href", novogenChannels.whatsapp_url);
  const box = await store.boundingBox();
  expect(box!.height).toBeLessThan(60);
  expect(box!.width).toBeLessThanOrEqual(220);
  await page
    .context()
    .route("https://www.novogenstore.cl/**", (route) =>
      route.fulfill({ body: "NOVOGEN Store" }),
    );
  const popup = page.waitForEvent("popup");
  await store.click();
  const products = await popup;
  await expect.poll(() => products.url()).toContain("novogenstore.cl");
  await expect
    .poll(() =>
      events.some(
        (e) =>
          e.target === "store" &&
          e.service === ids.suple &&
          e.preference === null,
      ),
    )
    .toBe(true);
  await products.close();
});

test("the first choices use plain language before exposing commercial names", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Solo lo necesario", exact: true })
    .click();
  await page
    .getByRole("link", { name: "SERVICIOS", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("link").filter({ hasText: "Bienestar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link").filter({ hasText: "Interpretación" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /OPTIMIZA|COMPRENDE/ }),
  ).toHaveCount(0);
  await page.getByRole("link").filter({ hasText: "Interpretación" }).click();
  await expect(
    page.getByRole("heading", { name: "COMPRENDE", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "SERVICIOS", exact: true })
    .first()
    .click();
  await page.getByRole("link").filter({ hasText: "Bienestar" }).click();
  await expect(
    page.getByRole("link").filter({ hasText: "Productos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link").filter({ hasText: "Recuperación" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /SUPLE|RECOVERY/ })).toHaveCount(
    0,
  );
});

test("YouTube appears with the other networks and measures the official profile click", async ({
  page,
}) => {
  const events = await fixture(page);
  const youtube = page.getByRole("link", { name: "YouTube", exact: true });
  await expect(youtube).toBeVisible();
  await expect(youtube).toHaveAttribute(
    "href",
    "https://www.youtube.com/@novogensalud",
  );
  await expect(youtube.locator("svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Permitir métricas", exact: true })
    .click();
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (e) => {
        if (
          (e.target as Element)?.closest("a")?.getAttribute("aria-label") ===
          "YouTube"
        )
          e.preventDefault();
      },
      true,
    ),
  );
  await youtube.click();
  await expect
    .poll(() =>
      events.some((e) => e.kind === "youtube_click" && e.target === "youtube"),
    )
    .toBe(true);
});

test('mobile consultation keeps the concrete service and confirms only server acceptance', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await fixture(page);
  await page.getByRole('button',{name:'Solo lo necesario',exact:true}).click();
  await openOptimiza(page);
  await page.getByRole('link').filter({hasText:'Productos'}).click();
  await page.getByRole('button',{name:'Solicitar orientación',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Servicio',{exact:true})).toHaveValue(ids.suple);
  await dialog.getByLabel('Nombre',{exact:true}).fill('Prueba de integración');
  await dialog.getByLabel('Correo electrónico',{exact:true}).fill('qa@example.com');
  await dialog.getByRole('checkbox').check();
  let posted:any;
  await page.route('https://connect.test/api/contact',async route=>{
    posted=route.request().postDataJSON();
    await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Sin conexión. Intenta de nuevo.'})});
  });
  await dialog.getByRole('button',{name:'Solicitar contacto',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('Sin conexión. Intenta de nuevo.');
  await expect(dialog.getByRole('button',{name:'Solicitar contacto',exact:true})).toBeEnabled();
  expect(posted.service).toBe(ids.suple);
  expect(posted.consent).toBe('on');
  await page.route('https://connect.test/api/contact',async route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({received:true,message:'Solicitud recibida en el CRM.'})}));
  await dialog.getByRole('button',{name:'Solicitar contacto',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('Solicitud recibida en el CRM.');
  await expect(dialog.getByRole('button',{name:'Solicitud recibida',exact:true})).toBeDisabled();
  await expect(dialog.getByRole('link',{name:'Abrir Agenda',exact:true})).toHaveAttribute('href',novogenChannels.agenda_url);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('website deep link selects a real service and excludes preference groups from the form',async({page})=>{
  await fixture(page);
  await page.goto('https://connect.test/fixture?service='+ids.suple+'&contact=1');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Servicio',{exact:true})).toHaveValue(ids.suple);
  await expect(dialog.locator('option[value="'+ids.optimiza+'"]')).toHaveCount(0);
  await expect(dialog.locator('option[value="'+ids.recovery+'"]')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Cerrar solicitud',exact:true}).click();
  await expect(dialog).not.toBeVisible();
});

test('home exposes lightweight games without changing the original primary actions',async({page})=>{
 await fixture(page);
 await expect(page.getByRole('link',{name:'Jugar · Snake y Bloques',exact:true})).toHaveAttribute('href','/connect/novogen/juegos');
 await expect(page.getByRole('link',{name:'ORIÉNTAME',exact:true})).toBeVisible();
});

test('approved terms gate precedes contact collection and AI consent; handoff sends no conversation text',async({page})=>{
 const names=['CONNECT_TERMS_VERSION','CONNECT_TERMS_URL','CONNECT_PRIVACY_URL','CONNECT_SESSION_SECRET','OPENAI_API_KEY','OPENAI_MODEL'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 Object.assign(process.env,{CONNECT_TERMS_VERSION:'fixture-v1',CONNECT_TERMS_URL:'https://connect.test/terms',CONNECT_PRIVACY_URL:'https://connect.test/privacy',CONNECT_SESSION_SECRET:'fixture-secret-'.repeat(4),OPENAI_API_KEY:'fixture-not-a-real-key',OPENAI_MODEL:'fixture-model'});
 let html:string;
 try{html=originalConnectHtml(novogenChannels,{services:rows,demo:false});}finally{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
 let consentPosts=0,chatPayload:any,handoffPayload:any;
 await page.route('https://connect.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/app-consent'){
   if(route.request().method()==='POST'){consentPosts++;expect(route.request().postDataJSON()).toEqual({accepted:true,version:'fixture-v1'});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({accepted:route.request().method()==='POST'})});
  }
  if(path==='/api/contact-status')return route.fulfill({contentType:'application/json',body:'{"items":[]}'});
  if(path==='/api/contact')return route.fulfill({status:201,contentType:'application/json',body:'{"received":true}'});
  if(path==='/api/orientame'){chatPayload=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify({answer:'Un profesional puede evaluar qué medición corresponde en tu caso.',handoff:'clinical',serviceId:ids.suple})});}
  if(path==='/api/orientame/handoff'){handoffPayload=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:'{"message":"Solicitud registrada en el CRM."}'});}
  if(path==='/api/interactions')return route.fulfill({status:202,body:'{}'});
  return route.fulfill({contentType:'text/html',body:html});
 });
 await page.setViewportSize({width:320,height:780});await page.goto('https://connect.test/fixture');
 const gate=page.getByRole('dialog',{name:'Bienvenido a CONNECT',exact:true});await expect(gate).toBeVisible();
 await page.keyboard.press('Escape');await expect(gate).toBeVisible();
 await gate.getByRole('button',{name:'Aceptar y continuar',exact:true}).click();expect(consentPosts).toBe(0);
 await gate.getByRole('checkbox').check();await gate.getByRole('button',{name:'Aceptar y continuar',exact:true}).click();await expect(gate).not.toBeVisible();
 await page.getByRole('button',{name:'Solo lo necesario',exact:true}).click();await page.getByRole('link',{name:'ORIÉNTAME',exact:true}).click();
 const ai=page.getByRole('dialog',{name:'ORIÉNTAME',exact:true});await expect(ai).toBeVisible();
 await ai.getByLabel('Nombre',{exact:true}).fill('Prueba IA');await ai.getByLabel('Correo electrónico',{exact:true}).fill('ai-fixture@example.com');await ai.getByRole('checkbox').check();await ai.getByRole('button',{name:'Continuar a ORIÉNTAME',exact:true}).click();
 await ai.getByRole('textbox',{name:'¿En qué puedo ayudarte?',exact:true}).fill('¿Qué medición corresponde?');await ai.getByRole('checkbox').check();await ai.getByRole('button',{name:'Enviar pregunta',exact:true}).click();
 await expect(ai.getByRole('log')).toContainText('Un profesional puede evaluar');
 expect(JSON.stringify(chatPayload)).not.toContain('ai-fixture@example.com');expect(JSON.stringify(chatPayload)).not.toContain('Prueba IA');expect(chatPayload.consent).toBe(true);
 await ai.getByRole('button',{name:'Pedir contacto con un profesional',exact:true}).click();await expect(ai).toContainText('Solicitud registrada en el CRM.');
 expect(handoffPayload).toEqual({service:ids.suple,kind:'clinical'});
 expect(await ai.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
