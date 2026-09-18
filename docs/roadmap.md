# Roadmap del producto

**Versión:** 0.3

## 1. Objetivo de este documento

Este documento reúne funcionalidades y módulos que podrían incorporarse después del MVP 1.

No representa un compromiso de implementación ni un orden definitivo.

Su propósito es:

- conservar ideas que surgieron durante la definición del producto;
- evitar incorporarlas accidentalmente al MVP 1;
- mantener visible la dirección posible de evolución;
- permitir priorizar futuras versiones a partir del uso real del producto.

La prioridad inmediata sigue siendo completar y publicar correctamente el MVP 1.

---

# 2. Principio de evolución

El producto debe crecer de forma incremental.

Cada nueva versión debería:

1. resolver un problema concreto;
2. mantener el alcance acotado;
3. poder desplegarse y probarse de manera independiente;
4. evitar incorporar complejidad anticipada;
5. respetar el aislamiento de datos entre centros.

No es necesario implementar todas las funcionalidades de este roadmap.

---

# 3. MVP 1 — Gestión operativa básica

El MVP 1 incluye:

- centros;
- usuarios y roles predefinidos;
- profesionales;
- especialidades;
- personas y pacientes registrados por centro;
- disponibilidad semanal habitual;
- turnos;
- agenda diaria, semanal y mensual;
- dashboard operativo.

El objetivo es validar el núcleo:

Profesional  
→ Disponibilidad  
→ Paciente  
→ Turno  
→ Agenda

---

# 4. Evolución de disponibilidad

Una de las primeras áreas naturales de evolución es la disponibilidad de los profesionales.

## Posibles funcionalidades

- bloqueos puntuales;
- vacaciones;
- licencias;
- feriados;
- ausencia por una fecha específica;
- disponibilidad extraordinaria;
- horarios diferentes para fechas particulares;
- distintas duraciones según especialidad;
- distintas duraciones según tipo de consulta;
- configuración temporal de horarios.

Ejemplo:

Horario habitual:

Lunes 08:00 - 12:00

Excepción:

Lunes 19/10/2026  
No atiende

O:

Lunes 19/10/2026  
14:00 - 18:00

Estas excepciones no deberían modificar permanentemente el horario habitual.

---

# 5. Evolución de turnos

Posibles mejoras sobre el módulo de turnos:

- turnos recurrentes;
- sobreturnos;
- lista de espera;
- motivos de consulta administrativos;
- tipos de turno;
- diferentes duraciones según tipo;
- prioridad del turno;
- historial detallado de reprogramaciones;
- motivo obligatorio de cancelación configurable;
- restauración o corrección de estados;
- asignación de consultorio físico o sala.

---

# 6. Comunicación con pacientes

El producto puede evolucionar hacia la automatización de comunicaciones.

## Posibles funcionalidades

- confirmación automática por email;
- recordatorios por email;
- recordatorios por WhatsApp;
- SMS;
- enlace para confirmar asistencia;
- enlace para cancelar;
- enlace para reprogramar;
- notificaciones al profesional;
- avisos de cambios de agenda.

Estas funcionalidades deberán diseñarse sin convertir la comunicación en una dependencia obligatoria para operar el sistema.

---

# 7. Reserva online para pacientes

Una futura versión podría permitir que el propio paciente solicite o reserve turnos.

Flujo posible:

Especialidad  
→ Profesional  
→ Fecha  
→ Horario disponible  
→ Datos del paciente  
→ Reserva

Posibles funcionalidades:

- página pública del centro;
- selección de especialidad;
- selección de profesional;
- selección de fecha y horario;
- identificación de pacientes existentes;
- registro de nuevos pacientes;
- confirmación de reserva;
- cancelación o reprogramación desde un enlace.

La agenda interna del centro seguirá siendo la fuente de disponibilidad.

---

# 8. Obras sociales y prepagas

En MVP 1, obra social o prepaga es únicamente un dato opcional del PacienteEnCentro.

En una versión futura podría convertirse en un módulo estructurado.

Posibles funcionalidades:

- catálogo de obras sociales y prepagas;
- planes;
- número de afiliado;
- credencial;
- vigencia;
- asociación entre profesional y cobertura aceptada;
- autorización de prácticas;
- copagos;
- validación de cobertura.

Este módulo deberá mantenerse separado de la identidad global de la Persona, ya que la información administrativa puede variar entre centros.

---

# 9. Facturación y pagos

Posible evolución administrativa:

- valor de consulta;
- señas;
- pagos;
- medios de pago;
- comprobantes;
- estado de pago;
- facturación;
- liquidaciones por profesional;
- reportes de ingresos;
- integración con proveedores externos.

No forma parte del objetivo inicial del producto.

---

# 10. Reportes y analítica

El Dashboard del MVP es operativo y se centra en el día actual.

Una futura sección de Reportes podría incluir:

- turnos por período;
- turnos por profesional;
- turnos por especialidad;
- pacientes nuevos;
- pacientes atendidos;
- cancelaciones;
- ausentismo;
- ocupación de agenda;
- horarios con mayor demanda;
- comparaciones mensuales;
- exportación de datos.

