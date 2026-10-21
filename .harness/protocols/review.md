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

Antes de repetir un check o gate, comparar el cambio con la evidencia PASS previa: código, configuración, entorno y datos relevantes. Reutilizar esa evidencia si sigue siendo aplicable y registrar su referencia; verificar de forma focal lo que cambió o pudo invalidarla. No repetir una corrida remota sólo por un ajuste que no afecta las condiciones de su PASS. Seguridad, aislamiento por centro, ownership y cleanup siguen siendo obligatorios cuando correspondan.
