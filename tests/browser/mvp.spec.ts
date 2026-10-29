import { test, expect } from "@playwright/test";
test("dashboard navigation, search and honest demo controls", async ({
  page,
}) => {
  await page.goto("/crm");
  await expect(
    page.getByRole("heading", { name: "Cada conexión cuenta." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "CRM comercial", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar contacto" })
    .fill("contacto.a@example.com");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByText("Contacto de ejemplo A", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Contacto de ejemplo B", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Agregar servicio", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Puntos CONNECT", exact: true }).click();
  const response = await page.request.get("/api/qr/demo-recepcion");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
});
test("mobile FLASH, service dialog and commercial form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/connect/novogen");
  await expect(
    page.getByRole("navigation", { name: "Accesos FLASH" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Más información" }).first().click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").first()).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Persona Prueba");
  await page
    .getByRole("textbox", { name: "Correo electrónico", exact: true })
    .fill("prueba@example.com");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Probar formulario de demostración" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No se guardaron ni enviaron tus datos",
  );
  await page.screenshot({
    path: "/tmp/novogen-flash-mobile.png",
    fullPage: true,
  });
});
test("point routes resolve safely and unknown organizations do not exist", async ({
  request,
  page,
}) => {
  const route = await request.get("/r/demo-recepcion", { maxRedirects: 0 });
  expect(route.status()).toBe(303);
  expect(route.headers().location).toContain(
    "/connect/novogen?point=demo-recepcion",
  );
  expect((await request.get("/r/unknown")).status()).toBe(404);
  await page.goto("/connect/no-existe");
  await expect(
    page.getByRole("heading", { name: "Este espacio no está disponible." }),
  ).toBeVisible();
});
test("desktop dashboard fits its viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/crm");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/novogen-dashboard.png", fullPage: true });
});

test("CONNECT home uses organization branding and leads to the CRM", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/connect\/novogen/);
  await expect(page.locator(".connect-credit")).toContainText("SOLVEX");
  await expect(page.locator("body")).not.toContainText("Francisco Ortiz");
  await page.getByRole("button", { name: "Más información" }).first().click();
  await page
    .getByRole("link", { name: "Solicitar orientación", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("¿Qué te interesa?")).toHaveValue(
    "10000000-0000-4000-8000-000000000001",
  );
  await page.getByRole("link", { name: "Acceso equipo", exact: true }).click();
  await page.getByRole("link", { name: "CRM comercial", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Filtrar etapa" })
    .selectOption("qualified");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByText("Contacto de ejemplo C", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Contacto de ejemplo A", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Crear contacto", exact: true }),
  ).toBeDisabled();
});

