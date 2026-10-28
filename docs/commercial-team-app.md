# CONNECT · Equipo comercial

`/equipo` es una primera aplicación web instalable (PWA) para el personal comercial, con manifiesto propio y acceso mediante las mismas cuentas/membresías de Supabase. Su inicio instalado abre la jornada comercial y conserva el acceso al CRM. No es una aplicación publicada en App Store o Google Play.

Muestra hasta los últimos 100 contactos y 100 tareas pendientes del espacio seleccionado. Incluye búsqueda por nombre/correo/teléfono, filtro de etapa y asignación, acceso manual a WhatsApp/correo, cambio de etapa y próxima acción, asignación de tareas y cierre de tareas. Los enlaces de WhatsApp solo se crean para teléfonos con código internacional explícito; no se infiere un país. Nunca envía un mensaje por abrir una tarjeta. En demostración, guardar y enlaces de contacto externo quedan desactivados.

El ingreso desde la app vuelve a `/equipo`, con destino fijo permitido para evitar redirecciones externas. Las acciones siguen comprobando usuario, organización y políticas RLS. No se guarda información de contactos en caché del service worker ni se ofrece acceso sin conexión a datos personales.

## Bandeja compacta y voz local

Los avisos del dispositivo y la bandeja de notificaciones están cerrados por defecto. Se muestra un contador; el historial pendiente se despliega al abrirlo y tiene altura limitada. Hasta 30 avisos recientes por consulta. Las notificaciones de cada cuenta siguen siendo privadas para su destinatario.

El aviso de voz es opcional por dispositivo/organización. Se activa con un clic y usa la síntesis del navegador con texto fijo: «Existe un nuevo prospecto. Revisa tu aplicación CONNECT». No anuncia nombres ni datos del prospecto. El primer lote histórico no se reproduce; un lote nuevo de prospectos genera un solo aviso de voz, sin recitar todos los registros. Los eventos siguen verificándose cada minuto mientras CONNECT está abierto. Las alertas del sistema apuntan a la app comercial cuando se originan en la vista interna.

Esto **no llama por WhatsApp** y no envía audio al teléfono de otro usuario. No se ha conectado Web Push con la app cerrada. La disponibilidad de audio/instalación depende del navegador y las restricciones del dispositivo. Los recordatorios comerciales existentes continúan con su regla de una hora y rojo tras 24 horas sin avance.

## Llamada externa solicitada: integración pendiente

La llamada automática con audio requiere comprobar un proveedor que soporte llamadas empresariales de WhatsApp salientes, sus permisos de llamada, disponibilidad del país y restricciones del audio automatizado. No basta `wa.me`, ni se ha creado una cuenta o contratado un plan.

Antes de conectar un proveedor, definir destinatarios (persona asignada o encargado de respaldo), consentimiento para llamadas, horarios de trabajo, deduplicación por prospecto, reintentos limitados y entrega de fallos en la bandeja interna. Un mensaje de WhatsApp con plantilla y enlace o una llamada telefónica convencional con audio son alternativas distintas, que requieren elección del usuario antes de activarse. No hay envíos ni llamadas externas implementados en esta entrega.

Prueba operativa pendiente con cuentas reales: entrar como integrante, recibir un prospecto autorizado, asignarse la tarea, actualizar etapa, comprobar recordatorio y escuchar voz con la app abierta. La validación automatizada cubre la demostración y el aislamiento de datos de las políticas existentes; no sustituye esa prueba con una sesión administrativa real.

Destinatarios elegidos por el usuario: **todos los integrantes del equipo comercial**. La futura integración externa debe aplicar esta preferencia solo a integrantes comerciales habilitados y con permiso de llamada; no enviar a clientes ni reutilizar sus teléfonos como destinatarios internos. La voz local sigue siendo por dispositivo activado.
