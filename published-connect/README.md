# NOVOGEN CONNECT — copia recuperada del sitio publicado

Origen: https://novogen-connect-franc.francisco-ortiz0903.chatgpt.site

Esta carpeta conserva los archivos que el sitio entrega públicamente al navegador: HTML, JavaScript compilado, CSS, logotipos, fuentes, iconos, manifiesto y service worker. Los archivos bajo `public/` se conservan sin modificaciones; `recovery-manifest.json` registra tamaños y SHA-256.

## Ejecutar

Requiere Node.js 22 o posterior. No necesita instalar dependencias.

```sh
cd published-connect
npm test
npm start
```

El servidor utiliza el puerto 4173. Se puede cambiar con `PORT`; `HOST` permite ajustar la interfaz de escucha. Sirve exclusivamente `public/`, admite rutas del cliente y no publica archivos del repositorio. Es un servidor de desarrollo, no un despliegue de producción.

## Qué se recuperó y qué falta

- Frontend publicado basado en React, React Router y una compilación de Vite; tipografía Montserrat y recursos PWA.
- Navegación pública de orientación, servicios y promociones; enlaces a canales institucionales.
- El JavaScript no incluye referencias a Supabase ni PostHog, ni endpoints `/api/`. Esto no acredita la existencia de un CRM o persistencia de servidor.
- El service worker es un archivo JavaScript legible conservado tal como se publicó.
- No se publicaron referencias a source maps. No se recuperaron los componentes JSX originales, manifiesto de dependencias original, configuración Vite original, historial, backend ni base de datos. Este `package.json`, servidor y pruebas se crearon para ejecutar y comprobar la copia; no pertenecen al proyecto original.
- Los enlaces institucionales y a WhatsApp mantienen sus destinos originales. Las pruebas no envían mensajes ni formularios externos.

## Continuar el desarrollo

La copia sirve como referencia ejecutable del avance real. Para editar componentes de forma mantenible, se necesita exportar el proyecto original desde la herramienta donde se creó, o reconstruir sus vistas como código fuente revisable usando esta copia de referencia. Evitar editar directamente el bundle minificado.

El MVP Next.js/Supabase preparado previamente permanece separado y no se reemplazó al recuperar este sitio. No se ha publicado ni modificado el sitio de origen.
