# Dashboard de web y CONNECT FLASH

La vista Seguimiento y métricas muestra períodos de 7, 14 y 30 días calendario de Chile, filtros independientes por origen y actualización automática cada minuto mientras la pestaña está visible. Se puede pausar y actualizar manualmente. Las cifras se calculan sobre los 1.000 eventos más recientes de los últimos 31 días; el día adicional evita perder el primer día local por el corte UTC. Se avisa si se alcanza el límite. No es un total ilimitado ni cuenta personas únicas.

Los eventos anteriores pertenecen al colector exclusivo de FLASH y conservan ese origen. Un clic en el enlace al sitio web desde FLASH sigue siendo un clic de FLASH. Una visita efectiva a WordPress necesita un evento distinto desde el sitio. No se infieren visitas web a partir de enlaces de salida ni se crean cifras de muestra.

## Base de datos existente

Ejecutar una sola vez `supabase/migrations/202610280005_metrics_sources.sql` después de 004. Agrega `source`, un índice y una función dedicada para eventos web. No elimina registros ni cambia funciones anteriores; los colectores FLASH siguen funcionando durante la actualización. El dashboard también puede mostrar los datos anteriores antes de ejecutar 005, con aviso de activación pendiente.

## Instalar en WordPress

Requiere primero un origen de CONNECT accesible públicamente para servir el script y recibir eventos. La protección Vercel del Preview impide instalarlo como colector externo de producción; mantenerla hasta preparar un despliegue público aprobado. No se han instalado plugins ni modificado WordPress automáticamente.

1. Configurar el sitio institucional en Catálogo → Canales de CONNECT FLASH. Solo se aceptan eventos desde ese dominio HTTPS o su variante `www`, en el mismo puerto. No usar comodines para subdominios.
2. Incluir el script, sustituyendo ORIGEN_CONNECT por el despliegue público aprobado:

```html
<script defer src="ORIGEN_CONNECT/web-tracker.js" data-slug="novogen"></script>
```

3. Desde el gestor de consentimiento del sitio, **después de cargar el script**, comunicar la preferencia explícita:

```js
window.CONNECTMetrics?.setConsent(true); // aceptación de métricas
window.CONNECTMetrics?.setConsent(false); // rechazo o revocación
```

El script no interpreta la mera carga ni un consentimiento previo de FLASH como permiso de medición de WordPress. El gestor de cookies debe volver a comunicar la preferencia en cada página. No se añade una segunda ventana de consentimiento. Hasta recibir `true`, no genera identificadores de sesión ni solicitudes de eventos.

4. WhatsApp, Instagram, TikTok y correo se reconocen por sus URLs. Etiquetar agenda y otros destinos explícitos con `data-connect-target`:

```html
<a href="https://www.novogensalud.cl/reservar/" data-connect-target="agenda">Reservar</a>
```

Destinos admitidos: agenda, instagram, tiktok, whatsapp, email, website. No se envían URLs de página, texto de botones, búsquedas, campos de formularios, correos, teléfonos ni información clínica. El alcance web inicial son visitas y estos destinos; las fichas por servicio corresponden a FLASH.

## Alcance y comprobación

El colector web valida el origen HTTP contra el sitio configurado y la función SQL vuelve a comprobarlo. Los eventos web no pueden incluir servicio ni punto QR. El cliente usa sesión anónima sin cookies del CRM. Los eventos son idempotentes por UUID y tienen límite de 100 por sesión/organización/día, compartido con FLASH. Las políticas de lectura siguen limitadas a miembros de la organización. Como cualquier analítica pública, esto no autentica a un visitante ni elimina tráfico artificial.

En una prueba autorizada, aceptar métricas en cada origen, abrir un enlace y comparar el dashboard. El filtro de canales afecta las tarjetas, gráfico diario, botones y servicios; la tarjeta de comparación conserva ambos canales para comparar el mismo período. No se consideran reservas, mensajes entregados ni ventas. Sin eventos web recientes se muestra ese estado, sin afirmar que la instrumentación está instalada o desconectada.
