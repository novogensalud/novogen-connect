# Agendalite → CONNECT — conector propio 0.1

Estado: código local preparado, desactivado. Migración preparada; no aplicada a producción. No se ha desplegado este cambio.

## Responsabilidades

| Sistema | Fuente de verdad | Estado de esta entrega |
| --- | --- | --- |
| Agendalite / WordPress | Reservas, fechas, servicios y profesionales de la agenda | Se conserva; lectura comercial mediante complemento propio |
| CONNECT | Relación comercial y consulta de reservas sincronizadas | Receptor firmado, persistencia transaccional y vista privada preparados |
| NOVOGEN OS | Atención realizada, ficha y consentimientos clínicos | Conexión pendiente; no se modificó su repositorio |
| EVOLUCIONA / WordPress | Contratos, personas, ciclos y beneficios | Base existente conservada; este conector no consume beneficios |
| Flow | Confirmación del cobro | Sin cambios en planes, credenciales o cobros |

Cal.com deja de ser la integración prevista. No se revocaron permisos previos ni se eliminaron cuentas/calendarios. La web pública conserva el enlace a /reservar/.

## Datos y consentimiento

El mensaje contiene exclusivamente la identificación de la reserva, servicio y título del catálogo, identificador de agenda/profesional, inicio y término UTC, estado, nombre del contacto registrado al reservar, correo y teléfono. El receptor presenta fechas en America/Santiago.

No se envían RUT, diagnósticos, resultados, notas, formularios clínicos, archivos, mensajes libres, tokens de gestión, claves ni snapshots completos de Agendalite. Los campos adicionales se rechazan.

Una reserva no acredita consentimiento promocional. Los registros importados utilizan purpose=reservation_management y marketing_consent=NULL. No se crean leads/opportunities ni tareas publicitarias como efecto secundario. Las reservas aparecen en la vista privada Reservas del CRM, accesible solo a miembros de la organización.

contact.reference se deriva de booking:ID. Un correo compartido no identifica a un paciente ni acredita parentesco o representación. La vinculación a un contacto comercial existente debe basarse en una referencia verificada; no se fusionan personas automáticamente por correo. El registro es el contacto de la reserva, no una ficha de paciente.

## Componentes

| Archivo | Función |
| --- | --- |
| lib/agendalite-integration.ts | Contrato estricto, límite de 8 KiB y verificación HMAC del cuerpo exacto |
| app/api/integrations/agendalite/route.ts | POST privado entre servidores; apagado por defecto |
| supabase/migrations/202610310010_agendalite_commercial_bookings.sql | Tres tablas, RLS y funciones limitadas a la organización |
| components/booking-inbox.tsx | Vista comercial privada de las últimas 100 reservas por fecha |
| app/crm/page.tsx | Acceso Reservas, visible únicamente cuando se habilita la integración |
| tests/agendalite-integration.test.ts | Autenticación, privacidad, orden, duplicados, separación organizacional y rollback |

El complemento WordPress preparado en el repositorio web es plugin/novogen-agenda-bridge/. Es código propio; no modifica Agendalite ni habilita características sujetas a licencia Pro.

## Transporte y consistencia

POST /api/integrations/agendalite

Cabeceras: Content-Type: application/json, X-Novogen-Timestamp: segundos Unix, X-Novogen-Signature: sha256=HMAC_HEX.

Firma: HMAC-SHA256(timestamp + "." + cuerpo_JSON_exacto, clave_compartida). Ventana de transporte: 300 segundos. Un reintento conserva cuerpo, event_id y revision; renueva únicamente timestamp y firma.

La clave es específica de esta integración y organización. No utiliza la clave de Flow, una sesión de personal ni la clave general service_role de Supabase. En la base se almacena únicamente SHA-256 de la clave; la función de configuración exige administrador de la misma organización.

La función de importación procesa recibo, reserva y auditoría en una transacción. Serializa por organización y reserva mediante bloqueo transaccional. El identificador de evento evita reprocesar un envío; una revisión anterior queda registrada como ignored y no retrocede la cita. Un mismo identificador con distinto contenido o una revisión igual con datos distintos genera conflicto.

El emisor WordPress conserva una cola con revisión monotónica por reserva y adquisición temporal por trabajador. Una caída tras recibir el mensaje produce un reintento con el mismo evento. El receptor responde duplicate, evitando otra reserva. Solo una confirmación explícita accepted/duplicate/ignored permite marcarlo enviado.

No se cambia una reserva desde CONNECT. La agenda sigue siendo el origen. Un estado confirmed corresponde a reserva confirmada, no a atención realizada, venta validada o mensualidad pagada.

## Configuración posterior, sin claves en el código

CONNECT, variables solo del servidor:

- CONNECT_AGENDALITE_ENABLED: ausente o false hasta superar la revisión.
- CONNECT_AGENDALITE_SECRET: clave aleatoria dedicada, generada con al menos 32 bytes de entropía, codificada como texto.
- CONNECT_AGENDALITE_ORGANIZATION: novogen.
- Se reutilizan las dos variables públicas existentes de Supabase.

