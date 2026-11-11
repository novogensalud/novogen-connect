# Interfaz original para teléfono y sincronización

La ruta `/connect/novogen/app` conserva la interfaz recuperada y obtiene los canales y servicios activos del CRM en cada apertura, sin caché de respuesta. Reabrir o recargar recoge cambios del catálogo. En modo configurado exige que NOVOGEN esté publicado. Errores de catálogo/canales devuelven 503, sin sustituir datos reales por ejemplos. Otras organizaciones reciben 404.

## Catálogo

Los nombres, descripciones, altas y bajas se obtienen de `services`. Solo se muestran registros activos. Se usan UUID en las rutas nuevas. Las fichas originales de RECOVERY/GLOW se reconocen por los nombres recuperados y conservan sus paneles informativos e iconos; nombres y resumen provienen del CRM. Los paneles extensos todavía son contenido editorial de la referencia: no están almacenados en el CRM. Los servicios nuevos reciben la misma plantilla visual con su descripción oficial.

SEGUIMIENTO permanece independiente; SUPLE y COMPRENDE tienen sus grupos. Los servicios RECOVERY/GLOW mantienen su subcategoría. Al cambiar el nombre de un servicio recuperado a un nombre ajeno al catálogo original, se conserva su UUID pero se usa la ficha general, evitando asociar instrucciones antiguas a una prestación distinta.

No se muestran los precios y promociones estáticos de la referencia, porque el CRM actual no los administra. Se mantienen la pantalla de Promos y sus estados vacíos. Publicar promociones requiere un modelo y vigencias administrables.

## Medición

El usuario puede aceptar, rechazar y retirar las métricas con la opción Privacidad. La elección se comparte con el FLASH existente. Se registran visitas, fichas por UUID, agenda, WhatsApp, Instagram, TikTok configurado, sitio institucional, navegación y apertura/cierre de paneles. Captura antes de navegar hacia canales externos y detecta navegación de React Router. No captura texto libre, URLs completas, nombres, correos ni contenido clínico.

La atribución conserva el punto QR/NFC válido recibido como `?point=`. Un clic acredita únicamente la apertura del enlace; no acredita reserva, conversación ni venta. El modo demostración no envía eventos. El acceso directo a la agenda usa el canal configurado en CRM.

## Activación en el entorno real

1. Revisar/aplicar las migraciones pendientes hasta 004 y después `supabase/migrations/202610280005_original_mobile_targets.sql`, una sola vez. La 005 amplía los tres identificadores de botones; no borra eventos ni contactos.
2. Desplegar esta versión en un Preview del mismo proyecto Next.js con las variables de Supabase. No se incluyen credenciales en esta entrega.
3. Abrir `/connect/novogen/app` desde un teléfono. Publicar NOVOGEN y revisar los canales desde el CRM si el acceso responde 404. Un 503 requiere revisar la configuración o las migraciones, no habilita modo demo.
4. Aceptar métricas, abrir un servicio y Agenda y revisar el desglose del CRM. No hace falta reservar ni enviar un mensaje.

La ruta principal, QR y alias existentes no se sustituyen automáticamente. La nueva ruta sincroniza catálogo/canales y métricas; las consultas mediante formulario y las notificaciones del dispositivo siguen en el FLASH anterior. La copia `index.html` es una vista local con datos de demostración, no una sesión conectada a Supabase.

## Mantenimiento

La referencia compilada vive en `lib/connect-original.json`; el adaptador en `lib/original-connect.ts`. El código de métricas se mantiene en `lib/original-runtime.js`; tras editarlo ejecutar `node scripts/build-original-runtime.cjs`. El JSON generado evita que el bundler inserte referencias a funciones internas en el HTML.

## Validación

Se comprobaron los anchos 320, 360, 390 y 430 con Chrome real automatizado, las rutas/fichas, el enlace de agenda, la ausencia de desbordamiento horizontal y la aceptación/retirada de métricas. Pruebas unitarias comprueban sincronización, desactivados y escape de scripts. La compilación Windows puede ejecutarse con `node node_modules/next/dist/bin/next build --experimental-next-config-strip-types --webpack` para evitar el problema previo del cargador nativo de configuración.

Estado de esta entrega: 29 comprobaciones unitarias/base de datos y 5 pruebas de navegador aprobadas, además de TypeScript. La compilación final se detuvo por EPERM al crear directorios generados en Windows, aun con una carpeta de salida nueva. No se publicó ni se aplicó la migración a Supabase. La rama es local; el intento de push no pudo autenticarse en GitHub desde esta sesión.
