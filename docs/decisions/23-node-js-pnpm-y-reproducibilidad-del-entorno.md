# 23. Node.js, pnpm y reproducibilidad del entorno

## Decisión aprobada

El proyecto utilizará:

```text
Runtime
→ Node.js 24 LTS

Package manager
→ pnpm

pnpm
→ major 11 estable al crear el repositorio
→ versión exacta fijada en package.json

Node
→ major 24 declarado en .nvmrc y package.json

Lockfile
→ pnpm-lock.yaml versionado en Git
```

## Objetivo de la decisión

Queremos que:

```text
máquina local
Codex
GitHub Actions
Vercel
```

trabajen con un entorno lo más consistente posible.

La intención es reducir diferencias del tipo:

> "En mi máquina funciona, pero en CI no."

## Node.js

Node.js será el runtime principal para:

- ejecutar Next.js en desarrollo y servidor;
- correr scripts;
- ejecutar tests;
- realizar builds;
- ejecutar herramientas del proyecto;
- correr el bootstrap del harness.

Se utilizará **Node.js 24 LTS**.

Elegimos una versión LTS en lugar de una rama Current porque priorizamos:

- estabilidad;
- soporte prolongado;
- compatibilidad con herramientas;
- menor probabilidad de introducir cambios recientes innecesarios.

## Fijación de versión de Node

El major de Node quedará declarado explícitamente.

Ejemplo:

```text
.nvmrc
```

```text
24
```

Y también en `package.json`:

```json
{
  "engines": {
    "node": ">=24 <25"
  }
}
```

La idea es fijar el major LTS, permitiendo patches y actualizaciones menores compatibles dentro de Node 24.

No se fijará de forma permanente una versión patch específica salvo que aparezca una necesidad concreta.

## pnpm

`pnpm` será el package manager oficial.

Se utilizará para:

- instalar dependencias;
- ejecutar scripts del proyecto;
- mantener el lockfile;
- reproducir instalaciones en CI y Vercel.

Ejemplos:

```text
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm verify
```

## ¿Por qué pnpm?

Elegimos pnpm por:

- velocidad;
- eficiencia de almacenamiento;
- lockfile determinista;
- modelo de dependencias más estricto;
- buen soporte en el ecosistema Next.js;
- buena integración con CI y Vercel.

La elección no implica que npm sea insuficiente.

La decisión busca una base consistente y moderna para este proyecto.

## Versión de pnpm

No se utilizará automáticamente "la última versión disponible".

En TASK-001 se fijó **pnpm 11.26.0**, versión estable de la rama 11 al crear el repositorio.

Ejemplo conceptual:

```json
{
  "packageManager": "pnpm@11.26.0"
}
```

El valor exacto quedó fijado en TASK-001: `pnpm@11.26.0`.

La versión de pnpm no se actualizará incidentalmente durante otra tarea.

Una actualización de tooling deberá ser una tarea explícita.

## Lockfile

`pnpm-lock.yaml` se versionará en Git.

Su función es registrar el árbol exacto de dependencias resuelto por pnpm.

Eso permite que:

```text
Pablo
Codex
CI
Vercel
```

instalen el mismo conjunto de dependencias.

## Instalación reproducible en CI

En CI se utilizará una instalación con lockfile congelado:

```text
pnpm install --frozen-lockfile
```

Si `package.json` y `pnpm-lock.yaml` no coinciden, CI deberá fallar en lugar de modificar el lockfile silenciosamente.

## Relación con scripts

Los scripts definidos en `package.json` podrán ejecutarse como:

```text
pnpm bootstrap
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm check
pnpm verify
pnpm build
```

Esto reemplaza los ejemplos previos escritos como `npm run ...`.

La lógica de los scripts no cambia.

## Relación con el harness

`bootstrap.mjs` podrá comprobar:

- versión major de Node;
- presencia y versión de pnpm;
- existencia del lockfile;
- instalación de dependencias;
- coherencia básica del entorno.

El harness deberá tratar cambios de Node o pnpm como cambios de tooling deliberados.

## Regla final

> Las versiones de Node.js y pnpm forman parte del contrato del proyecto y no deben cambiarse como efecto secundario de otra tarea.

## Estado

**Aprobado**
