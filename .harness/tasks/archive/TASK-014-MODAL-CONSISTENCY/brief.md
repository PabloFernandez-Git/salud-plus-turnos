# TASK-014 — Consistencia de modales de usuarios y registro de pacientes

## Objetivo

Renombrar el disparador de Gestión de usuarios a «Administrar acceso» y presentar Registrar paciente como modal centrado, conservando el contenido y las operaciones del registro.

## Criterios de aceptación

- Botón de tabla «Administrar acceso» con estilo secundario y sin desbordamiento desktop/mobile.
- Sólo Registrar paciente usa tarjeta modal centrada, fondo oscurecido, ancho cómodo, alto máximo y scroll interno; Administración de pacientes conserva su panel actual.
- X, fondo y Escape cierran sin cambios; con datos sin guardar solicitan descarte; continuar conserva los datos; pending bloquea cierre. Cualquier Cancelar existente comparte esta protección.
- Foco inicial dentro, Tab/Shift+Tab contenidos, foco restaurado al disparador, diálogo semántico.
- Resolve, create/link/reactivate, validaciones y mensajes sin cambios; pruebas locales afectadas y Chromium a 1440/390 px con capturas.

## Riesgos e impacto

- `PatientDialog` es compartido: la nueva presentación y guard deben activarse sólo para Registration.
- El formulario por etapas puede exceder el viewport: scroll interno, foco y pending requieren verificación real.
- No se alteran contratos, Auth/RLS/RPC/PostgreSQL, permisos, reglas, otras pantallas, Harness, Supabase DEV/PROD ni se realiza commit/push/merge.
