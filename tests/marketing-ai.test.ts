import test from "node:test";
import assert from "node:assert/strict";
import { initialSimulation, localMinuteToUTC, marketingSection, simulationReducer } from "../lib/marketing-ai/simulation";

test("editorial flow requires review and current approval; edits invalidate scheduled version", () => {
  let state = initialSimulation();
  const schedule = { type: "schedule" as const, id: "sample-1", instant: "2030-01-10T13:00:00Z", timezone: "America/Santiago", now: Date.UTC(2029, 0, 1) };
  assert.equal(simulationReducer(state, schedule).error, true);
  assert.equal(simulationReducer(state, { type: "approve", id: "sample-1" }).error, true);
  state = simulationReducer(state, { type: "review", id: "sample-1" });
  state = simulationReducer(state, { type: "approve", id: "sample-1" });
  state = simulationReducer(state, schedule);
  assert.equal(state.items[0].state, "scheduled");
  const previous = state;
  state = simulationReducer(state, { type: "edit", id: "sample-1", copy: "Texto corregido de demostración para otra versión." });
  assert.equal(state.items[0].version, 2);
  assert.equal(state.items[0].approvedVersion, null);
  assert.equal(state.items[0].scheduledAt, null);
  assert.equal(state.items[0].state, "draft");
  assert.equal(previous.items[0].state, "scheduled");
});
test("pause, past dates, cancel and rejection block invalid transitions", () => {
  let state = initialSimulation();
  state = simulationReducer(state, { type: "review", id: "sample-1" });
  state = simulationReducer(state, { type: "reject", id: "sample-1" });
  assert.equal(state.items[0].state, "changes_requested");
  state = simulationReducer(state, { type: "review", id: "sample-1" });
  state = simulationReducer(state, { type: "approve", id: "sample-1" });
  const action = { type: "schedule" as const, id: "sample-1", instant: "2030-01-10T13:00:00Z", timezone: "UTC", now: Date.UTC(2029, 0, 1) };
  assert.equal(simulationReducer(state, { ...action, now: Date.UTC(2031,0,1) }).error, true);
  state = simulationReducer(state, { type: "pause" });
  assert.equal(simulationReducer(state, action).error, true);
  state = simulationReducer(state, { type: "cancel", id: "sample-1" });
  assert.equal(simulationReducer(state, { type: "review", id: "sample-1" }).error, true);
});
test("wall clock conversion rejects DST gaps, ambiguities and invalid calendar dates", () => {
  assert.equal(localMinuteToUTC("2030-01-10T10:00", "UTC"), "2030-01-10T10:00:00.000Z");
  assert.throws(() => localMinuteToUTC("2026-03-08T02:30", "America/New_York"), /no existe/);
  assert.throws(() => localMinuteToUTC("2026-11-01T01:30", "America/New_York"), /ambigua/);
  assert.throws(() => localMinuteToUTC("2026-02-31T10:00", "UTC"), /no válida/);
  assert.throws(() => localMinuteToUTC("2026-01-01T10:00", "unknown"), /no válida/);
});
test("simulation instances are isolated and reset does not retain drafts", () => {
  const second = initialSimulation();
  let first = simulationReducer(initialSimulation(), { type: "create", title: "Pieza nueva", copy: "Contenido de prueba sin información personal.", format: "Imagen 1:1", channel: "Facebook" });
  assert.equal(first.items.length, 2); assert.equal(second.items.length, 1);
  first = simulationReducer(first, { type: "reset" });
  assert.equal(first.items.length, 1); assert.equal(first.history.length, 0);
  assert.equal(marketingSection("invalid"), "dashboard");
});
