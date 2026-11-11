"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationLabels } from "@/lib/automation";
export function DeviceAlerts({
  endpoint,
  title,
  refreshOnUpdate = false,
}: {
  endpoint: string;
  title: string;
  refreshOnUpdate?: boolean;
}) {
  const [allowed, setAllowed] = useState(false),
    [message, setMessage] = useState(""),
    [items, setItems] = useState<{ id: string; kind: string }[]>([]);
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    try {
      setAllowed(
        localStorage.getItem("connect-device-alerts:" + endpoint) === "yes" &&
          "Notification" in window &&
          Notification.permission === "granted",
      );
    } catch {}
  }, [endpoint]);
  useEffect(() => {
    seen.current = null;
    setItems([]);
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch(endpoint, { cache: "no-store" });
        if (!r.ok) {
          if (active)
            setMessage(
              "No se pudieron consultar los avisos. Revisa la conexión o la activación del seguimiento.",
            );
          return;
        }
        const data = await r.json();
        if (!active) return;
        const next = data.items ?? [];
        setItems(next);
        const fresh = seen.current
          ? next.filter((n: { id: string }) => !seen.current!.has(n.id))
          : [];
        seen.current = new Set(next.map((n: { id: string }) => n.id));
        if (fresh.length && refreshOnUpdate) router.refresh();
        if (
          allowed &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          fresh.length
        ) {
          const registration = await navigator.serviceWorker?.getRegistration();
          const options = {
            body: "Tienes una actualización comercial. Abre CONNECT para revisarla.",
            tag: "connect-commercial-update",
            icon: "/icons/icon-192.png",
          };
          if (registration)
            await registration.showNotification("CONNECT", options);
          else new Notification("CONNECT", options);
        }
      } catch {
        /* Network loss must not block the commercial workflow. */
      }
    };
    void poll();
    const timer = setInterval(poll, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint, allowed, refreshOnUpdate, router]);
  async function enable() {
    if (!("Notification" in window)) {
      setMessage(
        "Este navegador no permite estas alertas. En iPhone, instala CONNECT en la pantalla de inicio.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && "serviceWorker" in navigator)
        await navigator.serviceWorker.register("/connect-sw.js");
      try {
        localStorage.setItem(
          "connect-device-alerts:" + endpoint,
          permission === "granted" ? "yes" : "no",
        );
      } catch {}
      setAllowed(permission === "granted");
      setMessage(
        permission === "granted"
          ? "Alertas activas mientras CONNECT esté abierto."
          : "Puedes seguir usando las notificaciones dentro de CONNECT.",
      );
    } catch {
      setMessage("No se pudieron activar las alertas de este dispositivo.");
    }
  }
  return (
    <section className="device-alerts">
      <div>
        <strong>{title}</strong>
        <p>
          {items.length
            ? `${items.length} actualización(es) disponible(s).`
            : "Sin actualizaciones nuevas."}
        </p>
        {items.length > 0 && (
          <ul>
            {items.slice(0, 3).map((item) => (
              <li key={item.id}>
                {notificationLabels[
                  item.kind as keyof typeof notificationLabels
                ] ?? item.kind}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        data-connect-event="button_click"
        data-connect-target={allowed ? "device_pause" : "device_enable"}
        onClick={() => {
          if (allowed) {
            setAllowed(false);
            try {
              localStorage.setItem("connect-device-alerts:" + endpoint, "no");
            } catch {}
            setMessage("Alertas de este dispositivo pausadas.");
          } else void enable();
        }}
      >
        {allowed
          ? "Pausar alertas de este dispositivo"
          : "Activar alertas en este dispositivo"}
      </button>
      <small>
        Las alertas se revisan cada minuto mientras la aplicación está abierta.
        El envío push con la aplicación cerrada aún no está conectado.
      </small>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
