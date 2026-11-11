# ORIÉNTAME términos juegos y NovoPoint

## Publicación y límites

Los juegos Snake y Bloques se implementan como una página liviana dentro de CONNECT, con controles táctiles y teclado, pausa al ocultar la app, récords locales e insignias recreativas. No generan créditos, canjes ni un saldo NovoPoint.

El registro de aceptación de términos, el acceso a IA y la derivación están implementados, probados con datos ficticios y desactivados por configuración. No se activan hasta contar con términos institucionales aprobados y un proveedor configurado. La navegación original de ORIÉNTAME se conserva mientras la IA está desactivada. La migración 009 está aplicada en Supabase; solo agrega tablas de aceptación y conteo, y funciones acotadas al contacto que posee un comprobante privado.

## Configuración necesaria para activar

Variables exclusivamente de servidor:

- CONNECT_TERMS_VERSION: identificador del texto aprobado.
- CONNECT_TERMS_URL: URL HTTPS del texto aprobado.
- CONNECT_PRIVACY_URL: URL HTTPS de la política de privacidad aprobada.
- CONNECT_SESSION_SECRET: secreto aleatorio de al menos 32 caracteres, independiente de otras claves.
- OPENAI_API_KEY: clave de la cuenta responsable; configurar en Vercel, nunca en el chat, repositorio ni navegador.
- OPENAI_MODEL: modelo aprobado por el responsable de costos y con Structured Outputs compatible.

Después de configurarlas, desplegar y verificar una conversación real con la cuenta de OpenAI. La API de pago no se probó con credenciales reales en esta entrega. La página de pruebas del navegador utiliza respuestas simuladas claramente separadas de producción.

## Flujo

1. Al entrar a FLASH, si están configurados los términos aprobados, se exige aceptación y se registra versión y fecha. La cookie firmada dura 30 días; un cambio de versión vuelve a exigir aceptación. Entrar directamente a juegos también exige este paso.
2. ORIÉNTAME pide nombre y correo de manera contextual cuando todavía no existe una solicitud reconocida en ese navegador; teléfono opcional. Se registra la solicitud en el CRM.
3. Antes de preguntar, el usuario autoriza el envío de mensajes a OpenAI. La autorización no suscribe a publicidad. El modelo no recibe los campos de contacto del formulario.
4. El servidor valida cookie firmada, comprobante privado del contacto y cupo. Límites iniciales: 30 consultas por contacto y 200 por organización al día, aplicados con bloqueo transaccional en PostgreSQL. Los intentos ya autorizados consumen cupo aunque falle el proveedor.
5. La respuesta usa el catálogo publicado, distingue orientación comercial, necesidad de atención profesional y urgencias, y ofrece derivación. Al pulsar derivar, se marca la tarea para atención humana y se avisa al equipo dentro del CRM. No se copia el chat al CRM ni se promete contacto instantáneo, reserva o mensaje enviado por WhatsApp.

## Revisión de orientación sobre salud antes de activar

La IA está preparada para información educativa y comercial. No prescribe dosis, diagnostica deficiencias ni recomienda mediciones de rutina a todos. Las recomendaciones personalizadas se derivan a un profesional. Deben incorporarse fichas aprobadas de productos y revisar respuestas y casos de prueba con un profesional habilitado antes de ofrecer recomendaciones concretas.

Fuentes consultadas para este diseño:

- FDA sobre riesgos e interacciones: https://www.fda.gov/consumers/consumer-updates/fda-101-dietary-supplements
- MedlinePlus sobre pruebas de vitamina D: https://medlineplus.gov/lab-tests/vitamin-d-test/
- OpenAI sobre estado de conversación: https://developers.openai.com/api/docs/guides/conversation-state

El parámetro store:false evita almacenar respuestas como estado de conversación de la API; no equivale a garantizar retención cero por parte del proveedor.

## NovoPoint

El proyecto del portal documenta NovoPoint como alcance futuro, sin API ni saldos. Falta definir un identificador de cuenta verificado, reglas de puntos, acciones válidas, topes, caducidad, canjes y anulaciones. No se debe acreditar un puntaje recibido del navegador como saldo canjeable. La integración necesitará validación de servidor e idempotencia; las marcas locales de juegos son recreativas y editables por el propio usuario, por lo que no acreditan premios.

## Respaldo

Rama previa: backup/antes-orientame-juegos-2026-10-28. Rama de trabajo: feature/orientame-games. Las ramas son locales.
