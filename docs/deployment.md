# CONNECT en Vercel

Arquitectura aprobada: Next.js en Vercel, datos/autenticación en Supabase y WordPress institucional en Hostnauta. El primer despliegue debe ser una versión de prueba, sin cambiar DNS ni reemplazar el sitio existente.

## Código

Repositorio `novogensalud/novogen-connect`, rama `feature/connect-crm`. Seleccionar esta rama: `main` todavía no contiene el MVP. Directorio raíz: la raíz del repositorio, no `published-connect`. Framework: Next.js. Instalación: `npm ci --include=dev`. Compilación: `npm run build`. Usar Node.js 24.x en los ajustes del proyecto.

`vercel.json` declara los comandos; `.vercelignore` excluye el snapshot histórico y archivos locales cuando se sube mediante CLI. No usar exportación estática: la autenticación, Server Actions y el CRM requieren servidor.

## Variables de Vercel

Configurar para Preview y, cuando se decida publicar, Production:

- `NEXT_PUBLIC_SUPABASE_URL`: `https://dfilxqvbwjsvvhpowecn.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: la clave pública Publishable/anon del proyecto, mediante variables del proveedor. Nunca secret ni service_role.

Las variables configuradas en el entorno de desarrollo no se transfieren automáticamente a Vercel. No copiar credenciales a `vercel.json` ni al repositorio. `NODE_USE_ENV_PROXY` pertenece al entorno cloud de desarrollo y no hace falta trasladarlo a Vercel.

## Alta y despliegue

Se requiere una cuenta Vercel autorizada. No contratar planes ni servicios pagos durante esta preparación. Conectar GitHub y dar acceso a este repositorio si se usa la importación Git; o autenticar Vercel CLI y desplegar desde el checkout de la rama indicada.

En una importación Git, revisar explícitamente la rama antes de desplegar. Si Vercel selecciona `main` y no permite cambiarla en el asistente, configurar la rama de producción en los ajustes Git antes de promover ningún despliegue; también se puede crear un Preview de `feature/connect-crm` desde un enlace Git o CLI. No sobrescribir ni fusionar ramas para evitar ese paso.

## Verificación posterior

1. `/api/health`: status `ok` y storage `configured-not-verified` indica presencia de configuración, no valida las tablas.
2. `/login`: carga el formulario. `/crm` sin sesión debe redirigir al ingreso.
3. Iniciar sesión con la cuenta de la aplicación y comprobar la membresía NOVOGEN/admin.
4. Revisar catálogo, crear un contacto comercial autorizado, comprobar su oportunidad y actualizar su etapa.
5. Verificar que no puede leerse información ajena con otra organización/cuenta.
6. El piloto NOVOGEN continúa sin publicar hasta revisar el contenido. Su portada pública puede responder 404 mientras `organizations.published=false`; esto no impide ingresar al CRM.
7. Tras la revisión, habilitar el espacio deliberadamente y probar punto QR → solicitud → contacto/oportunidad, distinguiendo accesos de ventas.

Registrar la URL que Vercel entregue; no inventar una URL ni confundir el anterior sitio estático con el nuevo despliegue. No se considera validado el acceso administrativo hasta que una sesión real complete el recorrido.

## Primer Preview verificado — 27 de octubre de 2026

- Equipo Vercel: `novogen1` (NOVOGEN), plan Hobby.
- Proyecto: `novogen-connect`.
- Preview: https://novogen-connect-6ui94yj20-novogen1.vercel.app
- Ingreso: https://novogen-connect-6ui94yj20-novogen1.vercel.app/login
- ID del despliegue: `dpl_BgV9hi5Rruvtm2DRP8ieYDExSAQe`; estado Ready, target Preview.
- Ambas variables públicas de Supabase se configuraron en Preview mediante la CLI, sin copiarlas al repositorio. No están configuradas en Production.
- Verificación remota mediante el acceso de automatización oficial de Vercel: `/api/health` devolvió 200 con `configured-not-verified`; `/login` devolvió 200 con el formulario; `/crm` sin sesión devolvió 307 a `/login`.
- `/connect/novogen` devolvió 404 porque el espacio NOVOGEN todavía no está publicado. Se debe revisar el catálogo dentro del CRM antes de habilitarlo.
- Se mantiene la protección de acceso de Vercel. El propietario debe ingresar a Vercel si se le solicita y luego usar la cuenta de aplicación de Supabase en el formulario del CRM.
- Falta verificar el ingreso administrativo con la cuenta real y el recorrido autenticado de contactos; requiere que el propietario ingrese su contraseña personalmente.
- Vercel asignó automáticamente a Production el primer despliegue de un proyecto vacío. Ese despliegue inicial se retiró después de verificar el Preview, para no conservar una versión sin las variables correctas.
- No se modificaron DNS, WordPress ni el sitio estático anterior. La integración Git con despliegues automáticos todavía no se conectó; este Preview se subió mediante CLI.
- `.vercel/` y `.env.local` creados por la CLI son archivos locales ignorados; no deben versionarse ni imprimirse, y la autenticación CLI no se debe asumir disponible en otra máquina.

## Preview de seguimiento y métricas — 27 de octubre de 2026

- Código funcional desplegado: commit `5d51ccc` de `feature/connect-crm`.
- Despliegue Ready, Preview: `dpl_2xuXF5RMTrrDpRmT61fkA5DJX6q8`.
- URL inmutable: https://novogen-connect-bl18kouac-novogen1.vercel.app
- Alias estable de pruebas: https://novogen-connect-pruebas-novogen1.vercel.app
- Ingreso recomendado: https://novogen-connect-pruebas-novogen1.vercel.app/login
- En siguientes actualizaciones de prueba, reasignar el alias con `vercel alias set <preview-verificado> novogen-connect-pruebas-novogen1.vercel.app --scope novogen1`, después de verificar el Preview. Mantener este origen evita perder sesiones y comprobantes de clientes por cambiar de hostname en cada versión.
- Verificación remota con la protección de Vercel: health 200/configured; login 200; CRM sin sesión 307 a login; notificaciones internas sin sesión 401; estado de cliente sin comprobante sin datos; manifiesto PWA 200. El formulario de ingreso también se verificó en el alias estable.
- El operador informó la ejecución satisfactoria del activador 003 con `connect-commercial-hourly`, schedule `* * * * *`, active true. Se comprobó desde la aplicación la existencia/protección de tablas nuevas y la columna de subcategorías. El historial real de ejecuciones de cron requiere revisión desde SQL Editor; no es accesible con la clave pública.
- Regla comercial: recordatorio cada 60 minutos, resaltado rojo tras 24 horas sin avance. El job revisa cada minuto y deduplica por usuario/tarea/ciclo; no envía avisos cada minuto.
- Web Push con la app cerrada y mensajería automática de WhatsApp/correo continúan pendientes. La protección de acceso de Vercel sigue activa para esta versión de prueba.

## Preview de catálogo individual y controles FLASH — 28 de octubre de 2026

- Código desplegado: `c84f3ab`, rama `feature/connect-crm`.
- Preview Ready: `dpl_H4hbR3NSCY7YppwVJ27YRzYqBxda`.
- URL inmutable: https://novogen-connect-3o8g864gx-novogen1.vercel.app
- Alias de pruebas actualizado: https://novogen-connect-pruebas-novogen1.vercel.app
- Verificación remota: health 200, formulario de login 200 y CRM sin sesión 307 hacia login.
- Validación local: 26 pruebas y 8 pruebas de navegador aprobadas; build aprobado.
- Pendiente ejecutar una sola vez `supabase/migrations/202610270004_flash_catalogue_and_buttons.sql` en el SQL Editor del proyecto existente. La comprobación pública encontró la tabla public_channels ausente y la columna target ausente; no se afirma que el catálogo ni las nuevas métricas estén activados en la base real. No volver a ejecutar el instalador inicial.
- Esta migración agrega tres servicios individuales RECOVERY, siete GLOW y canales configurables, sin precios inventados ni eliminación de registros. Sustituye la restricción de tipos de interacción para admitir los nuevos eventos.
- TikTok sigue vacío porque la fuente original no contiene URL; el administrador puede configurarlo en Catálogo → Canales de CONNECT FLASH después de aplicar la migración.
- Las métricas cuentan clics consentidos en el nuevo FLASH, no reservas o mensajes efectivamente completados. No se modificó el sitio estático anterior ni la publicación del espacio.

## Dashboard por origen preparado — 28 de octubre de 2026

- Código: `629ed60`, guardado en `feature/connect-crm`.
- Interfaz con filtros FLASH/web, períodos de 7/14/30 días calendario Chile, actividad diaria, sesiones por canal, destinos, servicios y actualización cada minuto.
- Validación: 30 pruebas de lógica/base de datos aprobadas; los 10 recorridos de navegador pasaron (la comprobación antigua de WhatsApp se actualizó al nuevo texto y se volvió a ejecutar). Build aprobado; revisión visual local de escritorio y móvil, sin datos de clientes.
- No desplegado todavía: la CLI encontró la sesión Vercel caducada. La autorización interactiva está pendiente; no se movió el alias ni se afirma que la nueva interfaz esté publicada.
- Activación de base existente: migración `202610280005_metrics_sources.sql`, una sola vez después de 004. El origen FLASH se conserva para todos los eventos históricos, porque el único colector anterior era FLASH.
- WordPress no fue modificado: script e instrucciones en `docs/analytics-sources.md`, con consentimiento explícito y dominio permitido. El Preview protegido no permite recibir seguimiento externo de producción; requiere un origen público aprobado.

## Dashboard por origen desplegado — 28 de octubre de 2026

- La autorización Vercel se completó; CLI reconoció la cuenta NOVOGEN sin solicitar otro código.
- Código funcional `629ed60`, con documentación `fd46165`, rama `feature/connect-crm`.
- Preview Ready: `dpl_4tD8197rqzRbF1tP8zXu3P4HUztU`.
- URL inmutable: https://novogen-connect-7lzoxoja8-novogen1.vercel.app
- Alias estable actualizado tras verificar el Preview: https://novogen-connect-pruebas-novogen1.vercel.app
- Comprobación remota mediante acceso oficial Vercel: health 200, login 200 con formulario real, CRM sin sesión 307 a login y script WordPress 200. Se mantiene protección Vercel y autenticación Supabase.
- La base real todavía responde 42703 al consultar la columna source: migración 005 pendiente. La interfaz conserva compatibilidad con métricas FLASH anteriores e informa la activación pendiente.
- No se instalaron scripts en WordPress, no se publicaron datos ni se desactivó protección del Preview. El seguimiento externo requiere instalar el colector en un origen público aprobado y vincular consentimiento.

## App comercial y cookies de analítica — 28 de octubre de 2026

- Código funcional `891bfc5` (app de equipo) y `98dda56` (integración Complianz), rama `feature/connect-crm`.
- Preview Ready: `dpl_6VuMkjkKtxtzfoYLycyYKQgkCJF2`.
- URL inmutable: https://novogen-connect-hcgmu4lww-novogen1.vercel.app
- Alias estable actualizado después de comprobar el Preview: https://novogen-connect-pruebas-novogen1.vercel.app
- Entrada al equipo: `/equipo`; autenticación Supabase y protección Vercel conservadas. La sesión expirada redirige a `/login?next=equipo`; el destino posterior al ingreso es fijo.
- Comprobaciones remotas oficiales: health 200; ingreso comercial 200 con campo next=equipo; equipo sin sesión 307 al ingreso; manifiesto comercial 200 con start_url=/equipo; script de cookies 200 con validación de Estadísticas y eventos Complianz.
- Validación local: 34 pruebas de lógica/base de datos aprobadas, 12 recorridos de navegador aprobados entre la ejecución completa y la repetición focalizada tras corregir la ruta del manifiesto. Build aprobado. Revisión visual de la vista móvil comercial.
- Sin nueva migración. El usuario informó éxito de 005 y se comprobó la existencia de su función con rechazo de una organización inválida; las lecturas públicas de métricas siguen protegidas.
- Notificaciones plegadas y voz local opcional, solo con app abierta; no llamadas ni mensajes externos. Destinatarios elegidos para una futura integración: todos los integrantes del equipo comercial.
- Complemento de WordPress preparado en `integrations/wordpress/novogen-connect-cookies.zip`; requiere Complianz, configuración opt-in y origen de colector público aprobado. No instalado en WordPress; no se alteró su sitio ni se desactivó la protección Vercel.
- La instalación real en WordPress, la prueba autenticada con prospectos reales, Web Push y el proveedor de llamadas WhatsApp permanecen pendientes. No se contrataron servicios ni se enviaron llamadas.

## Cinco cupos configurables — 28 de octubre de 2026

- Código `b3ac42b`, rama `feature/connect-crm`.
- Preview Ready: `dpl_HBPTUf79hfSzUL11PjtyYduJW3Zj`, https://novogen-connect-ju234u0he-novogen1.vercel.app
- Alias estable actualizado después de comprobar health 200 y acceso a `/crm/accesos` sin sesión 307 al ingreso.
- Pantalla administrativa `/crm/accesos`: cinco cupos iniciales, ampliación hasta 100, conservación de cuentas vinculadas y roles previstos para los cupos pendientes. No crea buzones ni cuentas Auth ni concede membresías por reservar un cupo.
- Validación: 35 pruebas de lógica/base de datos, build y dos recorridos de navegador enfocados en cupos/app comercial aprobados.
- Pendiente activar una sola vez `202610280006_team_seats.sql`; las migraciones anteriores no deben repetirse. Antes de activarla la configuración se presenta deshabilitada con aviso.
- Gmail no está disponible como conector; no se leyó el buzón ni se crearon correos. No se contrató Twilio.

## Fuentes de ORIÉNTAME — 28 de octubre de 2026 (Chile)

- Código funcional `b0f4f56`, rama `feature/connect-crm`.
- Preview Ready `dpl_GKBF2w77LLSY8PYBxbPd7jLmJpMF`: https://novogen-connect-fscgyv9h2-novogen1.vercel.app
- Alias estable actualizado después de verificar el Preview: https://novogen-connect-pruebas-novogen1.vercel.app
- Entrada administrativa `/crm/orientame`, enlazada desde el CRM. Importación JSON/TXT/Markdown, referencias HTTPS, previsualización, revisión y exportación privada JSON.
- Validación local: 37 pruebas de lógica/base de datos aprobadas, build y tres recorridos seleccionados de navegador aprobados.
- Verificación remota oficial: página sin sesión 307 a login, exportación privada sin sesión 401, plantilla genérica 200 con descarga y health 200.
- La base real respondió 404/PGRST205 para orientame_sources: activar una sola vez `202610290007_orientame_sources.sql`; no repetir migraciones anteriores. Hasta entonces no se afirma que las fuentes estén almacenadas.
- No se activa un agente ni respuestas automáticas, ni se publica la biblioteca en FLASH. Los enlaces no se descargan automáticamente. No se cambiaron Gmail, WordPress, Twilio ni el acceso del personal.

## Enlace al ORIÉNTAME existente — 29 de octubre de 2026 (Chile)

- El propietario identificó la app operativa https://novogen-connect.vercel.app/connect/novogen/app . Se inspeccionó su HTML público y el widget WordPress sin enviar consultas ni alterar el motor.
- Motor encontrado: complemento `orientame`, widget publicado v0.4.0, embed https://www.novogensalud.cl/?orientame_embed=1 y consulta POST /wp-json/orientame/v1/query. El índice REST público no anuncia administración de fuentes.
- Código `5abf736`, Preview Ready `dpl_2QcTZpyXiEDDvxiaXawzFBEatGHY`: https://novogen-connect-rd7c8a3nd-novogen1.vercel.app
- Alias estable actualizado después de verificar health 200, biblioteca privada sin sesión 307 y FLASH 200 con destino correcto a la app existente. No se modificó el dominio de producción novogen-connect.vercel.app ni WordPress.
- Build, typecheck y cuatro recorridos de navegador focalizados aprobados. El enlace conserva la medición consentida orientame y abre en otra pestaña.
- El CRM informa explícitamente que sus fuentes aún no están sincronizadas con el complemento. El enlace al motor NOVOGEN solo se muestra para ese espacio; no se reutiliza en otras organizaciones.
- Para implementar sincronización se necesita el código del complemento o un contrato/exportación administrativa real, conservando vigencia, ubicación y fecha de revisión. No se afirma compatibilidad automática del JSON del CRM con el formato del motor. No hay conexión administrativa WordPress o control de navegador disponible en estas herramientas.
- Este ajuste no agrega migraciones ni requiere repetir SQL. La biblioteca import/export continúa dependiendo de la migración 007 ya entregada.
