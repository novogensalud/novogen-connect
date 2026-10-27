"use client";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/lib/domain";
export function ServiceInfo({
  service,
  contactHref = "#contacto",
}: {
  service: Service;
  contactHref?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="inline-link info-trigger"
        data-connect-event="service_view"
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
          onClick={() => dialog.current?.close()}
        >
          Solicitar orientación
        </a>
        <button className="button" onClick={() => dialog.current?.close()}>
          Cerrar
        </button>
      </dialog>
    </>
  );
}
