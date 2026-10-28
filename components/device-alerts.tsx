"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Volume2 } from "lucide-react";
import { notificationLabels } from "@/lib/automation";
export function DeviceAlerts({
  endpoint,
  title,
  refreshOnUpdate = false,
  compact = false,
}: {
  endpoint: string;
  title: string;
  refreshOnUpdate?: boolean;
  compact?: boolean;
}) {
  const [allowed, setAllowed] = useState(false),
    [message, setMessage] = useState(""),
    [items, setItems] = useState<{ id: string; kind: string }[]>([]);
  const [voice, setVoice] = useState(false);
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    try {
      setVoice(
        localStorage.getItem("connect-voice-alerts:" + endpoint) === "yes",
      );
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
          voice &&
          fresh.some((n: { kind: string }) => n.kind === "new_request") &&
          "speechSynthesis" in window
        ) {
          const speech = new SpeechSynthesisUtterance(
            "Existe un nuevo prospecto. Revisa tu aplicación CONNECT.",
          );
          speech.lang = "es-CL";
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(speech);
        }
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
            data: { url: compact ? "/equipo" : "/" },
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
  }, [endpoint, allowed, voice, compact, refreshOnUpdate, router]);
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
  const content = (
    <>
      <div>
        {!compact && <strong>{title}</strong>}
        <p>
          {items.length
            ? `${items.length} actualización(es) disponible(s).`
            : "Sin actualizaciones nuevas."}
        </p>
        {!compact && items.length > 0 && (
          <ul>
            {items.slice(0, 3).map((item) => (
              <li key={item.id}>
                {notificationLabels[
                  item.kind as keyof typeof notificationLabels
                ] ?? "Actualización comercial"}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="device-alert-controls">
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
        {compact && (
          <button
            type="button"
            onClick={() => {
              if (!("speechSynthesis" in window)) {
                setMessage(
                  "Este navegador no admite voz. Puedes usar la bandeja de avisos.",
                );
                return;
              }
              const next = !voice;
              setVoice(next);
              try {
                localStorage.setItem(
                  "connect-voice-alerts:" + endpoint,
                  next ? "yes" : "no",
                );
              } catch {}
              if (next) {
                const speech = new SpeechSynthesisUtterance(
                  "Avisos de voz activados para nuevos prospectos en CONNECT.",
                );
                speech.lang = "es-CL";
                speechSynthesis.speak(speech);
              } else speechSynthesis.cancel();
            }}
          >
            <Volume2 size={15} />
            {voice ? "Pausar aviso de voz" : "Activar aviso de voz"}
          </button>
        )}
      </div>
      <small>
        Alertas cada minuto con CONNECT abierto. La voz se reproduce en este
        dispositivo; no realiza llamadas por WhatsApp. El envío con la app
        cerrada sigue pendiente.
      </small>
      {message && <p role="status">{message}</p>}
    </>
  );
  return compact ? (
    <details className="device-alerts compact-alerts">
      <summary>
        <span>
          <Bell size={17} />
          {title}
        </span>
        <b>{items.length === 30 ? "30+" : items.length}</b>
      </summary>
      <div className="compact-alert-content">{content}</div>
    </details>
  ) : (
    <section className="device-alerts">{content}</section>
  );
}
