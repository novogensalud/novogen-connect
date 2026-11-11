import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leadSchema,
  serviceSchema,
  safeLocalPath,
  stages,
} from "../lib/domain";
const lead = {
  name: "Persona Ejemplo",
  email: "persona@example.com",
  phone: "+56 9 1234 5678",
  service: "",
  consent: "on",
};
test("commercial capture requires explicit consent and valid contact data", () => {
  assert.equal(leadSchema.safeParse(lead).success, true);
  for (const patch of [
    { consent: "" },
    { email: "invalid" },
    { name: "A" },
    { phone: "<script>" },
    { service: "other-tenant" },
  ])
    assert.equal(leadSchema.safeParse({ ...lead, ...patch }).success, false);
});
test("catalog only accepts approved categories and bounded descriptions", () => {
  assert.equal(
    serviceSchema.safeParse({
      name: "Servicio",
      category: "CHECK",
      description: "Información comercial",
    }).success,
    true,
  );
  assert.equal(
    serviceSchema.safeParse({
      name: "Servicio",
      category: "CLINICAL",
      description: "Información",
    }).success,
    false,
  );
  assert.equal(
    serviceSchema.safeParse({
      name: "Servicio",
      category: "CHECK",
      description: "x".repeat(501),
    }).success,
    false,
  );
});
test("redirect paths cannot escape the application", () => {
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/foo?redirect=bad",
    "/%2f%2fevil",
  ])
    assert.equal(safeLocalPath(path), "/");
  assert.equal(safeLocalPath("/connect/novogen"), "/connect/novogen");
});
test("pipeline does not equate a booking with a validated sale", () => {
  assert.ok(stages.includes("booked"));
  assert.equal((stages as readonly string[]).includes("sale_validated"), false);
});
