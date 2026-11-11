import { test, expect } from "@playwright/test";
test("Marketing AI stays in CRM and only simulates editorial work", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", r => { if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method())) writes.push(r.url()); });
  await page.goto("/crm?view=marketing");
  await expect(page.getByRole("heading", { name: "Marketing AI", exact: true })).toBeVisible();
  const workspace = page.getByRole("region", { name: "Marketing AI de demostración" });
  for (const section of ["Calendario", "Crear", "Campañas", "Resultados", "Configuración", "Publicaciones"]) {
    await workspace.getByRole("navigation").getByRole("button", { name: section, exact: true }).click();
    await expect(workspace.getByRole("heading", { name: section, exact: true })).toBeVisible();
  }
  await expect(workspace.getByRole("button", { name: "Simular programación", exact: true })).toBeDisabled();
  await workspace.getByRole("button", { name: "Solicitar revisión", exact: true }).click();
  await workspace.getByRole("button", { name: "Simular aprobación", exact: true }).click();
  await workspace.getByLabel("Fecha y hora local").fill("2099-01-10T10:00");
  await workspace.getByRole("button", { name: "Simular programación", exact: true }).click();
  await expect(workspace.getByRole("status")).toContainText("No se creó ningún trabajo");
  await workspace.getByLabel("Nuevo texto", { exact: true }).fill("Corrección editorial de prueba para invalidar la aprobación.");
  await workspace.getByRole("button", { name: "Guardar nueva versión", exact: true }).click();
  await expect(workspace.getByRole("status")).toContainText("invalidadas");
  await expect(workspace.getByRole("button", { name: "Simular programación", exact: true })).toBeDisabled();
  await expect(workspace.getByRole("button", { name: "Publicar · no disponible en esta fase", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
  await page.reload();
  await workspace.getByRole("navigation").getByRole("button", { name: "Publicaciones", exact: true }).click();
  await expect(workspace.getByText("Versión 1 · Borrador", { exact: true })).toBeVisible();
});
test("Marketing AI fits a narrow screen and preserves CRM navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm?view=marketing");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "CRM comercial", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CRM comercial", exact: true })).toBeVisible();
});
