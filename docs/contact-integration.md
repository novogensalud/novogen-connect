# Integración comercial de CONNECT

Publicado el 28 de octubre de 2026. FLASH conserva la interfaz original y permite solicitar orientación desde cada ficha individual. /api/contact registra el contacto, la oportunidad y la tarea de seguimiento en el CRM mediante capture_connect_request. Mantiene el servicio concreto y el punto QR/NFC cuando existe; excluye los agrupadores del selector y de las prestaciones solicitables.

El formulario exige consentimiento, no guarda datos personales en el navegador y confirma recepción únicamente después de guardarse en el servidor. Un reenvío durante una hora muestra un aviso en lugar de duplicar el contacto. Agenda abre la página de reservas web; no se interpreta un clic como reserva o venta.

GET /api/catalogue?slug=novogen ofrece exclusivamente el catálogo comercial publicado y sus canales. La web lo consume sin claves privadas. Los enlaces de consulta abren FLASH con el servicio seleccionado.

El plugin NOVOGEN CONNECT Catálogo está instalado y activo en novogensalud.cl. La página Servicios (WordPress 13139) consume [novogen_connect_catalogue]. Se sustituyó únicamente el listado de tarjetas comerciales; permanecen cabecera, explicación del sistema, contacto y enlace de empresas. El catálogo tiene una caché máxima de 60 segundos en WordPress. Las páginas editoriales individuales conservan sus textos actuales.

Restauración: reponer el contenido de servicios-wordpress-antes-connect.html en el editor de código de la página 13139; guardar; luego desactivar NOVOGEN CONNECT Catálogo si ya no se utiliza el shortcode. El respaldo está en outputs. El código previo está en la rama local backup/antes-integracion-contacto-2026-10-28 y su bundle.

Validación: TypeScript sin errores, 37 comprobaciones de validación/PostgreSQL y 10 pruebas de navegador. Producción devuelve 20 registros comerciales públicos (16 servicios y 4 agrupadores). No se modificó el esquema de datos.
