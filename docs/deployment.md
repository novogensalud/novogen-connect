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

## FLASH público — 28 de octubre de 2026

- URL pública verificada sin autenticación: https://novogen-connect.vercel.app
- Producción Ready: `dpl_2Y1rUFFFDj8znhi32DVw4XQC7zrf`, URL inmutable https://novogen-connect-9kjm0urd3-novogen1.vercel.app.
- La raíz redirige a `/connect/novogen/app`. El sitio estático original y el alias de pruebas permanecen separados.
- Se configuraron en Production las dos variables públicas de Supabase, copiadas desde el Preview existente mediante stdin; no se incluyeron claves en el código ni en esta documentación.
- Se aplicó la migración 005 a la base real y se habilitó `organizations.published=true` exclusivamente para NOVOGEN, id `a1420a11-a0af-455c-a162-491fc5a33a33`. El catálogo público contiene 19 registros activos.
- Se detectó en la prueba de producción que SQL `LIKE 'service_%'` también coincidía con el botón `services`. La migración 006 restringe el requisito de UUID a `service_info`, `service_contact` y `service_close`, manteniendo los controles de organización, servicio activo y límites de eventos. Se probó localmente y se aplicó en la base real.
- Verificado por navegador: portada, catálogo, RECOVERY Essential y navegación real hacia https://www.novogensalud.cl/reservar/ sin enviar formularios ni reservar.
- Verificado por consulta de la base: visitas, apertura de ficha por UUID y clic a agenda atribuido al servicio. Las métricas de prueba corresponden a interacciones reales del agente durante esta verificación, con aceptación de métricas.
- HTTP sin sesión: raíz → `/connect/novogen/app` → 200, `/api/health` → 200/configured-not-verified. La presencia de variables no se usa como sustituto de la verificación del catálogo real.
- La autenticación de Vercel CLI está disponible en una carpeta local de sesión fuera del repositorio; no copiarla ni subirla. La conexión adicional MCP quedó registrada, pero su autorización local expiró por timeout de callback y no se confirmó operativa.

## Jerarquía, orientación y YouTube — 28 de octubre de 2026

- Código de aplicación: commit `6b9c025`, rama local `feature/flash-crm-hierarchy`.
- Producción Ready: `dpl_FWCDXkrxtoNzPyJtuMzihKgtAAvB`, https://novogen-connect-6h8i2lmxk-novogen1.vercel.app.
- URL pública: https://novogen-connect.vercel.app. Alias habitual del CRM reasignado a la misma versión: https://novogen-connect-pruebas-novogen1.vercel.app.
- Migraciones 007 y 008 ejecutadas en Supabase. Catálogo actual: 4 agrupadores y 16 servicios individuales, conservando los UUID previos. Se añadió el agrupador Evaluación; los registros generales OPTIMIZA/RECOVERY/GLOW se clasificaron como preferencias en vez de servicios.
- Navegación: Evaluación, Interpretación, Bienestar y Seguimiento. Bienestar abre Productos, Recuperación y Piel. Los nombres comerciales aparecen dentro; el CRM muestra la etiqueta utilizada en FLASH.
- SUPLE es un servicio educativo, no un agrupador; mantiene un botón pequeño «Ver productos» a https://www.novogenstore.cl/. COMPRENDE es individual.
- YouTube se añadió al inicio con el mismo estilo circular de las redes, destino https://www.youtube.com/@novogensalud, campo editable en el CRM y evento propio consentido.
- Verificado en navegador real: raíz pública, etiquetas sencillas, SUPLE/Store, campo YouTube y enlace a la interfaz original desde el CRM. Verificado en PostgreSQL real: apertura de OPTIMIZA en preference_id sin service_id; apertura de SUPLE y Store en service_id sin preference_id; youtube_click/youtube guardado tras un clic de verificación.
- Validación: 35 comprobaciones unitarias/base de datos, ocho pruebas de navegador, TypeScript y compilación remota aprobados. Móviles probados a 320/360/390/430 px.
- Respaldo previo local: `backup/flash-publicado-2026-10-28` en `f477818`, archivo bundle e instantánea comercial de 19 registros. El despliegue anterior y un SQL de restauración revisable se conservaron; no se ejecutó la restauración. Las ramas no se subieron a GitHub desde esta sesión.
