# Catálogo jerárquico de FLASH y CRM

Rama de respaldo local: `backup/flash-publicado-2026-10-28` (commit `f477818`). Rama de trabajo: `feature/flash-crm-hierarchy`. El archivo bundle y la instantánea del catálogo comercial se guardaron antes de cambiar la estructura.

Estructura del piloto: Evaluación → CHECK, BODY, VITA; OPTIMIZA → SUPLE, RECOVERY, GLOW; RECOVERY → Essential, Advance, Premium; GLOW → sus siete prestaciones. COMPRENDE y SEGUIMIENTO son servicios individuales en el nivel principal. SUPLE es educación sobre productos por todos los canales, con un botón pequeño «Ver productos» que abre https://www.novogenstore.cl/ en otra pestaña.

El CRM administra `catalog_type` y `parent_id` como fuente central; valida que el padre sea un agrupador de la misma organización y no permite ciclos. Un agrupador con hijos no puede convertirse accidentalmente en servicio. Los UUID existentes se conservan. Se añade el agrupador Evaluación y se aclara SUPLE sin borrar contactos ni interacciones.

FLASH reutiliza los componentes, estilos, fuentes e iconos del original. Los servicios nuevos del CRM reciben automáticamente una ficha del mismo formato con su texto oficial. Las fichas originales reconocidas conservan sus paneles editoriales. Desactivar un agrupador oculta sus descendientes; los registros huérfanos no se muestran.

Las aperturas de agrupadores usan `preference_view` y `preference_id`. Las fichas individuales usan `service_view` y `service_id`. Nunca se envían ambos identificadores a la vez. El CRM muestra tablas separadas para preferencias y servicios. Las consultas/contactos solo aceptan servicios concretos. El botón Store usa `button_click` / `store`, atribuido a SUPLE, y no acredita una compra.

Activación: migración 007 después de 001–006 y despliegue de esta rama. La migración conserva la compatibilidad de las firmas anteriores del registro de eventos y valida tipo, actividad, organización y jerarquía en servidor.

Restauración: el despliegue anterior es `dpl_2Y1rUFFFDj8znhi32DVw4XQC7zrf`, URL https://novogen-connect-9kjm0urd3-novogen1.vercel.app. Para restaurar toda la versión, revisar y aplicar el SQL de restauración incluido en outputs y reasignar el dominio al despliegue anterior. El SQL se detiene si detecta registros adicionales que necesitan revisión; conserva contactos y logs. Una rama Git por sí sola no revierte la base de datos.

Validación: pruebas PostgreSQL de jerarquía, aislamiento, ciclos y rechazo de agrupadores como servicios; navegación móvil a 320/360/390/430 px, fichas nuevas, separación de métricas, y botón pequeño de productos. Las habilidades de Vercel/MCP adicionales siguen siendo independientes de este despliegue.

Verificación real de la versión jerárquica: migración 007 aplicada al proyecto Supabase; 4 agrupadores y 16 servicios individuales. Se comprobó OPTIMIZA → SUPLE, la apertura de https://www.novogenstore.cl/ y la separación en base de `preference_view` (sin service_id), `service_view` de SUPLE y `button_click/store` atribuido a SUPLE. El despliegue candidato `dpl_7NbmEJWZfpTNhjcapseX3Mw5uTTX` compiló correctamente y fue promovido; el alias habitual del CRM también se actualizó. Los enlaces del CRM y la resolución de puntos QR usan la misma interfaz original para NOVOGEN, manteniendo el destino genérico para otras organizaciones.

Ajuste de orientación solicitado: los nombres comerciales quedan dentro de opciones comprensibles. En el nivel principal se muestra Evaluación, Interpretación, Bienestar y Seguimiento. Bienestar abre Productos, Recuperación y Piel. Los nombres comerciales y UUID se conservan en las fichas y en el CRM; el administrador ve la etiqueta utilizada en FLASH. Estas etiquetas no cambian el tipo de registro ni convierten la consulta de una preferencia en un servicio.

YouTube: se añade al inicio con un icono circular del mismo estilo y tamaño que las demás redes, dirigido a https://www.youtube.com/@novogensalud. El canal es editable desde el CRM. La migración 008 agrega el campo y valida la medición `youtube_click`/`youtube`; los permisos administrativos y el consentimiento se mantienen.
