import { isConfigured, supabase } from "@/lib/supabase";

type Booking = {
  id: string; external_booking_id: string; external_professional_id: string | null;
  contact_name: string; contact_email: string; contact_phone: string;
  service_name: string; start_at: string; status: string;
};
const labels: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmada", cancelled: "Cancelada",
  expired: "Vencida", deleted: "Eliminada de la agenda",
};
const date = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short", hour12: false,
});

export async function BookingInbox({ organizationId }: { organizationId: string }) {
  if (process.env.CONNECT_AGENDALITE_ENABLED !== "true" || !isConfigured())
    return <section className="panel"><div className="panel-heading"><div><h2>Reservas de Agendalite</h2>
      <p>La sincronización aún no está habilitada. Las reservas se mantienen en la agenda original.</p></div></div></section>;
  const db = await supabase();
  const { data, error } = await db.from("commercial_bookings")
    .select("id,external_booking_id,external_professional_id,contact_name,contact_email,contact_phone,service_name,start_at,status")
    .eq("organization_id", organizationId).order("start_at", { ascending: false }).limit(100);
  if (error)
    return <section className="panel"><div className="panel-heading"><div><h2>No se pudieron cargar las reservas sincronizadas</h2>
      <p>Revisa la integración y tus permisos. La agenda de origen conserva las reservas.</p></div></div></section>;
  const bookings = (data || []) as Booking[];
  return <section className="panel contacts-panel">
    <div className="panel-heading"><div><h2>Reservas sincronizadas</h2>
      <p>Últimas 100 por fecha de atención · horario de Chile. Datos comerciales, sin ficha clínica ni autorización de marketing implícita.</p></div></div>
    {bookings.length === 0 ? <div className="panel-heading"><p>Aún no se reciben reservas para este espacio.</p></div> :
      <div className="table-scroll"><table>
        <thead><tr><th scope="col">Reserva</th><th scope="col">Contacto registrado al reservar</th>
          <th scope="col">Servicio</th><th scope="col">Fecha</th><th scope="col">Estado</th></tr></thead>
        <tbody>{bookings.map(b => <tr key={b.id}>
          <td>#{b.external_booking_id}<br /><small>{b.external_professional_id ? "Agenda #" + b.external_professional_id : "Agenda sin asignación"}</small></td>
          <td><strong>{b.contact_name}</strong><br />{b.contact_email}<br />{b.contact_phone}</td>
          <td>{b.service_name}</td><td><time dateTime={b.start_at}>{date.format(new Date(b.start_at))}</time></td>
          <td>{labels[b.status] || "Revisar estado"}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
