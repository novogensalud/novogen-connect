# ORIÉNTAME documental en CONNECT

Integración con https://www.novogensalud.cl/?orientame_embed=1 . El plugin WordPress debe estar activo. Su API devuelve solo respuestas aprobadas con evidencia y vigencia.

El cliente abre una vista documental en iframe y ofrece un enlace alternativo. No requiere nombre, correo, teléfono, claves de IA ni consentimiento para enviar mensajes a un proveedor generativo. No se copian preguntas al CRM ni a WhatsApp. Los otros formularios comerciales mantienen sus permisos propios.

La ruta POST /api/orientame anterior se retira con HTTP 410. GET publica modo documental y URL de la vista. CONNECT_ORIENTAME_DOCUMENTAL=off desactiva la apertura documental; la tarjeta heredada puede seguir visible. No hay migraciones SQL nuevas ni cambios a datos de clientes.

Archivos principales: lib/app-access.ts, lib/original-connect.ts, lib/experience-runtime.js y su JSON generado, app/api/orientame/route.ts. Después de editar el runtime ejecutar node scripts/build-original-runtime.cjs.

Validación: node --import tsx --test --test-concurrency=1 tests/*.test.ts; npm run typecheck; npm run build. La prueba scripts/verify-orientame-documental.cjs usa Chrome headless aislado, WordPress público y una página de prueba local interceptada con el origen de CONNECT para verificar la política de marco. No usa sesiones ni perfiles del usuario. Si se ejecuta en un entorno aislado, necesita salida de red al WordPress público.

El marco admite scripts, formularios y apertura de enlaces en pestaña nueva, conserva aislamiento entre dominios y no permite navegación superior. La URL se fija en código; no se toma de mensajes ni parámetros del usuario. Solo se habilita para slug novogen. El hosting mantiene X-Frame-Options SAMEORIGIN y el endpoint aporta CSP frame-ancestors con el origen de CONNECT autorizado; en navegadores antiguos utilizar el enlace alternativo.

Aprobadas al 28 de octubre de 2026: ubicación, WhatsApp, correo, GLOW, RECOVERY, SUPLE y servicios generales; cuatro fuentes con vigencia hasta el 27 de noviembre de 2026. La base editorial se administra en WordPress; cambiar esas respuestas no requiere redesplegar CONNECT. Las nuevas fuentes importadas permanecen pendientes hasta aprobación institucional.

Rollback: restaurar los archivos anteriores y volver a desplegar. Desactivar mediante CONNECT_ORIENTAME_DOCUMENTAL=off no reactiva el endpoint generativo retirado. No configurar una API de IA para esta versión.

