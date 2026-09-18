# 9. Testing

## Decisión aprobada

**Vitest + React Testing Library + Playwright**

### Estrategia general

El proyecto utilizará una estrategia de testing basada en riesgo y comportamiento.

No se establecerá un porcentaje artificial de cobertura como objetivo principal.

La prioridad será proteger:

- reglas de negocio críticas;
- disponibilidad;
- solapamiento de turnos;
- creación, reprogramación y cancelación de turnos;
- estados del turno;
- permisos;
- aislamiento entre centros;
- validaciones importantes;
- flujos principales del usuario.

### Vitest

Vitest se utilizará principalmente para:

- lógica de negocio;
- utilidades;
- funciones puras;
- reglas de disponibilidad;
- transformaciones y validaciones auxiliares.

### React Testing Library

React Testing Library se utilizará para probar comportamiento de componentes desde la perspectiva del usuario.

Se priorizarán:

- formularios relevantes;
- estados visibles;
- interacción;
- permisos reflejados en UI;
- mensajes de error;
- comportamiento de componentes importantes.

### Playwright

Playwright se utilizará para pruebas End-to-End.

Se priorizarán flujos críticos como:

- login;
- creación de usuarios;
- registro de pacientes;
- creación de turnos;
- reprogramación;
- cancelación;
- visualización de agenda;
- acciones del profesional.

Se elige Playwright por su capacidad de crecer junto con el proyecto y por su soporte robusto para:

- múltiples navegadores;
- múltiples pestañas;
- múltiples contextos/sesiones;
- escenarios con más de un usuario;
- trazas y debugging de flujos completos.

### Cypress

Cypress fue considerado como alternativa válida.

No se adopta como herramienta E2E principal porque Playwright ofrece mayor flexibilidad para escenarios complejos y multiusuario que podrían aparecer si el producto crece.

### Base de datos y seguridad

Las reglas críticas de PostgreSQL y RLS deberán tener pruebas específicas cuando se implemente el esquema y las políticas de acceso.

### Filosofía

La regla será:

> Testeamos comportamiento importante, reglas críticas y flujos de alto riesgo; no escribimos tests solamente para aumentar coverage.

### Estado

**Aprobado**
