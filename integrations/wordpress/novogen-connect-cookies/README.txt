NOVOGEN CONNECT — Cookies y métricas 0.1.0

Requiere Complianz – GDPR/CCPA Cookie Consent (complianz-gdpr).

1. Instalar Complianz desde el directorio oficial de WordPress si todavía no hay un gestor de consentimiento. Si existe otro gestor, revisar antes de instalar un segundo banner.
2. Configurar consentimiento previo (opt-in) para todos los visitantes y exigir aceptación de Estadísticas. No activar estadísticas sin consentimiento ni marcar la categoría como necesaria.
3. Instalar y activar este ZIP desde Plugins → Añadir nuevo → Subir plugin.
4. En Ajustes → CONNECT · Cookies, guardar el origen HTTPS público aprobado de CONNECT. El Preview protegido por Vercel no sirve para esta integración externa.
5. Verificar el dominio de la web en Catálogo → Canales de CONNECT FLASH.
6. Probar en ventana privada: antes de aceptar no debe haber solicitudes a /api/web-interactions; al aceptar Estadísticas debe haber page_view; al retirarlas deben detenerse las solicitudes. La aceptación guardada se respeta al recargar, mientras siga vigente.

No añadir claves de Supabase, contraseñas ni credenciales en este complemento.
No crea un aviso adicional, no acepta cookies por el usuario y no cambia WordPress automáticamente.
La agenda requiere data-connect-target="agenda" en el enlace. Instagram, WhatsApp, TikTok y correo se reconocen por su URL.
