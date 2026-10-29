# Fuentes de ORIÉNTAME

Ruta administrativa: `/crm/orientame?org=ID_ORGANIZACION`, enlazada desde el menú del CRM. Es una biblioteca privada de documentos y enlaces para preparar las respuestas de orientación, según lo confirmado por el usuario. No son canales de origen de prospectos.

## Operación

- Importar un JSON exportado por CONNECT o la plantilla descargable; alternativamente un documento `.txt` o `.md` por selección. No se almacenan binarios: TXT/Markdown se convierten en texto. Límite de 20.000 caracteres por documento y 2 MB por archivo de importación, hasta 100 fuentes por biblioteca. La base también limita su tamaño estructurado total a 1,8 MB para permitir exportación/reimportación dentro del límite de archivo.
- Antes de confirmar, se muestra la lista de títulos y claves. Una clave repetida dentro del archivo se rechaza. Una clave ya existente en la organización actualiza esa fuente; las demás se conservan. El lote se aplica completo o no se aplica ninguno.
- Añadir texto o un enlace HTTPS mediante el formulario. Una fuente de texto necesita contenido y URL vacía; un enlace necesita URL y puede incluir notas opcionales. No se descarga ni rastrea automáticamente el enlace.
- Toda importación queda pendiente de revisión, incluso si el respaldo indicaba revisada o archivada. Importar una actualización reinicia la revisión. El administrador puede marcarla revisada o archivada; no hay borrado masivo.
- Exportar descarga JSON con todas las fuentes, incluidas las archivadas, sin identificadores de organización ni cuentas de usuarios. El exportador no trunca silenciosamente el conjunto y usa `Cache-Control: private, no-store`.

Formato portable:

```json
{
  "version": 1,
  "sources": [
    {"key":"servicios-generales","title":"Información comercial","type":"text","url":"","content":"Texto comercial validado para orientación.","status":"draft"},
    {"key":"pagina-oficial","title":"Sitio institucional","type":"url","url":"https://novogensalud.cl/","content":"Referencia institucional","status":"draft"}
  ]
}
```

Claves: letras minúsculas, números, guion y guion bajo; inicio alfanumérico, máximo 80 caracteres. Títulos: 2–160 caracteres. Enlaces HTTPS sin credenciales, máximo 2.048 caracteres. La plantilla es genérica y no incorpora precios, beneficios ni datos clínicos de personas.

## Activación y seguridad

Ejecutar una sola vez `supabase/migrations/202610290007_orientame_sources.sql` en el proyecto existente. No repetir el instalador inicial. Hasta entonces se muestra la nueva pantalla con un aviso y las operaciones de guardado/exportación deshabilitadas. La plantilla permanece disponible.

Solo administradores de la organización pueden leer, importar, revisar o exportar la biblioteca. Las funciones SQL vuelven a comprobar el rol, separan registros por organización, bloquean la organización durante la importación para serializar límites y generan auditoría de cambios sin copiar contenido al log. No se da acceso público a documentos, enlaces ni notas. Los campos de texto se muestran escapados y no se ejecuta HTML importado.

Esta entrega no conecta un agente, embeddings ni generación automática de respuestas. El botón público ORIÉNTAME continúa como solicitud de orientación comercial. Marcar una fuente como revisada no la publica en FLASH. No importar fichas de pacientes, credenciales ni documentos personales a esta base comercial.

Validación: pruebas PostgreSQL de permisos/aislamiento, importación atómica, actualización y reimportación portable; validación de archivos, URL y claves duplicadas; recorrido móvil de la nueva opción y descarga de plantilla. La prueba con documentos reales y sesión autenticada del administrador queda a cargo del operador una vez activada la migración.
