# Marketing AI — Fase 2 local

Autorización del propietario: continuar Fase 2 después del diseño y usar esta copia local de CONNECT. Alcance: navegación y siete vistas con datos ficticios; sin tablas, migraciones, APIs nuevas, credenciales, mensajería, IA, medios, cuentas o despliegues.

Ruta: `/crm?view=marketing`. En demo (Supabase no configurado) la entrada es visible. En una instancia configurada permanece oculta salvo `CONNECT_MARKETING_AI_PREVIEW=true`, que es una habilitación de interfaz de prueba, no de publicación. No se modificaron variables de ningún entorno. Se conserva autenticación/membresía del CRM; el módulo no recibe contactos, reservas ni datos personales y omite la carga de contactos y avisos del CRM en esa vista.

Todo el flujo editorial vive en memoria del componente con reinicio por organización (`key=org.id`) y recarga. No usa localStorage ni llamadas de red, Server Actions o base de datos. Todas las aprobaciones/programaciones son ficticias, claramente señaladas. No ofrece garantías productivas de roles, trazabilidad persistente o seguridad para datos reales. No introducir información clínica/confidencial en campos de prueba.

Incluye dashboard de conteos sintéticos; calendario/lista; brief; versiones y revisión; programación futura con UTC y zona IANA; rechazo de horas DST ambiguas/inexistentes; cancelación; campaña orgánica de muestra; resultados sin valores inventados; pausa/reinicio de simulación. Creación audiovisual sigue perteneciendo a Multimedia e IA a ARM/Gemini, ambas deshabilitadas.

Ramas y cambios previos (ORIÉNTAME y Agenda Lite) no se confirmaron ni revirtieron. `BookingInbox` y navegación Reservas se conservan. El checkout inicial es `feature/orientame-games`, HEAD `6800b8e92fa61194e4b691c062747f1daf079e50`, con cambios locales del propietario preservados. No se crea otra aplicación ni CRM.

Verificación: `node node_modules/tsx/dist/cli.mjs --test tests/marketing-ai.test.ts`; typecheck existente y E2E `tests/browser/marketing-ai.spec.ts`. Ejecutar E2E únicamente con Supabase vacío y sin otros secretos heredados en servidor local; no probar formularios de producción. Las pruebas no publican ni reservan citas. Resultados concretos se registran en el informe de entrega.

Reversión: apagar preview en instancia configurada cuando corresponda a una acción autorizada; retirar solo los archivos nuevos de Marketing AI y sus inserciones del CRM. No usar git reset ni restaurar archivos enteros ignorando cambios concurrentes. La entrega conserva copia del CRM previo y hashes; restaurarla solo si el archivo actual coincide con la versión de esta entrega y no tiene cambios posteriores. No se necesita rollback de base de datos.
