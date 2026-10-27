# CONNECT en Vercel

Arquitectura aprobada: Next.js en Vercel, datos/autenticación en Supabase y WordPress institucional en Hostnauta. El primer despliegue debe ser una versión de prueba, sin cambiar DNS ni reemplazar el sitio existente.

## Código

Repositorio `novogensalud/novogen-connect`, rama `feature/connect-crm`. Seleccionar esta rama: `main` todavía no contiene el MVP. Directorio raíz: la raíz del repositorio, no `published-connect`. Framework: Next.js. Instalación: `npm ci --include=dev`. Compilación: `npm run build`. Usar Node.js 24.x en los ajustes del proyecto.

`vercel.json` declara los comandos; `.vercelignore` excluye el snapshot histórico y archivos locales cuando se sube mediante CLI. No usar exportación estática: la autenticación, Server Actions y el CRM requieren servidor.

## Variables de Vercel

Configurar para Preview y, cuando se decida publicar, Production:

- `NEXT_PUBLIC_SUPABASE_URL`: `https://dfilxqvbwjsvvhpowecn.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: la clave pública Publishable/anon del proyecto, mediante variables del proveedor. Nunca secret ni service_role.

Las variables configuradas en el entorno de desarrollo no se transfieren automáticamente a Vercel. No copiar credenciales a `vercel.json` ni al repositorio. `NODE_USE_ENV_PROXY` pertenece al entorno cloud de desarrollo y no hace falta trasladarlo a Vercel.

## Alta y despliegue

Se requiere una cuenta Vercel autorizada. No contratar planes ni servicios pagos durante esta preparación. Conectar GitHub y dar acceso a este repositorio si se usa la importación Git; o autenticar Vercel CLI y desplegar desde el checkout de la rama indicada.

En una importación Git, revisar explícitamente la rama antes de desplegar. Si Vercel selecciona `main` y no permite cambiarla en el asistente, configurar la rama de producción en los ajustes Git antes de promover ningún despliegue; también se puede crear un Preview de `feature/connect-crm` desde un enlace Git o CLI. No sobrescribir ni fusionar ramas para evitar ese paso.

## Verificación posterior

1. `/api/health`: status `ok` y storage `configured-not-verified` indica presencia de configuración, no valida las tablas.
2. `/login`: carga el formulario. `/crm` sin sesión debe redirigir al ingreso.
3. Iniciar sesión con la cuenta de la aplicación y comprobar la membresía NOVOGEN/admin.
4. Revisar catálogo, crear un contacto comercial autorizado, comprobar su oportunidad y actualizar su etapa.
5. Verificar que no puede leerse información ajena con otra organización/cuenta.
6. El piloto NOVOGEN continúa sin publicar hasta revisar el contenido. Su portada pública puede responder 404 mientras `organizations.published=false`; esto no impide ingresar al CRM.
7. Tras la revisión, habilitar el espacio deliberadamente y probar punto QR → solicitud → contacto/oportunidad, distinguiendo accesos de ventas.

Registrar la URL que Vercel entregue; no inventar una URL ni confundir el anterior sitio estático con el nuevo despliegue. No se considera validado el acceso administrativo hasta que una sesión real complete el recorrido.

## Primer Preview verificado — 27 de octubre de 2026

- Equipo Vercel: `novogen1` (NOVOGEN), plan Hobby.
- Proyecto: `novogen-connect`.
- Preview: https://novogen-connect-6ui94yj20-novogen1.vercel.app
- Ingreso: https://novogen-connect-6ui94yj20-novogen1.vercel.app/login
- ID del despliegue: `dpl_BgV9hi5Rruvtm2DRP8ieYDExSAQe`; estado Ready, target Preview.
- Ambas variables públicas de Supabase se configuraron en Preview mediante la CLI, sin copiarlas al repositorio. No están configuradas en Production.
- Verificación remota mediante el acceso de automatización oficial de Vercel: `/api/health` devolvió 200 con `configured-not-verified`; `/login` devolvió 200 con el formulario; `/crm` sin sesión devolvió 307 a `/login`.
- `/connect/novogen` devolvió 404 porque el espacio NOVOGEN todavía no está publicado. Se debe revisar el catálogo dentro del CRM antes de habilitarlo.
- Se mantiene la protección de acceso de Vercel. El propietario debe ingresar a Vercel si se le solicita y luego usar la cuenta de aplicación de Supabase en el formulario del CRM.
- Falta verificar el ingreso administrativo con la cuenta real y el recorrido autenticado de contactos; requiere que el propietario ingrese su contraseña personalmente.
- Vercel asignó automáticamente a Production el primer despliegue de un proyecto vacío. Ese despliegue inicial se retiró después de verificar el Preview, para no conservar una versión sin las variables correctas.
- No se modificaron DNS, WordPress ni el sitio estático anterior. La integración Git con despliegues automáticos todavía no se conectó; este Preview se subió mediante CLI.
- `.vercel/` y `.env.local` creados por la CLI son archivos locales ignorados; no deben versionarse ni imprimirse, y la autenticación CLI no se debe asumir disponible en otra máquina.
