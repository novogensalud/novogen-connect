"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  if (!user) redirect("/login");
  const org = value(f, "org");
  const { data, error } = await db
    .from("memberships")
    .select("role, organizations(slug)")
    .eq("organization_id", org)
    .eq("user_id", user.id)
    .single();
  if (error || !data) redirect("/crm?notice=forbidden");
  return { db, org, role: data.role as string };
}
function back(org: string, notice: string): never {
  revalidatePath("/crm");
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
  if (error) redirect("/login?error=credentials");
  redirect("/crm");
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
    back(org, "invalid");
  const { error } = await db
    .from("opportunities")
    .update({ stage, next_action })
    .eq("organization_id", org)
    .eq("id", value(f, "id"));
  back(org, error ? "error" : "saved");
}
export async function addPoint(f: FormData) {
  const { db, org, role } = await admin(f);
  if (role !== "admin") back(org, "forbidden");
  const name = value(f, "name").trim();
  if (name.length < 2 || name.length > 80) back(org, "invalid");
  const { error } = await db
    .from("connect_points")
    .insert({
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
  const { error } = await db.rpc("capture_lead", {
    p_slug: slug,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_service: parsed.data.service || null,
    p_code: value(f, "point") || null,
    p_consent: true,
  });
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
