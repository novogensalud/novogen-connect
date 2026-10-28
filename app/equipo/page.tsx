import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { demoLeads, demoOrg, demoServices } from "@/lib/demo";
import type { Lead, Organization, Service } from "@/lib/domain";
import type { CommercialNotification, FollowupTask } from "@/lib/automation";
import { TeamWorkspace } from "@/components/team-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CONNECT · Equipo comercial",
  manifest: "/equipo/manifest.webmanifest",
};
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams,
    demo = !isConfigured();
  let org = demoOrg,
    orgs: Organization[] = [demoOrg],
    leads: Lead[] = demoLeads,
    services: Service[] = demoServices,
    tasks: FollowupTask[] = [],
    notifications: CommercialNotification[] = [],
    userId = "demo";
  if (!demo) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login?next=equipo");
    userId = user.id;
    const { data: memberships, error } = await db
      .from("memberships")
      .select("organizations(id,name,slug)")
      .eq("user_id", user.id);
    if (error)
      return (
        <main className="empty">
          <h1>No se pudo cargar tu equipo</h1>
          <Link href="/equipo">Reintentar</Link>
        </main>
      );
    orgs = (memberships ?? []).flatMap((m) =>
      m.organizations ? [m.organizations as unknown as Organization] : [],
    );
    if (!orgs.length)
      return (
        <main className="empty">
          <h1>Tu cuenta aún no tiene un equipo asignado</h1>
          <Link href="/crm">Revisar acceso</Link>
        </main>
      );
    org = orgs.find((o) => o.id === params.org) ?? orgs[0];
    const sync = await db.rpc("sync_reminders", { p_org: org.id });
    const results = await Promise.all([
      db
        .from("leads")
        .select(
          "id,name,email,phone,created_at,service_id,opportunities(id,stage,next_action)",
        )
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("services").select("*").eq("organization_id", org.id),
      db
        .from("followup_tasks")
        .select("*")
        .eq("organization_id", org.id)
        .eq("state", "pending")
        .order("due_at")
        .limit(100),
      db
        .from("commercial_notifications")
        .select("id,kind,created_at,read_at")
        .eq("organization_id", org.id)
        .eq("recipient_id", userId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (sync.error || results.some((r) => r.error))
      return (
        <main className="empty">
          <h1>No se pudieron cargar los prospectos y tareas</h1>
          <p>Revisa tu conexión y permisos de equipo.</p>
          <Link href="/equipo">Reintentar</Link>
        </main>
      );
    leads = (results[0].data ?? []) as Lead[];
    services = results[1].data ?? [];
    tasks = results[2].data ?? [];
    notifications = results[3].data ?? [];
  }
  return (
    <TeamWorkspace
      org={org}
      orgs={orgs}
      leads={leads}
      services={services}
      tasks={tasks}
      notifications={notifications}
      userId={userId}
      demo={demo}
      notice={params.notice}
    />
  );
}
