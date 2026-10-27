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
  await expect(
    page.getByText("Clics a WhatsApp desde CONNECT", { exact: true }),
  ).toBeVisible();
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
