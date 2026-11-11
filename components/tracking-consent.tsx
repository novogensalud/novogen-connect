"use client";
import { useEffect, useState } from "react";
import type { interactionKinds } from "@/lib/automation";
type Kind = (typeof interactionKinds)[number];
export function TrackingConsent({
  slug,
  point,
}: {
  slug: string;
  point?: string;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const key = `connect-metrics-${slug}`;
  useEffect(() => {
    try {
      setChoice(localStorage.getItem(key));
    } catch {
      setChoice("no");
    }
  }, [key]);
  useEffect(() => {
    if (choice !== "yes") return;
    let session: string;
    try {
      const storageKey = `connect-session-${slug}`;
      session = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, session);
    } catch {
      return;
    }
    function send(kind: Kind, service?: string, target?: string) {
      const payload = {
        slug,
        id: crypto.randomUUID(),
        session,
        kind,
        service: service ?? null,
        point: point && /^[a-f0-9]{32}$/.test(point) ? point : null,
        target: target ?? null,
        consent: true,
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon)
        navigator.sendBeacon(
          "/api/interactions",
          new Blob([body], { type: "application/json" }),
        );
      else
        void fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
    }
    send("page_view");
    let started = false;
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-connect-event]")
          : null;
      if (target)
        send(
          target.dataset.connectEvent as Kind,
          target.dataset.serviceId,
          target.dataset.connectTarget,
        );
    };
    const focus = (event: FocusEvent) => {
      if (
        !started &&
        event.target instanceof Element &&
        event.target.closest(".connect-form")
      ) {
        started = true;
        send("contact_started");
      }
    };
    document.addEventListener("click", click, true);
    const auxiliary = (event: MouseEvent) => {
      if (event.button === 1) click(event);
    };
    document.addEventListener("auxclick", auxiliary, true);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("auxclick", auxiliary, true);
      document.removeEventListener("focusin", focus);
    };
  }, [choice, slug, point]);
  function choose(value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
    setChoice(value);
  }
  return (
    <div className="tracking-choice">
      {choice === null ? (
        <>
          <p>
            ¿Permites medir el uso de CONNECT? Registramos visitas y clics sin
            nombres, correos ni información clínica. Los botones para rechazar o
            desactivar métricas no se registran. Puedes usar el formulario
            aunque rechaces las métricas.
          </p>
          <div>
            <button onClick={() => choose("yes")}>Permitir métricas</button>
            <button onClick={() => choose("no")}>Solo lo necesario</button>
          </div>
        </>
      ) : (
        <button onClick={() => choose(choice === "yes" ? "no" : "yes")}>
          {choice === "yes"
            ? "Desactivar métricas opcionales"
            : "Permitir métricas opcionales"}
        </button>
      )}
    </div>
  );
}
