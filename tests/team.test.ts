import { test } from "node:test";
import assert from "node:assert/strict";
import { commercialWhatsApp } from "../lib/team";
test("manual commercial WhatsApp only accepts explicit international numbers", () => {
  assert.equal(
    commercialWhatsApp("+56 9 4468 3094"),
    "https://wa.me/56944683094",
  );
  for (const value of [
    "944683094",
    "javascript:alert(1)",
    "+0123456789",
    "+56944683094?text=spam",
    "+123",
    "+1234567890123456",
  ])
    assert.equal(commercialWhatsApp(value), null);
});
