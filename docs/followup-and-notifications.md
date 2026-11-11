# Seguimiento, notificaciones y medición de CONNECT

## Alcance implementado

- Equipo: nueva oportunidad → tarea y aviso interno inmediato. Recordatorios recurrentes cada **1 hora** (regla inicial configurable), con deduplicación por tarea/usuario/ciclo. A las **24 horas sin avance** la tarea se muestra en rojo. El cambio de etapa reinicia el plazo; cerrar la oportunidad cancela su tarea. Posponer un aviso no reinicia el plazo rojo.
- Clientes: quienes envían una solicitud pueden consultar cambios en su estado comercial desde ese navegador durante 30 días. La consulta usa un comprobante aleatorio en cookie HttpOnly, almacenado como SHA-256 en Supabase. No se publican nombres, teléfonos, correos, servicios de interés ni datos clínicos en la respuesta de estado.
- Avisos del dispositivo: activación voluntaria. Se revisan actualizaciones cada minuto **mientras CONNECT está abierto**. El permiso puede pausarse desde la aplicación; el navegador conserva su propio control de permisos. No hay envío Web Push con la aplicación cerrada conectado todavía. iOS puede exigir instalar la aplicación en la pantalla de inicio.
- PWA: manifiesto, iconos y service worker propios. El worker no guarda páginas privadas ni datos del CRM en caché.
- Atención humana: el visitante puede elegir “Quiero hablar con una persona”; su tarea se prioriza y el equipo recibe un aviso. WhatsApp y correo siguen siendo canales operados por personas. El motor es de reglas, no un agente de IA que responda preguntas clínicas.
- Analítica propia, sin PostHog: página vista, ficha consultada, inicio del formulario y clics a WhatsApp, correo y sitio institucional. Los clics a WhatsApp solo se cuentan cuando se originan en los enlaces de CONNECT y la persona permite métricas. No prueban que WhatsApp se haya abierto correctamente o que se haya enviado/recibido un mensaje.
- Las métricas opcionales requieren aceptación y pueden desactivarse. Solo se admite un esquema de eventos acotado: UUID del evento/sesión temporal, organización, tipo y referencias a servicio/punto; no se capturan URL completa, texto libre, nombre, email, teléfono ni campos del formulario. No se usa identificación comercial ni replay de sesión.
- Las cifras del panel cubren hasta 1.000 eventos consentidos recientes de los últimos 7 días. No son personas únicas ni ventas. Los accesos QR/NFC siguen separados en el registro CORE.
- Catálogo: SEGUIMIENTO es categoría independiente. SUPLE, RECOVERY y GLOW pertenecen a OPTIMIZA. Solo se añaden fichas informativas; no se inventan precios, beneficios ni contenido clínico. La administración completa de planes de suscripción sigue pendiente.

## Activación de un proyecto existente

1. Para activar todo en un solo paso, ejecutar **una sola vez** `supabase/setup/03-activate-automation.sql` en SQL Editor, después de 001 y 002. Combina la migración 003 y la programación horaria en una transacción: si falla, no deja una activación parcial. Si se prefiere separar los pasos, usar primero la migración 003 y luego el archivo 04. No volver a ejecutar el instalador inicial sobre la base existente.
2. Si ya se aplicó la migración 003 por separado, ejecutar `supabase/setup/04-enable-hourly-reminders.sql` para registrar el job `connect-commercial-hourly` de pg_cron. El programador revisa cada minuto para respetar el vencimiento individual; cada tarea genera como máximo un aviso por usuario en cada ciclo de una hora. No significa que se envíe un recordatorio cada minuto. El panel además sincroniza al consultarlo. El nombre del job permite actualizar su programación sin duplicarlo.
3. El job ejecuta una función interna sin acceso para `anon` ni `authenticated`. Solo genera avisos internos y no necesita credenciales de proveedores. La activación de pg_cron requiere los permisos y soporte del Supabase remoto; no se considera activado por tener este archivo en GitHub.
4. Desplegar el código de `feature/connect-crm` y abrir **Seguimiento y métricas**. Sin la migración, esta vista informa que debe activarse y el resto del CRM sigue disponible.
5. Enviar un contacto ficticio por el formulario público con consentimiento. Comprobar tarea, aviso y comprobante privado. Elegir atención humana y verificar su indicador. Cambiar la etapa desde el CRM y volver al mismo navegador del cliente para ver el cambio.
6. Para una prueba rápida controlada, ajustar el vencimiento de una tarea ficticia desde SQL Editor y ejecutar `select public.run_due_commercial_reminders();`. No cambiar la regla real del negocio para probar. Revisar `cron.job_run_details` para confirmar ejecuciones reales del programador.
7. Para probar la analítica, permitir métricas en la portada y pulsar WhatsApp sin enviar ningún mensaje, abrir una ficha y comenzar el formulario. Comprobar los contadores. Rechazar o desactivar métricas debe detener esos eventos.

## Pendiente y límites operativos

- Falta ejecutar y comprobar la migración y el job en el proyecto remoto, con una cuenta administrativa de base de datos. La clave pública de la aplicación no puede aplicarlos.
- El permiso de notificaciones NO equivale a una suscripción de Web Push activa. Para alertas con la aplicación cerrada faltan el registro de suscripciones push, claves VAPID, entrega en servidor, reintentos y verificación en dispositivos reales. El worker actual maneja avisos locales; no simula entregas push.
- WhatsApp Business API y un proveedor de correo aún no están conectados. No se importan conversaciones, no se envían mensajes automáticos y no se contabilizan entregas o respuestas. La API requiere cuentas/accesos, consentimiento y plantillas aprobadas antes de activarla.
- El cliente sigue un único comprobante reciente por organización/navegador. No es un portal de todas sus suscripciones ni reemplaza una identidad de cliente autenticada. El comprobante expira a los 30 días; borrar las cookies elimina el acceso desde ese navegador.
- Los contactos anteriores se convierten en tareas al aplicar 003; su plazo se calcula desde la creación de la oportunidad, ya que antes no existía un historial de tareas.
- No se ha activado PostHog ni un modelo de IA. El seguimiento de solicitudes y la clasificación humana descritos funcionan con reglas explícitas.
