# Contrato propuesto entre CONNECT y NovoPoint

Estado: propuesta para coordinar el nuevo proyecto NovoPoint. No existe todavía una API conectada ni se acreditan puntos. NovoPoint se desarrollará en otra ventana por decisión del usuario.

## Responsabilidad de cada sistema

CONNECT muestra la experiencia móvil y los juegos. NovoPoint es la autoridad del saldo, reglas, premios, caducidad, canjes y anulaciones. Los puntajes e insignias guardados en localStorage no son evidencia válida para acreditar un saldo canjeable.

## Identidad

Definir un ID opaco de cuenta verificada que ambos sistemas reconozcan dentro de la organización. No unir cuentas automáticamente por correo ni tratar un formulario comercial como verificación de identidad. CONNECT necesita un flujo de vinculación autenticado; la cookie actual de solicitud comercial no basta para identificar al titular de puntos.

## Evento versionado propuesto

POST /integrations/connect/v1/events en el servidor de NovoPoint. El endpoint es una propuesta, no está implementado.

```json
{
  "eventId": "UUID único generado por el servidor",
  "version": 1,
  "type": "game.achievement.verified",
  "organizationId": "UUID de la organización",
  "subjectId": "ID opaco de la cuenta vinculada y verificada",
  "occurredAt": "fecha ISO 8601 UTC",
  "game": "snake",
  "achievement": "first_verified_session",
  "sessionId": "ID de sesión de juego verificada en servidor"
}
```

El evento no incluye cantidad de puntos, saldo, nombre, correo, diagnósticos, suplementos consumidos ni resultados de mediciones. NovoPoint determina los puntos mediante reglas propias aprobadas.

## Verificación y entrega

CONNECT deberá implementar sesiones de juego validadas en servidor antes de emitir estos eventos: semilla/tablero inicial del servidor, registro de acciones, validación de partida y límites de frecuencia. No aceptar como prueba un puntaje remitido por el navegador. Acordar topes diarios y medidas contra automatización según el valor del premio.

Enviar desde servidor con firma HMAC-SHA256 sobre timestamp + punto + cuerpo JSON original en bytes. Usar un secreto dedicado compartido únicamente entre los servidores, cabeceras X-Connect-Timestamp y X-Connect-Signature, tolerancia de tiempo máxima de cinco minutos y comparación de firma en tiempo constante. Validar además emisor, organización y vinculación de cuenta. El timestamp se firma; no basta con HTTPS o una clave pública dentro del JavaScript.

NovoPoint debe rechazar eventos repetidos mediante restricción única por organización y eventId y acreditar en una transacción. Un reintento con el mismo evento devuelve el resultado anterior, sin volver a acreditar. CONNECT necesita una outbox durable con reintentos y estado de entrega. Ninguno de estos dos mecanismos está conectado aún.

## Respuesta y saldo propuestos

Respuesta de aceptación: eventId, estado accepted/duplicate/rejected, referencia de movimiento. Consulta de saldo mediante una API autenticada y autorizada por cuenta; devolver saldo disponible, pendiente y próxima caducidad. CONNECT no recalcula ni modifica el saldo.

Las anulaciones se registran mediante movimientos compensatorios, nunca borrando la historia. Las reglas de conversión, canjes, caducidad y responsabilidad deben estar definidas por NovoPoint antes del lanzamiento.

## Implementado hoy en CONNECT

Snake y Bloques con controles táctiles, pausa, récords e insignias recreativas locales. No hay emisión de eventos verificables, cuenta NovoPoint vinculada ni saldos. El resto del documento sirve para coordinar la integración futura sin confundirla con una conexión ya activa.
