# 40. Node.js, pnpm, package.json y lockfile

Esta sección explica cómo se relacionan las herramientas básicas que permiten ejecutar e instalar el proyecto.

---

## 40.1. Node.js

Node.js es el runtime que permite ejecutar JavaScript y TypeScript fuera del navegador.

En este proyecto se utiliza para:

```text
Next.js
scripts
tests
build
herramientas
bootstrap del harness
```

Utilizaremos:

```text
Node.js 24 LTS
```

### ¿Por qué LTS?

LTS significa **Long Term Support**.

Una rama LTS prioriza estabilidad y mantenimiento prolongado.

Para una aplicación real nos interesa más:

```text
estabilidad
compatibilidad
soporte
```

que adoptar inmediatamente una versión Current recién publicada.

---

## 40.2. `.nvmrc`

El archivo:

```text
.nvmrc
```

sirve para indicar qué versión principal de Node espera el proyecto.

Contenido previsto:

```text
24
```

Herramientas compatibles pueden leerlo para seleccionar automáticamente Node 24.

---

## 40.3. `package.json`

`package.json` es uno de los archivos centrales de un proyecto Node.

Entre otras cosas define:

```text
nombre del proyecto
scripts
dependencias
devDependencies
versión de Node esperada
package manager esperado
```

Ejemplo conceptual:

```json
{
  "engines": {
    "node": ">=24 <25"
  },
  "packageManager": "pnpm@11.26.0",
  "scripts": {
    "dev": "...",
    "check": "...",
    "verify": "..."
  }
}
```

---

## 40.4. ¿Qué es un package manager?

El package manager administra librerías externas.

Por ejemplo:

```text
Next.js
Zod
Vitest
Supabase
Playwright
```

En lugar de descargar y organizar manualmente cada librería, usamos:

```text
pnpm
```

---

## 40.5. ¿Por qué pnpm?

pnpm cumple el mismo rol general que npm, pero tiene algunas propiedades útiles:

```text
instalación eficiente
almacenamiento compartido
resolución estricta de dependencias
lockfile reproducible
```

También es ampliamente compatible con Next.js y Vercel.

No elegimos pnpm porque npm sea malo.

Lo elegimos porque queremos que el proyecto tenga una herramienta consistente y moderna para instalaciones y scripts.

---

## 40.6. ¿Qué significa "más estricto"?

Un proyecto puede terminar utilizando por accidente una librería que llegó de forma transitiva a través de otra dependencia.

Eso puede funcionar hoy y romperse mañana cuando la dependencia indirecta cambie.

pnpm ayuda a reducir ese tipo de acoplamiento accidental.

La idea es:

```text
si usamos una dependencia directamente
→ debe estar declarada directamente
```

---

## 40.7. Versión de pnpm

No queremos que cada máquina utilice una versión diferente de pnpm.

Por eso `package.json` incluirá:

```text
packageManager
```

con una versión exacta.

Ejemplo:

```json
{
  "packageManager": "pnpm@11.26.0"
}
```

El patch exacto quedó definido en TASK-001: `11.26.0`.

La política es:

```text
Node
→ fijar major LTS

pnpm
→ fijar versión exacta
```

---

## 40.8. ¿Por qué Node major y pnpm exacto?

En Node queremos recibir:

```text
patches de seguridad
correcciones compatibles
```

dentro de la rama 24.

Por eso fijamos:

```text
>=24 <25
```

En pnpm, en cambio, queremos que:

```text
máquina local
CI
Vercel
agentes
```

utilicen exactamente la misma versión de la herramienta que resuelve dependencias.

---

## 40.9. `pnpm-lock.yaml`

Supongamos que `package.json` permite una familia de versiones:

```json
{
  "dependencies": {
    "zod": "^4.0.0"
  }
}
```

Eso no representa necesariamente una única versión exacta de todo el árbol de dependencias.

El lockfile:

```text
pnpm-lock.yaml
```

registra qué versiones fueron realmente resueltas.

Por eso se versiona en Git.

Modelo mental:

```text
package.json
→ qué dependencias queremos

pnpm-lock.yaml
→ exactamente qué árbol instalamos
```

---

## 40.10. ¿Por qué versionar el lockfile?

Para que diferentes entornos no resuelvan dependencias distintas.

```text
Pablo
↓
mismo lockfile

Codex
↓
mismo lockfile

GitHub Actions
↓
mismo lockfile

Vercel
↓
mismo lockfile
```

Esto mejora la reproducibilidad.

---

## 40.11. `--frozen-lockfile`

En CI usaremos conceptualmente:

```bash
pnpm install --frozen-lockfile
```

Eso significa:

> No cambies el lockfile durante la instalación.

Si alguien modifica `package.json` pero olvida actualizar `pnpm-lock.yaml`, CI falla.

Eso es mejor que permitir que CI resuelva una combinación diferente silenciosamente.

---

## 40.12. Scripts

Los scripts seguirán definidos dentro de `package.json`.

Ejemplo conceptual:

```json
{
  "scripts": {
    "dev": "...",
    "lint": "...",
    "typecheck": "...",
    "test": "...",
    "check": "...",
    "verify": "...",
    "build": "...",
    "bootstrap": "node scripts/bootstrap.mjs"
  }
}
```

Con pnpm se ejecutan así:

```text
pnpm dev
pnpm check
pnpm verify
pnpm bootstrap
```

---

## 40.13. Relación con CI

GitHub Actions seguirá aproximadamente este flujo:

```text
checkout
↓
Node 24
↓
pnpm fijado
↓
pnpm install --frozen-lockfile
↓
pnpm check
↓
pnpm build
```

Cuando incorporemos más verificaciones, se agregan sobre esta base.

---

## 40.14. Relación con Vercel

Vercel deberá construir el proyecto utilizando:

```text
Node 24
pnpm fijado
pnpm-lock.yaml
```

Así evitamos que producción se construya con una configuración diferente de la utilizada en desarrollo y CI.

---

## 40.15. Relación con el Agent Harness

Antes de una tarea, `bootstrap.mjs` podrá comprobar:

```text
Node major = 24
pnpm disponible
versión pnpm correcta
lockfile presente
dependencias instaladas
```

Si algo no coincide, el agente debe reportarlo en lugar de cambiar versiones arbitrariamente.

---

## 40.16. Actualizaciones de tooling

No queremos este comportamiento:

```text
Tarea:
crear pantalla de pacientes

Agente:
"ya que estaba actualicé Node y pnpm"
```

Eso introduce riesgos no relacionados con la tarea.

La regla será:

```text
Upgrade Node
→ tarea específica

Upgrade pnpm
→ tarea específica

Upgrade importante de tooling
→ tarea específica
```

con:

```text
review
tests
CI
```

---

## 40.17. Resumen mental

```text
Node.js
→ ejecuta el proyecto

pnpm
→ administra dependencias y scripts

package.json
→ declara dependencias, scripts y herramientas esperadas

pnpm-lock.yaml
→ fija exactamente el árbol instalado

.nvmrc
→ indica Node 24

CI
→ verifica que todo sea reproducible
```

La decisión final es:

```text
Node.js 24 LTS
+
pnpm 11 estable fijado
+
pnpm-lock.yaml versionado
+
instalación congelada en CI
```

Esto nos da una base simple, moderna y reproducible.