test("analytics is opt-in, contains no contact fields and can be withdrawn", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  await page.route("**/api/interactions", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"stored":false}',
    });
  });
  await page.goto("/connect/novogen");
  await expect(
    page.getByRole("button", { name: "Solo lo necesario", exact: true }),
  ).toBeVisible();
  expect(events).toHaveLength(0);
  await page
    .getByRole("button", { name: "Permitir métricas", exact: true })
    .click();
  await expect
    .poll(() => events.some((e) => e.kind === "page_view"))
    .toBe(true);
  await page.getByRole("button", { name: "Más información" }).first().click();
  await expect
    .poll(() => events.some((e) => e.kind === "service_view"))
    .toBe(true);
  await page
    .getByRole("button", { name: "Cerrar", exact: true })
    .first()
    .click();
  expect(
    events.every(
      (e) =>
        e.consent === true &&
        !("email" in e) &&
        !("url" in e) &&
        !("name" in e),
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Desactivar métricas opcionales",
      exact: true,
    })
    .click();
  const count = events.length;
  await page.getByRole("button", { name: "Más información" }).first().click();
  await page
    .getByRole("button", { name: "Cerrar", exact: true })
    .first()
    .click();
  expect(events).toHaveLength(count);
});
test("commercial automation, independent follow-up category and PWA are visible", async ({
  page,
  request,
}) => {
  await page.goto("/crm");
  await page
    .getByRole("link", { name: "Seguimiento y métricas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Asistente de seguimiento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar regla", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("WhatsApp", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SEGUIMIENTO", exact: true }),
  ).toBeVisible();
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");
  const sw = await request.get("/connect-sw.js");
  expect(sw.status()).toBe(200);
  expect(await sw.text()).not.toContain("cache.put");
  const bad = await request.post("/api/interactions", {
    data: { consent: false, email: "private@example.com" },
  });
  expect(bad.status()).toBe(400);
});

test("FLASH attributes every commercial control and counts agenda and social clicks", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  await page.route("**/api/interactions", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"stored":false}',
    });
  });
  await page.goto("/connect/novogen");
  await page
    .getByRole("button", { name: "Permitir métricas", exact: true })
    .click();
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (event) => {
        const link =
          event.target instanceof Element ? event.target.closest("a") : null;
        if (
          link &&
          (link.target === "_blank" || link.href.startsWith("mailto:"))
        )
          event.preventDefault();
      },
      { capture: true },
    ),
  );
  for (const [name, target] of [
    ["Instagram", "instagram"],
    ["WhatsApp", "whatsapp"],
    ["AGENDAR ATENCIÓN", "agenda"],
    ["IR A NOVOGEN", "website"],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect
      .poll(() =>
        events.some((e) => e.target === target && e.kind === target + "_click"),
      )
      .toBe(true);
  }
  await expect(
    page.getByRole("button", { name: "TikTok: enlace pendiente" }),
  ).toBeDisabled();
  for (const [name, target] of [
    ["ORIÉNTAME", "orientame"],
    ["SERVICIOS", "services"],
    ["PROMOS", "promos"],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect.poll(() => events.some((e) => e.target === target)).toBe(true);
  }
  const missing = await page
    .locator(".novogen-flash a,.novogen-flash button")
    .evaluateAll((nodes) =>
      nodes
        .filter(
          (node) =>
            !node.closest(".tracking-choice") &&
            !node.hasAttribute("disabled") &&
            !node.hasAttribute("data-connect-target"),
        )
        .map((node) => node.textContent),
    );
  expect(missing).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "RECOVERY · Essential", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "GLOW · Limpieza facial", exact: true }),
  ).toBeVisible();
});

test("analytics dashboard filters sources and periods without inventing web events", async ({
  page,
}) => {
  await page.goto("/crm?view=automation");
  await expect(
    page.getByRole("heading", { name: "Dos canales. Una visión clara." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sitio web", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sitio web", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "La web mide visitas y accesos a canales. Las fichas de servicios corresponden a FLASH.",
    ),
  ).toBeVisible();
  await page.getByLabel("Período de métricas").selectOption("30");
  await expect(
    page.getByRole("img", { name: "Actividad diaria: 0 eventos en 30 días" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "CONNECT FLASH", exact: true })
    .click();
  await page.getByPlaceholder("RECOVERY, GLOW…").fill("Essential");
  await expect(page.locator(".metrics-service-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Automática", exact: true })
    .uncheck();
  await expect(page.getByText(/Actualización pausada/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("WordPress tracker requires explicit consent and stops after withdrawal", async ({
  page,
}) => {
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/web-interactions", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"stored":true}',
    });
  });
  await page.goto("/connect/novogen");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/web-tracker.js";
        s.dataset.slug = "novogen";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("tracker load"));
        document.head.appendChild(s);
      }),
  );
  expect(payloads).toHaveLength(0);
  await page.evaluate(() => {
    (
      window as unknown as { CONNECTMetrics: { setConsent(v: boolean): void } }
    ).CONNECTMetrics.setConsent(true);
  });
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].kind).toBe("page_view");
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.dataset.connectTarget = "agenda";
    a.href = "#test";
    a.textContent = "Prueba agenda web";
    document.body.appendChild(a);
  });
  await page.getByRole("link", { name: "Prueba agenda web" }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1].target).toBe("agenda");
  await page.evaluate(() => {
    (
      window as unknown as { CONNECTMetrics: { setConsent(v: boolean): void } }
    ).CONNECTMetrics.setConsent(false);
  });
  await page.getByRole("link", { name: "Prueba agenda web" }).click();
  expect(payloads).toHaveLength(2);
});

