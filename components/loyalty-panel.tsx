import { reviewRedemption } from "@/app/crm/loyalty-actions";
import { supabase } from "@/lib/supabase";

type RankingRow = {
  subject_id: string; quarter_xp: number; rolling_xp: number; level_label: string | null; rank_position: number;
};
type RedemptionRow = {
  request_id: string; reward_label: string; cost_points: number;
  state: "pending" | "approved" | "rejected" | "completed";
  finance_operation_id: string | null;
};

const states = {
  pending: "Pendiente",
  approved: "Aprobado · pendiente de débito FINANCE",
  rejected: "Rechazado",
  completed: "Entregado",
};

export async function LoyaltyPanel({ organizationId, result }: { organizationId: string; result?: string }) {
  const db = await supabase();
  const [ranking, redemptions] = await Promise.all([
    db.rpc("connect_xp_ranking", { p_org: organizationId }),
    db.from("connect_redemptions").select("request_id,reward_label,cost_points,state,finance_operation_id")
      .eq("organization_id", organizationId).order("requested_at", { ascending: false }).limit(50),
  ]);
  return (
    <section className="panel" aria-label="Ranking y canjes">
      {result === "saved" && <p role="status">Revisión registrada.</p>}
      {result === "error" && <p role="alert">La revisión no se pudo registrar. Comprueba el permiso y el estado de la solicitud.</p>}
      <h2>Ranking del trimestre</h2>
      {ranking.error ? <p role="status">Ranking no disponible.</p> : (ranking.data as RankingRow[]).length ? (
        <ol>
          {(ranking.data as RankingRow[]).map(row => (
            <li key={row.subject_id} value={row.rank_position}>
              Cuenta {row.subject_id.slice(0, 8)} · {row.quarter_xp} XP del trimestre · {row.rolling_xp} XP en 12 meses
              {row.level_label && <> · {row.level_label}</>}
            </li>
          ))}
        </ol>
      ) : <p>Aún no hay actividad verificada en este trimestre.</p>}
      <h2>Últimas solicitudes de canje</h2>
      {redemptions.error ? <p role="status">Solicitudes no disponibles.</p> : redemptions.data.length ? (
        <ul>
          {(redemptions.data as RedemptionRow[]).map(row => (
            <li key={row.request_id}>
              <strong>{row.reward_label}</strong> · {row.cost_points} NOVO Points · {
                row.state === "approved" && row.finance_operation_id ? "Débito confirmado · pendiente de entrega" : states[row.state]
              }
              {row.state === "pending" && (
                <form action={reviewRedemption.bind(null, organizationId, row.request_id)}>
                  <button className="button" name="decision" value="approved">Aprobar revisión</button>{" "}
                  <button className="button secondary" name="decision" value="rejected">Rechazar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : <p>Aún no hay solicitudes.</p>}
    </section>
  );
}