Los reportes deberían desarrollarse como un módulo separado del Dashboard.

---

# 11. Agenda avanzada

Posibles mejoras:

- drag & drop para reprogramar;
- colores configurables por profesional;
- impresión de agenda;
- exportación;
- sincronización con Google Calendar;
- sincronización con Outlook;
- vistas personalizadas;
- filtros guardados;
- agenda por sala o consultorio físico.

---

# 12. Roles y permisos avanzados

MVP 1 utiliza tres roles predefinidos:

- Administrador;
- Recepción;
- Profesional.

Una versión posterior podría incorporar:

- roles personalizados;
- permisos configurables;
- permisos por módulo;
- permisos por acción;
- múltiples administradores;
- perfiles de solo lectura;
- permisos temporales;
- auditoría de cambios de permisos.

---

# 13. Seguridad y acceso

Posibles mejoras futuras:

- autenticación de dos factores;
- inicio de sesión con Google;
- inicio de sesión con Microsoft;
- SSO;
- gestión de sesiones;
- cierre remoto de sesiones;
- políticas de contraseña;
- auditoría de accesos;
- registro de acciones sensibles.

Estas funcionalidades adquieren especial importancia antes de incorporar información clínica.

---

# 14. Experiencia multi-centro

El modelo ya permite que:

- un usuario tenga acceso a varios centros;
- un profesional trabaje en varios centros.

Posibles mejoras futuras:

- selector rápido de centro;
- recordar último centro utilizado;
- vista consolidada de agenda para un profesional que trabaja en varios centros;
- detección de conflictos de horarios entre centros;
- administración de múltiples centros por una misma organización;
- sucursales.

Una vista consolidada nunca deberá eliminar el aislamiento de los datos propios de cada centro.

---

# 15. Identidad de Persona y resolución de duplicados

El modelo Persona + PacienteEnCentro permite reutilizar una misma identidad en diferentes centros.

Posibles mejoras:

- detección avanzada de duplicados;
- revisión manual de coincidencias;
- combinación controlada de registros;
- historial de fusiones;
- corrección de identidad;
- manejo de documentos extranjeros;
- múltiples documentos por Persona.

No deben fusionarse automáticamente registros cuando exista ambigüedad.

---

# 16. Historia clínica longitudinal

Esta es una posible evolución importante del producto, pero queda explícitamente fuera del MVP 1.

La historia clínica debería asociarse conceptualmente a la Persona, no exclusivamente al registro PacienteEnCentro.

Esto permitiría que una misma Persona mantenga una historia clínica longitudinal aunque se atienda en diferentes centros.

Ejemplo:

PERSONA
│
└── HISTORIA CLÍNICA
       │
       ├── Registro clínico
       │      Profesional: Dra. Gómez
       │      Centro: Centro A
       │
       ├── Registro clínico
       │      Profesional: Dr. Pérez
       │      Centro: Centro B
       │
       └── ...

## Posibles contenidos

- antecedentes;
- diagnósticos;
- evolución;
- alergias;
- medicamentos;
- tratamientos;
- estudios;
- archivos;
- recetas;
- indicaciones.

---

# 17. Acceso compartido a información clínica

La existencia de una historia clínica longitudinal no significa que cualquier profesional pueda consultarla.

Una futura versión deberá diseñar explícitamente:

- consentimiento del paciente;
- qué profesionales pueden consultar;
- qué centros pueden consultar;
- qué información puede editarse;
- quién creó cada registro;
- trazabilidad de modificaciones;
- auditoría de accesos;
- revocación de permisos;
- acceso de emergencia, si alguna vez se incorpora.

Cada registro clínico debería conservar al menos:

- Persona;
- profesional autor;
- centro de origen;
- fecha y hora;
- contenido;
- historial de cambios cuando corresponda.

La privacidad y seguridad serán requisitos centrales antes de implementar este módulo.

---

# 18. Portal del paciente

Una futura experiencia para pacientes podría permitir:

- consultar próximos turnos;
- consultar historial de turnos;
- cancelar;
- reprogramar;
- actualizar determinados datos de contacto;
- gestionar autorizaciones;
- consultar documentos compartidos;
- acceder a información clínica autorizada.

Este portal deberá tener su propio modelo de autenticación y permisos.

---

# 19. Módulos específicos por especialidad

A largo plazo podrían evaluarse módulos específicos según el tipo de centro.

Ejemplos:

- odontología;
- kinesiología;
- nutrición;
- salud ocupacional;
- ART;
- estudios diagnósticos.

Estos módulos no deberían incorporarse al núcleo general hasta existir una necesidad concreta.

---

# 20. Criterio para elegir la próxima versión

Una vez publicado MVP 1, la siguiente versión no se seleccionará únicamente por cantidad de ideas disponibles.

La prioridad debería considerar:

1. problemas encontrados durante el uso real;
2. funcionalidades solicitadas con mayor frecuencia;
3. impacto para el usuario;
4. complejidad de implementación;
5. riesgos técnicos;
6. riesgos de privacidad o seguridad;
7. valor que aporta al portfolio y al aprendizaje del proyecto.

El roadmap es una guía de posibilidades, no una lista obligatoria de tareas.
