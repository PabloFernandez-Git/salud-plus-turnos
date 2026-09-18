# 29. Regla sobre excepciones

No se resolverán errores de calidad simplemente ocultándolos.

Se evitará el uso injustificado de:

```text
eslint-disable
@ts-ignore
```

Una excepción legítima deberá tener una razón técnica concreta.

No se incorporarán Git hooks como Husky al inicio; podrán evaluarse más adelante si aportan valor real al flujo de trabajo.
