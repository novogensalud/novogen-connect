"use server";
import { channelSchema } from "@/lib/channels";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { supabase, isConfigured } from "@/lib/supabase";
import { leadSchema, serviceSchema, stages } from "@/lib/domain";
const value = (f: FormData, key: string) => String(f.get(key) ?? "");
async function admin(f: FormData) {
  if (!isConfigured()) redirect("/crm?notice=demo");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      value(f, "return_to") === "equipo" ? "/login?next=equipo" : "/login",
    );
  const org = value(f, "org");
  const { data, error } = await db
    .from("memberships")
    .select("role, organizations(slug)")
    .eq("organization_id", org)
    .eq("user_id", user.id)
    .single();
  if (error || !data) redirect("/crm?notice=forbidden");
  return { db, org, role: data.role as string, userId: user.id };
}
function teamBack(org: string, notice: string): never {
  revalidatePath("/equipo");
  revalidatePath("/crm");
  redirect(`/equipo?org=${encodeURIComponent(org)}&notice=${notice}`);
}
function back(org: string, notice: string): never {
  revalidatePath("/crm");
  revalidatePath("/equipo");
  revalidatePath("/connect", "layout");
  redirect(`/crm?org=${encodeURIComponent(org)}&notice=${notice}`);
}
export async function signIn(f: FormData) {
  if (!isConfigured()) redirect("/login?error=config");
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: value(f, "email"),
    password: value(f, "password"),
  });
  const team = value(f, "next") === "equipo";
  if (error)
    redirect(
      team
        ? "/login?error=credentials&next=equipo"
        : "/login?error=credentials",
    );
  redirect(team ? "/equipo" : "/crm");
}
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
export async function addService(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const input = serviceSchema.safeParse(Object.fromEntries(f));
  if (!input.success) back(org, "invalid");
  const { error } = await db
    .from("services")
    .insert({ organization_id: org, ...input.data });
  back(org, error ? "error" : "saved");
}
export async function editService(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const input = serviceSchema.safeParse(Object.fromEntries(f));
  if (!input.success) back(org, "invalid");
  const { error } = await db
    .from("services")
    .update(input.data)
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  back(org, error ? "error" : "saved");
}
export async function toggleService(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const { error } = await db
    .from("services")
    .update({ active: value(f, "active") === "true" })
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  back(org, error ? "error" : "saved");
}
export async function updateOpportunity(f: FormData) {
  const { db, org } = await admin(f);
  const stage = value(f, "stage");
  const next_action = value(f, "next_action").trim();
  if (
    !stages.includes(stage as (typeof stages)[number]) ||
    next_action.length > 240
  )
    (value(f, "return_to") === "equipo" ? teamBack : back)(org, "invalid");
  const { error } = await db
    .from("opportunities")
    .update({ stage, next_action })
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  (value(f, "return_to") === "equipo" ? teamBack : back)(
    org,
    error ? "error" : "saved",
  );
}
export async function addPoint(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const name = value(f, "name").trim();
  if (name.length < 2 || name.length > 80) back(org, "invalid");
  const { error } = await db.from("connect_points").insert({
    organization_id: org,
    name,
    code: randomBytes(16).toString("hex"),
  });
  back(org, error ? "error" : "saved");
}
export async function togglePoint(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const { error } = await db
    .from("connect_points")
    .update({ active: value(f, "active") === "true" })
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  back(org, error ? "error" : "saved");
}
export async function submitLead(f: FormData) {
  const slug = value(f, "slug");
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) redirect("/");
  const path = `/connect/${slug}`;
  if (!isConfigured()) redirect(`${path}?notice=demo#contacto`);
  if (value(f, "website")) redirect(`${path}?notice=invalid#contacto`);
  const parsed = leadSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) redirect(`${path}?notice=invalid#contacto`);
  const db = await supabase();
  const payload = {
    p_slug: slug,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_service: parsed.data.service || null,
    p_code: value(f, "point") || null,
    p_consent: true,
  };
  const requestType = value(f, "request_type") || "information";
  if (!["information", "subscription", "human"].includes(requestType))
    redirect(`${path}?notice=invalid#contacto`);
  const receipt = randomBytes(32).toString("hex");
  let { error } = await db.rpc("capture_connect_request", {
    ...payload,
    p_request_type: requestType,
    p_receipt: receipt,
  });
  if (error?.code === "PGRST202" && requestType === "information") {
    const legacy = await db.rpc("capture_lead", payload);
    error = legacy.error;
  } else if (!error) {
    (await cookies()).set(`connect_receipt_${slug}`, receipt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  redirect(`${path}?notice=${error ? "error" : "received"}#contacto`);
}
export async function createContact(f: FormData) {
  const { db, org } = await admin(f);
  const parsed = leadSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) back(org, "invalid");
  const { error } = await db.rpc("create_commercial_contact", {
    p_org: org,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_service: parsed.data.service || null,
    p_consent: true,
  });
  back(org, error ? "error" : "saved");
}

