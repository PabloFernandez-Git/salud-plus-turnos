# Task Loop

```text
ANALYZE
↓
PLAN
↓
IMPLEMENT
↓
VERIFY
↓
REVIEW
```

Si Review falla:

```text
DIAGNOSE
↓
REFINE
↓
FIX
↓
VERIFY AGAIN
```

Máximo recomendado de 2–3 ciclos automáticos. Si persiste el problema, escalar con evidencia y alternativas.

Dentro del alcance ya autorizado, el agente diagnostica, corrige y verifica por sí mismo. No convierte al usuario en intermediario de comandos ni solicita confirmaciones por cada corrección. Cuando una credencial sólo está disponible en la sesión humana, prepara y valida localmente una operación única que la solicite de forma segura, ejecute el flujo aprobado y compruebe cleanup; no pide copiar el secreto al chat.

La autorización humana sigue siendo necesaria para operaciones sensibles no aprobadas, cambios de alcance o permisos y cualquier acceso remoto que exceda lo autorizado. Si una operación segura queda bloqueada, conservar el estado y la evidencia y explicar el bloqueo.
