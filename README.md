# CONNECT · SOLVEX / NOVOGEN

MVP comercial multiempresa. SOLVEX es la plataforma tecnológica; NOVOGEN es la primera instancia piloto. No almacena ni procesa expedientes clínicos.

## Estado

- Next.js 16, React 19, TypeScript y Supabase (Auth + PostgreSQL).
- Panel comercial en `/crm`; la ruta `/` abre CONNECT FLASH.
- Panel responsive: indicadores, contactos, seguimiento de oportunidades, catálogo y puntos CONNECT.
- CONNECT FLASH: orientación, servicios, estado de promociones y enlace al sitio institucional NOVOGEN.
- Identificadores opacos para QR/NFC, resolución interna, eventos separados de oportunidades y auditoría administrativa.
- Sin configuración de Supabase: demostración de solo lectura, con contactos ficticios. Los formularios no guardan datos.
- Con Supabase: inicio de sesión, lectura y escritura sujetas a permisos por organización. No hay credenciales administrativas en la aplicación.

## Desarrollo

Requiere Node.js 22 o posterior y npm. Trabajar en este checkout; cada tarea cloud ya tiene un entorno aislado y no necesita otro worktree.

```sh
npm ci --cache /tmp/novogen-npm-cache
npm test
npm run build
npm run dev
```

Para ejecutar la compilación: `npm run start`. El puerto predeterminado es 3000. `/api/health` comprueba el proceso y distingue demo/configuración presente; **no comprueba conectividad con la base de datos**.

## Conectar Supabase

1. Usar un proyecto Supabase aprobado. La migración no se aplica automáticamente al instalar o iniciar.
2. Aplicar una sola vez, en orden, `supabase/migrations/202610270001_connect_core.sql` y `supabase/migrations/202610270002_manual_contacts.sql` mediante SQL Editor o el flujo de migraciones aprobado. Crea el esquema, RLS y un piloto NOVOGEN **sin publicar**.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en variables del entorno, o en un archivo local ignorado `.env.local`. Usar la clave pública anon; **nunca service_role ni una clave secreta**. `.env.example` solo contiene nombres.
4. Crear el usuario administrativo desde Supabase Auth. La aplicación no ofrece registro público ni concede membresías automáticamente.
5. Asignar su membresía desde SQL Editor. Sustituir el correo del ejemplo por el de la cuenta creada:

```sql
insert into public.memberships(organization_id,user_id,role)
select o.id,u.id,'admin'
from public.organizations o cross join auth.users u
where o.slug='novogen' and u.email='ADMINISTRADOR@example.com'
on conflict(organization_id,user_id) do nothing;
```

6. Reiniciar Next.js. Entrar en `/login`, comprobar el catálogo y editar sus textos aprobados. El catálogo inicial es una base informativa; no incluye precios, promociones ni beneficios inventados.
7. Tras revisar el contenido, habilitar la publicación deliberadamente:

```sql
update public.organizations set published=true where slug='novogen';
```

8. Crear un punto desde el panel. Descargar su QR desde el dominio final donde se usará; el QR contiene la URL del dominio desde el que se descarga. La misma URL sirve para programar una etiqueta NFC.
9. Verificar en el proyecto real: envío público con consentimiento → contacto y oportunidad → seguimiento administrativo → evento de acceso separado. Comprobar con dos cuentas de distintas organizaciones que no pueden leer ni modificar datos ajenos.

Para una segunda organización, un operador autorizado crea su registro y membresías desde Supabase. Los usuarios con varias membresías pueden cambiar de organización en el panel. CONNECT CREATOR y la gestión visual de usuarios no están incluidos todavía.

En entornos de red restringida debe permitirse el hostname exacto del proyecto Supabase. Los nombres de variables y sus valores públicos se configuran de forma segura en ajustes; no enviar claves secretas al chat.

## Pruebas

```sh
npm test
npm run build
npm run typecheck
npm run test:browser
```

`npm test` ejecuta validaciones de entrada y la migración en PostgreSQL embebido (PGlite), con roles y un esquema `auth` simulado. Comprueba RLS entre organizaciones, permisos administrativos, consentimiento, duplicados, eventos y auditoría. No sustituye una prueba de Supabase Auth y PostgREST reales.

Las pruebas de navegador arrancan y detienen su propio servidor de producción en el puerto 3100; requieren una compilación previa y Chromium en `/usr/bin/chromium` (o `CHROMIUM_PATH`). Ejecutarlas sin variables Supabase para probar el modo demo. Recorren navegación, búsqueda, ficha informativa, formulario, QR y redirecciones, además de revisar desbordamiento móvil/escritorio.

## Límites del MVP

- No es una historia clínica ni una herramienta de orientación médica.
- No hay procesamiento de pagos, reservas sincronizadas, ventas ni ventas validadas. «Reserva informada» es una etapa comercial manual.
- Los accesos contabilizan solicitudes al punto; no personas únicas ni clics verificados de humanos. No hay atribución multicanal ni registro de clics al sitio institucional.
- El catálogo permite agregar, editar, publicar y desactivar servicios. Precios, campañas, promociones, convenios, fidelización y gestión visual multiempresa quedan para otras fases.
- CRM con alta manual de contactos autorizados, oportunidad inicial, búsqueda y filtro por etapa; limitado a los 100 contactos más recientes. Sin exportación, eliminación ni gestión visual de retención todavía.
- Captura pública con consentimiento, señuelo anti-bot y límite de un contacto por correo/organización por hora y 100 por organización/hora. Antes de exposición comercial amplia se debe completar protección contra abuso y el procedimiento de privacidad/retención con la organización.
- La asociación de un punto es una fuente declarada por la URL; no prueba identidad ni una venta.
- La interfaz pública editable conserva los logotipos y la identidad azul del sitio recuperado. El crédito visible corresponde a SOLVEX. Los recursos publicados originales permanecen como archivo histórico en `published-connect/`.
- No hay despliegue ni conexión a servicios externos creada automáticamente.

Véase [arquitectura](docs/architecture.md) para límites de seguridad y decisiones.

## Integración de la interfaz y conexión actual

La portada pública editable vive en `app/connect/[slug]/page.tsx`; el panel comercial en `app/crm/page.tsx`. Comparten el catálogo y las acciones de captura, con separación por organización. La ficha de cada servicio permite preseleccionarlo al solicitar contacto y conserva el punto de origen.

El alta manual utiliza una RPC autenticada, exige autorización comercial declarada por el operador y crea contacto y oportunidad en una transacción, sin inventar eventos de campaña. Las búsquedas y filtros del CRM se limitan a los 100 contactos cargados.

El 27 de octubre de 2026 se verificó que la clave configurada es pública Publishable y que Supabase responde mediante el proxy. Las consultas GET a `organizations` y `leads` devolvieron `PGRST205`: falta aplicar el esquema en el proyecto remoto. Una respuesta HEAD 204 no prueba que una tabla exista. No se aplicaron migraciones remotas ni se creó un usuario administrativo desde esta sesión.

En este entorno cloud, Node necesita `NODE_USE_ENV_PROXY=1` para respetar la ruta de red configurada. Se verificó con el runtime Node 24. Para desarrollo con las credenciales configuradas: `NODE_USE_ENV_PROXY=1 npm run dev`. Fuera del entorno con proxy se usan los comandos normales.

Las pruebas de navegador configuran variables Supabase vacías en su propio servidor para probar explícitamente la demostración. La configuración se lee dinámicamente en servidor; una compilación retenida puede tomar las variables del entorno que la ejecuta.
