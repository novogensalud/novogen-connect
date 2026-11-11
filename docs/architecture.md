# Decisiones del MVP

## Contexto y alcance

Stack Next.js + TypeScript + Supabase aprobado por el usuario. Monolito modular para un flujo comercial mínimo, sin microservicios ni infraestructura contratada. El trabajo amplía el núcleo aprobado hacia un MVP de FLASH, catálogo y CRM; Creator, ventas validadas y fidelización siguen pendientes.

## Capas

- Presentación: `app/crm/page.tsx`, `app/connect/[slug]/page.tsx`, `app/login/page.tsx`, estilos responsive compartidos.
- Aplicación: Server Actions en `app/actions.ts`. Validan entradas y sesión; autorizan membresía y rol antes de escritura.
- Dominio: tipos, etapas y esquemas Zod en `lib/domain.ts`.
- Persistencia: Supabase/PostgreSQL, migración en `supabase/migrations`. RLS y permisos de columnas protegen también las llamadas directas a PostgREST.
- Integración: `lib/supabase.ts` y `proxy.ts` gestionan sesión/cookies; rutas `/r/[code]` resuelven únicamente organizaciones publicadas. No aceptan destinos externos proporcionados por visitantes.
- Auditoría: triggers escriben actor, entidad, identificador, operación y fecha, sin duplicar contenidos personales en el log.

## Aislamiento

Cada recurso comercial tiene `organization_id`. Las referencias compuestas impiden asociar un servicio, punto u oportunidad con contactos de otra organización. Los clientes no pueden crear membresías, asignarse roles o trasladar registros entre organizaciones. La creación de organizaciones y asignación de miembros se reserva al operador autorizado de la base de datos.

`admin`: gestiona servicios y puntos, consulta contactos, actualiza oportunidades y consulta auditoría.
`agent`: consulta datos comerciales de su organización y actualiza oportunidades; no gestiona catálogo ni puntos.
`anon`: solo lee organizaciones publicadas y servicios activos, resuelve puntos públicos y envía solicitudes mediante RPC limitada. No puede enumerar contactos, oportunidades ni puntos.

No se utiliza service_role. Las funciones SECURITY DEFINER tienen search_path vacío, consultas calificadas, entradas acotadas y grants explícitos. Su uso público no habilita consultas arbitrarias. Las sesiones son verificadas por Supabase; no se confía en IDs de organización ni roles del formulario.

## Captura y trazabilidad

`capture_lead` valida organización publicada, servicio y punto de la misma organización, consentimiento y duplicación temporal. Crea contacto, oportunidad y evento en la misma transacción. Un bloqueo asesor serializa solicitudes para un mismo correo/organización. `resolve_point` registra `point_access` y devuelve el slug; no lo equipara a una conversión.

El consentimiento conserva versión y fecha. No se solicita texto libre al prospecto. La próxima acción administrativa debe ser exclusivamente comercial. La auditoría no guarda valores anteriores/posteriores; registra qué recurso se modificó y quién lo hizo.

## Validación y pendientes externos

Las pruebas de base usan PostgreSQL embebido y un Auth simulado. La prueba real de sesiones, refresco de cookies, relaciones PostgREST y RLS con cuentas Supabase queda pendiente hasta configurar un proyecto. No se presenta el modo demo como almacenamiento real.

Se recuperó la interfaz publicada en `published-connect/` y se reconstruyó una versión editable con sus logotipos, fuentes y estética azul en la ruta pública de Next.js. El crédito visible corresponde a SOLVEX. El catálogo y la solicitud comercial consumen las mismas fuentes que `/crm`. La copia compilada permanece como archivo histórico, sin reemplazar el sitio externo.

La RPC `create_commercial_contact` permite alta manual solo a miembros de la organización, comprueba consentimiento y servicio, previene duplicación temporal y crea la oportunidad atómicamente. No genera un evento de conversión pública.
