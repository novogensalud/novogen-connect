"use client";
import { useState } from "react";
import { FileUp, Download, BookOpen, Link2 } from "lucide-react";
import {
  parseSourceFile,
  type StoredOrientationSource,
} from "@/lib/orientame-sources";
import {
  importOrientationSources,
  reviewOrientationSource,
} from "@/app/actions";
export function OrientationSourceManager({
  org,
  sources,
  disabled,
}: {
  org: string;
  sources: StoredOrientationSource[];
  disabled: boolean;
}) {
  const [payload, setPayload] = useState(""),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<
      { key: string; title: string; type: string }[]
    >([]),
    [search, setSearch] = useState("");
  const statuses = {
    draft: "Pendiente de revisión",
    approved: "Revisada",
    archived: "Archivada",
  };
  async function select(file?: File) {
    setPayload("");
    setPreview([]);
    setError("");
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error("El archivo supera 2 MB");
      const bundle = parseSourceFile(await file.text(), file.name);
      setPayload(JSON.stringify(bundle));
      setPreview(bundle.sources);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "El archivo supera 2 MB"
          ? e.message
          : "Archivo no válido. Usa JSON de CONNECT, TXT o Markdown; revisa claves únicas, títulos y enlaces HTTPS.",
      );
    }
  }
  const inputs = <input type="hidden" name="org" value={org} />;
  return (
    <>
      <section className="panel source-import">
        <div>
          <span className="source-feature-icon">
            <FileUp size={22} />
          </span>
          <h2>Importar fuentes</h2>
          <p>
            JSON de CONNECT, TXT o Markdown · hasta 100 fuentes y 2 MB por
            archivo.
          </p>
        </div>
        <input
          aria-label="Archivo de fuentes"
          type="file"
          accept=".json,.txt,.md"
          disabled={disabled}
          onChange={(e) => void select(e.target.files?.[0])}
        />
        <a className="inline-link" href="/api/orientame/sources?template=1">
          Descargar plantilla JSON <Download size={14} />
        </a>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {!!preview.length && (
          <div className="source-preview">
            <strong>{preview.length} fuente(s) listas para importar</strong>
            <ul>
              {preview.map((s) => (
                <li key={s.key}>
                  {s.title} <small>· {s.key}</small>
                </li>
              ))}
            </ul>
            <p>
              Las claves existentes se actualizarán y volverán a revisión. El
              resto de la biblioteca se conserva.
            </p>
          </div>
        )}
        <form action={importOrientationSources}>
          {inputs}
          <input type="hidden" name="bundle" value={payload} />
          <button className="button primary" disabled={disabled || !payload}>
            Confirmar importación
          </button>
        </form>
      </section>
      <section className="panel form-panel">
        <h2>
          <Link2 size={19} /> Añadir documento o enlace
        </h2>
        <p>
          Guarda información comercial y fuentes de referencia, sin fichas de
          pacientes ni credenciales.
        </p>
        <form action={importOrientationSources} className="edit-form">
          {inputs}
          <label>
            Clave única
            <input
              name="key"
              required
              pattern="[a-z0-9][a-z0-9_-]{0,79}"
              maxLength={80}
              placeholder="servicios-recovery"
              disabled={disabled}
            />
          </label>
          <label>
            Título
            <input
              name="title"
              minLength={2}
              maxLength={160}
              required
              disabled={disabled}
            />
          </label>
          <label>
            Tipo
            <select name="type" disabled={disabled}>
              <option value="text">Documento de texto</option>
              <option value="url">Enlace HTTPS</option>
            </select>
          </label>
          <label>
            Enlace de referencia
            <input
              name="url"
              type="url"
              maxLength={2048}
              placeholder="https://…"
              disabled={disabled}
            />
          </label>
          <label className="full">
            Contenido o notas
            <textarea
              name="content"
              maxLength={20000}
              rows={6}
              placeholder="Para documentos, escribe al menos 5 caracteres. Los enlaces pueden incluir notas opcionales."
              disabled={disabled}
            />
          </label>
          <button className="button primary" disabled={disabled}>
            Guardar fuente para revisión
          </button>
        </form>
      </section>
      <section className="panel form-panel">
        <div className="source-library-heading">
          <div>
            <h2>
              <BookOpen size={19} /> Biblioteca de ORIÉNTAME
            </h2>
            <p>
              {sources.length} de 100 fuentes · privada para administradores
            </p>
          </div>
          <a
            className={`button ${disabled || !sources.length ? "source-disabled" : ""}`}
            aria-disabled={disabled || !sources.length}
            href={
              disabled || !sources.length
                ? undefined
                : `/api/orientame/sources?org=${encodeURIComponent(org)}`
            }
          >
            <Download size={16} /> Exportar JSON
          </a>
        </div>
        <label>
          Buscar fuentes
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Título o clave"
          />
        </label>
        <div className="source-library">
          {sources
            .filter((s) =>
              `${s.title} ${s.key}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((s) => (
              <article key={s.key}>
                <div className="source-row-heading">
                  <div>
                    <h3>{s.title}</h3>
                    <small>
                      {s.key} · {s.type === "url" ? "Enlace" : "Documento"}
                    </small>
                  </div>
                  <span className="service-tag">{statuses[s.status]}</span>
                </div>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-link source-url"
                  >
                    {s.url}
                  </a>
                )}
                <details>
                  <summary>Ver contenido y notas</summary>
                  <pre>{s.content || "Sin notas adicionales."}</pre>
                </details>
                <form action={reviewOrientationSource}>
                  {inputs}
                  <input type="hidden" name="key" value={s.key} />
                  <label>
                    Estado
                    <select
                      name="status"
                      defaultValue={s.status}
                      disabled={disabled}
                    >
                      <option value="draft">Pendiente de revisión</option>
                      <option value="approved">Revisada</option>
                      <option value="archived">Archivada</option>
                    </select>
                  </label>
                  <button className="small-button" disabled={disabled}>
                    Guardar estado
                  </button>
                </form>
              </article>
            ))}
        </div>
        {!sources.length && (
          <p className="empty-state">
            Importa un documento o añade un enlace para iniciar tu biblioteca.
          </p>
        )}
      </section>
    </>
  );
}
