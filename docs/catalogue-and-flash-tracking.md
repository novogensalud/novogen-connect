# Servicios individuales y seguimiento de CONNECT FLASH

## Catálogo recuperado

Fuente: archivos públicos del avance original conservados en `published-connect/`, JavaScript `index-BYM0Pqi2.js`. `lib/recovered-services.json` recoge únicamente identificador de origen, nombre, subcategoría y descripción comercial breve. No se importan precios, promociones ni datos de pacientes.

- RECOVERY: Essential, Advance y Premium.
- GLOW: Limpieza facial; Regeneración y calidad de la piel; Manchas y tono irregular; Ojeras y bolsas; Regeneración labial; Rojeces y apariencia vascular; Caída y fortalecimiento capilar.

Las diez fichas son servicios individuales de OPTIMIZA, con subcategoría RECOVERY o GLOW. Los registros generales de cada familia se conservan y las fichas individuales pueden seleccionarse al solicitar contacto. SEGUIMIENTO sigue separado. No se añaden variantes o tratamientos que no figuren como fichas individuales en esa fuente.

## Canales y botones

**Catálogo → Canales de CONNECT FLASH** permite al administrador editar sitio, agenda, Instagram, TikTok, WhatsApp y correo. Los agentes no pueden modificarlos; los cambios quedan auditados y limitados a su organización. El enlace de agenda recuperado es `https://www.novogensalud.cl/reservar/`. TikTok estaba vacío en el proyecto publicado: se muestra deshabilitado hasta configurar su URL real, sin inventar un perfil ni contar aperturas ficticias.

La analítica conserva `kind`, un `target` de una lista cerrada y el UUID del servicio cuando corresponde. No registra el texto de los botones, URL completas ni campos del formulario. Los canales sociales usan HTTPS y dominios de su proveedor, sin credenciales en la URL.

Controles medidos con aceptación de métricas: ORIÉNTAME, SERVICIOS, PROMOS, agenda, Instagram, TikTok configurado, WhatsApp, correo, sitio institucional, ficha de cada servicio, orientación de servicio, agenda desde ficha, cierre de ficha, clic en enviar solicitud, acceso al equipo/CRM, activar/pausar alertas e instalar CONNECT/cerrar instrucciones. También se capturan aperturas con botón central del mouse. La captura ocurre antes de la navegación o cambios del DOM.

Los controles de rechazo/desactivación de métricas no se registran. Las preferencias de privacidad prevalecen sobre la medición. Los canales vacíos y controles deshabilitados no generan eventos. Un clic en enviar no acredita que el formulario haya sido válido ni que se haya creado un contacto: el CORE registra por separado la solicitud comercial recibida.

El panel **Seguimiento y métricas** muestra contadores por canal, por botón y por servicio (ficha, orientación, agenda), dentro de los 1.000 eventos consentidos recientes de los últimos siete días. Los eventos históricos sin `target` conservan sus datos, pero no se les inventa un identificador de botón retrospectivo. Los clics no prueban reservas realizadas, instalaciones completadas, mensajes enviados o conversaciones recibidas.

## Activación

1. En una base que ya tenga 001–003, ejecutar una sola vez `supabase/migrations/202610270004_flash_catalogue_and_buttons.sql` en SQL Editor. No volver a ejecutar el instalador inicial ni el activador 003. Se amplía la restricción de eventos sin borrar los históricos, se crea la configuración de canales y se añaden las diez fichas faltantes.
2. Desplegar la rama `feature/connect-crm` y verificar el Preview antes de actualizar el alias fijo de pruebas.
3. Revisar los servicios en Catálogo y configurar la URL de TikTok en Canales. Sin esa URL, su botón permanecerá deshabilitado.
4. Para comprobar medición, usar la nueva interfaz `/connect/novogen` en el alias de pruebas, con el espacio publicado para la prueba y las métricas aceptadas. Abrir agenda o redes desde CONNECT sin realizar reservas ni enviar mensajes; abrir una ficha individual y revisar el desglose por botón y servicio.
5. Las versiones viejas del sitio estático y los enlaces a despliegues anteriores no se actualizan al cambiar el alias: deben usarse los accesos/QR que apunten al CONNECT actualizado. Esta integración no añade rastreo dentro de Instagram, TikTok, WhatsApp ni de la agenda externa.

La migración requiere el operador autorizado de Supabase. Tener el SQL en GitHub no significa que se haya ejecutado. La interfaz mantiene compatibilidad con el registro básico anterior hasta aplicarla; los canales nuevos y el desglose por botón necesitan la versión 004.
