# Retrospective — TASK-002

## Resultado

TASK-002 produjo un spike aislado y reproducible de React Big Calendar para Día, Semana y Mes. El
Reviewer emitió `PASS`, la evidencia visual fue revisada manualmente y la decisión humana posterior
adoptó React Big Calendar como librería base de la agenda para el MVP.

El cierre no convierte la ruta experimental en implementación productiva ni modifica el alcance
funcional del MVP.

## Qué funcionó

- Mantener el spike aislado, con datos locales y fecha fija, permitió reproducir interacciones,
  geometría y capturas sin depender de backend, autenticación, reloj o red.
- Separar mocks, configuración, controles, presentación y composición evitó que la página de Next.js
  concentrara el experimento y expuso con claridad el costo real de integración.
- La combinación de tests unitarios para comportamiento determinista y Playwright para geometría,
  overflow e interacciones reales evitó conclusiones falsas basadas en JSDOM.
- La matriz completa de criterios y las nueve capturas hicieron visible que una tarea puede cerrar con
  `PASS` aunque el candidato tenga aspectos `PARTIAL`: el objetivo del spike era producir evidencia
  suficiente para decidir, no demostrar perfección.
- La review independiente corrigió una evaluación demasiado optimista del Implementer sobre la
  legibilidad de simultáneos sin invalidar el valor del experimento.

## Fricciones y aprendizajes

- El modelo de recursos de React Big Calendar no sirve con la misma configuración para las jerarquías
  requeridas en Día y Semana. Activar recursos sólo en Día y desactivarlos en Semana es una
  adaptación explícita de severidad media que la implementación productiva deberá conservar visible.
- La librería no ofrece responsive suficiente por sí sola. Un ancho mínimo con scroll horizontal
  mantiene la agenda operable a 375 px y 768 px, pero no equivale a mostrar todo el período ni a una
  experiencia mobile nativa.
- Los simultáneos quedan correctamente posicionados y diferenciados, pero un nombre puede truncarse
  incluso en desktop. Color y texto parcial ayudan a identificar, aunque no satisfacen por completo
  el criterio de legibilidad; por eso Semana quedó `PARTIAL`.
- Mes se adapta bien mediante un encabezado de fecha personalizado y sin eventos horarios, con poco
  código puente. Es un punto de extensión soportado, no un hack de layout.
- React Big Calendar 1.20.0 funciona con el stack actual, pero depende de tipos comunitarios 1.16.3 y
  arrastra adaptadores transitivos no usados. Las futuras actualizaciones requieren repetir peers,
  tipos, tests E2E y build.
- Next.js 16 necesitó que Playwright usara `localhost` para evitar problemas de hidratación por origen,
  y `agentRules: false` evitó mutaciones automáticas de `AGENTS.md` durante el servidor de desarrollo.
- Las evidencias generadas por E2E deben apuntar al archivo de la tarea después del cierre; de lo
  contrario, una ejecución futura recrea accidentalmente `tasks/active/TASK-002`.

## Decisión resultante

- React Big Calendar queda adoptado como base de la agenda para el MVP.
- El enfoque será desktop-first, con scroll horizontal aceptado en anchos menores cuando la densidad
  lo requiera.
- Se aceptan el truncamiento parcial bajo simultaneidad y la configuración diferente de recursos para
  Día y Semana.
- La implementación productiva queda para una tarea posterior y deberá incorporar datos, permisos y
  reglas del dominio de forma deliberada.

## Cierre

- Review independiente: PASS.
- Revisión visual humana: completada.
- Limitaciones aceptadas: legibilidad parcial de simultáneos, scroll horizontal en 375/768 px y
  configuración distinta del modelo de recursos por vista.
- Costo técnico a monitorear: mantenimiento de tipos comunitarios, CSS externo y dependencias
  transitivas.
- Bloqueos: ninguno.
- Estado final: CLOSED.
