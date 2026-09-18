# Tooling base: Node.js y pnpm

## Propósito

Referencia rápida sobre el entorno base del proyecto.

## Runtime

```text
Node.js 24 LTS
```

Se utilizará para:

```text
Next.js
scripts
tests
builds
bootstrap del harness
```

## Package manager

```text
pnpm
```

La versión exacta fijada al crear el repositorio es `pnpm 11.26.0`.

## Archivos importantes

```text
.nvmrc
→ Node 24

package.json
→ scripts, dependencias, engines y versión de pnpm

pnpm-lock.yaml
→ árbol exacto de dependencias
```

## Política

```text
Node
→ major 24

pnpm
→ versión exacta

lockfile
→ versionado en Git
```

## CI

```text
Node 24
↓
pnpm fijado
↓
pnpm install --frozen-lockfile
↓
checks
↓
build
```

## Harness

`bootstrap.mjs` podrá validar el entorno.

Node o pnpm no se actualizan incidentalmente durante otra tarea.

## Regla mental

```text
Node ejecuta
pnpm instala
package.json declara
lockfile fija
CI verifica
```
