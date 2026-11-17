# TASK-039 — Retrospectiva

La verificación en PostgreSQL fue necesaria: el mensaje neutral de TASK-028 ocultaba datos en pantalla, pero la respuesta de red seguía entregando nombres y estado del vínculo. La migration corrigió el dato antes de salir de la DB y Zod convirtió la misma regla en un contrato explícito.

Separar exposición directa de inferencia de existencia evitó atribuir a `UNVERIFIED` una garantía que no ofrece. El bloqueo PRE-PROD de `resolve`/`create` permanece visible en el módulo, el estado y el cierre.

En Fase D, confirmar la lista exacta de migrations antes de aplicar permitió ejecutar sólo la versión autorizada. Los fixtures con IDs propios y cleanup auditado hicieron posible validar sesiones reales sin tocar datos de pacientes ni dejar residuos.
