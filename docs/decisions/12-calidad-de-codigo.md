# 12. Calidad de código

## Decisión aprobada

**ESLint + Prettier + TypeScript strict**

### Responsabilidades

```text
ESLint
→ calidad de código y detección de problemas

Prettier
→ formato automático y consistente

TypeScript strict
→ seguridad de tipos

Vitest / React Testing Library / Playwright
→ comportamiento
```

### Configuración

ESLint se configurará para trabajar con:

- Next.js;
- React;
- TypeScript.

Se evitará incorporar reglas excesivamente agresivas o de poco valor.

Prettier será responsable del formato para evitar discusiones o inconsistencias sobre:

- espacios;
- saltos de línea;
- comillas;
- formato general del código.

TypeScript se utilizará con `strict: true`.

### Scripts estándar

El proyecto deberá ofrecer scripts claros y predecibles, por ejemplo:

```text
npm run lint
npm run format
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

También podrá existir un comando agregado como:

```text
npm run check
```

para ejecutar los chequeos rápidos principales:

- lint;
- typecheck;
- tests unitarios.

### Chequeos rápidos y completos

Se distinguirá entre:

```text
Chequeos rápidos
→ lint
→ typecheck
→ unit tests
```

y:

```text
Chequeos completos
→ Playwright
→ build
```

### Excepciones

Se evitará utilizar sin justificación:

- `eslint-disable`;
- `@ts-ignore`;
- mecanismos equivalentes para ocultar errores.

Si una excepción fuera necesaria, deberá existir una razón concreta y documentable.

### Git hooks

No se incorporará Husky ni otro sistema de hooks al inicio.

Primero se priorizará que los comandos de calidad funcionen de manera confiable y puedan integrarse posteriormente al harness y a CI.

### Estado

**Aprobado**
