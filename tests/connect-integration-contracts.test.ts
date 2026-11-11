import test from "node:test";
import assert from "node:assert/strict";
import {
  ConnectEventSchema, RedemptionSchema, eventIdempotencyKey,
  canRequestFinanceDebit, pointsReservedForPendingRedemption,
} from "../lib/connect-integration-contracts";

const event = {
  event_id: "f7435e38-341d-44e5-96bc-4544d391c311",
  event_type: "purchase.confirmed",
  source: "SUPLE",
  source_reference: "ORDER-1",
  core_user_id: "USER-1",
  occurred_at: "2026-11-11T12:00:00-03:00",
  schema_version: 1,
  payload: { eligible_amount_clp: 25000 },
};
test("validated source events have stable idempotency keys", () => {
  const parsed = ConnectEventSchema.parse(event);
  assert.equal(eventIdempotencyKey(parsed), "SUPLE:purchase.confirmed:ORDER-1");
  assert.equal(eventIdempotencyKey(ConnectEventSchema.parse({...event, event_id:"a25bb6c1-1849-40ad-90bd-03b05f9fb37d"})), eventIdempotencyKey(parsed));
});
test("rejects unsupported events", () => {
  assert.equal(ConnectEventSchema.safeParse({...event,event_type:"points.credit"}).success,false);
});
const base = {
  request_id:"dc0b0ab2-43d6-4d6c-8c21-963bb1444a17",
  core_user_id:"USER-1", reward_id:"avatar", cost_points:50,
  state:"pending", requested_at:"2026-11-11T12:00:00-03:00",
};
test("pending redemptions never reserve or debit points", () => {
  const pending = RedemptionSchema.parse(base);
  assert.equal(pointsReservedForPendingRedemption(pending),0);
  assert.equal(canRequestFinanceDebit(pending),false);
});
test("debit requires human approval and no previous finance operation", () => {
  assert.equal(canRequestFinanceDebit(RedemptionSchema.parse({...base,state:"approved"})),false);
  assert.equal(canRequestFinanceDebit(RedemptionSchema.parse({...base,state:"approved",approved_by:"ADMIN-1"})),true);
  assert.equal(canRequestFinanceDebit(RedemptionSchema.parse({...base,state:"approved",approved_by:"ADMIN-1",finance_operation_id:"TX-1"})),false);
});
