# 21. Playwright

## ¿Qué es?

Playwright es una herramienta de testing End-to-End y automatización de navegador.

Permite probar la aplicación completa:

```text
Browser
→ React
→ Next.js
→ Supabase Auth
→ PostgreSQL
```

## ¿Por qué lo elegimos?

El MVP podría cubrirse también con Cypress, pero Playwright ofrece una base más flexible para escenarios que pueden aparecer a medida que el proyecto crezca.

Entre sus capacidades útiles para el futuro:

- múltiples navegadores;
- múltiples pestañas;
- múltiples BrowserContexts;
- sesiones independientes;
- escenarios con distintos usuarios;
- trazas detalladas para debugging.

Esto puede ser útil en un sistema multi-centro y con varios roles.

Ejemplo futuro:

```text
Administrador
→ crea un usuario

Recepción
→ inicia sesión en otro contexto
→ crea un turno

Profesional
→ inicia sesión en otro contexto
→ verifica su agenda
```

## ¿Por qué no Cypress?

Cypress es una alternativa válida y podría resolver perfectamente el MVP.

Sin embargo, se decidió priorizar Playwright porque su modelo de automatización del navegador ofrece más flexibilidad si el producto evoluciona hacia escenarios multiusuario o de navegación más compleja.
