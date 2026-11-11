import { z } from "zod";

/** CONNECT 1.0: stable transport contracts; no financial ledger lives here. */
export const ConnectEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.enum([
    "purchase.confirmed", "purchase.refunded", "booking.confirmed",
    "booking.cancelled", "education.completed", "mission.completed",
    "referral.verified", "reward.redeem.requested",
  ]),
  source: z.enum(["SUPLE", "AGENDALITE", "ACADEMY", "CONNECT", "CRM"]),
  source_reference: z.string().min(1).max(128),
  core_user_id: z.string().min(1).max(128),
  occurred_at: z.string().datetime({ offset: true }),
  schema_version: z.literal(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ConnectEvent = z.infer<typeof ConnectEventSchema>;

export const RedemptionStateSchema = z.enum([
  "pending", "approved", "completed", "rejected", "failed", "cancelled",
]);
export type RedemptionState = z.infer<typeof RedemptionStateSchema>;

export const RedemptionSchema = z.object({
  request_id: z.string().uuid(),
  core_user_id: z.string().min(1),
  reward_id: z.string().min(1),
  cost_points: z.number().int().positive(),
  state: RedemptionStateSchema,
  requested_at: z.string().datetime({ offset: true }),
  approved_by: z.string().nullable().optional(),
  finance_operation_id: z.string().nullable().optional(),
  delivered_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type Redemption = z.infer<typeof RedemptionSchema>;

/** Same business event must not grant a reward twice, even on retries. */
export function eventIdempotencyKey(event: ConnectEvent): string {
  return [event.source, event.event_type, event.source_reference].join(":");
}

/** Only an authorized, approved redemption may request an atomic debit. */
export function canRequestFinanceDebit(redemption: Redemption): boolean {
  return redemption.state === "approved" &&
    Boolean(redemption.approved_by) &&
    !redemption.finance_operation_id;
}

/** CONNECT never reserves or subtracts points on a pending request. */
export function pointsReservedForPendingRedemption(_redemption: Redemption): number {
  return 0;
}
