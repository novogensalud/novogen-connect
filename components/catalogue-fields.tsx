import type { Service } from "@/lib/domain";
import { availableParents } from "@/lib/catalogue-tree";
export function CatalogueFields({
  services,
  current,
}: {
  services: Service[];
  current?: Service;
}) {
  return (
    <>
      <label>
        Tipo de registro
        <select
          name="catalog_type"
          defaultValue={current?.catalog_type ?? "service"}
        >
          <option value="service">Servicio individual</option>
          <option value="group">Agrupador de preferencias</option>
        </select>
      </label>
      <label>
        Dentro de
        <select name="parent_id" defaultValue={current?.parent_id ?? ""}>
          <option value="">Nivel principal</option>
          {availableParents(services, current).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active ? "" : " (inactivo)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Enlace específico del servicio (opcional)
        <input
          name="action_url"
          type="url"
          placeholder="https://…"
          maxLength={2048}
          defaultValue={current?.action_url ?? ""}
        />
      </label>
      <label>
        Texto del botón (opcional)
        <input
          name="action_label"
          maxLength={60}
          defaultValue={current?.action_label ?? ""}
        />
      </label>
      <p className="fine-print">
        Un agrupador mide preferencias y contiene otros registros. Solo los
        servicios individuales pueden elegirse en contactos y tener ficha de
        servicio.
      </p>
    </>
  );
}
