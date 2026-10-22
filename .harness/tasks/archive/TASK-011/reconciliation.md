# Conciliación con `main` — 2026-10-22

## Requisito original y decisión posterior

El brief y el plan originales se conservan intactos. La rama `ui/reusable-app-loader`
(`e2716bc`) implementó el orden eyebrow → título → centro → descripción. La unificación visual
posterior integrada en `main` por PR #15 (`b066db2`) lo sustituyó por breadcrumb → título →
descripción en `src/components/module-header.tsx`; el centro se muestra en el layout compartido.
Esa decisión se documenta en `docs/modules/dashboard.md`. El review histórico describe su
estado de entonces y no prueba el orden vigente.

## Cobertura vigente

- Pacientes, Especialidades y Profesionales mantienen las descripciones solicitadas en sus
  respectivos `*-screen.tsx` y aserciones de texto en los tests de componente.
- `ModuleHeader` aplica tipografía, tamaño, color, line-height y separación comunes. Usuarios
  usa el mismo componente. TASK-015 aprobó un ancho flexible sólo para Pacientes; ver TASK-012.
- Capturas reutilizadas: `artifacts/task015-ui-polish/{desktop-1440,mobile-390}-pacientes.png`,
  `artifacts/final-navigation-visual/{desktop,mobile}-{specialties,professionals}.png`. Las
  últimas preceden ajustes posteriores; el JSX y los tests actuales confirman el encabezado.
- Cinco archivos de tests focales del encabezado y pantallas: 33/33 PASS el 2026-10-22. No se
  levantó servidor ni se repitió validación remota o navegación autenticada.

El objetivo de explicación y orientación está cubierto. Los criterios antiguos de orden y
ancho uniforme quedan reemplazados expresamente, sin presentarlos como PASS.
