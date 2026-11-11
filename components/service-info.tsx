"use client";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/lib/domain";
export function ServiceInfo({
  service,
  contactHref = "#contacto",
  agendaUrl,
}: {
  service: Service;
  contactHref?: string;
  agendaUrl?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="inline-link info-trigger"
        data-connect-event="service_view"
        data-connect-target="service_info"
        data-service-id={service.id}
        onClick={() => dialog.current?.showModal()}
      >
        Más información <ArrowUpRight size={16} />
      </button>
      <dialog
        ref={dialog}
        className="service-dialog"
        aria-labelledby={`title-${service.id}`}
      >
        <span className="eyebrow">{service.category}</span>
        <h2 id={`title-${service.id}`}>{service.name}</h2>
        <p>{service.description}</p>
        <a
          className="button primary"
          href={contactHref}
          data-connect-event="button_click"
          data-connect-target="service_contact"
          data-service-id={service.id}
          onClick={() => dialog.current?.close()}
        >
          Solicitar orientación
        </a>
        {agendaUrl && (
          <a
            className="button primary"
            href={agendaUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-connect-event="agenda_click"
            data-connect-target="agenda"
            data-service-id={service.id}
          >
            Ir a agenda
          </a>
        )}
        <button
          data-connect-event="button_click"
          data-connect-target="service_close"
          data-service-id={service.id}
          className="button"
          onClick={() => dialog.current?.close()}
        >
          Cerrar
        </button>
      </dialog>
    </>
  );
}
