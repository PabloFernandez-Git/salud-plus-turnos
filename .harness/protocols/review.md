# Review Protocol

El Reviewer debe comprobar:

- criterios de aceptación;
- scope creep;
- lint/typecheck/tests/build relevantes;
- seguridad y autorización;
- impacto de DB/RLS;
- compatibilidad con convenciones;
- documentación afectada;
- ausencia de cambios de tooling incidentales;
- ausencia de secretos o datos reales.

Resultado:

```text
PASS
```

o

```text
CHANGES_REQUESTED
```

con hallazgos concretos y verificables.
