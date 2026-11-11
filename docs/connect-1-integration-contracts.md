# NOVOGEN CONNECT 1.0 — contratos de integración

Estado: contratos y persistencia de XP y revisión de canjes en rama de desarrollo. AgendaLite tiene un receptor independiente. Las conexiones externas requieren configuración autorizada.

## Demostración de fidelización

Aplicar la migración `202610310011_connect_loyalty.sql` a una base de prueba y activar `CONNECT_LOYALTY_ENABLED=true` solo en ese entorno. Crear reglas, niveles, recompensas y revisores sintéticos con el propietario de la base. En el CRM, la sección Fidelización muestra el ranking trimestral y la cola de revisión para administradores. La revisión exige también una autorización explícita por organización. Ninguna regla ni recompensa se activa por defecto.

Las funciones de registro de XP y de solicitud de canje son internas y requieren un servidor que ya haya comprobado origen e identidad. El ranking usa trimestres y los últimos doce meses según la hora de Santiago. Snake y Bloques locales siguen siendo recreativos. La aprobación solo registra la decisión, dejando pendiente el débito y la entrega. No hay saldo financiero local ni se envía ninguna operación a FINANCE.

El trabajador futuro puede registrar confirmaciones verificadas mediante `confirm_connect_redemption_debit` y `complete_connect_redemption`. Ambas operaciones requieren credencial de servidor, conservan la referencia original y rechazan reintentos contradictorios. El débito debe estar registrado antes de cerrar la entrega. Los proveedores deben deduplicar sus operaciones externas usando `request_id`.

## Principios

- Reutilizar Next.js, Supabase, la interfaz recuperada, los juegos y el CRM existentes.
- No duplicar datos financieros, clínicos, pedidos ni reservas.
- `core_user_id` es la identidad de referencia futura; hasta CORE, utilizar una correspondencia verificada con el proveedor de autenticación existente. Nunca enlazar solo por correo, teléfono o RUT.
- `connect_points` del CRM representa puntos físicos de acceso QR/NFC, **no** NOVO Points.
- Cada evento externo necesita autenticación de servicio, verificación de origen y autorización de usuario. No aceptar confirmaciones de compra enviadas por el navegador.
- Cada operación debe ser idempotente y mantener referencias de origen.
- Las actividades de prueba locales de Snake y Bloques no otorgan puntos ni se migran a recompensas oficiales.

## Eventos v1

Campos: `event_id` UUID, `event_type`, `source`, `source_reference`, `core_user_id`, `occurred_at` ISO-8601, `schema_version=1`, `payload` validado por tipo.

Clave de idempotencia de negocio: `(source, event_type, source_reference)`. Las correcciones y devoluciones necesitan referencias propias y vínculo al evento original; no deben reutilizar el evento confirmado.

- SUPLE: `purchase.confirmed`, `purchase.refunded`; requiere pedido pagado, monto elegible validado y vinculación de identidad.
- AgendaLite: `booking.confirmed`, `booking.cancelled`; no otorga puntos automáticamente.
- ACADEMY: `education.completed`; requiere finalización verificable.
- CONNECT: `mission.completed`, `reward.redeem.requested`; requiere validación del servidor.
- CRM: `referral.verified`; verificación humana o regla antifraude.

## NOVO Points y XP

FINANCE es la única autoridad del saldo, lotes de vencimiento (12 meses), movimientos, ajustes, débitos y reversos de NOVO Points. CONNECT mantiene XP y resultados de juego verificados, separados del libro financiero. Cada actividad elegible solo genera una concesión, incluso si llega repetida.

## Canjes

Estados: `pending`, `approved`, `completed`, `rejected`, `failed`, `cancelled`.

1. CONNECT crea `pending`; no bloquea ni descuenta puntos.
2. Usuario con permiso específico en CRM aprueba; registrar aprobador y hora.
3. Backend solicita a FINANCE una transacción atómica idempotente, referenciada por `request_id`. FINANCE verifica saldo al aprobar y descuenta solo si alcanza.
4. Confirmado el débito, entregar recompensa una vez y marcar `completed`.
5. Si falla FINANCE, no entregar. Si falla la entrega tras débito, reintentar sin segundo débito y permitir reversión controlada.

Un estado `approved` no implica que FINANCE haya debitado. El backend debe verificar la respuesta y persistir `finance_operation_id` antes de habilitar la recompensa.

## Permisos

Reutilizar sesión y membresías del CRM. Añadir permisos específicos `connect.manage`, `connect.publish`, `connect.redeem.review`, `connect.redeem.approve`. No confiar en roles enviados por el cliente. Registrar aprobador y resultado; evitar que una persona apruebe su propio ajuste de puntos.

## Resiliencia

Reintentos limitados con backoff y cola de pendientes; nunca reintentar con un identificador de operación distinto. Sin conexión FINANCE, suspender canjes y concesiones, sin alterar saldo. Sin AgendaLite o SUPLE, mantener CONNECT y mostrar el fallo de esa función. Eventos sin usuario verificado quedan pendientes de atribución.

## Pendientes reales antes de activar

- Identificar endpoints, credenciales de servicio y mecanismos de autenticación disponibles de CORE, FINANCE, SUPLE, AgendaLite, ACADEMY y DATA.
- Aprobar reglas de XP, niveles, recompensas y permisos antes de configurarlos en la base.
- Conectar la identidad verificada y los adaptadores de eventos, débito y entrega con sus sistemas propietarios.
- Verificar pruebas `npm run typecheck`, `npm test`, `npm run build`, RLS con sesiones reales y casos de doble solicitud, devolución, reintento y fallo parcial.
- Preparar staging con secretos separados, migraciones reversibles, comprobación de salud y rollback. No desplegar producción con integraciones simuladas.