export async function saveFollowupSettings(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const minutes = Number(value(f, "reminder_minutes"));
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 43200)
    back(org, "invalid");
  const { data, error: readError } = await db
    .from("followup_settings")
    .select("organization_id")
    .eq("organization_id", org)
    .maybeSingle();
  if (readError) back(org, "error");
  const result = data
    ? await db
        .from("followup_settings")
        .update({ reminder_minutes: minutes })
        .eq("organization_id", org)
    : await db
        .from("followup_settings")
        .insert({ organization_id: org, reminder_minutes: minutes });
  revalidatePath("/crm");
  redirect(
    `/crm?org=${org}&view=automation&notice=${result.error ? "error" : "saved"}`,
  );
}
export async function updateFollowup(f: FormData) {
  const { db, org, userId } = await admin(f);
  const state = value(f, "state");
  if (!["pending", "done", "cancelled"].includes(state)) back(org, "invalid");
  const patch: { state: string; assigned_to?: string; due_at?: string } = {
    state,
  };
  if (value(f, "claim") === "on") patch.assigned_to = userId;
  const minutes = Number(value(f, "snooze"));
  if (minutes) {
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 43200)
      back(org, "invalid");
    patch.due_at = new Date(Date.now() + minutes * 60000).toISOString();
  }
  const { error } = await db
    .from("followup_tasks")
    .update(patch)
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  revalidatePath("/equipo");
  if (value(f, "return_to") === "equipo")
    teamBack(org, error ? "error" : "saved");
  revalidatePath("/crm");
  redirect(
    `/crm?org=${org}&view=automation&notice=${error ? "error" : "saved"}`,
  );
}
export async function readNotification(f: FormData) {
  const { db, org, userId } = await admin(f);
  const { error } = await db
    .from("commercial_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", value(f, "id"))
    .eq("organization_id", org)
    .eq("recipient_id", userId);
  revalidatePath("/equipo");
  if (value(f, "return_to") === "equipo")
    teamBack(org, error ? "error" : "saved");
  revalidatePath("/crm");
  redirect(
    `/crm?org=${org}&view=automation&notice=${error ? "error" : "saved"}`,
  );
}

export async function saveChannels(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const parsed = channelSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) back(org, "invalid");
  const { data, error } = await db
    .from("public_channels")
    .select("organization_id")
    .eq("organization_id", org)
    .maybeSingle();
  if (error) back(org, "error");
  const result = data
    ? await db
        .from("public_channels")
        .update(parsed.data)
        .eq("organization_id", org)
    : await db
        .from("public_channels")
        .insert({ organization_id: org, ...parsed.data });
  revalidatePath("/crm");
  revalidatePath("/equipo");
  revalidatePath("/connect", "layout");
  redirect(
    `/crm?org=${org}&view=catalog&notice=${result.error ? "error" : "saved"}`,
  );
}
