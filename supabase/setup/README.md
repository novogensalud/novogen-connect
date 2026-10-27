# Activación inicial de CONNECT

Proyecto autorizado: `dfilxqvbwjsvvhpowecn`.

1. En el **SQL Editor**, ejecutar una sola vez todo `01-install.sql`. Es una transacción que combina las dos migraciones del MVP. Si falla, conservar el error; no borrar tablas ni desactivar RLS. Si el esquema ya existe, no usar este instalador: revisar las migraciones canónicas pendientes.
2. En **Authentication > Users**, crear una cuenta de aplicación para `novogen.temuco@gmail.com` usando el flujo seguro del panel. La cuenta del dashboard Supabase es distinta de los usuarios de Auth del proyecto. Establecer la contraseña allí; no enviarla al chat ni por correo.
3. En el **SQL Editor**, ejecutar `02-admin.sql`. Asigna a esa cuenta el rol administrador de NOVOGEN y confirma el resultado. Puede ejecutarse otra vez sin duplicar la membresía. No publica el catálogo.
4. Con el servidor de CONNECT iniciado y configurado, abrir `/login` e ingresar con la cuenta de aplicación. Comprobar acceso a `/crm`, revisar el catálogo y sus textos, crear un contacto autorizado y verificar su oportunidad y auditoría. Este paso requiere una cuenta real; las pruebas locales con Auth simulado no lo sustituyen.
5. Después de revisar el contenido comercial, publicar el espacio NOVOGEN deliberadamente con `update public.organizations set published=true where slug='novogen';`. La interfaz pública seguirá sin estar disponible con datos reales mientras el espacio esté sin publicar.
6. Validar el recorrido público → contacto → oportunidad y el aislamiento con una segunda cuenta/organización. Luego preparar el despliegue; estos scripts no despliegan la aplicación ni cambian el sitio publicado.

`01-install.sql` se genera al concatenar en orden el contenido de `supabase/migrations/*.sql`, sin sus transacciones individuales, dentro de una transacción común. Si cambian las migraciones, regenerar esta copia antes de utilizarla.

No introducir claves `secret`, `service_role` ni contraseñas dentro de estos archivos. El backend sigue usando la clave pública y las políticas por organización.

## Actualización: seguimiento e interacciones

Para una base existente con 001 y 002, ejecutar una sola vez `03-activate-automation.sql`. Añade tareas, avisos horarios, rojo a las 24 horas, métricas consentidas y fichas de SUPLE/RECOVERY/GLOW y SEGUIMIENTO. Si 003 ya se aplicó, usar solo `04-enable-hourly-reminders.sql` para programar el job. No volver a ejecutar `01-install.sql` en una base que ya contiene CONNECT. Consulta `docs/followup-and-notifications.md`.