test("commercial team app has its own manifest, filters and collapsed notifications", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/equipo");
  await expect(
    page.getByRole("heading", { name: "Tu equipo, conectado." }),
  ).toBeVisible();
  await expect(page.locator(".compact-alert-content")).toBeHidden();
  await expect(page.locator(".notification-inbox")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByText("Bandeja de notificaciones", { exact: true }).click();
  await expect(
    page.getByText("Estás al día. No hay avisos pendientes."),
  ).toBeVisible();
  await page
    .getByPlaceholder("Nombre, correo o teléfono")
    .fill("contacto.a@example.com");
  await expect(
    page.getByRole("heading", { name: "Contacto de ejemplo A" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contacto de ejemplo B" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar prospecto" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Mis tareas", exact: true }).click();
  await expect(
    page.getByText("No hay tareas que coincidan con estos filtros."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Instalar CONNECT en mi dispositivo" })
    .click();
  await expect(page.getByRole("status")).toContainText("Agregar a inicio");
  await expect(page.locator('link[rel="manifest"]').last()).toHaveAttribute(
    "href",
    "/equipo/manifest.webmanifest",
  );
  const r = await request.get("/equipo/manifest.webmanifest");
  expect(r.status()).toBe(200);
  expect((await r.json()).start_url).toBe("/equipo");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("internal alerts stay compact and voice requires an explicit choice", async ({
  page,
}) => {
  await page.clock.install();
  let newProspect = false;
  let polls = 0;
  await page.addInitScript(() => {
    (window as unknown as { spoken: string[] }).spoken = [];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(s: { text: string }) {
          (window as unknown as { spoken: string[] }).spoken.push(s.text);
        },
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        lang = "";
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });
  await page.route("**/api/notifications?*", (route) => {
    polls++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: Array.from({ length: 30 }, (_, i) => ({
          id: newProspect && i === 0 ? "fresh-prospect" : String(i),
          kind: "new_request",
        })),
        enabled: true,
      }),
    });
  });
  await page.goto("/crm?view=automation");
  await expect(page.locator(".compact-alerts summary b")).toHaveText("30+");
  await expect(page.locator(".compact-alert-content")).toBeHidden();
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken,
    ),
  ).toEqual([]);
  await page.locator(".compact-alerts summary").click();
  await page
    .getByRole("button", { name: "Activar aviso de voz", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken.length,
    ),
  ).toBe(1);
  await expect(
    page.getByText(/La voz se reproduce en este dispositivo/),
  ).toBeVisible();
  await expect.poll(() => polls).toBeGreaterThanOrEqual(2);
  newProspect = true;
  await page.clock.fastForward(60001);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { spoken: string[] }).spoken),
    )
    .toContain("Existe un nuevo prospecto. Revisa tu aplicación CONNECT.");
  await page.clock.fastForward(60001);
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken.length,
    ),
  ).toBe(2);
  await page
    .getByRole("button", { name: "Pausar aviso de voz", exact: true })
    .click();
});

test("administrator can preview five expandable seats without invented email accounts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm");
  await page
    .getByRole("link", { name: "Accesos y cupos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu equipo, a tu medida." }),
  ).toBeVisible();
  await expect(page.locator(".access-seats article")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Guardar cupo 1", exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator('.access-seats input[type="email"]')
      .evaluateAll((nodes) =>
        nodes.every((n) => (n as HTMLInputElement).value === ""),
      ),
  ).toBe(true);
  await expect(
    page.getByText(/Reservar un cupo no crea un buzón de correo/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("ORIÉNTAME source manager exposes template and private-library controls on mobile", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm");
  await page
    .getByRole("link", { name: "Fuentes de ORIÉNTAME", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fuentes de ORIÉNTAME", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar importación" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Revisar una fuente no activa respuestas automáticas/),
  ).toBeVisible();
  const template = await request.get("/api/orientame/sources?template=1");
  expect(template.status()).toBe(200);
  expect(template.headers()["content-disposition"]).toContain("attachment");
  expect((await template.json()).version).toBe(1);
  const demoExport = await request.get("/api/orientame/sources?org=demo");
  expect(demoExport.status()).toBe(409);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
