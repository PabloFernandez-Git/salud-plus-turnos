# Conciliación con `main` — 2026-10-22

## Requisito original y desvío

El brief y plan originales se conservan intactos. La rama `ui/reusable-app-loader`
(`5e3af83`) había cambiado las cuatro descripciones a `max-w-5xl`. Esa implementación no es
la política de ancho vigente en `main` (`10f5d36`). `src/components/module-header.tsx`
aplica `max-w-3xl` de forma predeterminada y `max-w-none` con `wideDescription`.
`src/modules/patients/components/patients-screen.tsx` es el único de los cuatro que opta por
el ancho flexible. Usuarios, Especialidades y Profesionales no lo hacen. Las pruebas de cada
pantalla afirman las clases actuales.

## Decisión aprobada y justificación

PR #15 (`b066db2`) unificó el encabezado de módulos y dejó `max-w-3xl` como base. TASK-015
(PR #16, `ed3b9b1`) pidió y verificó explícitamente que la descripción de Pacientes ocupara
una línea a 1440 px si cabe, ajustara naturalmente a 390 px y que los demás encabezados no
cambiaran. Su `brief.md`, `implementation-report.md` y `review.md` documentan la excepción y
el review focal PASS. La variante hace uso del espacio disponible donde la descripción es más
larga y mantiene un ancho de lectura acotado en los otros tres módulos. El valor `max-w-5xl`
del brief original queda reemplazado, no aprobado como PASS literal.

## Evidencia reutilizada y alcance

- Pacientes: `artifacts/task015-ui-polish/{desktop-1440,mobile-390}-pacientes.png` y
  `results.json` (altura de descripción 24/72 px, sin overflow).
- Usuarios: `artifacts/task010-gestion-usuarios/{desktop-1440,mobile-390}-usuarios.png` y
  `results.json` (sin overflow).
- Especialidades y Profesionales: `artifacts/final-navigation-visual/` contiene capturas
  desktop 1440, tablet 768 y mobile 390 de ambas pantallas. Las imágenes son anteriores a
  ajustes posteriores; el `ModuleHeader` y los tests actuales confirman las clases y textos.
- Cinco archivos de tests focales de los cuatro módulos y `ModuleHeader`: 33/33 PASS el
  2026-10-22. El JSX usa `min-w-0`, flex responsive y carece de `whitespace-nowrap` en estas
  descripciones; las capturas muestran wrap natural y acciones visibles.

No hubo nueva prueba autenticada, acceso a Supabase, servidor iniciado ni cambios visuales.
El criterio histórico de commit/push queda desplazado por la instrucción actual de no hacerlo.
