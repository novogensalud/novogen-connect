"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isConfigured, supabase } from "@/lib/supabase";

export async function reviewRedemption(organization: string, request: string, form: FormData) {
  const parsed = z.tuple([z.uuid(), z.uuid(), z.enum(["approved", "rejected"])])
    .safeParse([organization, request, form.get("decision")]);
  if (!parsed.success || !isConfigured() || process.env.CONNECT_LOYALTY_ENABLED !== "true") redirect("/crm");

  const [org, id, decision] = parsed.data;
  const db = await supabase();
  const { error } = await db.rpc("review_connect_redemption", {
    p_org: org, p_request: id, p_decision: decision,
  });
  redirect(`/crm?org=${org}&view=loyalty&review=${error ? "error" : "saved"}`);
}
