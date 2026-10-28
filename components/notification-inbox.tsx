import { Bell } from "lucide-react";
import {
  notificationLabels,
  type CommercialNotification,
} from "@/lib/automation";
import { readNotification } from "@/app/actions";
export function NotificationInbox({
  items,
  org,
  demo,
  team = false,
}: {
  items: CommercialNotification[];
  org: string;
  demo: boolean;
  team?: boolean;
}) {
  return (
    <details className="notification-inbox panel">
      <summary>
        <span>
          <Bell size={18} /> Bandeja de notificaciones
        </span>
        <b>{items.length === 30 ? "30+" : items.length}</b>
      </summary>
      <p className="fine-print">
        Avisos pendientes para tu cuenta. Abre la bandeja cuando quieras
        revisarlos.
      </p>
      {items.length ? (
        <div className="notification-inbox-list">
          {items.map((n) => (
            <article key={n.id}>
              <div>
                <strong>{notificationLabels[n.kind]}</strong>
                <small>
                  {new Date(n.created_at).toLocaleString("es-CL", {
                    timeZone: "America/Santiago",
                  })}
                </small>
              </div>
              <form action={readNotification}>
                <input type="hidden" name="org" value={org} />
                <input type="hidden" name="id" value={n.id} />
                {team && (
                  <input type="hidden" name="return_to" value="equipo" />
                )}
                <button className="small-button" disabled={demo}>
                  Marcar leída
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p>Estás al día. No hay avisos pendientes.</p>
      )}
    </details>
  );
}