WordPress, constantes protegidas fuera del complemento:

- NOVOGEN_AGENDA_BRIDGE_ENABLED: false inicialmente.
- NOVOGEN_CONNECT_INGEST_URL: https://novogen-connect.vercel.app/api/integrations/agendalite, después de desplegar y verificar el receptor.
- NOVOGEN_CONNECT_INTEGRATION_SECRET: la misma clave dedicada.
- NOVOGEN_AGENDA_BRIDGE_FROM_UTC: fecha de atención mínima aprobada, formato ISO UTC terminado en Z.

No hay una fecha automática que exporte todo el historial. Una reserva ya sincronizada sigue recibiendo cambios aunque sea reagendada antes de la fecha de inicio aprobada.

## Secuencia de activación

1. Revisar y autorizar el complemento, la migración y el entorno de pruebas.
2. Instalarlo con sincronización apagada. Su activación crea únicamente las dos tablas propias de cola/espejo; no modifica tablas de Agendalite.
3. Probar sobre MySQL las transacciones, competencia entre trabajadores, reinicios y continuidad del emisor. Esta comprobación aún no se ha ejecutado.
4. Aplicar la migración de CONNECT en una base de pruebas; comprobar RLS y versiones de esquema. No se presupone que la base real tenga aplicada la migración 009.
5. Desplegar el receptor desactivado, sin mezclar cambios de otras tareas del repositorio.
6. Confirmar organización y dominio receptor, fecha inicial, finalidad, personas autorizadas, conservación de datos comerciales y tratamiento de menores.
7. Autorizar expresamente el acceso persistente y guardar la clave dedicada de forma protegida; provisionar solo su hash mediante configure_agendalite_integration.
8. Habilitar el receptor de pruebas y probar reserva, modificación, cancelación, expiración, duplicado, envío fuera de orden y caída de red con datos ficticios.
9. Comparar la agenda original y el CRM, validar que no se envían datos clínicos ni se consumen beneficios.
10. Autorizar la puesta en producción y una primera sincronización acotada. Acordar monitoreo y conciliación.

La instalación del complemento no autoriza por sí sola a empezar a transferir datos.

## Límites operativos pendientes

- La licencia Pro actual figura inválida; no bloquea el conector propio, pero sí las funciones nativas Pro de Google Calendar y varios profesionales por servicio.
- Compatibilidad auditada: Agendalite 1.0.0 y campos observados en su código instalado. El emisor se detiene ante otra versión hasta revisar compatibilidad.
- La lectura SQL comercial usa únicamente columnas verificadas y no descifra ni lee los campos clínicos cifrados del proveedor.
- La conciliación usa una pasada de cambios recientes con solapamiento de dos días y una pasada completa con cursor por ID; no depende de un timestamp local como revisión única.
- WP-Cron depende del tráfico. Debe verificarse su ejecución real y acordar un cron del servidor si se necesita un intervalo garantizado.
- Las cancelaciones y eliminaciones lógicas conservan historial. Los borrados físicos o solicitudes de supresión requieren un procedimiento de conciliación/privacidad; no se infieren eliminaciones por ausencia en una página.
- Los envíos bloqueados se conservan para revisión. Falta una herramienta operativa de reintento y una política aprobada de retención de envíos pendientes.
- Al confirmarse la recepción se elimina el cuerpo con contactos de la cola; permanece el registro técnico del envío.
- El mapeo TM/Enfermería hacia usuarios de OS, sus permisos y el flujo de representación de menores se verifican antes de conectar la ficha clínica.
- La recepción de una reserva no habilita RECOVERY; la atención realizada debe proceder de un profesional autorizado en OS y de un control incluido del ciclo.

## Pruebas

Las pruebas locales no envían correos, no reservan horas, no cobran ni usan datos reales de pacientes. PostgreSQL se prueba con PGlite. PHP se prueba con el runtime existente PHP-WASM 8.3. La comprobación cruzada PHP → TypeScript verifica fechas UTC, campos permitidos y firma sobre el mismo mensaje.

Pendiente antes de habilitar: MySQL/InnoDB real para la cola WordPress, comportamiento real de WP-Cron, prueba completa sobre entorno aislado, revisión de privacidad y conciliación con datos ficticios.

## Alternativa si no se obtiene licencia

Una agenda propia es un desarrollo separado del conector: disponibilidad por profesional, capacidad y bloqueos, exclusiones de servicios, cinco bloques diarios de 90 minutos, reserva transaccional contra dobles cupos, autogestión, notificaciones, Google Calendar y controles de acceso.

Puede reutilizar la visual y los puntos de entrada actuales. Debe comparar alternativas dentro de la arquitectura existente y probar la transición sin duplicar la agenda activa. No se ha implementado ni desplegado una agenda nueva en esta entrega.
