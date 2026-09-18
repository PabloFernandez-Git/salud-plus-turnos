# 22. Estrategia conjunta de testing

La combinación aprobada es:

```text
Vitest
→ lógica de negocio

React Testing Library
→ componentes

Playwright
→ flujos End-to-End
```

La estrategia será basada en riesgo.

No se perseguirá coverage por sí mismo.

Los tests formarán parte del harness del proyecto y servirán también como red de seguridad para cambios realizados con Codex y otros agentes.
