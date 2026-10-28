# Activación de accesos de NOVOGEN CONNECT

Estado revisado el 28 de octubre de 2026. No guardar contraseñas, tokens o claves de proveedores en este documento ni en el repositorio.

## Vercel y CONNECT

La CLI reconoce la cuenta NOVOGEN del equipo `novogen1`; no hace falta repetir autorización de dispositivo mientras la sesión siga activa. El proyecto y el Preview están desplegados. La protección de Vercel se conserva y es independiente del ingreso de aplicación mediante Supabase.

- CRM: https://novogen-connect-pruebas-novogen1.vercel.app/crm
- App comercial: https://novogen-connect-pruebas-novogen1.vercel.app/equipo
- Supabase: https://supabase.com/dashboard/project/dfilxqvbwjsvvhpowecn

Las migraciones 001–005 ya se activaron según la confirmación del propietario y las comprobaciones disponibles con la clave pública. No volver a ejecutarlas para crear usuarios. La clave pública no permite invitar cuentas ni administrar el proyecto.

Para cada integrante hace falta definir nombre, correo y rol. `agent` permite trabajo comercial y `admin` permite además editar catálogo/configuración. El alta requiere crear o invitar la cuenta Auth desde el proyecto Supabase y añadir la membresía de la organización NOVOGEN (`a1420a11-a0af-455c-a162-491fc5a33a33`) mediante un operador autorizado. No basta crear una cuenta Auth: sin membresía no obtiene acceso. Verificar después el ingreso con una cuenta de agente y que no pueda administrar catálogo ni acceder a otra organización. No pedir ni compartir las contraseñas del personal.

## WordPress

- Entrada administrativa: https://www.novogensalud.cl/wp-admin/
- Complianz oficial: https://wordpress.org/plugins/complianz-gdpr/
- ZIP de integración: https://github.com/novogensalud/novogen-connect/raw/refs/heads/feature/connect-crm/integrations/wordpress/novogen-connect-cookies.zip

No hay un conector WordPress ni control del navegador disponible en este entorno. Una sesión que el propietario abra en otra pestaña no transfiere permisos a la CLI. Se requiere intervención de un administrador desde el panel o una conexión administrativa compatible antes de afirmar que se instaló algo.

Desde WordPress: revisar primero si ya hay gestor de consentimiento; instalar Complianz si no existe otro; configurar consentimiento previo para Estadísticas; subir el ZIP desde Plugins → Añadir nuevo → Subir plugin. El complemento de integración se entrega sin origen configurado y no envía eventos en ese estado. No poner el Preview protegido como origen de analítica de producción. Habilitar el colector público antes de completar Ajustes → CONNECT · Cookies. No se desactivó protección de Vercel.

## WhatsApp y llamadas

- Registro Twilio: https://www.twilio.com/try-twilio
- Consola: https://console.twilio.com/
- Documentación comprobada: https://www.twilio.com/docs/voice/whatsapp-business-calling

Pendiente confirmar si NOVOGEN ya tiene cuenta o necesita una nueva. El acceso a una cuenta no equivale a tener un remitente WhatsApp habilitado para voz. Antes de envíos reales se necesita número empresarial habilitado, disponibilidad del número/país, credenciales de integración guardadas en variables privadas y un origen público para callbacks verificados.

Destinatarios solicitados: todos los integrantes comerciales habilitados. Cada uno debe autorizar llamadas; las restricciones de WhatsApp incluyen un máximo de cinco llamadas por destinatario en 24 horas con permiso. No convertir los recordatorios horarios en llamadas horarias. No se creó ninguna cuenta, contrató un plan, envió un mensaje o cambió el número WhatsApp actual.
